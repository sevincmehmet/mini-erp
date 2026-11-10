using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniErp.Domain.Common;

namespace MiniErp.Infrastructure.Persistence.Configurations;

/// <summary>
/// Tüm şirket entity'leri için ortak kurallar.
/// (CompanyId, Id) alternate key'i, alt kayıtların composite FK ile
/// "aynı şirkete ait" olmaya zorlanmasını sağlar.
/// </summary>
public abstract class TenantEntityConfiguration<TEntity> : IEntityTypeConfiguration<TEntity>
    where TEntity : TenantEntity
{
    public virtual void Configure(EntityTypeBuilder<TEntity> builder)
    {
        builder.HasKey(e => e.Id);
        builder.HasAlternateKey(e => new { e.CompanyId, e.Id });
        builder.HasIndex(e => e.CompanyId);
    }
}
