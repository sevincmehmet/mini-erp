using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Auth;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record CompanyRequest(string Name, string? TaxNumber, string? AccentColor);

[ApiController]
[Route("api/companies")]
public class CompaniesController(AppDbContext db, HttpCurrentUser current) : ControllerBase
{
    /// <summary>Kullanıcının erişebildiği şirketler (şirket değiştirici).</summary>
    [HttpGet]
    public async Task<IReadOnlyList<CompanyDto>> GetAll(CancellationToken ct) =>
        await db.UserCompanies.AsNoTracking().Where(uc => uc.UserId == current.UserId)
            .OrderBy(uc => uc.Company.Name)
            .Select(uc => new CompanyDto(uc.CompanyId, uc.Company.Name, uc.Company.Currency, uc.Company.AccentColor))
            .ToListAsync(ct);

    /// <summary>Şirket adı, vergi no ve rengi. Yalnızca o şirketin sahibi değiştirebilir.</summary>
    [HttpPut("{id:guid}")]
    public async Task<CompanyDto> Update(Guid id, CompanyRequest r, CancellationToken ct)
    {
        var isOwner = await db.UserCompanies.AnyAsync(uc => uc.UserId == current.UserId && uc.CompanyId == id && uc.Role == CompanyRole.Owner, ct);
        if (!isOwner) throw new UnauthorizedAccessException("Şirket bilgilerini yalnızca şirket sahibi değiştirebilir.");
        if (string.IsNullOrWhiteSpace(r.Name)) throw new AppValidationException("Şirket adı boş olamaz.");
        var company = await db.Companies.FirstAsync(c => c.Id == id, ct);
        company.Name = r.Name.Trim();
        company.TaxNumber = Text.NullIfEmpty(r.TaxNumber);
        company.AccentColor = Text.NullIfEmpty(r.AccentColor) ?? company.AccentColor;
        await db.SaveChangesAsync(ct);
        return new CompanyDto(company.Id, company.Name, company.Currency, company.AccentColor);
    }
}
