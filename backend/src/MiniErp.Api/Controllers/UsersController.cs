using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Auth;
using MiniErp.Api.Common;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record CompanyUserDto(Guid Id, string FullName, string Email, CompanyRole Role, bool IsActive, DateTime? LastLoginAt);
public sealed record AddUserRequest(string FullName, string Email, string? Password, CompanyRole Role);
public sealed record UpdateUserRequest(CompanyRole Role, bool IsActive);
public sealed record ResetPasswordRequest(string NewPassword);

/// <summary>Aktif şirketin kullanıcıları ve rolleri. Yalnızca şirket sahibi yönetir.</summary>
[ApiController]
[Route("api/users")]
[RequireOwner]
public class UsersController(AppDbContext db, TenantContext tenant, HttpCurrentUser current) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<CompanyUserDto>> Get(CancellationToken ct) =>
        await db.UserCompanies.AsNoTracking().Where(uc => uc.CompanyId == tenant.CompanyId)
            .OrderBy(uc => uc.User.FullName)
            .Select(uc => new CompanyUserDto(uc.UserId, uc.User.FullName, uc.User.Email, uc.Role, uc.User.IsActive, uc.User.LastLoginAt))
            .ToListAsync(ct);

    /// <summary>E-posta kayıtlıysa kullanıcı bu şirkete bağlanır; değilse yeni hesap açılır (şifre zorunlu).</summary>
    [HttpPost]
    public async Task<IActionResult> Add(AddUserRequest r, CancellationToken ct)
    {
        var email = r.Email?.Trim().ToLowerInvariant() ?? "";
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null)
        {
            user = AuthController.NewUser(r.FullName, email, r.Password ?? "");
            db.Users.Add(user);
        }
        else if (await db.UserCompanies.AnyAsync(uc => uc.UserId == user.Id && uc.CompanyId == tenant.CompanyId, ct))
        {
            throw new AppValidationException("Bu kullanıcının şirkete zaten erişimi var.");
        }
        db.UserCompanies.Add(new UserCompany { UserId = user.Id, CompanyId = tenant.CompanyId, Role = r.Role });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateUserRequest r, CancellationToken ct)
    {
        var link = await db.UserCompanies.Include(uc => uc.User).FirstOrDefaultAsync(uc => uc.UserId == id && uc.CompanyId == tenant.CompanyId, ct);
        if (link is null) return NotFound();
        if (id == current.UserId && (r.Role != CompanyRole.Owner || !r.IsActive)) throw new AppValidationException("Kendi sahiplik yetkinizi kaldıramazsınız.");
        await EnsureAnotherOwner(link, r.Role, ct);
        link.Role = r.Role;
        if (link.User.IsActive != r.IsActive) { link.User.IsActive = r.IsActive; link.User.SecurityStamp++; }
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, ResetPasswordRequest r, CancellationToken ct)
    {
        var link = await db.UserCompanies.Include(uc => uc.User).FirstOrDefaultAsync(uc => uc.UserId == id && uc.CompanyId == tenant.CompanyId, ct);
        if (link is null) return NotFound();
        if (TokenService.PasswordProblem(r.NewPassword) is { } problem) throw new AppValidationException(problem);
        link.User.PasswordHash = TokenService.Hash(link.User, r.NewPassword);
        link.User.SecurityStamp++;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Kullanıcının bu şirkete erişimini kaldırır (hesap silinmez).</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken ct)
    {
        var link = await db.UserCompanies.FirstOrDefaultAsync(uc => uc.UserId == id && uc.CompanyId == tenant.CompanyId, ct);
        if (link is null) return NotFound();
        if (id == current.UserId) throw new AppValidationException("Kendinizi şirketten çıkaramazsınız.");
        await EnsureAnotherOwner(link, CompanyRole.Viewer, ct);
        db.UserCompanies.Remove(link);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task EnsureAnotherOwner(UserCompany link, CompanyRole newRole, CancellationToken ct)
    {
        if (link.Role != CompanyRole.Owner || newRole == CompanyRole.Owner) return;
        var owners = await db.UserCompanies.CountAsync(uc => uc.CompanyId == tenant.CompanyId && uc.Role == CompanyRole.Owner, ct);
        if (owners <= 1) throw new AppValidationException("Şirketin en az bir sahibi olmalı.");
    }
}
