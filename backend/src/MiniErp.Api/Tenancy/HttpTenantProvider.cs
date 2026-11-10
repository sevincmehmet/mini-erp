using MiniErp.Application.Abstractions;

namespace MiniErp.Api.Tenancy;

/// <summary>İstek boyunca yaşayan (scoped) tenant bilgisi. TenantMiddleware tarafından doldurulur.</summary>
public sealed class HttpTenantProvider : ITenantProvider
{
    public Guid? CompanyId { get; private set; }

    internal void SetCompany(Guid companyId) => CompanyId = companyId;
}
