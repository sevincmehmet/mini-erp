using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Contracts;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<DashboardDto> Get(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var seriesStart = monthStart.AddMonths(-5);

        var monthly = await db.IncomeExpenses.AsNoTracking()
            .Where(t => t.Date >= seriesStart)
            .GroupBy(t => new { t.Date.Year, t.Date.Month, t.Type })
            .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Type, Total = g.Sum(t => t.Amount) })
            .ToListAsync(ct);

        var months = Enumerable.Range(0, 6).Select(i => seriesStart.AddMonths(i)).Select(m => new MonthTotalDto(
            m.Year, m.Month,
            monthly.Where(x => x.Year == m.Year && x.Month == m.Month && x.Type == TransactionType.Income).Sum(x => x.Total),
            monthly.Where(x => x.Year == m.Year && x.Month == m.Month && x.Type == TransactionType.Expense).Sum(x => x.Total)))
            .ToList();

        var current = months[^1];

        // Gruplama SQL'de kategori Id'sine göre, isim eşleştirme bellekte (az sayıda kategori var)
        var expenseByCategory = await db.IncomeExpenses.AsNoTracking()
            .Where(t => t.Date >= monthStart.AddMonths(-2) && t.Type == TransactionType.Expense)
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Total = g.Sum(t => t.Amount) })
            .ToListAsync(ct);
        var categoryNames = await db.FinanceCategories.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var topExpenses = expenseByCategory
            .OrderByDescending(x => x.Total).Take(8)
            .Select(x => new CategoryTotalDto(
                x.CategoryId is { } id && categoryNames.TryGetValue(id, out var name) ? name : "Diğer",
                TransactionType.Expense, x.Total))
            .ToList();

        var recent = await db.IncomeExpenses.AsNoTracking()
            .OrderByDescending(t => t.Date).ThenByDescending(t => t.CreatedAt).Take(8)
            .Select(t => new TransactionDto(t.Id, t.Type, t.Amount, t.Date, t.Description, t.DocumentNo,
                t.CategoryId, t.Category != null ? t.Category.Name : null, t.PayrollId != null))
            .ToListAsync(ct);

        var monthStartTime = monthStart.ToDateTime(TimeOnly.MinValue);
        return new DashboardDto(
            today.Year, today.Month,
            current.Income, current.Expense,
            await db.Employees.CountAsync(e => e.IsActive, ct),
            await db.ShiftAssignments.CountAsync(a => a.Date == today, ct),
            await db.TimeEntries.Where(t => t.ClockIn >= monthStartTime).SumAsync(t => t.OvertimeHours, ct),
            await db.Payrolls.Where(p => p.Status == PayrollStatus.Approved).SumAsync(p => p.NetPay, ct),
            months, topExpenses, recent);
    }
}
