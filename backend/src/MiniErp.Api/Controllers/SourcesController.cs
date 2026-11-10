using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Contracts;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

/// <summary>
/// Sistem verilerini, Excel veri kümeleriyle aynı tablo biçiminde sunar.
/// Böylece özel sayfalardaki bir grafik "Gelir-Gider"e de, yüklenmiş bir Excel'e de aynı şekilde bağlanır.
/// </summary>
[ApiController]
[Route("api/sources")]
public class SourcesController(AppDbContext db) : ControllerBase
{
    private const int MaxRows = 50_000;

    public sealed record SourceData(IReadOnlyList<DataColumn> Columns, IReadOnlyList<object?[]> Rows);

    private static string D(DateOnly d) => d.ToString("yyyy-MM-dd");
    private static string? T(DateTime? d) => d?.ToString("HH:mm");
    private static DataColumn C(string key, string name, string type = "text") => new(key, name, type);

    private static readonly Dictionary<ShiftStatus, string> ShiftStatusTr = new()
    {
        [ShiftStatus.Planned] = "Planlandı", [ShiftStatus.Completed] = "Tamamlandı", [ShiftStatus.Absent] = "Gelmedi", [ShiftStatus.Leave] = "İzinli",
    };
    private static readonly Dictionary<PayrollStatus, string> PayrollStatusTr = new()
    {
        [PayrollStatus.Draft] = "Taslak", [PayrollStatus.Approved] = "Onaylandı", [PayrollStatus.Paid] = "Ödendi",
    };

    [HttpGet("{key}")]
    public async Task<ActionResult<SourceData>> Get(string key, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        var start = from ?? DateOnly.MinValue;
        var end = to ?? DateOnly.MaxValue;
        var startTime = start.ToDateTime(TimeOnly.MinValue);
        var endTime = end == DateOnly.MaxValue ? DateTime.MaxValue : end.AddDays(1).ToDateTime(TimeOnly.MinValue);

        switch (key)
        {
            case "personel":
            {
                var rows = await db.Employees.AsNoTracking().OrderBy(e => e.FirstName).Take(MaxRows).ToListAsync(ct);
                return new SourceData(
                    [C("sicil", "Sicil No"), C("adSoyad", "Ad Soyad"), C("pozisyon", "Pozisyon"), C("iseGiris", "İşe Giriş", "date"),
                     C("durum", "Durum"), C("ucretTipi", "Ücret Tipi"), C("brutMaas", "Brüt Maaş", "money"), C("saatUcreti", "Saat Ücreti", "money")],
                    rows.Select(e => new object?[]
                    {
                        e.EmployeeNumber, $"{e.FirstName} {e.LastName}", e.Position, D(e.HireDate), e.IsActive ? "Aktif" : "Pasif",
                        e.PayType == PayType.Monthly ? "Aylık" : "Saatlik", e.PayType == PayType.Monthly ? e.BaseSalary : null, e.HourlyRate,
                    }).ToList());
            }
            case "gelir-gider":
            {
                var rows = await db.IncomeExpenses.AsNoTracking()
                    .Where(t => t.Date >= start && t.Date <= end).OrderBy(t => t.Date).Take(MaxRows)
                    .Select(t => new { t.Date, t.Type, Category = t.Category != null ? t.Category.Name : null, t.Description, t.DocumentNo, t.Amount, Payroll = t.PayrollId != null })
                    .ToListAsync(ct);
                return new SourceData(
                    [C("tarih", "Tarih", "date"), C("tur", "Tür"), C("kategori", "Kategori"), C("aciklama", "Açıklama"), C("belgeNo", "Belge No"),
                     C("tutar", "Tutar", "money"), C("gelir", "Gelir", "money"), C("gider", "Gider", "money"), C("net", "Net (+ gelir / − gider)", "money")],
                    rows.Select(t => new object?[]
                    {
                        D(t.Date), t.Type == TransactionType.Income ? "Gelir" : "Gider", t.Category ?? "Kategorisiz", t.Description, t.DocumentNo, t.Amount,
                        t.Type == TransactionType.Income ? t.Amount : 0m, t.Type == TransactionType.Expense ? t.Amount : 0m,
                        t.Type == TransactionType.Income ? t.Amount : -t.Amount,
                    }).ToList());
            }
            case "puantaj":
            {
                var rows = await db.TimeEntries.AsNoTracking()
                    .Where(t => t.ClockIn >= startTime && t.ClockIn < endTime).OrderBy(t => t.ClockIn).Take(MaxRows)
                    .Select(t => new
                    {
                        t.ClockIn, t.ClockOut, Name = t.Employee.FirstName + " " + t.Employee.LastName, t.Employee.Position,
                        Shift = t.ShiftAssignment != null ? t.ShiftAssignment.ShiftTemplate.Name : null, t.WorkedHours, t.OvertimeHours,
                    })
                    .ToListAsync(ct);
                return new SourceData(
                    [C("tarih", "Tarih", "date"), C("calisan", "Çalışan"), C("pozisyon", "Pozisyon"), C("vardiya", "Vardiya"), C("giris", "Giriş"),
                     C("cikis", "Çıkış"), C("calisilanSaat", "Çalışılan Saat", "number"), C("fazlaMesai", "Fazla Mesai (saat)", "number")],
                    rows.Select(t => new object?[]
                    {
                        D(DateOnly.FromDateTime(t.ClockIn)), t.Name, t.Position, t.Shift ?? "Plansız", T(t.ClockIn), T(t.ClockOut), t.WorkedHours, t.OvertimeHours,
                    }).ToList());
            }
            case "bordro":
            {
                var rows = await db.Payrolls.AsNoTracking()
                    .Where(p => (p.Year > start.Year || (p.Year == start.Year && p.Month >= start.Month))
                                && (p.Year < end.Year || (p.Year == end.Year && p.Month <= end.Month)))
                    .OrderBy(p => p.Year).ThenBy(p => p.Month).Take(MaxRows)
                    .Select(p => new
                    {
                        p.Year, p.Month, Name = p.Employee.FirstName + " " + p.Employee.LastName, p.Employee.Position, p.RegularHours, p.OvertimeHours,
                        p.BasePay, p.OvertimePay, p.Bonus, p.Deductions, p.GrossPay, p.NetPay, p.Status,
                    })
                    .ToListAsync(ct);
                return new SourceData(
                    [C("donem", "Dönem", "date"), C("calisan", "Çalışan"), C("pozisyon", "Pozisyon"), C("normalSaat", "Normal Saat", "number"),
                     C("fmSaat", "Fazla Mesai (saat)", "number"), C("temel", "Temel Ücret", "money"), C("fmUcreti", "Fazla Mesai Ücreti", "money"),
                     C("prim", "Prim", "money"), C("kesinti", "Kesinti", "money"), C("brut", "Brüt", "money"), C("net", "Net", "money"), C("durum", "Durum")],
                    rows.Select(p => new object?[]
                    {
                        D(new DateOnly(p.Year, p.Month, 1)), p.Name, p.Position, p.RegularHours, p.OvertimeHours, p.BasePay, p.OvertimePay,
                        p.Bonus, p.Deductions, p.GrossPay, p.NetPay, PayrollStatusTr[p.Status],
                    }).ToList());
            }
            case "vardiya":
            {
                var rows = await db.ShiftAssignments.AsNoTracking()
                    .Where(a => a.Date >= start && a.Date <= end).OrderBy(a => a.Date).Take(MaxRows)
                    .Select(a => new
                    {
                        a.Date, Name = a.Employee.FirstName + " " + a.Employee.LastName, a.Employee.Position, Shift = a.ShiftTemplate.Name, a.Status,
                        Worked = a.TimeEntry != null ? (decimal?)a.TimeEntry.WorkedHours : null,
                    })
                    .ToListAsync(ct);
                return new SourceData(
                    [C("tarih", "Tarih", "date"), C("calisan", "Çalışan"), C("pozisyon", "Pozisyon"), C("vardiya", "Vardiya"), C("durum", "Durum"),
                     C("calisilanSaat", "Çalışılan Saat", "number")],
                    rows.Select(a => new object?[] { D(a.Date), a.Name, a.Position, a.Shift, ShiftStatusTr[a.Status], a.Worked }).ToList());
            }
            default:
                return NotFound();
        }
    }
}
