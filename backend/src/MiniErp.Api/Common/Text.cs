using System.Globalization;
using System.Text;

namespace MiniErp.Api.Common;

public static class Text
{
    /// <summary>
    /// Excel'den gelen isimleri karşılaştırmak için sadeleştirir:
    /// "  Ayşe   DEMİR " → "ayse demir" (Türkçe karakterler, büyük/küçük harf ve fazla boşluk yok sayılır).
    /// </summary>
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var lower = value.Trim().ToLower(new CultureInfo("tr-TR"));
        var sb = new StringBuilder(lower.Length);
        var lastSpace = false;
        foreach (var ch in lower)
        {
            var c = ch switch { 'ç' => 'c', 'ğ' => 'g', 'ı' => 'i', 'ö' => 'o', 'ş' => 's', 'ü' => 'u', 'â' => 'a', 'î' => 'i', 'û' => 'u', _ => ch };
            if (char.IsWhiteSpace(c))
            {
                if (!lastSpace) sb.Append(' ');
                lastSpace = true;
                continue;
            }
            sb.Append(c);
            lastSpace = false;
        }
        return sb.ToString();
    }

    public static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static readonly string[] TimeFormats = ["HH:mm", "H:mm", "HH:mm:ss", "H:mm:ss", "HH.mm", "H.mm"];

    public static bool TryParseTime(string? value, out TimeOnly time) =>
        TimeOnly.TryParseExact(value?.Trim(), TimeFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
}
