using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

/// <summary>Kullanıcının oluşturduğu sayfalar. Bileşen yerleşimi istemci tarafında yorumlanır, burada saklanır.</summary>
[ApiController]
[Route("api/pages")]
public class PagesController(AppDbContext db, TenantContext tenant) : ControllerBase
{
    private const int MaxLayoutChars = 1_000_000;

    [HttpGet]
    public async Task<IReadOnlyList<CustomPageSummaryDto>> GetAll(CancellationToken ct) =>
        await db.CustomPages.AsNoTracking().OrderBy(p => p.SortOrder).ThenBy(p => p.Title)
            .Select(p => new CustomPageSummaryDto(p.Id, p.Title, p.Icon, p.SortOrder)).ToListAsync(ct);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomPageDto>> Get(Guid id, CancellationToken ct)
    {
        var p = await db.CustomPages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        return ToDto(p);
    }

    [HttpPost]
    public async Task<CustomPageDto> Create(CustomPageRequest request, CancellationToken ct)
    {
        var page = new CustomPage
        {
            CompanyId = tenant.CompanyId,
            SortOrder = (await db.CustomPages.MaxAsync(p => (int?)p.SortOrder, ct) ?? 0) + 1,
        };
        Apply(page, request);
        db.CustomPages.Add(page);
        await db.SaveChangesAsync(ct);
        return ToDto(page);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CustomPageDto>> Update(Guid id, CustomPageRequest request, CancellationToken ct)
    {
        var page = await db.CustomPages.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (page is null) return NotFound();
        Apply(page, request);
        await db.SaveChangesAsync(ct);
        return ToDto(page);
    }

    [HttpPut("order")]
    public async Task<IActionResult> Reorder(PageOrderRequest request, CancellationToken ct)
    {
        var pages = await db.CustomPages.ToListAsync(ct);
        for (var i = 0; i < request.Ids.Count; i++)
            if (pages.FirstOrDefault(p => p.Id == request.Ids[i]) is { } page) page.SortOrder = i + 1;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var page = await db.CustomPages.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (page is null) return NotFound();
        db.CustomPages.Remove(page);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static void Apply(CustomPage p, CustomPageRequest r)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(r.Title)) errors.Add("Sayfaya bir başlık verin.");
        if (r.Layout.ValueKind != JsonValueKind.Object) errors.Add("Geçersiz sayfa yerleşimi.");
        var json = r.Layout.ValueKind == JsonValueKind.Object ? r.Layout.GetRawText() : "";
        if (json.Length > MaxLayoutChars) errors.Add("Sayfa çok büyük.");
        AppValidationException.ThrowIfAny(errors);

        p.Title = r.Title.Trim();
        p.Icon = Text.NullIfEmpty(r.Icon);
        p.LayoutJson = json;
    }

    private static CustomPageDto ToDto(CustomPage p) =>
        new(p.Id, p.Title, p.Icon, p.SortOrder, JsonDocument.Parse(p.LayoutJson).RootElement.Clone(), p.UpdatedAt ?? p.CreatedAt);
}
