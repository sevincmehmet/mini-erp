using Microsoft.EntityFrameworkCore;
using MiniErp.Application.Abstractions;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;
using MiniErp.Infrastructure.Persistence.Interceptors;

namespace MiniErp.Tests;

/// <summary>Şirketler arası veri sızıntısının olmadığını sorgu filtresi ve kayıt interceptor'ı üzerinden doğrular.</summary>
public class TenantIsolationTests
{
    private sealed class FakeTenant : ITenantProvider { public Guid? CompanyId { get; set; } }

    private static readonly Guid A = Guid.NewGuid(), B = Guid.NewGuid();

    private static (AppDbContext Db, FakeTenant Tenant) Create(string name)
    {
        var tenant = new FakeTenant { CompanyId = A };
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .AddInterceptors(new TenantSaveChangesInterceptor(tenant))
            .Options;
        return (new AppDbContext(options, tenant), tenant);
    }

    [Fact]
    public async Task Yeni_kayda_aktif_sirket_basilir_ve_diger_sirket_goremez()
    {
        var (db, tenant) = Create(nameof(Yeni_kayda_aktif_sirket_basilir_ve_diger_sirket_goremez));
        db.Employees.Add(new Employee { FirstName = "Ayşe", LastName = "Demir" });
        await db.SaveChangesAsync();

        Assert.Equal(A, (await db.Employees.SingleAsync()).CompanyId);

        tenant.CompanyId = B;
        Assert.Empty(await db.Employees.ToListAsync());
    }

    [Fact]
    public async Task Baska_sirkete_kayit_eklenemez()
    {
        var (db, _) = Create(nameof(Baska_sirkete_kayit_eklenemez));
        db.Employees.Add(new Employee { CompanyId = B, FirstName = "X", LastName = "Y" });
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Sirket_secilmeden_kayit_yapilamaz()
    {
        var (db, tenant) = Create(nameof(Sirket_secilmeden_kayit_yapilamaz));
        tenant.CompanyId = null;
        db.Employees.Add(new Employee { FirstName = "X", LastName = "Y" });
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }
}
