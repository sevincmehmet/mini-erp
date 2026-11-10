using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record AttachmentDto(Guid Id, string FileName, string ContentType, long Size, DateTime CreatedAt);

/// <summary>Kayıtlara dosya ekleme (fatura PDF'i, fiş fotoğrafı, sözleşme). En fazla 10 MB.</summary>
[ApiController]
[Route("api/attachments")]
public class AttachmentsController(AppDbContext db, TenantContext tenant) : ControllerBase
{
    private const long MaxBytes = 10 * 1024 * 1024;
    private static readonly HashSet<string> EntityTypes = ["IncomeExpense", "CariDocument", "Employee", "LeaveRequest"];
    private static readonly HashSet<string> Extensions = [".pdf", ".png", ".jpg", ".jpeg", ".heic", ".webp", ".xlsx", ".xls", ".csv", ".docx", ".doc", ".txt"];

    [HttpGet]
    public async Task<IReadOnlyList<AttachmentDto>> Get([FromQuery] string entityType, [FromQuery] Guid entityId, CancellationToken ct) =>
        await db.Attachments.AsNoTracking().Where(a => a.EntityType == entityType && a.EntityId == entityId).OrderBy(a => a.CreatedAt)
            .Select(a => new AttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.CreatedAt)).ToListAsync(ct);

    [HttpPost]
    [RequestSizeLimit(MaxBytes + 1024 * 64)]
    public async Task<AttachmentDto> Upload([FromForm] string entityType, [FromForm] Guid entityId, IFormFile file, CancellationToken ct)
    {
        if (!EntityTypes.Contains(entityType)) throw new AppValidationException("Bu kayıt türüne dosya eklenemez.");
        if (file.Length == 0) throw new AppValidationException("Dosya boş.");
        if (file.Length > MaxBytes) throw new AppValidationException("Dosya 10 MB'tan büyük olamaz.");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!Extensions.Contains(ext)) throw new AppValidationException($"Desteklenmeyen dosya türü ({ext}). PDF, resim, Excel ya da Word ekleyebilirsiniz.");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var a = new Attachment
        {
            CompanyId = tenant.CompanyId, EntityType = entityType, EntityId = entityId,
            FileName = Path.GetFileName(file.FileName), ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            Size = file.Length, Data = ms.ToArray(),
        };
        db.Attachments.Add(a);
        await db.SaveChangesAsync(ct);
        return new AttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.CreatedAt);
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var a = await db.Attachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return a is null ? NotFound() : File(a.Data, a.ContentType, a.FileName);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var a = await db.Attachments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();
        db.Attachments.Remove(a);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
