using MiniErp.Domain.Common;
using MiniErp.Domain.Enums;

namespace MiniErp.Domain.Entities;

/// <summary>Uygulamaya giriş yapan kullanıcı. Şirketten bağımsızdır; erişimi UserCompany belirler.</summary>
public class AppUser : BaseEntity
{
    public string Email { get; set; } = default!;
    public string FullName { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }
    /// <summary>Şifre değişince artar; eski oturum anahtarları (token) geçersiz olur.</summary>
    public int SecurityStamp { get; set; }

    public ICollection<UserCompany> Companies { get; set; } = new List<UserCompany>();
}

/// <summary>Kullanıcı ↔ Şirket çoka-çok ilişkisi ve o şirketteki rolü.</summary>
public class UserCompany
{
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = default!;

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public CompanyRole Role { get; set; } = CompanyRole.Owner;
}
