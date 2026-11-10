using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Auth;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Tenancy;

/// <summary>
/// Masaüstü uygulaması her isteğe aktif şirketi "X-Company-Id" header'ı ile ekler.
/// Middleware kullanıcının o şirkete erişimini ve rolünü doğrular:
/// erişim yoksa 403; "Salt okuma" rolü yalnızca okuma (GET) isteği yapabilir.
/// </summary>
public sealed class TenantMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Company-Id";

    public async Task InvokeAsync(HttpContext context, HttpTenantProvider tenant, AppDbContext db)
    {
        if (!context.Request.Headers.TryGetValue(HeaderName, out var raw) || string.IsNullOrWhiteSpace(raw))
        {
            await next(context); // Şirketten bağımsız uç noktalar (giriş, şirket listesi, konsolide görünüm)
            return;
        }

        if (!Guid.TryParse(raw, out var companyId))
        {
            await Results.Problem($"{HeaderName} geçerli bir GUID değil.", statusCode: 400).ExecuteAsync(context);
            return;
        }

        if (!Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            await next(context); // Yetkilendirme katmanı 401 döner
            return;
        }

        var role = await db.UserCompanies.AsNoTracking()
            .Where(uc => uc.UserId == userId && uc.CompanyId == companyId)
            .Select(uc => (CompanyRole?)uc.Role)
            .FirstOrDefaultAsync();
        if (role is null)
        {
            await Results.Problem(title: "Bu şirkete erişim yetkiniz yok.", statusCode: 403).ExecuteAsync(context);
            return;
        }
        if (role == CompanyRole.Viewer && !HttpMethods.IsGet(context.Request.Method))
        {
            await Results.Problem(title: "Salt okuma yetkiniz var; kayıt ekleyemez ya da değiştiremezsiniz.", statusCode: 403).ExecuteAsync(context);
            return;
        }

        tenant.SetCompany(companyId);
        context.Items[HttpCurrentUser.TenantRoleKey] = role;
        await next(context);
    }
}
