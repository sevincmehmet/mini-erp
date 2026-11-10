namespace MiniErp.Domain.Common;

/// <summary>
/// Bir şirkete (tenant) ait olan her veri bu arayüzü uygular.
/// AppDbContext, bu arayüzü taşıyan tüm tiplere otomatik olarak şirket filtresi uygular.
/// </summary>
public interface ITenantEntity
{
    Guid CompanyId { get; set; }
}

/// <summary>Şirkete ait entity'ler için temel sınıf.</summary>
public abstract class TenantEntity : BaseEntity, ITenantEntity
{
    public Guid CompanyId { get; set; }
}
