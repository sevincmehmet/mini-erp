using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

/// <summary>
/// Dikkat: Hiçbir sorguda CompanyId filtresi yazılmıyor — global query filter
/// ve TenantSaveChangesInterceptor bunu otomatik ve unutulamaz şekilde yapıyor.
/// </summary>
[ApiController]
[Route("api/employees")]
public class EmployeesController(AppDbContext db, TenantContext tenant) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<EmployeeDto>> GetAll(CancellationToken ct) =>
        (await db.Employees.AsNoTracking().OrderBy(e => e.FirstName).ThenBy(e => e.LastName).ToListAsync(ct))
        .Select(ToDto).ToList();

    [HttpPost]
    public async Task<EmployeeDto> Create(EmployeeRequest request, CancellationToken ct)
    {
        var employee = new Employee { CompanyId = tenant.CompanyId };
        Apply(employee, request);
        db.Employees.Add(employee);
        await db.SaveChangesAsync(ct);
        return ToDto(employee);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EmployeeDto>> Update(Guid id, EmployeeRequest request, CancellationToken ct)
    {
        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (employee is null) return NotFound(); // başka şirketin kaydı da "yok" görünür
        Apply(employee, request);
        await db.SaveChangesAsync(ct);
        return ToDto(employee);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (employee is null) return NotFound();
        if (await db.Payrolls.AnyAsync(p => p.EmployeeId == id && p.Status != PayrollStatus.Draft, ct))
            throw new AppValidationException("Bu çalışanın onaylı bordrosu var; silmek yerine \"Pasif\" yapın.");
        db.Employees.Remove(employee); // interceptor soft delete'e çevirir
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static void Apply(Employee e, EmployeeRequest r)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(r.FirstName)) errors.Add("Ad boş olamaz.");
        if (string.IsNullOrWhiteSpace(r.LastName)) errors.Add("Soyad boş olamaz.");
        if (r.PayType == PayType.Monthly && r.BaseSalary <= 0) errors.Add("Aylık ücretli için brüt maaş girin.");
        if (r.PayType == PayType.Hourly && r.HourlyRate is null or <= 0) errors.Add("Saatlik ücretli için saat ücreti girin.");
        if (r.BaseSalary < 0 || r.HourlyRate < 0) errors.Add("Ücret negatif olamaz.");
        if (r.OvertimeMultiplier is < 1 or > 5) errors.Add("Fazla mesai katsayısı 1 ile 5 arasında olmalı.");
        if (r.NationalId is { Length: > 0 } tc && (tc.Length != 11 || !tc.All(char.IsDigit))) errors.Add("TC kimlik no 11 haneli olmalı.");
        if (r.TerminationDate < r.HireDate) errors.Add("İşten çıkış tarihi işe girişten önce olamaz.");
        AppValidationException.ThrowIfAny(errors);

        e.FirstName = r.FirstName.Trim();
        e.LastName = r.LastName.Trim();
        e.EmployeeNumber = Text.NullIfEmpty(r.EmployeeNumber);
        e.NationalId = Text.NullIfEmpty(r.NationalId);
        e.Position = Text.NullIfEmpty(r.Position);
        e.Phone = Text.NullIfEmpty(r.Phone);
        e.HireDate = r.HireDate;
        e.TerminationDate = r.TerminationDate;
        e.IsActive = r.IsActive;
        e.PayType = r.PayType;
        e.BaseSalary = r.BaseSalary;
        e.HourlyRate = r.HourlyRate;
        e.OvertimeMultiplier = r.OvertimeMultiplier;
        e.MonthlyStandardHours = r.MonthlyStandardHours <= 0 ? 225 : r.MonthlyStandardHours;
    }

    private static EmployeeDto ToDto(Employee e) => new(
        e.Id, e.EmployeeNumber, e.FirstName, e.LastName, e.NationalId, e.Position, e.Phone, e.HireDate, e.TerminationDate,
        e.IsActive, e.PayType, e.BaseSalary, e.HourlyRate, e.OvertimeMultiplier, e.MonthlyStandardHours);
}
