using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Api.Services;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

/// <summary>Excel'den yüklenen veri kümeleri. Özel sayfalardaki bileşenler bu verileri okur.</summary>
[ApiController]
[Route("api/datasets")]
[RequestSizeLimit(40 * 1024 * 1024)]
public class DatasetsController(AppDbContext db, TenantContext tenant, TimeProvider clock) : ControllerBase
{
    public const int MaxRows = 50_000;
    public const int MaxColumns = 100;
    private static readonly HashSet<string> Types = ["text", "number", "money", "date"];
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [HttpGet]
    public async Task<IReadOnlyList<DatasetSummaryDto>> GetAll(CancellationToken ct) =>
        (await db.Datasets.AsNoTracking().OrderBy(d => d.Name)
            .Select(d => new { d.Id, d.Name, d.Description, d.SourceFileName, d.SourceSheet, d.ColumnsJson, d.RowCount, d.RefreshedAt })
            .ToListAsync(ct))
        .Select(d => new DatasetSummaryDto(d.Id, d.Name, d.Description, d.SourceFileName, d.SourceSheet, Columns(d.ColumnsJson), d.RowCount, d.RefreshedAt))
        .ToList();

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DatasetDto>> Get(Guid id, CancellationToken ct)
    {
        var d = await db.Datasets.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();
        return ToDto(d);
    }

    [HttpPost]
    public async Task<DatasetSummaryDto> Create(DatasetRequest request, CancellationToken ct)
    {
        if (request.Columns is null || request.Rows is null) throw new AppValidationException("Veri kümesinde sütun ve satır olmalı.");
        var dataset = new Dataset { CompanyId = tenant.CompanyId };
        Apply(dataset, request);
        db.Datasets.Add(dataset);
        await db.SaveChangesAsync(ct);
        return Summary(dataset);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DatasetSummaryDto>> Update(Guid id, DatasetRequest request, CancellationToken ct)
    {
        var dataset = await db.Datasets.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (dataset is null) return NotFound();
        Apply(dataset, request);
        await db.SaveChangesAsync(ct);
        return Summary(dataset);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var dataset = await db.Datasets.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (dataset is null) return NotFound();
        db.Datasets.Remove(dataset);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private void Apply(Dataset d, DatasetRequest r)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(r.Name)) errors.Add("Veri kümesine bir ad verin.");
        if (r.Columns is not null)
        {
            if (r.Columns.Count == 0) errors.Add("En az bir sütun olmalı.");
            if (r.Columns.Count > MaxColumns) errors.Add($"En fazla {MaxColumns} sütun olabilir.");
            if (r.Columns.Select(c => c.Key).Distinct().Count() != r.Columns.Count) errors.Add("Sütun anahtarları benzersiz olmalı.");
            if (r.Columns.Any(c => string.IsNullOrWhiteSpace(c.Key) || !Types.Contains(c.Type))) errors.Add("Geçersiz sütun tanımı.");
        }
        if (r.Rows is not null)
        {
            if (r.Columns is null) errors.Add("Satırlar sütun tanımıyla birlikte gönderilmeli.");
            if (r.Rows.Count > MaxRows) errors.Add($"En fazla {MaxRows:N0} satır yüklenebilir.");
            if (r.Columns is not null && r.Rows.Any(row => row.Length > r.Columns.Count)) errors.Add("Bazı satırlar sütun sayısından uzun.");
        }
        AppValidationException.ThrowIfAny(errors);

        d.Name = r.Name.Trim();
        d.Description = Text.NullIfEmpty(r.Description);
        if (r.Columns is not null && r.Rows is not null)
        {
            d.ColumnsJson = JsonSerializer.Serialize(r.Columns, Json);
            d.RowsJson = JsonSerializer.Serialize(r.Rows, Json);
            d.RowCount = r.Rows.Count;
            d.SourceFileName = Text.NullIfEmpty(r.SourceFileName);
            d.SourceSheet = Text.NullIfEmpty(r.SourceSheet);
            d.RefreshedAt = clock.GetUtcNow().UtcDateTime;
        }
    }

    private static IReadOnlyList<DataColumn> Columns(string json) => JsonSerializer.Deserialize<List<DataColumn>>(json, Json) ?? [];

    private static DatasetSummaryDto Summary(Dataset d) =>
        new(d.Id, d.Name, d.Description, d.SourceFileName, d.SourceSheet, Columns(d.ColumnsJson), d.RowCount, d.RefreshedAt);

    public static DatasetDto ToDto(Dataset d) =>
        new(d.Id, d.Name, d.Description, d.SourceFileName, d.SourceSheet, Columns(d.ColumnsJson),
            JsonSerializer.Deserialize<List<JsonElement[]>>(d.RowsJson, Json) ?? [], d.RowCount, d.RefreshedAt);
}
