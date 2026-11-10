using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

/// <summary>Puantaj: gerçekleşen giriş/çıkış kayıtları. Saatler ve fazla mesai sunucuda hesaplanır.</summary>
[ApiController]
[Route("api/time-entries")]
public class TimeEntriesController(AppDbContext db, TimeEntryService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TimeEntryDto>>> Get(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] Guid? employeeId, CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > 92) return BadRequest("Tarih aralığı en fazla 92 gün olabilir.");
        var start = from.ToDateTime(TimeOnly.MinValue);
        var end = to.AddDays(1).ToDateTime(TimeOnly.MinValue);

        var locked = await db.Payrolls.AsNoTracking().Where(p => p.Status != PayrollStatus.Draft)
            .Select(p => new { p.EmployeeId, p.Year, p.Month }).ToListAsync(ct);
        var lockedSet = locked.Select(l => (l.EmployeeId, l.Year, l.Month)).ToHashSet();

        var rows = await db.TimeEntries.AsNoTracking()
            .Where(t => t.ClockIn >= start && t.ClockIn < end && (employeeId == null || t.EmployeeId == employeeId))
            .OrderByDescending(t => t.ClockIn)
            .Select(t => new
            {
                t.Id, t.EmployeeId, Name = t.Employee.FirstName + " " + t.Employee.LastName, t.Employee.EmployeeNumber,
                t.ClockIn, t.ClockOut, t.BreakMinutes, t.WorkedHours, t.OvertimeHours,
                Shift = t.ShiftAssignment != null ? t.ShiftAssignment.ShiftTemplate.Name : null, t.Note,
            })
            .ToListAsync(ct);

        return rows.Select(t => new TimeEntryDto(t.Id, t.EmployeeId, t.Name, t.EmployeeNumber, DateOnly.FromDateTime(t.ClockIn),
            t.ClockIn, t.ClockOut, t.BreakMinutes, t.WorkedHours, t.OvertimeHours, t.Shift, t.Note,
            lockedSet.Contains((t.EmployeeId, t.ClockIn.Year, t.ClockIn.Month)))).ToList();
    }

    [HttpPost]
    public async Task<IActionResult> Create(TimeEntryRequest request, CancellationToken ct)
    {
        var entry = new TimeEntry();
        await service.ApplyAsync(entry, request, ct);
        db.TimeEntries.Add(entry);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, TimeEntryRequest request, CancellationToken ct)
    {
        var entry = await db.TimeEntries.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (entry is null) return NotFound();
        await service.ApplyAsync(entry, request, ct);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var entry = await db.TimeEntries.Include(t => t.ShiftAssignment).FirstOrDefaultAsync(t => t.Id == id, ct);
        if (entry is null) return NotFound();
        if (TimeEntryService.LockError(await service.LockedPeriodsAsync(ct), entry.EmployeeId, entry.ClockIn) is { } error)
            throw new AppValidationException(error);
        if (entry.ShiftAssignment is { Status: ShiftStatus.Completed } a) a.Status = ShiftStatus.Planned;
        entry.ShiftAssignmentId = null;
        db.TimeEntries.Remove(entry);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
