using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Application.Payroll;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Services;

/// <summary>Bordro yaşam döngüsü: Taslak (hesapla) → Onaylandı → Ödendi (gider kaydı oluşur).</summary>
public sealed class PayrollService(AppDbContext db, TenantContext tenant, FinanceService finance, PayrollSettingsService settings, TimeProvider clock)
{

    public async Task<BulkResult> CalculateAsync(int year, int month, CancellationToken ct)
    {
        ValidatePeriod(year, month);
        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        var from = monthStart.ToDateTime(TimeOnly.MinValue);
        var to = monthStart.AddMonths(1).ToDateTime(TimeOnly.MinValue);

        var employees = await db.Employees
            .Where(e => e.HireDate <= monthEnd && (e.TerminationDate == null || e.TerminationDate >= monthStart))
            .ToListAsync(ct);
        var entries = await db.TimeEntries.AsNoTracking().Where(t => t.ClockIn >= from && t.ClockIn < to).ToListAsync(ct);
        var existing = await db.Payrolls.Where(p => p.Year == year && p.Month == month).ToListAsync(ct);
        var prior = await PriorCumulativeAsync(year, month, ct);
        var cfg = await settings.GetAsync(year, ct);

        int calculated = 0, locked = 0;
        foreach (var emp in employees)
        {
            var list = entries.Where(t => t.EmployeeId == emp.Id).ToList();
            if (list.Count == 0 && (emp.PayType == PayType.Hourly || !emp.IsActive)) continue;

            var payroll = existing.FirstOrDefault(p => p.EmployeeId == emp.Id);
            if (payroll is { Status: not PayrollStatus.Draft }) { locked++; continue; }
            if (payroll == null)
            {
                payroll = new Payroll { CompanyId = tenant.CompanyId, EmployeeId = emp.Id, Year = year, Month = month };
                db.Payrolls.Add(payroll);
            }
            Compute(payroll, emp, list, cfg, prior.GetValueOrDefault(emp.Id), null);
            calculated++;
        }

        await db.SaveChangesAsync(ct);
        var method = cfg.Method == "Statutory" ? "mevzuata göre" : "yaklaşık kesintiyle";
        var message = $"{calculated} bordro {method} hesaplandı." + (locked > 0 ? $" {locked} onaylı bordroya dokunulmadı." : "");
        return new BulkResult(calculated, message);
    }

    /// <summary>Çalışan başına, bu aydan önceki son bordronun kümülatif gelir vergisi matrahı.</summary>
    private async Task<Dictionary<Guid, decimal>> PriorCumulativeAsync(int year, int month, CancellationToken ct) =>
        (await db.Payrolls.AsNoTracking().Where(p => p.Year == year && p.Month < month)
            .Select(p => new { p.EmployeeId, p.Month, p.CumulativeTaxBase }).ToListAsync(ct))
        .GroupBy(p => p.EmployeeId).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Month).First().CumulativeTaxBase);

    /// <summary>Tek bir bordroyu hesaplar: kıst gün, temel + fazla mesai + prim, sonra kesintiler (mevzuat ya da yaklaşık).</summary>
    private static void Compute(Payroll p, Employee emp, List<TimeEntry> entries, PayrollSettings cfg, decimal priorCumulative, decimal? manualDeductions)
    {
        var days = TurkishPayroll.WorkedDays(emp.HireDate, emp.TerminationDate, p.Year, p.Month);
        var calc = PayrollCalculator.Calculate(emp, entries, p.Bonus);
        var basePay = emp.PayType == PayType.Monthly ? Math.Round(emp.BaseSalary * days / 30m, 2) : calc.BasePay;
        var gross = basePay + calc.OvertimePay + p.Bonus;

        p.WorkedDays = days;
        p.RegularHours = calc.RegularHours;
        p.OvertimeHours = calc.OvertimeHours;
        p.HourlyRateSnapshot = calc.HourlyRate;
        p.BasePay = basePay;
        p.OvertimePay = calc.OvertimePay;
        p.GrossPay = Math.Round(gross, 2);

        if (cfg.Method == "Statutory")
        {
            var r = TurkishPayroll.Calculate(gross, priorCumulative, p.Month, days, PayrollSettingsService.Parameters(cfg));
            p.SgkEmployee = r.SgkEmployee;
            p.UnemploymentEmployee = r.UnemploymentEmployee;
            p.IncomeTax = r.IncomeTax;
            p.IncomeTaxExemption = r.IncomeTaxExemption;
            p.StampTax = r.StampTax;
            p.StampTaxExemption = r.StampTaxExemption;
            p.CumulativeTaxBase = r.CumulativeTaxBase;
            p.EmployerSgk = r.EmployerSgk;
            p.EmployerUnemployment = r.EmployerUnemployment;
            p.EmployerCost = r.EmployerCost;
            p.Deductions = r.TotalDeductions;
            p.NetPay = r.Net;
        }
        else
        {
            p.SgkEmployee = p.UnemploymentEmployee = p.IncomeTax = p.IncomeTaxExemption = p.StampTax = p.StampTaxExemption = 0;
            p.EmployerSgk = p.EmployerUnemployment = 0;
            p.CumulativeTaxBase = priorCumulative;
            p.Deductions = manualDeductions ?? Math.Round(gross * cfg.ApproxDeductionRate, 2);
            p.NetPay = Math.Round(gross - p.Deductions, 2);
            p.EmployerCost = p.GrossPay;
        }
    }

    /// <summary>Prim değişince bordro yeniden hesaplanır. Kesinti yalnızca "yaklaşık" yöntemde elle girilebilir.</summary>
    public async Task AdjustAsync(Guid id, PayrollAdjustRequest request, CancellationToken ct)
    {
        var payroll = await GetAsync(id, ct);
        if (payroll.Status != PayrollStatus.Draft) throw new AppValidationException("Yalnızca taslak bordro düzenlenebilir.");
        if (request.Bonus < 0 || request.Deductions < 0) throw new AppValidationException("Prim ve kesinti negatif olamaz.");

        var emp = await db.Employees.FirstAsync(e => e.Id == payroll.EmployeeId, ct);
        var from = new DateOnly(payroll.Year, payroll.Month, 1).ToDateTime(TimeOnly.MinValue);
        var entries = await db.TimeEntries.AsNoTracking().Where(t => t.EmployeeId == emp.Id && t.ClockIn >= from && t.ClockIn < from.AddMonths(1)).ToListAsync(ct);
        var cfg = await settings.GetAsync(payroll.Year, ct);
        var prior = (await PriorCumulativeAsync(payroll.Year, payroll.Month, ct)).GetValueOrDefault(emp.Id);
        payroll.Bonus = request.Bonus;
        Compute(payroll, emp, entries, cfg, prior, cfg.Method == "Statutory" ? null : request.Deductions);
        await db.SaveChangesAsync(ct);
    }

    public async Task<BulkResult> ApproveAsync(IReadOnlyList<Payroll> payrolls, CancellationToken ct)
    {
        var drafts = payrolls.Where(p => p.Status == PayrollStatus.Draft).ToList();
        drafts.ForEach(p => p.Status = PayrollStatus.Approved);
        await db.SaveChangesAsync(ct);
        return new BulkResult(drafts.Count, $"{drafts.Count} bordro onaylandı.");
    }

    public async Task<BulkResult> RevertAsync(Guid id, CancellationToken ct)
    {
        var payroll = await GetAsync(id, ct);
        if (payroll.Status != PayrollStatus.Approved) throw new AppValidationException("Yalnızca onaylanmış (ödenmemiş) bordro taslağa alınabilir.");
        payroll.Status = PayrollStatus.Draft;
        await db.SaveChangesAsync(ct);
        return new BulkResult(1, "Bordro taslağa alındı.");
    }

    /// <summary>Ödeme: bordro "Ödendi" olur ve net tutar kadar gider kaydı oluşur.</summary>
    public async Task<BulkResult> PayAsync(IReadOnlyList<Payroll> payrolls, CancellationToken ct)
    {
        var approved = payrolls.Where(p => p.Status == PayrollStatus.Approved).ToList();
        if (approved.Count == 0) return new BulkResult(0, "Ödenecek onaylı bordro yok.");

        var category = await finance.GetOrCreateCategoryAsync(FinanceService.PayrollCategoryName, TransactionType.Expense, ct);
        var now = clock.GetLocalNow().DateTime;
        var names = await db.Employees.AsNoTracking()
            .Where(e => approved.Select(p => p.EmployeeId).Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => new { e.FirstName, e.LastName, e.EmployeeNumber }, ct);

        foreach (var p in approved)
        {
            p.Status = PayrollStatus.Paid;
            p.PaidAt = now;
            var n = names[p.EmployeeId];
            db.IncomeExpenses.Add(new IncomeExpense
            {
                CompanyId = tenant.CompanyId,
                Type = TransactionType.Expense,
                Amount = p.NetPay,
                Date = DateOnly.FromDateTime(now),
                Category = category,
                CategoryId = category.Id,
                PayrollId = p.Id,
                Description = $"{p.Month:00}.{p.Year} maaşı — {n.FirstName} {n.LastName}",
                DocumentNo = $"BR{p.Year % 100:00}{p.Month:00}-{n.EmployeeNumber ?? p.EmployeeId.ToString()[..6]}",
            });
        }
        await db.SaveChangesAsync(ct);
        return new BulkResult(approved.Count, $"{approved.Count} bordro ödendi ve gider olarak kaydedildi.");
    }

    public async Task<Payroll> GetAsync(Guid id, CancellationToken ct) =>
        await db.Payrolls.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new AppValidationException("Bordro bulunamadı.");

    public static void ValidatePeriod(int year, int month)
    {
        if (year is < 2000 or > 2100 || month is < 1 or > 12) throw new AppValidationException("Geçersiz dönem.");
    }
}
