namespace MiniErp.Application.Abstractions;

/// <summary>
/// İstek bazında "şu an hangi şirketin verisiyle çalışıyoruz?" sorusunun cevabı.
/// API katmanında HTTP header'dan, testlerde sabit değerle doldurulur.
/// </summary>
public interface ITenantProvider
{
    Guid? CompanyId { get; }
    bool HasTenant => CompanyId.HasValue;
}
