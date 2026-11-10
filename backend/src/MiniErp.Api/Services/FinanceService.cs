using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Services;

public sealed class FinanceService(AppDbContext db, TenantContext tenant)
{
    public const string PayrollCategoryName = "Personel Maaşları";

    private Dictionary<(TransactionType, string), FinanceCategory>? _cache;

    /// <summary>Adı verilen kategoriyi bulur; yoksa oluşturur (Excel'den gelen yeni kategoriler için).</summary>
    public async Task<FinanceCategory> GetOrCreateCategoryAsync(string name, TransactionType type, CancellationToken ct)
    {
        _cache ??= (await db.FinanceCategories.ToListAsync(ct))
            .GroupBy(c => (c.Type, Text.Normalize(c.Name)))
            .ToDictionary(g => g.Key, g => g.First());

        var key = (type, Text.Normalize(name));
        if (_cache.TryGetValue(key, out var existing)) return existing;

        var category = new FinanceCategory { CompanyId = tenant.CompanyId, Name = name.Trim(), Type = type };
        db.FinanceCategories.Add(category);
        _cache[key] = category;
        return category;
    }

    public static TransactionType? ParseType(string? value) => Text.Normalize(value) switch
    {
        "gelir" or "income" or "+" or "alacak" or "tahsilat" => TransactionType.Income,
        "gider" or "expense" or "-" or "borc" or "odeme" or "masraf" => TransactionType.Expense,
        _ => null,
    };
}
