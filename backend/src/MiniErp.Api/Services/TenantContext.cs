using MiniErp.Application.Abstractions;
using MiniErp.Api.Common;

namespace MiniErp.Api.Services;

/// <summary>
/// Servislerin aktif şirkete ihtiyaç duyduğu yerlerde kullanılır.
/// Yeni kayıtlara CompanyId baştan verilir: interceptor yine kontrol eder,
/// ama composite FK'lar daha ilk andan tutarlı olur.
/// </summary>
public sealed class TenantContext(ITenantProvider tenant)
{
    public Guid CompanyId => tenant.CompanyId ?? throw new AppValidationException("Önce bir şirket seçin.");
}
