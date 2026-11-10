using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Auth;
using MiniErp.Api.Common;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record SetupRequest(string FullName, string Email, string Password);
public sealed record LoginRequest(string Email, string Password);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record UserCompanyDto(Guid Id, string Name, string? AccentColor, CompanyRole Role);
public sealed record MeDto(Guid Id, string FullName, string Email, IReadOnlyList<UserCompanyDto> Companies);
public sealed record LoginResult(string Token, DateTime ExpiresAt, MeDto User);

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens, TimeProvider clock) : ControllerBase
{
    /// <summary>İlk açılışta kurulum gerekip gerekmediği.</summary>
    [AllowAnonymous, HttpGet("status")]
    public async Task<object> Status([FromServices] IConfiguration config, CancellationToken ct) =>
        new { hasUsers = await db.Users.IgnoreQueryFilters().AnyAsync(ct), demo = config.GetValue<bool>("Demo:Enabled") };

    /// <summary>İlk kurulum: hiç kullanıcı yoksa şirket sahibi hesabı açılır ve tüm şirketlere bağlanır.</summary>
    [AllowAnonymous, EnableRateLimiting("auth"), HttpPost("setup")]
    public async Task<LoginResult> Setup(SetupRequest r, CancellationToken ct)
    {
        if (await db.Users.IgnoreQueryFilters().AnyAsync(ct)) throw new AppValidationException("Kurulum zaten yapılmış; giriş yapın.");
        var user = NewUser(r.FullName, r.Email, r.Password);
        db.Users.Add(user);
        foreach (var company in await db.Companies.ToListAsync(ct))
            db.UserCompanies.Add(new UserCompany { UserId = user.Id, CompanyId = company.Id, Role = CompanyRole.Owner });
        await db.SaveChangesAsync(ct);
        return await Issue(user, ct);
    }

    [AllowAnonymous, EnableRateLimiting("auth"), HttpPost("login")]
    public async Task<LoginResult> Login(LoginRequest r, CancellationToken ct)
    {
        var email = r.Email?.Trim().ToLowerInvariant() ?? "";
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        // Hangi bilginin yanlış olduğu söylenmez
        if (user is null || !user.IsActive || !TokenService.Verify(user, r.Password ?? ""))
        {
            await Task.Delay(400, ct); // kaba kuvvet denemelerini yavaşlat
            throw new AppValidationException("E-posta ya da şifre hatalı.");
        }
        user.LastLoginAt = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return await Issue(user, ct);
    }

    [HttpGet("me")]
    public async Task<MeDto> Me([FromServices] HttpCurrentUser current, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == current.UserId, ct);
        return await ToMe(user, ct);
    }

    [EnableRateLimiting("auth"), HttpPost("change-password")]
    public async Task<LoginResult> ChangePassword(ChangePasswordRequest r, [FromServices] HttpCurrentUser current, CancellationToken ct)
    {
        var user = await db.Users.FirstAsync(u => u.Id == current.UserId, ct);
        if (!TokenService.Verify(user, r.CurrentPassword ?? "")) throw new AppValidationException("Mevcut şifre hatalı.");
        if (TokenService.PasswordProblem(r.NewPassword) is { } problem) throw new AppValidationException(problem);
        user.PasswordHash = TokenService.Hash(user, r.NewPassword);
        user.SecurityStamp++; // diğer cihazlardaki oturumlar kapanır
        await db.SaveChangesAsync(ct);
        return await Issue(user, ct);
    }

    public static AppUser NewUser(string fullName, string email, string password)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(fullName)) errors.Add("Ad soyad boş olamaz.");
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) errors.Add("Geçerli bir e-posta adresi girin.");
        if (TokenService.PasswordProblem(password) is { } problem) errors.Add(problem);
        AppValidationException.ThrowIfAny(errors);
        var user = new AppUser { FullName = fullName.Trim(), Email = email.Trim().ToLowerInvariant() };
        user.PasswordHash = TokenService.Hash(user, password);
        return user;
    }

    private async Task<LoginResult> Issue(AppUser user, CancellationToken ct)
    {
        var (token, expires) = tokens.Create(user);
        return new LoginResult(token, expires, await ToMe(user, ct));
    }

    private async Task<MeDto> ToMe(AppUser user, CancellationToken ct)
    {
        var companies = await db.UserCompanies.AsNoTracking().Where(uc => uc.UserId == user.Id)
            .OrderBy(uc => uc.Company.Name)
            .Select(uc => new UserCompanyDto(uc.CompanyId, uc.Company.Name, uc.Company.AccentColor, uc.Role)).ToListAsync(ct);
        return new MeDto(user.Id, user.FullName, user.Email, companies);
    }
}
