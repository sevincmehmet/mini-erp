namespace MiniErp.Api.Contracts;

/// <summary>
/// Excel içe aktarımı iki adımlıdır:
/// 1) dryRun=true → hiçbir şey yazılmaz, satır satır hata listesi döner (önizleme).
/// 2) dryRun=false → geçerli satırlar tek bir transaction içinde yazılır; hatalılar atlanır.
/// Masaüstü uygulaması Excel hücrelerini önceden tiplere çevirir (tarih, sayı); burada iş kuralları doğrulanır.
/// </summary>
public sealed record ImportRequest<TRow>(IReadOnlyList<TRow> Rows, bool DryRun = true);

public sealed record ImportRowError(int Row, string Message);

public sealed record ImportResult(bool DryRun, int Total, int Created, int Updated, int Skipped, IReadOnlyList<ImportRowError> Errors);

public sealed record EmployeeImportRow(
    int Row, string? FirstName, string? LastName, string? EmployeeNumber, string? NationalId, string? Position, string? Phone,
    DateOnly? HireDate, string? PayType, decimal? BaseSalary, decimal? HourlyRate);

public sealed record TransactionImportRow(
    int Row, DateOnly? Date, string? Type, decimal? Amount, string? Description, string? Category, string? DocumentNo);

/// <summary>Çalışan: sicil numarası veya "Ad Soyad". Vardiya: vardiya tanımının adı (ör. "Sabah").</summary>
public sealed record ShiftAssignmentImportRow(int Row, string? Employee, DateOnly? Date, string? Shift, string? Status, string? Note);

/// <summary>Giriş/çıkış "08:00" biçiminde; çıkış girişten küçükse ertesi gün sayılır (gece vardiyası).</summary>
public sealed record TimeEntryImportRow(
    int Row, string? Employee, DateOnly? Date, string? ClockIn, string? ClockOut, int? BreakMinutes, string? Note);

/// <summary>Cari belge: "Cari" adıyla eşleşir (yoksa açılır). Tür: Alacak (satış) / Borç (alış). Vade boşsa carinin varsayılan vadesi.</summary>
public sealed record CariDocumentImportRow(int Row, string? Party, string? Type, string? DocumentNo, DateOnly? Date, DateOnly? DueDate, decimal? Amount, string? Description);
