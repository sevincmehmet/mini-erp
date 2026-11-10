using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

[ApiController]
[Route("api/finance")]
public class FinanceController(AppDbContext db, TenantContext tenant, FinanceService finance) : ControllerBase
{
    [HttpGet("categories")]
    public async Task<IReadOnlyList<CategoryDto>> Categories(CancellationToken ct) =>
        await db.FinanceCategories.AsNoTracking().OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Type)).ToListAsync(ct);

    [HttpPost("categories")]
    public async Task<CategoryDto> CreateCategory(CategoryRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) throw new AppValidationException("Kategori adı boş olamaz.");
        var category = await finance.GetOrCreateCategoryAsync(request.Name, request.Type, ct);
        await db.SaveChangesAsync(ct);
        return new CategoryDto(category.Id, category.Name, category.Type);
    }

    [HttpGet("transactions")]
    public async Task<IReadOnlyList<TransactionDto>> Transactions(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct) =>
        await db.IncomeExpenses.AsNoTracking()
            .Where(t => t.Date >= from && t.Date <= to)
            .OrderByDescending(t => t.Date).ThenByDescending(t => t.Amount)
            .Select(t => new TransactionDto(t.Id, t.Type, t.Amount, t.Date, t.Description, t.DocumentNo,
                t.CategoryId, t.Category != null ? t.Category.Name : null, t.PayrollId != null))
            .ToListAsync(ct);

    [HttpPost("transactions")]
    public async Task<IActionResult> Create(TransactionRequest request, CancellationToken ct)
    {
        var tx = new IncomeExpense { CompanyId = tenant.CompanyId };
        await ApplyAsync(tx, request, ct);
        db.IncomeExpenses.Add(tx);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("transactions/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, TransactionRequest request, CancellationToken ct)
    {
        var tx = await db.IncomeExpenses.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tx is null) return NotFound();
        if (tx.PayrollId != null) throw new AppValidationException("Maaş ödemesi kayıtları bordro ekranından yönetilir.");
        await ApplyAsync(tx, request, ct);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("transactions/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tx = await db.IncomeExpenses.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tx is null) return NotFound();
        if (tx.PayrollId != null) throw new AppValidationException("Maaş ödemesi kayıtları bordro ekranından yönetilir.");
        db.IncomeExpenses.Remove(tx);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task ApplyAsync(IncomeExpense tx, TransactionRequest r, CancellationToken ct)
    {
        var errors = new List<string>();
        if (r.Amount <= 0) errors.Add("Tutar sıfırdan büyük olmalı.");
        if (string.IsNullOrWhiteSpace(r.Description)) errors.Add("Açıklama boş olamaz.");
        AppValidationException.ThrowIfAny(errors);

        Guid? categoryId = null;
        if (r.CategoryId is { } id)
        {
            var category = await db.FinanceCategories.FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new AppValidationException("Kategori bulunamadı.");
            if (category.Type != r.Type) throw new AppValidationException($"\"{category.Name}\" bir {(category.Type == Domain.Enums.TransactionType.Income ? "gelir" : "gider")} kategorisi.");
            categoryId = category.Id;
        }
        else if (Text.NullIfEmpty(r.CategoryName) is { } name)
        {
            categoryId = (await finance.GetOrCreateCategoryAsync(name, r.Type, ct)).Id;
        }

        tx.Type = r.Type;
        tx.Amount = r.Amount;
        tx.Date = r.Date;
        tx.Description = r.Description.Trim();
        tx.DocumentNo = Text.NullIfEmpty(r.DocumentNo);
        tx.CategoryId = categoryId;
    }
}
