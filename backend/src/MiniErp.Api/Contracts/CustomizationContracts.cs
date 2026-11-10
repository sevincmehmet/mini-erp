using System.Text.Json;

namespace MiniErp.Api.Contracts;

/// <summary>Bir sütunun tipi: text | number | money | date</summary>
public sealed record DataColumn(string Key, string Name, string Type);

/// <summary>Bileşenlerin okuduğu ortak tablo biçimi (hem Excel veri kümeleri hem sistem verileri için).</summary>
public sealed record TabularData(IReadOnlyList<DataColumn> Columns, IReadOnlyList<JsonElement[]> Rows);

public sealed record DatasetSummaryDto(
    Guid Id, string Name, string? Description, string? SourceFileName, string? SourceSheet,
    IReadOnlyList<DataColumn> Columns, int RowCount, DateTime RefreshedAt);

public sealed record DatasetDto(
    Guid Id, string Name, string? Description, string? SourceFileName, string? SourceSheet,
    IReadOnlyList<DataColumn> Columns, IReadOnlyList<JsonElement[]> Rows, int RowCount, DateTime RefreshedAt);

/// <summary>Rows null ise yalnızca ad/açıklama güncellenir; doluysa veri tamamen yenilenir.</summary>
public sealed record DatasetRequest(
    string Name, string? Description, string? SourceFileName, string? SourceSheet,
    IReadOnlyList<DataColumn>? Columns, IReadOnlyList<JsonElement[]>? Rows);

public sealed record CustomPageSummaryDto(Guid Id, string Title, string? Icon, int SortOrder);

public sealed record CustomPageDto(Guid Id, string Title, string? Icon, int SortOrder, JsonElement Layout, DateTime? UpdatedAt);

public sealed record CustomPageRequest(string Title, string? Icon, JsonElement Layout);

public sealed record PageOrderRequest(IReadOnlyList<Guid> Ids);
