using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Contracts;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Services;

/// <summary>
/// Excel satırlarını doğrular ve (dryRun=false ise) yazar.
/// Her içe aktarım tek SaveChanges ile yapılır: ya geçerli satırların hepsi yazılır ya hiçbiri.
/// Var olan kayıtlar güncellenir (personelde sicil no, gelir-giderde belge no, vardiyada çalışan+gün+vardiya, mesaide çalışan+giriş saati),
/// böylece aynı Excel tekrar aktarıldığında kopya kayıt oluşmaz.
/// </summary>
public sealed class ImportService(AppDbContext db, TenantContext tenant, FinanceService finance)
{
    public const int MaxRows = 20_000;

    private sealed class Tally
    {
        public int Created, Updated, Skipped;
        public readonly List<ImportRowError> Errors = [];
        public void Fail(int row, IEnumerable<string> messages) { Errors.Add(new ImportRowError(row, string.Join(" ", messages))); Skipped++; }
        public ImportResult ToResult(bool dryRun, int total) => new(dryRun, total, Created, Updated, Skipped, Errors);
    }

    private static void Guard<T>(ImportRequest<T> request)
    {
        if (request.Rows is null || request.Rows.Count == 0) throw new AppValidationException("Aktarılacak satır yok.");
        if (request.Rows.Count > MaxRows) throw new AppValidationException($"Tek seferde en fazla {MaxRows:N0} satır aktarılabilir.");
    }

    // ---------------------------------------------------------------- Personel
    public async Task<ImportResult> EmployeesAsync(ImportRequest<EmployeeImportRow> request, CancellationToken ct)
    {
        Guard(request);
        var tally = new Tally();
        var existing = await db.Employees.ToListAsync(ct);
        var byNumber = existing.Where(e => e.EmployeeNumber != null).GroupBy(e => Text.Normalize(e.EmployeeNumber)).ToDictionary(g => g.Key, g => g.First());
        var byName = existing.ToLookup(e => Text.Normalize($"{e.FirstName} {e.LastName}"));
        var seen = new HashSet<string>();
        var today = DateOnly.FromDateTime(DateTime.Today);

        foreach (var r in request.Rows)
        {
            var errors = new List<string>();
            var first = Text.NullIfEmpty(r.FirstName);
            var last = Text.NullIfEmpty(r.LastName);
            if (first is null) errors.Add("Ad boş.");
            if (last is null) errors.Add("Soyad boş.");

            var payType = Text.Normalize(r.PayType) switch
            {
                "" or "aylik" or "monthly" or "maasli" => PayType.Monthly,
                "saatlik" or "hourly" or "saat" => PayType.Hourly,
                _ => (PayType?)null,
            };
            if (payType is null) errors.Add($"Ücret tipi anlaşılamadı: \"{r.PayType}\" (Aylık / Saatlik).");
            if (payType == PayType.Monthly && (r.BaseSalary is null or <= 0)) errors.Add("Aylık ücretli için brüt maaş gerekli.");
            if (payType == PayType.Hourly && (r.HourlyRate is null or <= 0)) errors.Add("Saatlik ücretli için saat ücreti gerekli.");
            if (r.NationalId is { Length: > 0 } tc && (tc.Trim().Length != 11 || !tc.Trim().All(char.IsDigit))) errors.Add("TC kimlik no 11 haneli olmalı.");

            var number = Text.NullIfEmpty(r.EmployeeNumber);
            if (number != null && !seen.Add(Text.Normalize(number))) errors.Add($"Sicil no dosyada birden fazla kez geçiyor: {number}.");

            if (errors.Count > 0) { tally.Fail(r.Row, errors); continue; }

            // Eşleştirme: önce sicil no, sicil yoksa tekil ad soyad
            Employee? target = null;
            if (number != null) byNumber.TryGetValue(Text.Normalize(number), out target);
            else if (byName[Text.Normalize($"{first} {last}")].ToList() is [var only]) target = only;

            if (target is null)
            {
                tally.Created++;
                if (request.DryRun) continue;
                target = new Employee { CompanyId = tenant.CompanyId, HireDate = r.HireDate ?? today };
                db.Employees.Add(target);
            }
            else
            {
                tally.Updated++;
                if (request.DryRun) continue;
            }

            target.FirstName = first!;
            target.LastName = last!;
            target.EmployeeNumber = number ?? target.EmployeeNumber;
            target.NationalId = Text.NullIfEmpty(r.NationalId) ?? target.NationalId;
            target.Position = Text.NullIfEmpty(r.Position) ?? target.Position;
            target.Phone = Text.NullIfEmpty(r.Phone) ?? target.Phone;
            if (r.HireDate is { } hire) target.HireDate = hire;
            target.PayType = payType!.Value;
            target.BaseSalary = r.BaseSalary ?? (payType == PayType.Hourly ? 0 : target.BaseSalary);
            target.HourlyRate = r.HourlyRate ?? target.HourlyRate;
        }

        if (!request.DryRun) await db.SaveChangesAsync(ct);
        return tally.ToResult(request.DryRun, request.Rows.Count);
    }

    // ---------------------------------------------------------------- Gelir-Gider
    public async Task<ImportResult> TransactionsAsync(ImportRequest<TransactionImportRow> request, CancellationToken ct)
    {
        Guard(request);
        var tally = new Tally();
        var byDoc = (await db.IncomeExpenses.Where(t => t.DocumentNo != null && t.PayrollId == null).ToListAsync(ct))
            .GroupBy(t => Text.Normalize(t.DocumentNo)).ToDictionary(g => g.Key, g => g.First());
        var seen = new HashSet<string>();

        foreach (var r in request.Rows)
        {
            var errors = new List<string>();
            if (r.Date is null) errors.Add("Tarih boş ya da anlaşılamadı.");
            if (r.Amount is null or 0) errors.Add("Tutar boş.");

            // Tür sütunu yoksa: negatif tutar gider, pozitif tutar gelir
            var type = FinanceService.ParseType(r.Type);
            if (type is null && !string.IsNullOrWhiteSpace(r.Type)) errors.Add($"Tür anlaşılamadı: \"{r.Type}\" (Gelir / Gider).");
            type ??= r.Amount < 0 ? TransactionType.Expense : TransactionType.Income;

            var description = Text.NullIfEmpty(r.Description) ?? Text.NullIfEmpty(r.Category);
            if (description is null) errors.Add("Açıklama boş.");

            var doc = Text.NullIfEmpty(r.DocumentNo);
            if (doc != null && !seen.Add(Text.Normalize(doc))) errors.Add($"Belge no dosyada birden fazla kez geçiyor: {doc}.");

            if (errors.Count > 0) { tally.Fail(r.Row, errors); continue; }

            byDoc.TryGetValue(Text.Normalize(doc), out var target);
            if (target is null) tally.Created++; else tally.Updated++;
            if (request.DryRun) continue;

            if (target is null)
            {
                target = new IncomeExpense { CompanyId = tenant.CompanyId };
                db.IncomeExpenses.Add(target);
            }
            target.Type = type.Value;
            target.Amount = Math.Abs(r.Amount!.Value);
            target.Date = r.Date!.Value;
            target.Description = description!;
            target.DocumentNo = doc;
            if (Text.NullIfEmpty(r.Category) is { } categoryName)
            {
                var category = await finance.GetOrCreateCategoryAsync(categoryName, type.Value, ct);
                target.CategoryId = category.Id;
            }
        }

        if (!request.DryRun) await db.SaveChangesAsync(ct);
        return tally.ToResult(request.DryRun, request.Rows.Count);
    }

    // ---------------------------------------------------------------- Vardiya planı
    public async Task<ImportResult> ShiftAssignmentsAsync(ImportRequest<ShiftAssignmentImportRow> request, CancellationToken ct)
    {
        Guard(request);
        var tally = new Tally();
        var employees = await EmployeeLookup.LoadAsync(db, ct);
        var templates = await db.ShiftTemplates.AsNoTracking().ToListAsync(ct);
        var templateByName = templates.GroupBy(t => Text.Normalize(t.Name)).ToDictionary(g => g.Key, g => g.First());
        var templateNames = string.Join(", ", templates.Select(t => t.Name));

        var dates = request.Rows.Where(r => r.Date != null).Select(r => r.Date!.Value).ToList();
        var existing = dates.Count == 0 ? [] : await db.ShiftAssignments
            .Where(a => a.Date >= dates.Min() && a.Date <= dates.Max()).ToListAsync(ct);
        var byKey = existing.ToDictionary(a => (a.EmployeeId, a.Date, a.ShiftTemplateId));
        var seen = new HashSet<(Guid, DateOnly, Guid)>();

        foreach (var r in request.Rows)
        {
            var errors = new List<string>();
            var emp = employees.Resolve(r.Employee, out var empError);
            if (empError != null) errors.Add(empError);
            if (r.Date is null) errors.Add("Tarih boş ya da anlaşılamadı.");

            ShiftTemplate? template = null;
            if (Text.NullIfEmpty(r.Shift) is null) errors.Add("Vardiya adı boş.");
            else if (!templateByName.TryGetValue(Text.Normalize(r.Shift), out template))
            {
                // Çizelgelerde kısaltma yaygındır: "S" → Sabah, "Ak" → Akşam (tek bir vardiyayla eşleşiyorsa)
                var prefix = templateByName.Where(kv => kv.Key.StartsWith(Text.Normalize(r.Shift), StringComparison.Ordinal)).ToList();
                if (prefix.Count == 1) template = prefix[0].Value;
                else errors.Add(prefix.Count > 1
                    ? $"\"{r.Shift}\" birden fazla vardiyaya uyuyor; tam adını yazın."
                    : $"Vardiya bulunamadı: \"{r.Shift}\" (tanımlı vardiyalar: {templateNames}).");
            }

            var status = Text.Normalize(r.Status) switch
            {
                "" or "planlandi" or "plan" or "planned" => ShiftStatus.Planned,
                "tamamlandi" or "calisti" or "completed" or "geldi" => ShiftStatus.Completed,
                "gelmedi" or "devamsiz" or "absent" or "yok" => ShiftStatus.Absent,
                "izin" or "izinli" or "leave" or "rapor" or "raporlu" => ShiftStatus.Leave,
                _ => (ShiftStatus?)null,
            };
            if (status is null) errors.Add($"Durum anlaşılamadı: \"{r.Status}\" (Planlandı / Tamamlandı / Gelmedi / İzinli).");

            if (emp != null && template != null && r.Date != null && !seen.Add((emp.Id, r.Date.Value, template.Id)))
                errors.Add("Bu çalışana aynı gün aynı vardiya dosyada iki kez yazılmış.");

            if (errors.Count > 0) { tally.Fail(r.Row, errors); continue; }

            byKey.TryGetValue((emp!.Id, r.Date!.Value, template!.Id), out var target);
            if (target is null) tally.Created++; else tally.Updated++;
            if (request.DryRun) continue;

            if (target is null)
            {
                target = new ShiftAssignment { CompanyId = tenant.CompanyId, EmployeeId = emp.Id, ShiftTemplateId = template.Id, Date = r.Date.Value };
                db.ShiftAssignments.Add(target);
            }
            target.Status = status!.Value;
            target.Note = Text.NullIfEmpty(r.Note) ?? target.Note;
        }

        if (!request.DryRun) await db.SaveChangesAsync(ct);
        return tally.ToResult(request.DryRun, request.Rows.Count);
    }

    // ---------------------------------------------------------------- Mesai (puantaj)
    public async Task<ImportResult> TimeEntriesAsync(ImportRequest<TimeEntryImportRow> request, CancellationToken ct)
    {
        Guard(request);
        var tally = new Tally();
        var employees = await EmployeeLookup.LoadAsync(db, ct);
        var locked = await new TimeEntryService(db, tenant).LockedPeriodsAsync(ct);

        var dates = request.Rows.Where(r => r.Date != null).Select(r => r.Date!.Value).ToList();
        var minDate = dates.Count > 0 ? dates.Min() : DateOnly.MinValue;
        var maxDate = dates.Count > 0 ? dates.Max() : DateOnly.MinValue;
        var assignments = dates.Count == 0 ? [] : await db.ShiftAssignments.Include(a => a.ShiftTemplate)
            .Where(a => a.Date >= minDate && a.Date <= maxDate).ToListAsync(ct);
        var assignmentsByDay = assignments.ToLookup(a => (a.EmployeeId, a.Date));
        var entries = dates.Count == 0 ? [] : await db.TimeEntries
            .Where(t => t.ClockIn >= minDate.ToDateTime(TimeOnly.MinValue) && t.ClockIn < maxDate.AddDays(1).ToDateTime(TimeOnly.MinValue))
            .ToListAsync(ct);
        var entryByKey = entries.GroupBy(t => (t.EmployeeId, t.ClockIn)).ToDictionary(g => g.Key, g => g.First());
        var linkedAssignments = entries.Where(t => t.ShiftAssignmentId != null).Select(t => t.ShiftAssignmentId!.Value).ToHashSet();
        var seen = new HashSet<(Guid, DateTime)>();

        foreach (var r in request.Rows)
        {
            var errors = new List<string>();
            var emp = employees.Resolve(r.Employee, out var empError);
            if (empError != null) errors.Add(empError);
            if (r.Date is null) errors.Add("Tarih boş ya da anlaşılamadı.");
            if (!Text.TryParseTime(r.ClockIn, out var inTime)) errors.Add($"Giriş saati anlaşılamadı: \"{r.ClockIn}\" (ör. 08:00).");
            if (!Text.TryParseTime(r.ClockOut, out var outTime)) errors.Add($"Çıkış saati anlaşılamadı: \"{r.ClockOut}\" (ör. 17:30).");
            if (r.BreakMinutes is < 0 or > 240) errors.Add("Mola 0–240 dakika olmalı.");
            if (errors.Count > 0) { tally.Fail(r.Row, errors); continue; }

            var clockIn = r.Date!.Value.ToDateTime(inTime);
            var clockOut = r.Date.Value.ToDateTime(outTime);
            if (clockOut <= clockIn) clockOut = clockOut.AddDays(1); // gece vardiyası: ertesi güne taşar

            if (TimeEntryService.LockError(locked, emp!.Id, clockIn) is { } lockError) errors.Add(lockError);
            if (!seen.Add((emp.Id, clockIn))) errors.Add("Aynı çalışan için aynı giriş saati dosyada iki kez var.");
            if (errors.Count > 0) { tally.Fail(r.Row, errors); continue; }

            entryByKey.TryGetValue((emp.Id, clockIn), out var target);
            var assignment = assignmentsByDay[(emp.Id, r.Date.Value)]
                .FirstOrDefault(a => a.Id == target?.ShiftAssignmentId || !linkedAssignments.Contains(a.Id));
            var breakMinutes = r.BreakMinutes ?? assignment?.ShiftTemplate.BreakMinutes ?? 0;
            var planned = assignment != null ? TimeEntryService.PlannedHours(assignment.ShiftTemplate) : TimeEntryService.DefaultDailyHours;
            var (worked, overtime) = TimeEntryService.Compute(clockIn, clockOut, breakMinutes, planned);

            if (target is null) tally.Created++; else tally.Updated++;
            if (request.DryRun) continue;

            if (target is null)
            {
                target = new TimeEntry { CompanyId = tenant.CompanyId, EmployeeId = emp.Id, ClockIn = clockIn };
                db.TimeEntries.Add(target);
            }
            target.ClockOut = clockOut;
            target.BreakMinutes = breakMinutes;
            target.WorkedHours = worked;
            target.OvertimeHours = overtime;
            target.Note = Text.NullIfEmpty(r.Note) ?? target.Note;
            if (assignment != null)
            {
                target.ShiftAssignmentId = assignment.Id;
                assignment.Status = ShiftStatus.Completed;
                linkedAssignments.Add(assignment.Id);
            }
        }

        if (!request.DryRun) await db.SaveChangesAsync(ct);
        return tally.ToResult(request.DryRun, request.Rows.Count);
    }

    // ---------------------------------------------------------------- Cari belgeler (vadeli faturalar)
    public async Task<ImportResult> CariDocumentsAsync(ImportRequest<CariDocumentImportRow> request, CancellationToken ct)
    {
        Guard(request);
        var tally = new Tally();
        var parties = (await db.Parties.ToListAsync(ct)).GroupBy(p => Text.Normalize(p.Name)).ToDictionary(g => g.Key, g => g.First());
        var byDoc = (await db.CariDocuments.Where(d => d.DocumentNo != null).ToListAsync(ct))
            .GroupBy(d => Text.Normalize(d.DocumentNo)).ToDictionary(g => g.Key, g => g.First());
        var seen = new HashSet<string>();

        foreach (var r in request.Rows)
        {
            var errors = new List<string>();
            var partyName = Text.NullIfEmpty(r.Party);
            if (partyName is null) errors.Add("Cari adı boş.");
            var type = Text.Normalize(r.Type) switch
            {
                "alacak" or "satis" or "satis faturasi" or "musteri" or "gelir" or "receivable" => CariDocumentType.Receivable,
                "borc" or "alis" or "alis faturasi" or "tedarikci" or "gider" or "payable" => CariDocumentType.Payable,
                _ => (CariDocumentType?)null,
            };
            if (type is null) errors.Add($"Tür anlaşılamadı: \"{r.Type}\" (Alacak / Borç).");
            if (r.Date is null) errors.Add("Belge tarihi boş ya da anlaşılamadı.");
            if (r.Amount is null or <= 0) errors.Add("Tutar boş ya da sıfır.");
            if (r.DueDate is { } due && r.Date is { } date && due < date) errors.Add("Vade tarihi belge tarihinden önce.");
            var doc = Text.NullIfEmpty(r.DocumentNo);
            if (doc != null && !seen.Add(Text.Normalize(doc))) errors.Add($"Belge no dosyada birden fazla kez geçiyor: {doc}.");
            if (errors.Count > 0) { tally.Fail(r.Row, errors); continue; }

            byDoc.TryGetValue(Text.Normalize(doc), out var target);
            if (target is { } existing && existing.Type != type) { tally.Fail(r.Row, ["Bu belge no başka türde kayıtlı."]); continue; }
            if (target is null) tally.Created++; else tally.Updated++;
            if (request.DryRun) continue;

            if (!parties.TryGetValue(Text.Normalize(partyName), out var party))
            {
                party = new Party { CompanyId = tenant.CompanyId, Name = partyName!, Type = type == CariDocumentType.Receivable ? PartyType.Customer : PartyType.Supplier };
                db.Parties.Add(party);
                parties[Text.Normalize(partyName)] = party;
            }
            if (target is null)
            {
                target = new CariDocument { CompanyId = tenant.CompanyId };
                db.CariDocuments.Add(target);
            }
            target.PartyId = party.Id;
            target.Type = type!.Value;
            target.DocumentNo = doc;
            target.Date = r.Date!.Value;
            target.DueDate = r.DueDate ?? r.Date.Value.AddDays(party.DefaultTermDays);
            target.Amount = r.Amount!.Value;
            target.Description = Text.NullIfEmpty(r.Description) ?? target.Description;
        }

        if (!request.DryRun) await db.SaveChangesAsync(ct);
        return tally.ToResult(request.DryRun, request.Rows.Count);
    }
}
