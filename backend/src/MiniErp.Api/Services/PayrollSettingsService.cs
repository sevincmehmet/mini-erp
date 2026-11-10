using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Application.Payroll;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Services;

public sealed record PayrollSettingsDto(
    int Year, string Method, decimal ApproxDeductionRate, decimal MinimumWageGross,
    decimal SgkEmployeeRate, decimal UnemploymentEmployeeRate, decimal SgkEmployerRate, decimal UnemploymentEmployerRate,
    decimal StampTaxRate, decimal SgkCeilingMultiplier, IReadOnlyList<TaxBracket> Brackets, bool ApplyMinimumWageExemption, bool IsDefault);

/// <summary>
/// Yıllık bordro parametreleri. Kayıt yoksa bilinen varsayılanlarla oluşturulur.
/// ÖNEMLİ: Varsayılanlar bilgi amaçlıdır; resmî bordrodan önce muhasebeci tarafından doğrulanmalıdır.
/// </summary>
public sealed class PayrollSettingsService(AppDbContext db, TenantContext tenant)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static (decimal MinWage, TaxBracket[] Brackets) Defaults(int year) => year switch
    {
        <= 2025 => (26005.50m, [new(158_000, 0.15m), new(330_000, 0.20m), new(1_200_000, 0.27m), new(4_300_000, 0.35m), new(null, 0.40m)]),
        _ => (33030.00m, [new(190_000, 0.15m), new(400_000, 0.20m), new(1_500_000, 0.27m), new(5_300_000, 0.35m), new(null, 0.40m)]),
    };

    public async Task<PayrollSettings> GetAsync(int year, CancellationToken ct)
    {
        var existing = await db.PayrollSettings.FirstOrDefaultAsync(s => s.Year == year, ct);
        if (existing != null) return existing;
        var (minWage, brackets) = Defaults(year);
        // Kaydedilmez: kullanıcı "Kaydet" diyene kadar varsayılan olarak döner
        return new PayrollSettings { CompanyId = tenant.CompanyId, Year = year, MinimumWageGross = minWage, TaxBracketsJson = JsonSerializer.Serialize(brackets, Json) };
    }

    public async Task<PayrollSettings> SaveAsync(PayrollSettingsDto r, CancellationToken ct)
    {
        var errors = new List<string>();
        if (r.Year is < 2000 or > 2100) errors.Add("Geçersiz yıl.");
        if (r.MinimumWageGross <= 0) errors.Add("Asgari ücret sıfırdan büyük olmalı.");
        if (r.Method is not ("Statutory" or "Approximate")) errors.Add("Geçersiz hesap yöntemi.");
        var rates = new[] { r.SgkEmployeeRate, r.UnemploymentEmployeeRate, r.SgkEmployerRate, r.UnemploymentEmployerRate, r.StampTaxRate, r.ApproxDeductionRate };
        if (rates.Any(x => x is < 0 or > 1)) errors.Add("Oranlar 0 ile 1 arasında olmalı (ör. %14 için 0,14).");
        if (r.Brackets.Count == 0 || r.Brackets[^1].UpTo != null) errors.Add("Son vergi diliminin üst sınırı boş (sınırsız) olmalı.");
        if (r.Brackets.Zip(r.Brackets.Skip(1)).Any(p => p.First.UpTo is null || (p.Second.UpTo is { } up && up <= p.First.UpTo))) errors.Add("Vergi dilimleri artan sırada olmalı.");
        AppValidationException.ThrowIfAny(errors);

        var s = await db.PayrollSettings.FirstOrDefaultAsync(x => x.Year == r.Year, ct);
        if (s is null) { s = new PayrollSettings { CompanyId = tenant.CompanyId, Year = r.Year }; db.PayrollSettings.Add(s); }
        s.Method = r.Method;
        s.ApproxDeductionRate = r.ApproxDeductionRate;
        s.MinimumWageGross = r.MinimumWageGross;
        s.SgkEmployeeRate = r.SgkEmployeeRate;
        s.UnemploymentEmployeeRate = r.UnemploymentEmployeeRate;
        s.SgkEmployerRate = r.SgkEmployerRate;
        s.UnemploymentEmployerRate = r.UnemploymentEmployerRate;
        s.StampTaxRate = r.StampTaxRate;
        s.SgkCeilingMultiplier = r.SgkCeilingMultiplier;
        s.TaxBracketsJson = JsonSerializer.Serialize(r.Brackets, Json);
        s.ApplyMinimumWageExemption = r.ApplyMinimumWageExemption;
        await db.SaveChangesAsync(ct);
        return s;
    }

    public static PayrollSettingsDto ToDto(PayrollSettings s) => new(s.Year, s.Method, s.ApproxDeductionRate, s.MinimumWageGross,
        s.SgkEmployeeRate, s.UnemploymentEmployeeRate, s.SgkEmployerRate, s.UnemploymentEmployerRate, s.StampTaxRate, s.SgkCeilingMultiplier,
        Brackets(s), s.ApplyMinimumWageExemption, s.CreatedAt == default);

    public static IReadOnlyList<TaxBracket> Brackets(PayrollSettings s) => JsonSerializer.Deserialize<List<TaxBracket>>(s.TaxBracketsJson, Json) ?? [];

    public static PayrollParameters Parameters(PayrollSettings s) => new(s.MinimumWageGross, s.SgkEmployeeRate, s.UnemploymentEmployeeRate,
        s.SgkEmployerRate, s.UnemploymentEmployerRate, s.StampTaxRate, s.SgkCeilingMultiplier, Brackets(s), s.ApplyMinimumWageExemption);
}
