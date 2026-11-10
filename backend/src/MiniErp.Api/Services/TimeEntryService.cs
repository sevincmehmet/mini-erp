using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Services;

/// <summary>Mesai kayıtlarının saat hesabı, vardiya planıyla eşleştirilmesi ve bordro kilidi.</summary>
public sealed class TimeEntryService(AppDbContext db, TenantContext tenant)
{
    /// <summary>Planlı vardiyası olmayan günlerde fazla mesai bu saatin üstü sayılır.</summary>
    public const decimal DefaultDailyHours = 7.5m;

    public static decimal PlannedHours(ShiftTemplate t)
    {
        var span = t.EndTime.ToTimeSpan() - t.StartTime.ToTimeSpan();
        if (span <= TimeSpan.Zero) span += TimeSpan.FromHours(24);
        return (decimal)span.TotalHours - t.BreakMinutes / 60m;
    }

    public static (decimal Worked, decimal Overtime) Compute(DateTime clockIn, DateTime clockOut, int breakMinutes, decimal plannedHours)
    {
        var worked = Math.Max(0m, (decimal)(clockOut - clockIn).TotalHours - breakMinutes / 60m);
        worked = Math.Round(worked, 2);
        return (worked, Math.Round(Math.Max(0m, worked - plannedHours), 2));
    }

    /// <summary>Bordrosu onaylanmış/ödenmiş (çalışan, yıl, ay) kombinasyonları: bu aylarda mesai değiştirilemez.</summary>
    public async Task<HashSet<(Guid, int, int)>> LockedPeriodsAsync(CancellationToken ct) =>
        (await db.Payrolls.AsNoTracking()
            .Where(p => p.Status != PayrollStatus.Draft)
            .Select(p => new { p.EmployeeId, p.Year, p.Month })
            .ToListAsync(ct))
        .Select(p => (p.EmployeeId, p.Year, p.Month)).ToHashSet();

    public static string? LockError(HashSet<(Guid, int, int)> locked, Guid employeeId, DateTime when) =>
        locked.Contains((employeeId, when.Year, when.Month))
            ? $"{when:MM.yyyy} bordrosu onaylandığı için bu aya ait mesai değiştirilemez."
            : null;

    public async Task ApplyAsync(TimeEntry entry, TimeEntryRequest request, CancellationToken ct)
    {
        var errors = new List<string>();
        if (!await db.Employees.AnyAsync(e => e.Id == request.EmployeeId, ct)) errors.Add("Çalışan bulunamadı.");
        if (request.ClockOut <= request.ClockIn) errors.Add("Çıkış saati girişten sonra olmalı.");
        if ((request.ClockOut - request.ClockIn).TotalHours > 24) errors.Add("Bir mesai kaydı 24 saati geçemez.");
        if (request.BreakMinutes is < 0 or > 240) errors.Add("Mola 0–240 dakika arasında olmalı.");

        var locked = await LockedPeriodsAsync(ct);
        if (LockError(locked, request.EmployeeId, request.ClockIn) is { } lockError) errors.Add(lockError);
        if (entry.EmployeeId != Guid.Empty && LockError(locked, entry.EmployeeId, entry.ClockIn) is { } oldLock) errors.Add(oldLock);
        AppValidationException.ThrowIfAny(errors);

        // Aynı gün planlı vardiya varsa ona bağla ve "tamamlandı" yap
        var date = DateOnly.FromDateTime(request.ClockIn);
        var assignment = await db.ShiftAssignments
            .Include(a => a.ShiftTemplate)
            .Where(a => a.EmployeeId == request.EmployeeId && a.Date == date
                        && (a.TimeEntry == null || a.TimeEntry.Id == entry.Id))
            .FirstOrDefaultAsync(ct);

        var planned = assignment != null ? PlannedHours(assignment.ShiftTemplate) : DefaultDailyHours;
        var (worked, overtime) = Compute(request.ClockIn, request.ClockOut, request.BreakMinutes, planned);

        if (entry.CompanyId == Guid.Empty) entry.CompanyId = tenant.CompanyId;
        entry.EmployeeId = request.EmployeeId;
        entry.ClockIn = request.ClockIn;
        entry.ClockOut = request.ClockOut;
        entry.BreakMinutes = request.BreakMinutes;
        entry.WorkedHours = worked;
        entry.OvertimeHours = overtime;
        entry.Note = Text.NullIfEmpty(request.Note);
        entry.ShiftAssignmentId = assignment?.Id;
        if (assignment != null) assignment.Status = ShiftStatus.Completed;
    }
}
