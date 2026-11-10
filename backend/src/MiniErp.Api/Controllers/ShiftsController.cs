using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

[ApiController]
[Route("api/shifts")]
public class ShiftsController(AppDbContext db, TenantContext tenant) : ControllerBase
{
    // ---------- Vardiya tanımları ----------
    [HttpGet("templates")]
    public async Task<IReadOnlyList<ShiftTemplateDto>> Templates(CancellationToken ct) =>
        await db.ShiftTemplates.AsNoTracking()
            .OrderBy(s => s.StartTime)
            .Select(s => new ShiftTemplateDto(s.Id, s.Name, s.StartTime, s.EndTime, s.BreakMinutes, s.Color))
            .ToListAsync(ct);

    [HttpPost("templates")]
    public async Task<ShiftTemplateDto> CreateTemplate(ShiftTemplateRequest request, CancellationToken ct)
    {
        var template = new ShiftTemplate { CompanyId = tenant.CompanyId };
        Apply(template, request);
        db.ShiftTemplates.Add(template);
        await db.SaveChangesAsync(ct);
        return ToDto(template);
    }

    [HttpPut("templates/{id:guid}")]
    public async Task<ActionResult<ShiftTemplateDto>> UpdateTemplate(Guid id, ShiftTemplateRequest request, CancellationToken ct)
    {
        var template = await db.ShiftTemplates.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (template is null) return NotFound();
        Apply(template, request);
        await db.SaveChangesAsync(ct);
        return ToDto(template);
    }

    [HttpDelete("templates/{id:guid}")]
    public async Task<IActionResult> DeleteTemplate(Guid id, CancellationToken ct)
    {
        var template = await db.ShiftTemplates.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (template is null) return NotFound();
        var used = await db.ShiftAssignments.CountAsync(a => a.ShiftTemplateId == id, ct);
        if (used > 0) throw new AppValidationException($"Bu vardiya {used} planda kullanılıyor; önce o planları silin ya da değiştirin.");
        db.ShiftTemplates.Remove(template);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------- Vardiya planı ----------
    /// <summary>Tarih aralığındaki vardiya planı (gerçekleşen saatlerle birlikte).</summary>
    [HttpGet("assignments")]
    public async Task<ActionResult<IReadOnlyList<ShiftAssignmentDto>>> Assignments(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > 62) return BadRequest("Tarih aralığı en fazla 62 gün olabilir.");

        return await db.ShiftAssignments.AsNoTracking()
            .Where(a => a.Date >= from && a.Date <= to)
            .Select(a => new ShiftAssignmentDto(a.Id, a.EmployeeId, a.ShiftTemplateId, a.Date, a.Status, a.Note,
                a.TimeEntry != null ? a.TimeEntry.WorkedHours : null,
                a.TimeEntry != null ? a.TimeEntry.OvertimeHours : null))
            .ToListAsync(ct);
    }

    [HttpPost("assignments")]
    public async Task<IActionResult> CreateAssignment(ShiftAssignmentRequest request, CancellationToken ct)
    {
        await ValidateAsync(request, ct);
        db.ShiftAssignments.Add(new ShiftAssignment
        {
            CompanyId = tenant.CompanyId, EmployeeId = request.EmployeeId, ShiftTemplateId = request.ShiftTemplateId,
            Date = request.Date, Status = request.Status, Note = Text.NullIfEmpty(request.Note),
        });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("assignments/{id:guid}")]
    public async Task<IActionResult> UpdateAssignment(Guid id, ShiftAssignmentRequest request, CancellationToken ct)
    {
        var a = await db.ShiftAssignments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();
        await ValidateAsync(request, ct);
        a.EmployeeId = request.EmployeeId;
        a.ShiftTemplateId = request.ShiftTemplateId;
        a.Date = request.Date;
        a.Status = request.Status;
        a.Note = Text.NullIfEmpty(request.Note);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("assignments/{id:guid}")]
    public async Task<IActionResult> DeleteAssignment(Guid id, CancellationToken ct)
    {
        var a = await db.ShiftAssignments.Include(x => x.TimeEntry).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();
        if (a.TimeEntry != null) a.TimeEntry.ShiftAssignmentId = null; // mesai kaydı kalır, plan bağlantısı kopar
        db.ShiftAssignments.Remove(a);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task ValidateAsync(ShiftAssignmentRequest r, CancellationToken ct)
    {
        var errors = new List<string>();
        if (!await db.Employees.AnyAsync(e => e.Id == r.EmployeeId, ct)) errors.Add("Çalışan bulunamadı.");
        if (!await db.ShiftTemplates.AnyAsync(s => s.Id == r.ShiftTemplateId, ct)) errors.Add("Vardiya tanımı bulunamadı.");
        AppValidationException.ThrowIfAny(errors);
    }

    private static void Apply(ShiftTemplate t, ShiftTemplateRequest r)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(r.Name)) errors.Add("Vardiya adı boş olamaz.");
        if (!Text.TryParseTime(r.StartTime, out var start)) errors.Add("Başlangıç saati geçersiz (ör. 08:00).");
        if (!Text.TryParseTime(r.EndTime, out var end)) errors.Add("Bitiş saati geçersiz (ör. 16:00).");
        if (r.BreakMinutes is < 0 or > 240) errors.Add("Mola 0–240 dakika olmalı.");
        AppValidationException.ThrowIfAny(errors);

        t.Name = r.Name.Trim();
        t.StartTime = start;
        t.EndTime = end;
        t.CrossesMidnight = end <= start;
        t.BreakMinutes = r.BreakMinutes;
        t.Color = Text.NullIfEmpty(r.Color);
    }

    private static ShiftTemplateDto ToDto(ShiftTemplate s) => new(s.Id, s.Name, s.StartTime, s.EndTime, s.BreakMinutes, s.Color);
}
