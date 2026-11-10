using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Auth;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record NotificationDto(string Key, Guid CompanyId, string CompanyName, string Severity, string Title, string Detail, string Page, int Count);

/// <summary>Hatırlatma merkezi: tüm şirketlerde dikkat isteyen işler (anlık hesaplanır, saklanmaz).</summary>
[ApiController]
[Route("api/notifications")]
public class NotificationsController(AppDbContext db, HttpCurrentUser current, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<NotificationDto>> Get(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        var companies = await db.UserCompanies.AsNoTracking().Where(uc => uc.UserId == current.UserId)
            .Select(uc => new { uc.CompanyId, uc.Company.Name }).ToListAsync(ct);
        var ids = companies.Select(c => c.CompanyId).ToList();
        string Name(Guid id) => companies.First(c => c.CompanyId == id).Name;
        var list = new List<NotificationDto>();

        // Onaylanmış ama ödenmemiş bordrolar
        foreach (var g in await db.Payrolls.IgnoreQueryFilters().AsNoTracking().Where(p => ids.Contains(p.CompanyId) && !p.IsDeleted && p.Status == PayrollStatus.Approved)
                     .GroupBy(p => p.CompanyId).Select(g => new { g.Key, Count = g.Count(), Total = g.Sum(p => p.NetPay) }).ToListAsync(ct))
            list.Add(new($"payroll-unpaid-{g.Key}", g.Key, Name(g.Key), "warning", $"{g.Count} bordro ödeme bekliyor", $"Toplam net {g.Total:N0} ₺", "payroll", g.Count));

        // Geçen ayın bordrosu hiç hesaplanmamış (puantajı olduğu hâlde)
        var last = today.AddMonths(-1);
        var lastStart = new DateOnly(last.Year, last.Month, 1).ToDateTime(TimeOnly.MinValue);
        var withEntries = await db.TimeEntries.IgnoreQueryFilters().AsNoTracking().Where(t => ids.Contains(t.CompanyId) && !t.IsDeleted && t.ClockIn >= lastStart && t.ClockIn < lastStart.AddMonths(1))
            .Select(t => t.CompanyId).Distinct().ToListAsync(ct);
        var withPayroll = await db.Payrolls.IgnoreQueryFilters().AsNoTracking().Where(p => ids.Contains(p.CompanyId) && !p.IsDeleted && p.Year == last.Year && p.Month == last.Month)
            .Select(p => p.CompanyId).Distinct().ToListAsync(ct);
        foreach (var id in withEntries.Except(withPayroll))
            list.Add(new($"payroll-missing-{id}", id, Name(id), "info", $"{last:MM.yyyy} bordrosu hesaplanmadı", "Puantaj kayıtları hazır; Bordro ekranından hesaplayın.", "payroll", 1));

        // Vadesi geçmiş alacaklar ve 7 gün içinde ödenecek borçlar
        var docs = await db.CariDocuments.IgnoreQueryFilters().AsNoTracking().Where(d => ids.Contains(d.CompanyId) && !d.IsDeleted)
            .Select(d => new { d.CompanyId, d.Type, d.DueDate, Remaining = d.Amount - (d.Payments.Where(p => !p.IsDeleted).Sum(p => (decimal?)p.Amount) ?? 0) })
            .ToListAsync(ct);
        foreach (var g in docs.Where(d => d.Remaining > 0 && d.Type == CariDocumentType.Receivable && d.DueDate < today).GroupBy(d => d.CompanyId))
            list.Add(new($"receivable-overdue-{g.Key}", g.Key, Name(g.Key), "critical", $"{g.Count()} alacağın vadesi geçti", $"Toplam {g.Sum(x => x.Remaining):N0} ₺ tahsil edilmedi", "cari", g.Count()));
        foreach (var g in docs.Where(d => d.Remaining > 0 && d.Type == CariDocumentType.Payable && d.DueDate >= today && d.DueDate <= today.AddDays(7)).GroupBy(d => d.CompanyId))
            list.Add(new($"payable-soon-{g.Key}", g.Key, Name(g.Key), "warning", $"7 gün içinde {g.Count()} ödeme var", $"Toplam {g.Sum(x => x.Remaining):N0} ₺", "cari", g.Count()));
        foreach (var g in docs.Where(d => d.Remaining > 0 && d.Type == CariDocumentType.Payable && d.DueDate < today).GroupBy(d => d.CompanyId))
            list.Add(new($"payable-overdue-{g.Key}", g.Key, Name(g.Key), "critical", $"{g.Count()} borcun vadesi geçti", $"Toplam {g.Sum(x => x.Remaining):N0} ₺ ödenmedi", "cari", g.Count()));

        // Bekleyen izin talepleri
        foreach (var g in await db.LeaveRequests.IgnoreQueryFilters().AsNoTracking().Where(l => ids.Contains(l.CompanyId) && !l.IsDeleted && l.Status == LeaveStatus.Requested)
                     .GroupBy(l => l.CompanyId).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct))
            list.Add(new($"leave-pending-{g.Key}", g.Key, Name(g.Key), "info", $"{g.Count} izin talebi onay bekliyor", "İzinler ekranından onaylayın ya da reddedin.", "leaves", g.Count));

        var order = new Dictionary<string, int> { ["critical"] = 0, ["warning"] = 1, ["info"] = 2 };
        return list.OrderBy(n => order[n.Severity]).ThenBy(n => n.CompanyName).ToList();
    }
}
