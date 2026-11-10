using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MiniErp.Application.Abstractions;
using MiniErp.Domain.Common;

namespace MiniErp.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Yazma tarafındaki tenant güvencesi:
/// - Yeni kayda aktif şirketin Id'sini otomatik basar.
/// - Aktif şirket dışındaki bir kaydın eklenmesini/değiştirilmesini engeller.
/// </summary>
public sealed class TenantSaveChangesInterceptor(ITenantProvider tenantProvider) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Apply(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Apply(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Apply(DbContext? context)
    {
        if (context is null) return;

        var entries = context.ChangeTracker.Entries<ITenantEntity>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();
        if (entries.Count == 0) return;

        var companyId = tenantProvider.CompanyId
            ?? throw new InvalidOperationException("Aktif şirket seçilmeden şirket verisi kaydedilemez.");

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added && entry.Entity.CompanyId == Guid.Empty)
            {
                entry.Entity.CompanyId = companyId;
            }

            if (entry.Entity.CompanyId != companyId)
            {
                throw new UnauthorizedAccessException(
                    $"{entry.Metadata.ClrType.Name} kaydı aktif şirkete ait değil; işlem engellendi.");
            }

            if (entry.State == EntityState.Modified && entry.Property(nameof(ITenantEntity.CompanyId)).IsModified)
            {
                throw new InvalidOperationException("Bir kaydın şirketi sonradan değiştirilemez.");
            }
        }
    }
}
