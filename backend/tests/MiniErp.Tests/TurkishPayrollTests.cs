using MiniErp.Application.Payroll;

namespace MiniErp.Tests;

/// <summary>
/// 2025 parametreleriyle elle hesaplanmış değerler. Asgari ücret neti (22.104,67 ₺) resmi rakamdır;
/// diğerleri formülün adım adım uygulanmasıdır.
/// </summary>
public class TurkishPayrollTests
{
    private static readonly TaxBracket[] Brackets2025 =
        [new(158_000, 0.15m), new(330_000, 0.20m), new(1_200_000, 0.27m), new(4_300_000, 0.35m), new(null, 0.40m)];

    private static PayrollParameters P2025(bool exemption = true) =>
        new(26005.50m, 0.14m, 0.01m, 0.1575m, 0.02m, 0.00759m, 7.5m, Brackets2025, exemption);

    [Fact]
    public void Asgari_ucretli_resmi_net_ucreti_alir_ve_vergi_odemez()
    {
        var r = TurkishPayroll.Calculate(26005.50m, 0, month: 1, workedDays: 30, P2025());

        Assert.Equal(3640.77m, r.SgkEmployee);
        Assert.Equal(260.06m, r.UnemploymentEmployee);
        Assert.Equal(r.IncomeTax, r.IncomeTaxExemption);
        Assert.Equal(r.StampTax, r.StampTaxExemption);
        Assert.Equal(22104.67m, r.Net);
    }

    [Fact]
    public void Asgari_ucret_ustunde_istisna_asgari_ucretin_vergisi_kadardir()
    {
        var r = TurkishPayroll.Calculate(50_000m, 0, month: 1, workedDays: 30, P2025());

        Assert.Equal(42_500m, r.TaxBase);
        Assert.Equal(6375m, r.IncomeTax);
        Assert.Equal(3315.70m, r.IncomeTaxExemption);
        Assert.Equal(379.50m, r.StampTax);
        Assert.Equal(197.38m, r.StampTaxExemption);
        Assert.Equal(10741.42m, r.TotalDeductions);
        Assert.Equal(39258.58m, r.Net);
        Assert.Equal(50_000m + 7875m + 1000m, r.EmployerCost);
    }

    [Fact]
    public void Istisna_kapaliyken_tum_vergi_kesilir()
    {
        var r = TurkishPayroll.Calculate(50_000m, 0, 1, 30, P2025(exemption: false));
        Assert.Equal(0, r.IncomeTaxExemption);
        Assert.Equal(50_000m - 7500m - 6375m - 379.50m, r.Net);
    }

    [Fact]
    public void Sgk_matrahi_tavanla_sinirlanir()
    {
        var r = TurkishPayroll.Calculate(300_000m, 0, 1, 30, P2025());
        Assert.Equal(195_041.25m, r.SgkBase);
        Assert.Equal(27_305.78m, r.SgkEmployee);
    }

    [Fact]
    public void Kumulatif_matrah_dilim_atlayinca_ust_oran_uygulanir()
    {
        // Önceki aylardan 150.000 matrah; bu ay 42.500 → 8.000'i %15, 34.500'ü %20
        var r = TurkishPayroll.Calculate(50_000m, 150_000m, month: 4, workedDays: 30, P2025(exemption: false));
        Assert.Equal(192_500m, r.CumulativeTaxBase);
        Assert.Equal(8000m * 0.15m + 34_500m * 0.20m, r.IncomeTax);
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(100_000, 15_000)]
    [InlineData(200_000, 32_100)] // 158.000×%15 + 42.000×%20
    public void Dilimli_vergi(decimal matrah, decimal vergi) =>
        Assert.Equal(vergi, TurkishPayroll.TaxOn(matrah, Brackets2025));

    [Fact]
    public void Kist_ayda_istisna_gunle_orantilanir()
    {
        var full = TurkishPayroll.Calculate(26005.50m, 0, 1, 30, P2025());
        var half = TurkishPayroll.Calculate(13002.75m, 0, 1, 15, P2025());
        Assert.Equal(Math.Round(full.StampTaxExemption / 2, 2), half.StampTaxExemption, 1);
        Assert.Equal(half.StampTax, half.StampTaxExemption);
    }

    [Theory]
    [InlineData("2025-01-01", null, 2025, 3, 30)]        // tam ay
    [InlineData("2025-03-16", null, 2025, 3, 15)]        // ay ortası giriş
    [InlineData("2025-01-01", null, 2025, 2, 30)]        // Şubat tam ay = 30 gün
    [InlineData("2025-02-15", null, 2025, 2, 16)]        // Şubat'ta giriş: 15→30
    [InlineData("2024-05-01", "2025-01-10", 2025, 1, 10)] // ay içinde çıkış
    [InlineData("2025-04-01", null, 2025, 3, 0)]         // henüz işe girmemiş
    [InlineData("2025-01-31", null, 2025, 1, 1)]         // 31'inde giriş
    public void Calisilan_gun(string hire, string? termination, int year, int month, int expected) =>
        Assert.Equal(expected, TurkishPayroll.WorkedDays(DateOnly.Parse(hire), termination is null ? null : DateOnly.Parse(termination), year, month));
}
