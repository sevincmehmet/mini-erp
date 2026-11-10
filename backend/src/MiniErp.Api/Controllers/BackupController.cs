using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Auth;
using MiniErp.Api.Common;
using MiniErp.Application.Abstractions;
using MiniErp.Domain.Common;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record RestoreResult(int Restored, IReadOnlyDictionary<string, int> Counts, string Message);

/// <summary>
/// Aktif şirketin tüm verisini tek bir JSON paketinde döndürür; masaüstü uygulaması bunu yerel diske yazar.
/// Geri yükleme aynı paketi alır ve şirket verisini tamamen onunla değiştirir (tek transaction).
/// </summary>
[ApiController]
[Route("api/backup")]
[RequestSizeLimit(200 * 1024 * 1024)]
public class BackupController(AppDbContext db, ITenantProvider tenant, AuditOptions audit, HttpCurrentUser current, TimeProvider clock) : ControllerBase
{
    public const int SchemaVersion = 2;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
    };

    [HttpGet("export")]
    public async Task<IActionResult> Export(CancellationToken ct)
    {
        if (!tenant.HasTenant) return BadRequest("X-Company-Id header'ı gerekli.");
        var company = await db.Companies.AsNoTracking().FirstAsync(c => c.Id == tenant.CompanyId, ct);
        return Ok(new
        {
            schemaVersion = SchemaVersion,
            exportedAt = DateTime.UtcNow,
            company = new { company.Id, company.Name, company.Currency },
            employees = await db.Employees.AsNoTracking().ToListAsync(ct),
            shiftTemplates = await db.ShiftTemplates.AsNoTracking().ToListAsync(ct),
            shiftAssignments = await db.ShiftAssignments.AsNoTracking().ToListAsync(ct),
            timeEntries = await db.TimeEntries.AsNoTracking().ToListAsync(ct),
            payrolls = await db.Payrolls.AsNoTracking().ToListAsync(ct),
            payrollSettings = await db.PayrollSettings.AsNoTracking().ToListAsync(ct),
            financeCategories = await db.FinanceCategories.AsNoTracking().ToListAsync(ct),
            transactions = await db.IncomeExpenses.AsNoTracking().ToListAsync(ct),
            parties = await db.Parties.AsNoTracking().ToListAsync(ct),
            cariDocuments = await db.CariDocuments.AsNoTracking().ToListAsync(ct),
            cariPayments = await db.CariPayments.AsNoTracking().ToListAsync(ct),
            leaveRequests = await db.LeaveRequests.AsNoTracking().ToListAsync(ct),
            customPages = (await db.CustomPages.AsNoTracking().ToListAsync(ct))
                .Select(p => new { p.Id, p.Title, p.Icon, p.SortOrder, layout = JsonDocument.Parse(p.LayoutJson).RootElement.Clone() }),
            datasets = (await db.Datasets.AsNoTracking().ToListAsync(ct)).Select(DatasetsController.ToDto),
        });
    }

    /// <summary>
    /// Yedekten geri yükleme (yalnızca şirket sahibi). Şirketin mevcut verisi yedektekiyle değiştirilir;
    /// kayıt kimlikleri korunur. Belge ekleri yedekte yoktur ve silinmez.
    /// </summary>
    [HttpPost("restore")]
    [RequireOwner]
    public async Task<RestoreResult> Restore([FromBody] JsonElement body, CancellationToken ct)
    {
        if (!tenant.HasTenant) throw new AppValidationException("Önce bir şirket seçin.");
        var companyId = tenant.CompanyId!.Value;
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("employees", out _))
            throw new AppValidationException("Bu dosya bir Mini-ERP şirket yedeği değil.");

        List<T> Read<T>(string name) where T : TenantEntity
        {
            if (!body.TryGetProperty(name, out var arr) || arr.ValueKind != JsonValueKind.Array) return [];
            var list = arr.Deserialize<List<T>>(Json) ?? [];
            foreach (var e in list) e.CompanyId = companyId; // başka şirketin yedeği bu şirkete alınabilir
            return list;
        }

        var employees = Read<Employee>("employees");
        var templates = Read<ShiftTemplate>("shiftTemplates");
        var assignments = Read<ShiftAssignment>("shiftAssignments");
        var entries = Read<TimeEntry>("timeEntries");
        var payrolls = Read<Payroll>("payrolls");
        var settings = Read<PayrollSettings>("payrollSettings");
        var categories = Read<FinanceCategory>("financeCategories");
        var transactions = Read<IncomeExpense>("transactions");
        var parties = Read<Party>("parties");
        var cariDocs = Read<CariDocument>("cariDocuments");
        var cariPayments = Read<CariPayment>("cariPayments");
        var leaves = Read<LeaveRequest>("leaveRequests");

        var pages = new List<CustomPage>();
        if (body.TryGetProperty("customPages", out var pagesJson) && pagesJson.ValueKind == JsonValueKind.Array)
            foreach (var p in pagesJson.EnumerateArray())
                pages.Add(new CustomPage
                {
                    Id = p.GetProperty("id").GetGuid(), CompanyId = companyId, Title = p.GetProperty("title").GetString() ?? "Sayfa",
                    Icon = p.TryGetProperty("icon", out var ic) ? ic.GetString() : null, SortOrder = p.TryGetProperty("sortOrder", out var so) ? so.GetInt32() : 0,
                    LayoutJson = p.TryGetProperty("layout", out var lj) ? lj.GetRawText() : "{\"widgets\":[]}",
                });
        var datasets = new List<Dataset>();
        if (body.TryGetProperty("datasets", out var dsJson) && dsJson.ValueKind == JsonValueKind.Array)
            foreach (var d in dsJson.EnumerateArray())
                datasets.Add(new Dataset
                {
                    Id = d.GetProperty("id").GetGuid(), CompanyId = companyId, Name = d.GetProperty("name").GetString() ?? "Veri",
                    Description = d.TryGetProperty("description", out var de) ? de.GetString() : null,
                    SourceFileName = d.TryGetProperty("sourceFileName", out var sf) ? sf.GetString() : null,
                    SourceSheet = d.TryGetProperty("sourceSheet", out var ss) ? ss.GetString() : null,
                    ColumnsJson = d.GetProperty("columns").GetRawText(), RowsJson = d.GetProperty("rows").GetRawText(),
                    RowCount = d.TryGetProperty("rowCount", out var rc) ? rc.GetInt32() : 0, RefreshedAt = clock.GetUtcNow().UtcDateTime,
                });

        // Gezinme özelliklerini boşalt: EF yalnızca listelerdeki kayıtları eklesin (kopya graf oluşmasın)
        foreach (var e in employees) { e.ShiftAssignments = []; e.TimeEntries = []; e.Payrolls = []; }
        foreach (var t in templates) t.Assignments = [];
        foreach (var a in assignments) a.TimeEntry = null;
        foreach (var t in entries) t.ShiftAssignment = null;
        foreach (var p in payrolls) p.Transaction = null;
        foreach (var c in categories) c.Transactions = [];
        foreach (var t in transactions) { t.Category = null; t.Payroll = null; }
        foreach (var p in parties) p.Documents = [];
        foreach (var d in cariDocs) d.Payments = [];

        var counts = new Dictionary<string, int>
        {
            ["Personel"] = employees.Count, ["Vardiya tanımı"] = templates.Count, ["Vardiya"] = assignments.Count, ["Mesai kaydı"] = entries.Count,
            ["Bordro"] = payrolls.Count, ["Gelir-gider"] = transactions.Count, ["Cari"] = parties.Count, ["Cari belge"] = cariDocs.Count,
            ["İzin"] = leaves.Count, ["Sayfa"] = pages.Count, ["Veri kümesi"] = datasets.Count,
        };

        audit.Suppress = true; // binlerce satır için ayrı ayrı kayıt yazma; aşağıda tek özet kayıt düşülür
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var trx = await db.Database.BeginTransactionAsync(ct);
            // Çocuktan ebeveyne fiziksel silme (soft delete'ler dahil); ekler korunur
            string[] tables = ["CariPayments", "CariDocuments", "Parties", "LeaveRequests", "IncomeExpenses", "Payrolls", "PayrollSettings", "TimeEntries",
                "ShiftAssignments", "ShiftTemplates", "FinanceCategories", "Employees", "CustomPages", "Datasets"];
            foreach (var table in tables)
            {
#pragma warning disable EF1002 // tablo adları sabit listeden
                await db.Database.ExecuteSqlRawAsync($"DELETE FROM [{table}] WHERE [CompanyId] = {{0}}", [companyId], ct);
#pragma warning restore EF1002
            }
            db.ChangeTracker.Clear();
            db.AddRange(employees); db.AddRange(templates); db.AddRange(categories); db.AddRange(settings);
            db.AddRange(assignments); db.AddRange(entries); db.AddRange(payrolls); db.AddRange(transactions);
            db.AddRange(parties); db.AddRange(cariDocs); db.AddRange(cariPayments); db.AddRange(leaves);
            db.AddRange(pages); db.AddRange(datasets);
            db.AuditLogs.Add(new AuditLog
            {
                CompanyId = companyId, UserId = current.UserId, UserName = current.Name, EntityType = "Company", EntityId = companyId,
                EntityLabel = "Yedekten geri yükleme", Action = AuditAction.Restored, ChangesJson = JsonSerializer.Serialize(counts), At = clock.GetUtcNow().UtcDateTime,
            });
            await db.SaveChangesAsync(ct);
            await trx.CommitAsync(ct);
        });
        audit.Suppress = false;

        var total = counts.Values.Sum();
        return new RestoreResult(total, counts, $"{total:N0} kayıt yedekten geri yüklendi.");
    }
}
