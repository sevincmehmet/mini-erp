namespace MiniErp.Application.Payroll;

public sealed record TaxBracket(decimal? UpTo, decimal Rate);

/// <summary>Bir yılın bordro parametreleri (ekrandan değiştirilebilir; muhasebeci doğrulamalı).</summary>
public sealed record PayrollParameters(
    decimal MinimumWageGross,
    decimal SgkEmployeeRate,
    decimal UnemploymentEmployeeRate,
    decimal SgkEmployerRate,
    decimal UnemploymentEmployerRate,
    decimal StampTaxRate,
    decimal SgkCeilingMultiplier,
    IReadOnlyList<TaxBracket> Brackets,
    bool ApplyMinimumWageExemption);

public sealed record StatutoryResult(
    decimal Gross,
    decimal SgkBase,
    decimal SgkEmployee,
    decimal UnemploymentEmployee,
    decimal TaxBase,
    decimal CumulativeTaxBase,
    decimal IncomeTax,
    decimal IncomeTaxExemption,
    decimal StampTax,
    decimal StampTaxExemption,
    decimal TotalDeductions,
    decimal Net,
    decimal EmployerSgk,
    decimal EmployerUnemployment,
    decimal EmployerCost);

/// <summary>
/// Türkiye ücret bordrosu hesabı (brütten nete):
/// SGK ve işsizlik işçi payı (SGK tavanına kadar) → gelir vergisi matrahı → yıl içi kümülatif matraha göre
/// dilimli gelir vergisi → asgari ücret gelir vergisi ve damga vergisi istisnası → net ücret ve işveren maliyeti.
/// Saf bir hesaplayıcıdır (veritabanına dokunmaz); birim testlerle doğrulanır.
/// </summary>
public static class TurkishPayroll
{
    private static decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    /// <summary>Kümülatif matraha göre toplam gelir vergisi (dilimli).</summary>
    public static decimal TaxOn(decimal cumulativeBase, IReadOnlyList<TaxBracket> brackets)
    {
        if (cumulativeBase <= 0) return 0;
        decimal tax = 0, lower = 0;
        foreach (var b in brackets)
        {
            var upper = b.UpTo ?? decimal.MaxValue;
            if (cumulativeBase <= lower) break;
            tax += (Math.Min(cumulativeBase, upper) - lower) * b.Rate;
            lower = upper;
        }
        return tax;
    }

    /// <param name="gross">Ayın brüt ücreti (kıst gün ve fazla mesai dahil)</param>
    /// <param name="previousCumulativeBase">Yıl başından önceki aya kadar gelir vergisi matrahı toplamı</param>
    /// <param name="month">1–12; asgari ücret istisnasının kümülatif hesabı için</param>
    /// <param name="workedDays">Ayda çalışılan gün (kıst ayda istisna orantılanır)</param>
    public static StatutoryResult Calculate(decimal gross, decimal previousCumulativeBase, int month, decimal workedDays, PayrollParameters p)
    {
        var ceiling = p.MinimumWageGross * p.SgkCeilingMultiplier;
        var sgkBase = Math.Min(gross, ceiling);
        var sgk = R(sgkBase * p.SgkEmployeeRate);
        var unemp = R(sgkBase * p.UnemploymentEmployeeRate);

        var taxBase = gross - sgk - unemp;
        var cumulative = previousCumulativeBase + taxBase;
        var incomeTax = R(TaxOn(cumulative, p.Brackets) - TaxOn(previousCumulativeBase, p.Brackets));

        var stamp = R(gross * p.StampTaxRate);
        decimal taxExemption = 0, stampExemption = 0;
        if (p.ApplyMinimumWageExemption)
        {
            // Asgari ücretin vergisi kadar istisna: asgari ücretin kendi kümülatif matrahı üzerinden
            var dayRatio = Math.Clamp(workedDays / 30m, 0, 1);
            var mwBase = (p.MinimumWageGross - R(p.MinimumWageGross * p.SgkEmployeeRate) - R(p.MinimumWageGross * p.UnemploymentEmployeeRate)) * dayRatio;
            var mwBefore = (p.MinimumWageGross - R(p.MinimumWageGross * p.SgkEmployeeRate) - R(p.MinimumWageGross * p.UnemploymentEmployeeRate)) * (month - 1);
            taxExemption = Math.Min(incomeTax, R(TaxOn(mwBefore + mwBase, p.Brackets) - TaxOn(mwBefore, p.Brackets)));
            stampExemption = Math.Min(stamp, R(p.MinimumWageGross * dayRatio * p.StampTaxRate));
        }

        var deductions = sgk + unemp + (incomeTax - taxExemption) + (stamp - stampExemption);
        var employerSgk = R(sgkBase * p.SgkEmployerRate);
        var employerUnemp = R(sgkBase * p.UnemploymentEmployerRate);
        return new StatutoryResult(R(gross), R(sgkBase), sgk, unemp, R(taxBase), R(cumulative), incomeTax, taxExemption, stamp, stampExemption,
            R(deductions), R(gross - deductions), employerSgk, employerUnemp, R(gross + employerSgk + employerUnemp));
    }

    /// <summary>Ayda çalışılan gün (30 günlük ay): işe giriş/çıkış ay içindeyse kıst gün sayısı.</summary>
    public static decimal WorkedDays(DateOnly hire, DateOnly? termination, int year, int month)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1).AddDays(-1);
        if (hire > end || (termination is { } t0 && t0 < start)) return 0;
        var from = Math.Min(hire > start ? hire.Day : 1, 30);
        var to = termination is { } t && t <= end ? t.Day : 30;
        if (to == end.Day && end.Day < 30) to = 30; // Şubat gibi kısa aylarda tam ay = 30 gün
        return Math.Clamp(Math.Min(to, 30) - from + 1, 0, 30);
    }
}
