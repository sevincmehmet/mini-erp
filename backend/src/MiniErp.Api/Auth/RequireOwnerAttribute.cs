using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using MiniErp.Domain.Enums;

namespace MiniErp.Api.Auth;

/// <summary>Yalnızca aktif şirkette "Sahip" rolündeki kullanıcılar (kullanıcı yönetimi, geri yükleme, kalıcı silme…).</summary>
public sealed class RequireOwnerAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (context.HttpContext.Items[HttpCurrentUser.TenantRoleKey] is not CompanyRole.Owner)
            context.Result = new ObjectResult(new ProblemDetails { Title = "Bu işlem için şirket sahibi yetkisi gerekiyor.", Status = 403 }) { StatusCode = 403 };
    }
}
