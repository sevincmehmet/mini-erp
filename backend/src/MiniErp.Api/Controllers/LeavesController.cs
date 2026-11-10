using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record LeaveDto(Guid Id, Guid EmployeeId, string EmployeeName, LeaveKind Kind, DateOnly StartDate, DateOnly EndDate, decimal Days, LeaveStatus Status, string? Note);
public sealed record LeaveRequestBody(Guid EmployeeId, LeaveKind Kind, DateOnly StartDate, DateOnly EndDate, string? Note);
public sealed record LeaveBalanceDto(Guid EmployeeId, string EmployeeName, string? Position, DateOnly HireDate, int SeniorityYears, decimal Entitlement, decimal Used, decimal Pending, decimal Remaining);

/// <summary>
/// İzin talepleri ve yıllık izin bakiyeleri. Yıllık izin hakkı İş Kanunu md. 53'e göre kıdemle hesaplanır
/// (1–5 yıl 14, 5–15 yıl 20, 15+ yıl 26 iş günü). Resmî tatiller şimdilik düşülmez; Pazar günleri sayılmaz.
/// </summary>
[ApiController]
[Route("api/leaves")]
public class LeavesController(AppDbContext db, TenantContext tenant, TimeProvider clock) : ControllerBase
{
    public static int Entitlement(int seniorityYears) => seniorityYears < 1 ? 0 : seniorityYears < 5 ? 14 : seniorityYears < 15 ? 20 : 26;

    public static decimal WorkDays(DateOnly start, DateOnly end)
    {
        decimal n = 0;
        for (var d = start; d <= end; d = d.AddDays(1)) if (d.DayOfWeek != DayOfWeek.Sunday) n++;
        return n;
    }

    [HttpGet]
    public async Task<IReadOnlyList<LeaveDto>> Get([FromQuery] int? year, CancellationToken ct) =>
        await db.LeaveRequests.AsNoTracking()
            .Where(l => year == null || l.StartDate.Year == year || l.EndDate.Year == year)
            .OrderByDescending(l => l.StartDate)
            .Select(l => new LeaveDto(l.Id, l.EmployeeId, l.Employee.FirstName + " " + l.Employee.LastName, l.Kind, l.StartDate, l.EndDate, l.Days, l.Status, l.Note))
            .ToListAsync(ct);

    [HttpGet("balances")]
    public async Task<IReadOnlyList<LeaveBalanceDto>> Balances([FromQuery] int? year, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        var y = year is >= 2000 and <= 2100 ? year.Value : today.Year;
        var employees = await db.Employees.AsNoTracking().Where(e => e.IsActive).OrderBy(e => e.FirstName).ToListAsync(ct);
        var leaves = await db.LeaveRequests.AsNoTracking().Where(l => l.Kind == LeaveKind.Annual && l.StartDate.Year == y && l.Status != LeaveStatus.Rejected).ToListAsync(ct);
        return employees.Select(e =>
        {
            var reference = new DateOnly(y, 12, 31) < today ? new DateOnly(y, 12, 31) : today;
            var seniority = reference.Year - e.HireDate.Year - (reference < e.HireDate.AddYears(reference.Year - e.HireDate.Year) ? 1 : 0);
            var mine = leaves.Where(l => l.EmployeeId == e.Id).ToList();
            var used = mine.Where(l => l.Status == LeaveStatus.Approved).Sum(l => l.Days);
            var pending = mine.Where(l => l.Status == LeaveStatus.Requested).Sum(l => l.Days);
            var ent = Entitlement(seniority);
            return new LeaveBalanceDto(e.Id, $"{e.FirstName} {e.LastName}", e.Position, e.HireDate, Math.Max(0, seniority), ent, used, pending, ent - used);
        }).ToList();
    }

    [HttpPost]
    public async Task<IActionResult> Create(LeaveRequestBody r, CancellationToken ct)
    {
        await Validate(r, null, ct);
        db.LeaveRequests.Add(new LeaveRequest { CompanyId = tenant.CompanyId, EmployeeId = r.EmployeeId, Kind = r.Kind, StartDate = r.StartDate, EndDate = r.EndDate, Days = WorkDays(r.StartDate, r.EndDate), Note = Text.NullIfEmpty(r.Note) });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, LeaveRequestBody r, CancellationToken ct)
    {
        var l = await db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (l is null) return NotFound();
        if (l.Status == LeaveStatus.Approved) throw new AppValidationException("Onaylanmış izin değiştirilemez; önce geri alın.");
        await Validate(r, id, ct);
        l.EmployeeId = r.EmployeeId; l.Kind = r.Kind; l.StartDate = r.StartDate; l.EndDate = r.EndDate; l.Days = WorkDays(r.StartDate, r.EndDate); l.Note = Text.NullIfEmpty(r.Note);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Onay: izin günlerindeki planlı vardiyalar "İzinli" olarak işaretlenir.</summary>
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        var l = await db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (l is null) return NotFound();
        l.Status = LeaveStatus.Approved;
        var shifts = await db.ShiftAssignments.Where(a => a.EmployeeId == l.EmployeeId && a.Date >= l.StartDate && a.Date <= l.EndDate && a.Status == ShiftStatus.Planned).ToListAsync(ct);
        foreach (var a in shifts) { a.Status = ShiftStatus.Leave; a.Note = KindLabel(l.Kind); }
        await db.SaveChangesAsync(ct);
        return Ok(new { affectedShifts = shifts.Count });
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, CancellationToken ct) => await SetStatus(id, LeaveStatus.Rejected, ct);

    [HttpPost("{id:guid}/revert")]
    public async Task<IActionResult> Revert(Guid id, CancellationToken ct)
    {
        var l = await db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (l is null) return NotFound();
        if (l.Status == LeaveStatus.Approved)
        {
            var shifts = await db.ShiftAssignments.Where(a => a.EmployeeId == l.EmployeeId && a.Date >= l.StartDate && a.Date <= l.EndDate && a.Status == ShiftStatus.Leave).ToListAsync(ct);
            foreach (var a in shifts) { a.Status = ShiftStatus.Planned; a.Note = null; }
        }
        l.Status = LeaveStatus.Requested;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var l = await db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (l is null) return NotFound();
        if (l.Status == LeaveStatus.Approved) throw new AppValidationException("Onaylanmış izin silinemez; önce geri alın.");
        db.LeaveRequests.Remove(l);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<IActionResult> SetStatus(Guid id, LeaveStatus status, CancellationToken ct)
    {
        var l = await db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (l is null) return NotFound();
        l.Status = status;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task Validate(LeaveRequestBody r, Guid? id, CancellationToken ct)
    {
        var errors = new List<string>();
        if (!await db.Employees.AnyAsync(e => e.Id == r.EmployeeId, ct)) errors.Add("Çalışan bulunamadı.");
        if (r.EndDate < r.StartDate) errors.Add("Bitiş tarihi başlangıçtan önce olamaz.");
        if (r.EndDate.DayNumber - r.StartDate.DayNumber > 90) errors.Add("Tek seferde en fazla 90 günlük izin girilebilir.");
        if (await db.LeaveRequests.AnyAsync(l => l.Id != id && l.EmployeeId == r.EmployeeId && l.Status != LeaveStatus.Rejected && l.StartDate <= r.EndDate && l.EndDate >= r.StartDate, ct))
            errors.Add("Bu tarihlerde çalışanın başka bir izni var.");
        AppValidationException.ThrowIfAny(errors);
    }

    private static string KindLabel(LeaveKind k) => k switch
    {
        LeaveKind.Annual => "Yıllık izin", LeaveKind.Excuse => "Mazeret izni", LeaveKind.Sick => "Raporlu", LeaveKind.Unpaid => "Ücretsiz izin", _ => "İzin",
    };
}
