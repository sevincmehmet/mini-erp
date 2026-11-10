using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record PartyDto(Guid Id, string Name, PartyType Type, string? TaxNumber, string? Phone, string? Email, string? Note, int DefaultTermDays,
    decimal ReceivableOpen, decimal PayableOpen, decimal Overdue, int OpenDocuments);
public sealed record PartyRequest(string Name, PartyType Type, string? TaxNumber, string? Phone, string? Email, string? Note, int DefaultTermDays);
public sealed record CariDocumentDto(Guid Id, Guid PartyId, string PartyName, CariDocumentType Type, string? DocumentNo, DateOnly Date, DateOnly DueDate,
    decimal Amount, decimal Paid, decimal Remaining, string Status, int DaysToDue, string? Description);
public sealed record CariDocumentRequest(Guid PartyId, CariDocumentType Type, string? DocumentNo, DateOnly Date, DateOnly DueDate, decimal Amount, string? Description);
public sealed record CariPaymentRequest(DateOnly Date, decimal Amount, string? Method);
public sealed record CariPaymentDto(Guid Id, DateOnly Date, decimal Amount, string? Method);
public sealed record StatementLine(DateOnly Date, string Kind, string? DocumentNo, string? Description, decimal Debit, decimal Credit, decimal Balance);

/// <summary>
/// Cari hesaplar ve vade takibi. Bakiye yönü: müşteriden alacak (+), tedarikçiye borç (−).
/// Tahsilat ve ödemeler gelir-gidere otomatik hareket olarak da yazılır.
/// </summary>
[ApiController]
[Route("api/cari")]
public class CariController(AppDbContext db, TenantContext tenant, FinanceService finance, TimeProvider clock) : ControllerBase
{
    private DateOnly Today => DateOnly.FromDateTime(clock.GetLocalNow().DateTime);

    // ---------------------------------------------------------------- cariler
    [HttpGet("parties")]
    public async Task<IReadOnlyList<PartyDto>> Parties(CancellationToken ct)
    {
        var parties = await db.Parties.AsNoTracking().OrderBy(p => p.Name).ToListAsync(ct);
        var docs = await OpenDocs(ct);
        return parties.Select(p =>
        {
            var mine = docs.Where(d => d.PartyId == p.Id).ToList();
            return new PartyDto(p.Id, p.Name, p.Type, p.TaxNumber, p.Phone, p.Email, p.Note, p.DefaultTermDays,
                mine.Where(d => d.Type == CariDocumentType.Receivable).Sum(d => d.Remaining),
                mine.Where(d => d.Type == CariDocumentType.Payable).Sum(d => d.Remaining),
                mine.Where(d => d.DueDate < Today).Sum(d => d.Remaining),
                mine.Count);
        }).ToList();
    }

    [HttpPost("parties")]
    public async Task<IActionResult> CreateParty(PartyRequest r, CancellationToken ct)
    {
        var party = new Party { CompanyId = tenant.CompanyId };
        ApplyParty(party, r);
        db.Parties.Add(party);
        await db.SaveChangesAsync(ct);
        return Ok(new { party.Id });
    }

    [HttpPut("parties/{id:guid}")]
    public async Task<IActionResult> UpdateParty(Guid id, PartyRequest r, CancellationToken ct)
    {
        var party = await db.Parties.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (party is null) return NotFound();
        ApplyParty(party, r);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("parties/{id:guid}")]
    public async Task<IActionResult> DeleteParty(Guid id, CancellationToken ct)
    {
        var party = await db.Parties.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (party is null) return NotFound();
        if ((await OpenDocs(ct)).Any(d => d.PartyId == id)) throw new AppValidationException("Bu carinin açık belgesi var; önce kapatın ya da silin.");
        db.Parties.Remove(party);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Hesap ekstresi: belgeler ve ödemeler tarih sırasıyla, yürüyen bakiyeyle.</summary>
    [HttpGet("parties/{id:guid}/statement")]
    public async Task<IReadOnlyList<StatementLine>> Statement(Guid id, CancellationToken ct)
    {
        var docs = await db.CariDocuments.AsNoTracking().Where(d => d.PartyId == id).Include(d => d.Payments).ToListAsync(ct);
        var lines = docs.Select(d => (d.Date, Kind: d.Type == CariDocumentType.Receivable ? "Satış faturası" : "Alış faturası", d.DocumentNo, d.Description,
                Debit: d.Type == CariDocumentType.Receivable ? d.Amount : 0m, Credit: d.Type == CariDocumentType.Payable ? d.Amount : 0m))
            .Concat(docs.SelectMany(d => d.Payments.Select(p => (p.Date, Kind: d.Type == CariDocumentType.Receivable ? "Tahsilat" : "Ödeme", d.DocumentNo, Description: (string?)p.Method,
                Debit: d.Type == CariDocumentType.Payable ? p.Amount : 0m, Credit: d.Type == CariDocumentType.Receivable ? p.Amount : 0m))))
            .OrderBy(l => l.Date).ToList();
        decimal balance = 0;
        return lines.Select(l => { balance += l.Debit - l.Credit; return new StatementLine(l.Date, l.Kind, l.DocumentNo, l.Description, l.Debit, l.Credit, balance); }).ToList();
    }

    // ---------------------------------------------------------------- belgeler (vade)
    [HttpGet("documents")]
    public async Task<IReadOnlyList<CariDocumentDto>> Documents([FromQuery] Guid? partyId, [FromQuery] string? status, CancellationToken ct)
    {
        var docs = await db.CariDocuments.AsNoTracking().Include(d => d.Payments).Include(d => d.Party)
            .Where(d => partyId == null || d.PartyId == partyId).OrderBy(d => d.DueDate).ToListAsync(ct);
        return docs.Select(ToDto).Where(d => status switch
        {
            "open" => d.Remaining > 0,
            "overdue" => d.Status == "overdue",
            "paid" => d.Remaining <= 0,
            _ => true,
        }).ToList();
    }

    [HttpPost("documents")]
    public async Task<IActionResult> CreateDocument(CariDocumentRequest r, CancellationToken ct)
    {
        await ValidateDocument(r, ct);
        db.CariDocuments.Add(new CariDocument
        {
            CompanyId = tenant.CompanyId, PartyId = r.PartyId, Type = r.Type, DocumentNo = Text.NullIfEmpty(r.DocumentNo),
            Date = r.Date, DueDate = r.DueDate, Amount = r.Amount, Description = Text.NullIfEmpty(r.Description),
        });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("documents/{id:guid}")]
    public async Task<IActionResult> UpdateDocument(Guid id, CariDocumentRequest r, CancellationToken ct)
    {
        var d = await db.CariDocuments.Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();
        await ValidateDocument(r, ct);
        if (d.Payments.Sum(p => p.Amount) > r.Amount) throw new AppValidationException("Tutar, yapılmış ödemelerin toplamından küçük olamaz.");
        if (d.Payments.Count > 0 && d.Type != r.Type) throw new AppValidationException("Ödemesi olan belgenin türü değiştirilemez.");
        d.PartyId = r.PartyId; d.Type = r.Type; d.DocumentNo = Text.NullIfEmpty(r.DocumentNo);
        d.Date = r.Date; d.DueDate = r.DueDate; d.Amount = r.Amount; d.Description = Text.NullIfEmpty(r.Description);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("documents/{id:guid}")]
    public async Task<IActionResult> DeleteDocument(Guid id, CancellationToken ct)
    {
        var d = await db.CariDocuments.Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();
        if (d.Payments.Count > 0) throw new AppValidationException("Ödemesi olan belge silinemez; önce ödemeleri kaldırın.");
        db.CariDocuments.Remove(d);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------------------------------------------------------------- tahsilat / ödeme
    [HttpGet("documents/{id:guid}/payments")]
    public async Task<IReadOnlyList<CariPaymentDto>> Payments(Guid id, CancellationToken ct) =>
        await db.CariPayments.AsNoTracking().Where(p => p.DocumentId == id).OrderBy(p => p.Date)
            .Select(p => new CariPaymentDto(p.Id, p.Date, p.Amount, p.Method)).ToListAsync(ct);

    [HttpPost("documents/{id:guid}/payments")]
    public async Task<IActionResult> AddPayment(Guid id, CariPaymentRequest r, CancellationToken ct)
    {
        var d = await db.CariDocuments.Include(x => x.Payments).Include(x => x.Party).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();
        var remaining = d.Amount - d.Payments.Sum(p => p.Amount);
        if (r.Amount <= 0) throw new AppValidationException("Tutar sıfırdan büyük olmalı.");
        if (r.Amount > remaining) throw new AppValidationException($"Kalan tutar {remaining:N2} ₺; daha fazlası girilemez.");

        // Gelir-gidere yansıt: tahsilat = gelir, tedarikçi ödemesi = gider
        var income = d.Type == CariDocumentType.Receivable;
        var category = await finance.GetOrCreateCategoryAsync(income ? "Tahsilatlar" : "Tedarikçi Ödemeleri", income ? TransactionType.Income : TransactionType.Expense, ct);
        var tx = new IncomeExpense
        {
            CompanyId = tenant.CompanyId, Type = income ? TransactionType.Income : TransactionType.Expense, Amount = r.Amount, Date = r.Date,
            CategoryId = category.Id, Description = $"{(income ? "Tahsilat" : "Ödeme")} — {d.Party.Name}{(d.DocumentNo is null ? "" : $" ({d.DocumentNo})")}",
            DocumentNo = d.DocumentNo is null ? null : $"{d.DocumentNo}-{d.Payments.Count + 1}",
        };
        db.IncomeExpenses.Add(tx);
        db.CariPayments.Add(new CariPayment { CompanyId = tenant.CompanyId, DocumentId = d.Id, Date = r.Date, Amount = r.Amount, Method = Text.NullIfEmpty(r.Method), TransactionId = tx.Id });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("payments/{id:guid}")]
    public async Task<IActionResult> DeletePayment(Guid id, CancellationToken ct)
    {
        var p = await db.CariPayments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.TransactionId is { } txId && await db.IncomeExpenses.FirstOrDefaultAsync(t => t.Id == txId, ct) is { } tx) db.IncomeExpenses.Remove(tx);
        db.CariPayments.Remove(p);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------------------------------------------------------------- yardımcılar
    private async Task<List<CariDocumentDto>> OpenDocs(CancellationToken ct) =>
        (await db.CariDocuments.AsNoTracking().Include(d => d.Payments).Include(d => d.Party).ToListAsync(ct)).Select(ToDto).Where(d => d.Remaining > 0).ToList();

    private CariDocumentDto ToDto(CariDocument d)
    {
        var paid = d.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount);
        var remaining = d.Amount - paid;
        var days = d.DueDate.DayNumber - Today.DayNumber;
        var status = remaining <= 0 ? "paid" : days < 0 ? "overdue" : days <= 7 ? "due-soon" : paid > 0 ? "partial" : "open";
        return new CariDocumentDto(d.Id, d.PartyId, d.Party?.Name ?? "", d.Type, d.DocumentNo, d.Date, d.DueDate, d.Amount, paid, remaining, status, days, d.Description);
    }

    private static void ApplyParty(Party p, PartyRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) throw new AppValidationException("Cari adı boş olamaz.");
        if (r.DefaultTermDays is < 0 or > 365) throw new AppValidationException("Vade 0–365 gün olmalı.");
        p.Name = r.Name.Trim(); p.Type = r.Type; p.TaxNumber = Text.NullIfEmpty(r.TaxNumber); p.Phone = Text.NullIfEmpty(r.Phone);
        p.Email = Text.NullIfEmpty(r.Email); p.Note = Text.NullIfEmpty(r.Note); p.DefaultTermDays = r.DefaultTermDays;
    }

    private async Task ValidateDocument(CariDocumentRequest r, CancellationToken ct)
    {
        var errors = new List<string>();
        if (!await db.Parties.AnyAsync(p => p.Id == r.PartyId, ct)) errors.Add("Cari bulunamadı.");
        if (r.Amount <= 0) errors.Add("Tutar sıfırdan büyük olmalı.");
        if (r.DueDate < r.Date) errors.Add("Vade tarihi belge tarihinden önce olamaz.");
        AppValidationException.ThrowIfAny(errors);
    }
}
