using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Auth;
using MiniErp.Api.Common;
using MiniErp.Api.Services;
using MiniErp.Domain.Common;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record TrashItem(string Type, string TypeLabel, Guid Id, string Label, string? Detail, DateTime? DeletedAt);
public sealed record TrashRef(string Type, Guid Id);

/// <summary>Çöp kutusu: silinen kayıtlar (soft delete) geri getirilebilir; şirket sahibi kalıcı silebilir.</summary>
[ApiController]
[Route("api/trash")]
public class TrashController(AppDbContext db, TenantContext tenant) : ControllerBase
{
    private IQueryable<T> Deleted<T>() where T : TenantEntity => db.Set<T>().IgnoreQueryFilters().Where(e => e.CompanyId == tenant.CompanyId && e.IsDeleted);

    [HttpGet]
    public async Task<IReadOnlyList<TrashItem>> Get(CancellationToken ct)
    {
        var items = new List<TrashItem>();
        items.AddRange((await Deleted<Employee>().ToListAsync(ct)).Select(e => new TrashItem("employee", "Personel", e.Id, $"{e.FirstName} {e.LastName}", e.Position, e.UpdatedAt)));
        items.AddRange((await Deleted<IncomeExpense>().ToListAsync(ct)).Select(e => new TrashItem("transaction", "Gelir-gider", e.Id, e.Description, $"{e.Amount:N2} ₺ · {e.Date:dd.MM.yyyy}", e.UpdatedAt)));
        items.AddRange((await Deleted<TimeEntry>().Include(t => t.Employee).ToListAsync(ct)).Select(e => new TrashItem("timeEntry", "Mesai kaydı", e.Id, $"{e.Employee?.FirstName} {e.Employee?.LastName}", $"{e.ClockIn:dd.MM.yyyy HH:mm}", e.UpdatedAt)));
        items.AddRange((await Deleted<ShiftAssignment>().ToListAsync(ct)).Select(e => new TrashItem("shift", "Vardiya", e.Id, $"Vardiya · {e.Date:dd.MM.yyyy}", null, e.UpdatedAt)));
        items.AddRange((await Deleted<Party>().ToListAsync(ct)).Select(e => new TrashItem("party", "Cari", e.Id, e.Name, null, e.UpdatedAt)));
        items.AddRange((await Deleted<CariDocument>().ToListAsync(ct)).Select(e => new TrashItem("cariDocument", "Cari belge", e.Id, e.DocumentNo ?? e.Description ?? "Belge", $"{e.Amount:N2} ₺", e.UpdatedAt)));
        items.AddRange((await Deleted<LeaveRequest>().ToListAsync(ct)).Select(e => new TrashItem("leave", "İzin", e.Id, $"{e.StartDate:dd.MM.yyyy} – {e.EndDate:dd.MM.yyyy}", null, e.UpdatedAt)));
        items.AddRange((await Deleted<CustomPage>().ToListAsync(ct)).Select(e => new TrashItem("page", "Sayfa", e.Id, e.Title, null, e.UpdatedAt)));
        items.AddRange((await Deleted<Dataset>().Select(d => new { d.Id, d.Name, d.RowCount, d.UpdatedAt }).ToListAsync(ct)).Select(e => new TrashItem("dataset", "Veri kümesi", e.Id, e.Name, $"{e.RowCount} satır", e.UpdatedAt)));
        items.AddRange((await Deleted<Attachment>().Select(a => new { a.Id, a.FileName, a.Size, a.UpdatedAt }).ToListAsync(ct)).Select(e => new TrashItem("attachment", "Belge eki", e.Id, e.FileName, $"{e.Size / 1024} KB", e.UpdatedAt)));
        return items.OrderByDescending(i => i.DeletedAt).ToList();
    }

    [HttpPost("restore")]
    public async Task<IActionResult> Restore(TrashRef r, CancellationToken ct)
    {
        var entity = await Find(r, ct) ?? throw new AppValidationException("Kayıt çöp kutusunda bulunamadı.");
        entity.IsDeleted = false; // değişiklik kaydına "geri getirildi" olarak düşer
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Kalıcı silme: geri alınamaz. Bağlı kayıtları olan (ör. mesai kaydı olan çalışan) silinemez.</summary>
    [HttpDelete("{type}/{id:guid}")]
    [RequireOwner]
    public async Task<IActionResult> Purge(string type, Guid id, CancellationToken ct)
    {
        var entity = await Find(new TrashRef(type, id), ct);
        if (entity is null) return NotFound();
        db.Entry(entity).State = EntityState.Detached;
        // Soft delete interceptor'ı atlamak için doğrudan SQL
        var table = db.Model.FindEntityType(entity.GetType())!.GetTableName();
        try
        {
#pragma warning disable EF1002 // tablo adı modelden geliyor
            await db.Database.ExecuteSqlRawAsync($"DELETE FROM [{table}] WHERE [Id] = {{0}} AND [CompanyId] = {{1}} AND [IsDeleted] = 1", id, tenant.CompanyId);
#pragma warning restore EF1002
        }
        catch (Exception ex) when (MiniErp.Infrastructure.Persistence.DbErrors.IsForeignKeyViolation(ex))
        {
            throw new AppValidationException("Bu kayda bağlı başka kayıtlar var (ör. mesai, bordro, ödeme); kalıcı olarak silinemez.");
        }
        return NoContent();
    }

    private async Task<TenantEntity?> Find(TrashRef r, CancellationToken ct) => r.Type switch
    {
        "employee" => await Deleted<Employee>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "transaction" => await Deleted<IncomeExpense>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "timeEntry" => await Deleted<TimeEntry>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "shift" => await Deleted<ShiftAssignment>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "party" => await Deleted<Party>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "cariDocument" => await Deleted<CariDocument>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "leave" => await Deleted<LeaveRequest>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "page" => await Deleted<CustomPage>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "dataset" => await Deleted<Dataset>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        "attachment" => await Deleted<Attachment>().FirstOrDefaultAsync(e => e.Id == r.Id, ct),
        _ => null,
    };
}
