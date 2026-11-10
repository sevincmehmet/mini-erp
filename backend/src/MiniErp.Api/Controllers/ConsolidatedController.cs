using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Auth;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record CompanySummary(Guid CompanyId, string Name, string? AccentColor,
    decimal MonthIncome, decimal MonthExpense, decimal LastMonthIncome, decimal LastMonthExpense, decimal YearIncome, decimal YearExpense,
    int ActiveEmployees, decimal PendingPayroll, decimal ReceivableOpen, decimal ReceivableOverdue, decimal PayableOpen,
    IReadOnlyList<MiniErp.Api.Contracts.MonthTotalDto> Months);

/// <summary>
/// Konsolide görünüm: kullanıcının erişebildiği tüm şirketlerin özeti tek istekte.
/// Şirket filtresi bilinçli olarak atlanır; yalnızca kullanıcının yetkili olduğu şirket kimlikleriyle sınırlanır.
/// </summary>
[ApiController]
[Route("api/consolidated")]
public class ConsolidatedController(AppDbContext db, HttpCurrentUser current, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<CompanySummary>> Get(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var seriesStart = monthStart.AddMonths(-11);
        var companies = await db.UserCompanies.AsNoTracking().Where(uc => uc.UserId == current.UserId)
            .Select(uc => new { uc.CompanyId, uc.Company.Name, uc.Company.AccentColor }).ToListAsync(ct);
        var ids = companies.Select(c => c.CompanyId).ToList();

        var tx = await db.IncomeExpenses.IgnoreQueryFilters().AsNoTracking()
            .Where(t => ids.Contains(t.CompanyId) && !t.IsDeleted && t.Date >= seriesStart)
            .GroupBy(t => new { t.CompanyId, t.Date.Year, t.Date.Month, t.Type })
            .Select(g => new { g.Key.CompanyId, g.Key.Year, g.Key.Month, g.Key.Type, Total = g.Sum(t => t.Amount) }).ToListAsync(ct);
        var employees = await db.Employees.IgnoreQueryFilters().AsNoTracking().Where(e => ids.Contains(e.CompanyId) && !e.IsDeleted && e.IsActive)
            .GroupBy(e => e.CompanyId).Select(g => new { CompanyId = g.Key, Count = g.Count() }).ToListAsync(ct);
        var payroll = await db.Payrolls.IgnoreQueryFilters().AsNoTracking().Where(p => ids.Contains(p.CompanyId) && !p.IsDeleted && p.Status == PayrollStatus.Approved)
            .GroupBy(p => p.CompanyId).Select(g => new { CompanyId = g.Key, Total = g.Sum(p => p.NetPay) }).ToListAsync(ct);
        var docs = await db.CariDocuments.IgnoreQueryFilters().AsNoTracking().Where(d => ids.Contains(d.CompanyId) && !d.IsDeleted)
            .Select(d => new { d.CompanyId, d.Type, d.DueDate, Remaining = d.Amount - d.Payments.Where(p => !p.IsDeleted).Sum(p => (decimal?)p.Amount) ?? d.Amount })
            .ToListAsync(ct);

        decimal Sum(Guid c, int y, int m, TransactionType t) => tx.Where(x => x.CompanyId == c && x.Year == y && x.Month == m && x.Type == t).Sum(x => x.Total);
        var last = monthStart.AddMonths(-1);
        return companies.Select(c =>
        {
            var months = Enumerable.Range(0, 12).Select(i => seriesStart.AddMonths(i))
                .Select(m => new MiniErp.Api.Contracts.MonthTotalDto(m.Year, m.Month, Sum(c.CompanyId, m.Year, m.Month, TransactionType.Income), Sum(c.CompanyId, m.Year, m.Month, TransactionType.Expense))).ToList();
            var mine = docs.Where(d => d.CompanyId == c.CompanyId && d.Remaining > 0).ToList();
            return new CompanySummary(c.CompanyId, c.Name, c.AccentColor,
                Sum(c.CompanyId, today.Year, today.Month, TransactionType.Income), Sum(c.CompanyId, today.Year, today.Month, TransactionType.Expense),
                Sum(c.CompanyId, last.Year, last.Month, TransactionType.Income), Sum(c.CompanyId, last.Year, last.Month, TransactionType.Expense),
                months.Where(m => m.Year == today.Year).Sum(m => m.Income), months.Where(m => m.Year == today.Year).Sum(m => m.Expense),
                employees.FirstOrDefault(e => e.CompanyId == c.CompanyId)?.Count ?? 0,
                payroll.FirstOrDefault(p => p.CompanyId == c.CompanyId)?.Total ?? 0,
                mine.Where(d => d.Type == CariDocumentTypeReceivable).Sum(d => d.Remaining),
                mine.Where(d => d.Type == CariDocumentTypeReceivable && d.DueDate < today).Sum(d => d.Remaining),
                mine.Where(d => d.Type != CariDocumentTypeReceivable).Sum(d => d.Remaining),
                months);
        }).ToList();
    }

    private const MiniErp.Domain.Entities.CariDocumentType CariDocumentTypeReceivable = MiniErp.Domain.Entities.CariDocumentType.Receivable;
}
