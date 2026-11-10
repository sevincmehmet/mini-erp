using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MiniErp.Infrastructure.Persistence;
using MiniErp.Infrastructure.Persistence.Interceptors;

namespace MiniErp.Infrastructure;

public static class DependencyInjection
{
    /// <param name="provider">"SqlServer" (varsayılan, sunucu kurulumu) ya da "Sqlite" (sunucusuz demo: tek dosyalık yerel veritabanı)</param>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString, string? provider = null)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<AuditableEntityInterceptor>();
        services.AddScoped<TenantSaveChangesInterceptor>();
        services.AddScoped<AuditTrailInterceptor>();
        services.AddScoped<MiniErp.Application.Abstractions.AuditOptions>();

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            if (IsSqlite(provider))
                options.UseSqlite(connectionString);
            else
                options.UseSqlServer(
                    connectionString,
                    sql => sql.EnableRetryOnFailure()); // bulut bağlantısındaki geçici kopmalara karşı
            // Sıra önemli: önce tenant kontrolü, sonra tarih/soft delete, en son değişiklik kaydı
            options.AddInterceptors(
                sp.GetRequiredService<TenantSaveChangesInterceptor>(),
                sp.GetRequiredService<AuditableEntityInterceptor>(),
                sp.GetRequiredService<AuditTrailInterceptor>());
        });

        return services;
    }

    public static bool IsSqlite(string? provider) => string.Equals(provider, "Sqlite", StringComparison.OrdinalIgnoreCase);

    /// <summary>Şemayı hazırlar: SQL Server'da migration'lar, SQLite demo veritabanında doğrudan model şeması.</summary>
    public static Task EnsureSchemaAsync(this AppDbContext db, CancellationToken ct = default) =>
        db.Database.IsSqlite() ? db.Database.EnsureCreatedAsync(ct) : db.Database.MigrateAsync(ct);
}
