using MiniErp.Domain.Common;

namespace MiniErp.Domain.Entities;

/// <summary>
/// Kullanıcının Excel'den yüklediği tablo (veri kümesi). Sütun tanımları ve satırlar JSON olarak saklanır;
/// böylece her Excel için ayrı tablo açmadan özel sayfalarda kullanılabilir.
/// </summary>
public class Dataset : TenantEntity
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? SourceFileName { get; set; }
    public string? SourceSheet { get; set; }

    /// <summary>[{ "key": "tutar", "name": "Tutar", "type": "money" }, ...]</summary>
    public string ColumnsJson { get; set; } = "[]";

    /// <summary>Satırlar, sütun sırasıyla dizi dizisi: [["2026-10-01", 1500, "Kira"], ...]</summary>
    public string RowsJson { get; set; } = "[]";

    public int RowCount { get; set; }
    public DateTime RefreshedAt { get; set; }
}

/// <summary>Kullanıcının bileşenlerle oluşturduğu sayfa. Yerleşim ve bileşen ayarları JSON olarak saklanır.</summary>
public class CustomPage : TenantEntity
{
    public string Title { get; set; } = default!;
    public string? Icon { get; set; }
    public int SortOrder { get; set; }

    /// <summary>{ "widgets": [ { "id", "type", "size", "source", ... } ] }</summary>
    public string LayoutJson { get; set; } = "{\"widgets\":[]}";
}
