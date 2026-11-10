using Microsoft.AspNetCore.Mvc;
using MiniErp.Api.Contracts;
using MiniErp.Api.Services;

namespace MiniErp.Api.Controllers;

/// <summary>Excel içe aktarımı. Önce dryRun=true ile önizleme, sonra dryRun=false ile kayıt.</summary>
[ApiController]
[Route("api/import")]
[RequestSizeLimit(30 * 1024 * 1024)]
public class ImportController(ImportService import) : ControllerBase
{
    [HttpPost("employees")]
    public Task<ImportResult> Employees(ImportRequest<EmployeeImportRow> request, CancellationToken ct) => import.EmployeesAsync(request, ct);

    [HttpPost("transactions")]
    public Task<ImportResult> Transactions(ImportRequest<TransactionImportRow> request, CancellationToken ct) => import.TransactionsAsync(request, ct);

    [HttpPost("shift-assignments")]
    public Task<ImportResult> ShiftAssignments(ImportRequest<ShiftAssignmentImportRow> request, CancellationToken ct) => import.ShiftAssignmentsAsync(request, ct);

    [HttpPost("cari-documents")]
    public Task<ImportResult> CariDocuments(ImportRequest<CariDocumentImportRow> request, CancellationToken ct) => import.CariDocumentsAsync(request, ct);

    [HttpPost("time-entries")]
    public Task<ImportResult> TimeEntries(ImportRequest<TimeEntryImportRow> request, CancellationToken ct) => import.TimeEntriesAsync(request, ct);
}
