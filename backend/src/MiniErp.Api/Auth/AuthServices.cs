using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using MiniErp.Application.Abstractions;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;

namespace MiniErp.Api.Auth;

public sealed class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "MiniErp";
    public int Hours { get; set; } = 10;
}

/// <summary>Oturum anahtarı (JWT) üretimi ve şifre özeti.</summary>
public sealed class TokenService(JwtOptions options, TimeProvider clock)
{
    private static readonly PasswordHasher<AppUser> Hasher = new();

    public static string Hash(AppUser user, string password) => Hasher.HashPassword(user, password);

    public static bool Verify(AppUser user, string password) =>
        Hasher.VerifyHashedPassword(user, user.PasswordHash, password) != PasswordVerificationResult.Failed;

    public (string Token, DateTime ExpiresAt) Create(AppUser user)
    {
        var expires = clock.GetUtcNow().UtcDateTime.AddHours(options.Hours);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim("stamp", user.SecurityStamp.ToString()),
        };
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(options.Issuer, options.Issuer, claims, expires: expires, signingCredentials: creds);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public static string? PasswordProblem(string? password) =>
        string.IsNullOrEmpty(password) || password.Length < 8 ? "Şifre en az 8 karakter olmalı."
        : !password.Any(char.IsDigit) || !password.Any(char.IsLetter) ? "Şifrede en az bir harf ve bir rakam olmalı."
        : null;
}

/// <summary>İsteği yapan kullanıcı ve aktif şirketteki rolü.</summary>
public sealed class HttpCurrentUser(IHttpContextAccessor http) : ICurrentUser
{
    public Guid? UserId => Guid.TryParse(http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public string? Name => http.HttpContext?.User.FindFirstValue(ClaimTypes.Name);
    public CompanyRole? Role => http.HttpContext?.Items[TenantRoleKey] as CompanyRole?;

    public const string TenantRoleKey = "tenant-role";
}
