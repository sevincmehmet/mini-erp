using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Api.Services;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

[ApiController]
[Route("api/payrolls")]
public class PayrollsController(AppDbContext db, PayrollService service) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<PayrollDto>> Get([FromQuery] int year, [FromQuery] int month, CancellationToken ct) =>
        await db.Payrolls.AsNoTracking()
            .Where(p => p.Year == year && p.Month == month)
            .OrderBy(p => p.Employee.FirstName).ThenBy(p => p.Employee.LastName)
            .Select(p => new PayrollDto(p.Id, p.EmployeeId, p.Employee.FirstName + " " + p.Employee.LastName,
                p.Employee.Position, p.Employee.NationalId, p.Employee.EmployeeNumber, p.Year, p.Month, p.WorkedDays, p.RegularHours, p.OvertimeHours,
                p.BasePay, p.OvertimePay, p.Bonus, p.SgkEmployee, p.UnemploymentEmployee, p.IncomeTax, p.IncomeTaxExemption, p.StampTax, p.StampTaxExemption,
                p.Deductions, p.GrossPay, p.NetPay, p.EmployerSgk, p.EmployerUnemployment, p.EmployerCost, p.Status, p.PaidAt))
            .ToListAsync(ct);

    /// <summary>Ayın mesai kayıtlarından taslak bordroları (yeniden) hesaplar. Onaylılara dokunmaz.</summary>
    [HttpPost("calculate")]
    public Task<BulkResult> Calculate(PeriodRequest request, CancellationToken ct) => service.CalculateAsync(request.Year, request.Month, ct);

    // ---------- Yıllık bordro parametreleri
    [HttpGet("settings/{year:int}")]
    public async Task<PayrollSettingsDto> GetSettings(int year, [FromServices] PayrollSettingsService settings, CancellationToken ct) =>
        PayrollSettingsService.ToDto(await settings.GetAsync(year, ct));

    [HttpPut("settings/{year:int}")]
    [MiniErp.Api.Auth.RequireOwner]
    public async Task<PayrollSettingsDto> SaveSettings(int year, PayrollSettingsDto request, [FromServices] PayrollSettingsService settings, CancellationToken ct) =>
        PayrollSettingsService.ToDto(await settings.SaveAsync(request with { Year = year }, ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Adjust(Guid id, PayrollAdjustRequest request, CancellationToken ct)
    {
        await service.AdjustAsync(id, request, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<BulkResult> Approve(Guid id, CancellationToken ct) => await service.ApproveAsync([await service.GetAsync(id, ct)], ct);

    [HttpPost("{id:guid}/revert")]
    public Task<BulkResult> Revert(Guid id, CancellationToken ct) => service.RevertAsync(id, ct);

    [HttpPost("{id:guid}/pay")]
    public async Task<BulkResult> Pay(Guid id, CancellationToken ct) => await service.PayAsync([await service.GetAsync(id, ct)], ct);

    [HttpPost("approve-all")]
    public async Task<BulkResult> ApproveAll(PeriodRequest request, CancellationToken ct) =>
        await service.ApproveAsync(await db.Payrolls.Where(p => p.Year == request.Year && p.Month == request.Month).ToListAsync(ct), ct);

    [HttpPost("pay-all")]
    public async Task<BulkResult> PayAll(PeriodRequest request, CancellationToken ct) =>
        await service.PayAsync(await db.Payrolls.Where(p => p.Year == request.Year && p.Month == request.Month).ToListAsync(ct), ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var payroll = await service.GetAsync(id, ct);
        if (payroll.Status != PayrollStatus.Draft) throw new AppValidationException("Yalnızca taslak bordro silinebilir.");
        db.Payrolls.Remove(payroll);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
