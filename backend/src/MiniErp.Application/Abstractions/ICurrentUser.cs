namespace MiniErp.Application.Abstractions;

/// <summary>İsteği yapan kullanıcı (JWT'den). Değişiklik kaydı ve yetki kontrolleri için.</summary>
public interface ICurrentUser
{
    Guid? UserId { get; }
    string? Name { get; }
}

/// <summary>Toplu işlemlerde (ör. yedekten geri yükleme) satır satır değişiklik kaydını kapatmak için.</summary>
public sealed class AuditOptions
{
    public bool Suppress { get; set; }
}
