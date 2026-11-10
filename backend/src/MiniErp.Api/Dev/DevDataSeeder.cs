using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Controllers;
using MiniErp.Api.Services;
using MiniErp.Api.Tenancy;
using MiniErp.Application.Abstractions;
using MiniErp.Application.Payroll;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;
using MiniErp.Infrastructure;
using MiniErp.Infrastructure.Persistence;
using MiniErp.Infrastructure.Persistence.Configurations;

namespace MiniErp.Api.Dev;

/// <summary>
/// Yalnızca geliştirme ortamı için gerçekçi örnek veri üretir:
/// `dotnet run --project src/MiniErp.Api -- --seed` (mevcut örnek veriyi silip yeniden üretir).
/// Sabit tohumlu Random kullanır; her çalıştırmada aynı veri oluşur.
/// </summary>
public static class DevDataSeeder
{
    private sealed record EmployeeSeed(string First, string Last, string Position, PayType PayType, decimal Salary, decimal? Hourly, DateOnly Hired);
    private sealed record ShiftSeed(string Name, int StartHour, int EndHour, int Break, string Color);
    private sealed record TxSeed(string Category, TransactionType Type, decimal Min, decimal Max, int PerMonth, string[] Descriptions);

    private sealed record CompanyProfile(
        Guid CompanyId, string Prefix, EmployeeSeed[] Employees, ShiftSeed[] Shifts, bool Rotating, int WorkDaysPerWeek, TxSeed[] Transactions);

    // Örnek veri bugünden geriye 5 ay + bu ay: demo ne zaman açılırsa açılsın güncel görünür
    private static DateOnly From = new(2026, 5, 1);

    public static async Task RunAsync(IServiceProvider root)
    {
        // Şema yoksa uygula
        using (var scope = root.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().EnsureSchemaAsync();
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        From = new DateOnly(today.Year, today.Month, 1).AddMonths(-5);
        foreach (var profile in Profiles())
        {
            using var scope = root.CreateScope();
            scope.ServiceProvider.GetRequiredService<HttpTenantProvider>().SetCompany(profile.CompanyId);
            scope.ServiceProvider.GetRequiredService<AuditOptions>().Suppress = true;
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var settings = scope.ServiceProvider.GetRequiredService<PayrollSettingsService>();

            await WipeAsync(db, profile.CompanyId);
            await SeedCompanyAsync(db, profile, today, settings);
            await SeedCariAsync(db, profile, today);
            Console.WriteLine($"✓ {profile.Prefix}: örnek veri oluşturuldu");
        }

        // Demo kullanıcı: üç şirkete de "Sahip"
        using (var scope = root.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            const string email = "yonetici@ornek.com", password = "MiniErp2026!";
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user is null)
            {
                user = AuthController.NewUser("Mehmet Yönetici", email, password);
                db.Users.Add(user);
            }
            foreach (var c in await db.Companies.ToListAsync())
                if (!await db.UserCompanies.AnyAsync(uc => uc.UserId == user.Id && uc.CompanyId == c.Id))
                    db.UserCompanies.Add(new UserCompany { UserId = user.Id, CompanyId = c.Id, Role = CompanyRole.Owner });
            await db.SaveChangesAsync();
            Console.WriteLine($"✓ Demo kullanıcı: {email} / {password}");
        }
    }

    private static async Task WipeAsync(AppDbContext db, Guid companyId)
    {
        // Ham SQL ile fiziksel silme (soft delete interceptor'ı devreye girmesin). Sıra: çocuktan ebeveyne.
        string[] tables = ["CariPayments", "CariDocuments", "Parties", "LeaveRequests", "Attachments", "IncomeExpenses", "Payrolls", "PayrollSettings",
            "TimeEntries", "ShiftAssignments", "ShiftTemplates", "FinanceCategories", "Employees", "AuditLogs"];
        foreach (var table in tables)
        {
#pragma warning disable EF1002 // tablo adları sabit listeden geliyor
            await db.Database.ExecuteSqlRawAsync($"DELETE FROM [{table}] WHERE [CompanyId] = {{0}}", companyId);
#pragma warning restore EF1002
        }
    }

    private static async Task SeedCompanyAsync(AppDbContext db, CompanyProfile p, DateOnly today, PayrollSettingsService settingsService)
    {
        var rng = new Random(p.Prefix[1] * 7919 + p.Employees.Length);

        // 1) Çalışanlar
        var employees = p.Employees.Select((e, i) => new Employee
        {
            FirstName = e.First, LastName = e.Last, Position = e.Position,
            EmployeeNumber = $"{p.Prefix}-{i + 1:000}", HireDate = e.Hired,
            Phone = $"05{rng.Next(30, 56)} {rng.Next(100, 999)} {rng.Next(10, 99)} {rng.Next(10, 99)}",
            NationalId = SampleTc(rng),
            PayType = e.PayType, BaseSalary = e.Salary, HourlyRate = e.Hourly,
        }).ToList();
        db.Employees.AddRange(employees);

        // 2) Vardiya tanımları
        var templates = p.Shifts.Select(s => new ShiftTemplate
        {
            Name = s.Name, StartTime = new TimeOnly(s.StartHour, 0), EndTime = new TimeOnly(s.EndHour % 24, 0),
            BreakMinutes = s.Break, CrossesMidnight = s.EndHour >= 24, Color = s.Color,
        }).ToList();
        db.ShiftTemplates.AddRange(templates);

        // 3) Vardiya planı + gerçekleşen mesai (geçmiş günler) — 2 hafta ileriye de plan
        var planUntil = today.AddDays(14);
        var timeEntries = new List<TimeEntry>();
        for (var day = From; day <= planUntil; day = day.AddDays(1))
        {
            // Rotasyon haftası pazartesi başlar (vardiya hafta ortasında değişmesin)
            var weekIndex = (day.DayNumber - ((int)day.DayOfWeek + 6) % 7 - From.DayNumber) / 7;
            for (var i = 0; i < employees.Count; i++)
            {
                var emp = employees[i];
                if (emp.HireDate > day) continue;

                // Haftalık izin günü: çalışana göre kaydırılmış (7/24 tesiste herkes aynı gün izinli olmasın)
                var offDays = 7 - p.WorkDaysPerWeek;
                var isOff = p.Rotating
                    ? ((int)day.DayOfWeek + i) % 7 < offDays
                    : day.DayOfWeek == DayOfWeek.Sunday || (offDays >= 2 && day.DayOfWeek == DayOfWeek.Saturday);
                if (isOff) continue;

                var template = p.Rotating ? templates[(i + weekIndex) % templates.Count] : templates[i % templates.Count];
                var isPast = day < today;
                var roll = rng.NextDouble();
                var status = !isPast ? ShiftStatus.Planned
                    : roll < 0.03 ? ShiftStatus.Absent
                    : roll < 0.06 ? ShiftStatus.Leave
                    : ShiftStatus.Completed;

                var assignment = new ShiftAssignment
                {
                    Employee = emp, ShiftTemplate = template, Date = day, Status = status,
                    Note = status == ShiftStatus.Leave ? "Yıllık izin" : status == ShiftStatus.Absent ? "Habersiz devamsızlık" : null,
                };
                db.ShiftAssignments.Add(assignment);

                if (status != ShiftStatus.Completed) continue;

                var start = day.ToDateTime(template.StartTime).AddMinutes(rng.Next(-10, 12));
                var planned = (template.CrossesMidnight ? 24 - template.StartTime.Hour + template.EndTime.Hour : template.EndTime.Hour - template.StartTime.Hour) - template.BreakMinutes / 60m;
                var overtime = rng.NextDouble() < 0.18 ? rng.Next(1, 4) : 0;
                var worked = planned + overtime;
                timeEntries.Add(new TimeEntry
                {
                    // EmployeeId'yi de açıkça veriyoruz: EF ilişki düzeltmesi navigasyonu boşaltabilir, Id kalıcıdır
                    Employee = emp, EmployeeId = emp.Id, ShiftAssignment = assignment, ClockIn = start,
                    ClockOut = start.AddHours((double)(worked + template.BreakMinutes / 60m)).AddMinutes(rng.Next(-5, 10)),
                    BreakMinutes = template.BreakMinutes, WorkedHours = worked, OvertimeHours = overtime,
                    Note = overtime > 0 ? "Fazla mesai" : null,
                });
            }
        }
        db.TimeEntries.AddRange(timeEntries);

        // 4) Finans kategorileri
        var categories = p.Transactions.Select(t => t.Category).Append("Personel Maaşları").Distinct()
            .Select(name =>
            {
                var type = p.Transactions.FirstOrDefault(t => t.Category == name)?.Type ?? TransactionType.Expense;
                return new FinanceCategory { Name = name, Type = type };
            }).ToDictionary(c => c.Name);
        db.FinanceCategories.AddRange(categories.Values);

        // 5) Gelir-gider hareketleri (ay ay)
        var docNo = 1000;
        for (var month = new DateOnly(From.Year, From.Month, 1); month <= today; month = month.AddMonths(1))
        {
            var daysInMonth = DateTime.DaysInMonth(month.Year, month.Month);
            foreach (var t in p.Transactions)
            {
                for (var n = 0; n < t.PerMonth; n++)
                {
                    var date = month.AddDays(rng.Next(0, daysInMonth));
                    if (date > today) continue; // içinde bulunulan ay: sadece gerçekleşmiş günler
                    var amount = Math.Round(((decimal)rng.NextDouble() * (t.Max - t.Min) + t.Min) / 10m) * 10m; // 10 TL katları
                    db.IncomeExpenses.Add(new IncomeExpense
                    {
                        Type = t.Type, Amount = amount, Date = date, Category = categories[t.Category],
                        // Ay içinde açıklama sayısı kadar kayıt varsa sırayla (ör. 1. ve 2. yarım ay), yoksa rastgele
                        Description = t.PerMonth == t.Descriptions.Length ? t.Descriptions[n] : t.Descriptions[rng.Next(t.Descriptions.Length)],
                        DocumentNo = $"{(t.Type == TransactionType.Income ? "FT" : "GD")}{date:yyMM}-{docNo++}",
                    });
                }
            }
        }

        // 6) Bordrolar: tamamlanmış aylar için mevzuat hesabıyla; ödenince gider kaydı oluşur
        var cumulative = new Dictionary<Employee, decimal>();
        for (var month = new DateOnly(From.Year, From.Month, 1); month.AddMonths(1) <= today; month = month.AddMonths(1))
        {
            var cfg = await settingsService.GetAsync(month.Year, CancellationToken.None);
            var parameters = PayrollSettingsService.Parameters(cfg);
            var isLastClosedMonth = month.AddMonths(2) > today;
            foreach (var emp in employees)
            {
                var entries = timeEntries.Where(te => te.EmployeeId == emp.Id && te.ClockIn.Year == month.Year && te.ClockIn.Month == month.Month).ToList();
                if (entries.Count == 0) continue;

                var bonus = rng.NextDouble() < 0.12 ? 2500m : 0m;
                var days = TurkishPayroll.WorkedDays(emp.HireDate, emp.TerminationDate, month.Year, month.Month);
                var calc = PayrollCalculator.Calculate(emp, entries, bonus);
                var basePay = emp.PayType == PayType.Monthly ? Math.Round(emp.BaseSalary * days / 30m, 2) : calc.BasePay;
                var gross = basePay + calc.OvertimePay + bonus;
                var prior = month.Month == 1 ? 0 : cumulative.GetValueOrDefault(emp);
                var r = TurkishPayroll.Calculate(gross, prior, month.Month, days, parameters);
                cumulative[emp] = r.CumulativeTaxBase;

                var payroll = new Payroll
                {
                    Employee = emp, EmployeeId = emp.Id, Year = month.Year, Month = month.Month, WorkedDays = days,
                    RegularHours = calc.RegularHours, OvertimeHours = calc.OvertimeHours, HourlyRateSnapshot = calc.HourlyRate,
                    BasePay = basePay, OvertimePay = calc.OvertimePay, Bonus = bonus, GrossPay = r.Gross,
                    SgkEmployee = r.SgkEmployee, UnemploymentEmployee = r.UnemploymentEmployee, IncomeTax = r.IncomeTax, IncomeTaxExemption = r.IncomeTaxExemption,
                    StampTax = r.StampTax, StampTaxExemption = r.StampTaxExemption, CumulativeTaxBase = r.CumulativeTaxBase,
                    EmployerSgk = r.EmployerSgk, EmployerUnemployment = r.EmployerUnemployment, EmployerCost = r.EmployerCost,
                    Deductions = r.TotalDeductions, NetPay = r.Net,
                    Status = isLastClosedMonth ? PayrollStatus.Approved : PayrollStatus.Paid,
                    PaidAt = isLastClosedMonth ? null : month.AddMonths(1).AddDays(4).ToDateTime(new TimeOnly(10, 0)),
                };
                db.Payrolls.Add(payroll);

                if (payroll.Status == PayrollStatus.Paid)
                {
                    db.IncomeExpenses.Add(new IncomeExpense
                    {
                        Type = TransactionType.Expense, Amount = payroll.NetPay, Date = DateOnly.FromDateTime(payroll.PaidAt!.Value),
                        Category = categories["Personel Maaşları"], Payroll = payroll,
                        Description = $"{month:MM.yyyy} maaşı — {emp.FirstName} {emp.LastName}",
                        DocumentNo = $"BR{month:yyMM}-{emp.EmployeeNumber}",
                    });
                }
            }
        }

        // 7) İzinler: geçmişte onaylanmış yıllık izinler + onay bekleyen talepler
        foreach (var (emp, i) in employees.Select((e, i) => (e, i)).Where(x => x.i % 3 == 0))
        {
            var start = today.AddDays(-60 - i * 5);
            db.LeaveRequests.Add(new LeaveRequest { Employee = emp, EmployeeId = emp.Id, Kind = LeaveKind.Annual, StartDate = start, EndDate = start.AddDays(4), Days = LeavesController.WorkDays(start, start.AddDays(4)), Status = LeaveStatus.Approved, Note = "Yaz tatili" });
        }
        foreach (var emp in employees.Take(2))
        {
            var start = today.AddDays(12);
            db.LeaveRequests.Add(new LeaveRequest { Employee = emp, EmployeeId = emp.Id, Kind = LeaveKind.Annual, StartDate = start, EndDate = start.AddDays(2), Days = LeavesController.WorkDays(start, start.AddDays(2)), Status = LeaveStatus.Requested, Note = "Aile ziyareti" });
        }

        await db.SaveChangesAsync();
    }

    /// <summary>Örnek TC kimlik no (sağlama haneleri geçerli, gerçek kişiye ait değil).</summary>
    private static string SampleTc(Random rng)
    {
        var d = new int[11];
        d[0] = rng.Next(1, 10);
        for (var i = 1; i < 9; i++) d[i] = rng.Next(0, 10);
        d[9] = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
        if (d[9] < 0) d[9] += 10;
        d[10] = d.Take(10).Sum() % 10;
        return string.Concat(d);
    }

    /// <summary>Cari hesaplar: müşteri faturaları (kısmen tahsil, bazıları gecikmiş) ve tedarikçi faturaları.</summary>
    private static async Task SeedCariAsync(AppDbContext db, CompanyProfile p, DateOnly today)
    {
        var rng = new Random(p.Prefix[1] * 131);
        var (customers, suppliers) = p.Prefix switch
        {
            "S7" => (new[] { "TEDAŞ Bölge Müdürlüğü", "Akdeniz Tarım Kooperatifi", "Ege Gübre Ticaret", "Karbon Borsası Aracı" }, new[] { "Mısır Silajı Üreticisi", "Motor Servisi A.Ş.", "Kimya Tedarik Ltd." }),
            "S2" => (new[] { "Marmara Lojistik", "Anadolu Süt", "Kapadokya Otel" }, new[] { "Kablo Toptan", "Ofis Kiralama" }),
            _ => (new[] { "Trakya Tekstil", "İç Anadolu Un", "Karadeniz Çay" }, new[] { "Akaryakıt Dağıtım", "Ambalaj San." }),
        };
        var parties = customers.Select(n => new Party { Name = n, Type = PartyType.Customer, DefaultTermDays = 30 })
            .Concat(suppliers.Select(n => new Party { Name = n, Type = PartyType.Supplier, DefaultTermDays = 45 })).ToList();
        db.Parties.AddRange(parties);
        var receivables = await db.FinanceCategories.FirstOrDefaultAsync(c => c.Name == "Tahsilatlar") ?? new FinanceCategory { Name = "Tahsilatlar", Type = TransactionType.Income };
        var payables = await db.FinanceCategories.FirstOrDefaultAsync(c => c.Name == "Tedarikçi Ödemeleri") ?? new FinanceCategory { Name = "Tedarikçi Ödemeleri", Type = TransactionType.Expense };
        var no = 1;
        foreach (var party in parties)
        {
            var isCustomer = party.Type == PartyType.Customer;
            for (var k = 0; k < 5; k++)
            {
                var date = today.AddDays(-rng.Next(5, 150));
                var amount = Math.Round((decimal)(rng.NextDouble() * (isCustomer ? 180_000 : 90_000) + 15_000) / 10m) * 10m;
                var doc = new CariDocument
                {
                    Party = party, PartyId = party.Id, Type = isCustomer ? CariDocumentType.Receivable : CariDocumentType.Payable,
                    DocumentNo = $"{(isCustomer ? "SF" : "AF")}{p.Prefix}-{no++:0000}", Date = date, DueDate = date.AddDays(party.DefaultTermDays), Amount = amount,
                    Description = isCustomer ? "Satış faturası" : "Alış faturası",
                };
                db.CariDocuments.Add(doc);
                // Eski belgelerin çoğu ödenmiş; bir kısmı kısmi, yenilerin çoğu açık
                var roll = rng.NextDouble();
                var paidRatio = doc.DueDate < today ? (roll < 0.6 ? 1m : roll < 0.8 ? 0.5m : 0m) : (roll < 0.25 ? 0.4m : 0m);
                if (paidRatio > 0)
                {
                    var payAmount = Math.Round(amount * paidRatio, 2);
                    var payDate = doc.DueDate < today ? doc.DueDate.AddDays(rng.Next(-5, 6)) : today.AddDays(-rng.Next(0, 5));
                    if (payDate > today) payDate = today;
                    var tx = new IncomeExpense
                    {
                        Type = isCustomer ? TransactionType.Income : TransactionType.Expense, Amount = payAmount, Date = payDate,
                        Category = isCustomer ? receivables : payables, Description = $"{(isCustomer ? "Tahsilat" : "Ödeme")} — {party.Name} ({doc.DocumentNo})",
                        DocumentNo = $"{doc.DocumentNo}-1",
                    };
                    db.IncomeExpenses.Add(tx);
                    db.CariPayments.Add(new CariPayment { Document = doc, DocumentId = doc.Id, Date = payDate, Amount = payAmount, Method = rng.NextDouble() < 0.7 ? "Havale/EFT" : "Nakit", TransactionId = tx.Id });
                }
            }
        }
        await db.SaveChangesAsync();
    }

    private static IEnumerable<CompanyProfile> Profiles()
    {
        yield return new CompanyProfile(
            CompanyConfiguration.Solar7Id, "S7",
            [
                new("Ayşe", "Demir", "Tesis Müdürü", PayType.Monthly, 115_000, null, new(2022, 3, 1)),
                new("Mehmet", "Kaya", "Biyogaz Operatörü", PayType.Hourly, 0, 245, new(2023, 6, 12)),
                new("Hasan", "Yıldız", "Biyogaz Operatörü", PayType.Hourly, 0, 240, new(2024, 2, 5)),
                new("Fatma", "Arslan", "Proses Mühendisi", PayType.Monthly, 78_000, null, new(2023, 9, 18)),
                new("Mustafa", "Çelik", "Elektrik Teknisyeni", PayType.Hourly, 0, 260, new(2022, 11, 7)),
                new("Emre", "Şahin", "Mekanik Bakım Teknisyeni", PayType.Hourly, 0, 235, new(2024, 4, 22)),
                new("Zeynep", "Koç", "Laboratuvar Sorumlusu", PayType.Monthly, 62_000, null, new(2025, 1, 6)),
                new("Ali", "Aydın", "Saha Operatörü", PayType.Hourly, 0, 210, new(2025, 3, 3)),
                new("Burak", "Öztürk", "Saha Operatörü", PayType.Hourly, 0, 210, new(2025, 8, 11)),
                new("Hüseyin", "Kurt", "Kepçe Operatörü", PayType.Hourly, 0, 225, new(2023, 5, 15)),
                new("İbrahim", "Polat", "Güvenlik Görevlisi", PayType.Hourly, 0, 190, new(2024, 7, 1)),
                new("Ramazan", "Aksoy", "Güvenlik Görevlisi", PayType.Hourly, 0, 190, new(2026, 7, 20)),
                new("Elif", "Erdoğan", "İdari İşler ve Satın Alma", PayType.Monthly, 55_000, null, new(2024, 10, 1)),
                new("Okan", "Güneş", "SCADA Operatörü", PayType.Hourly, 0, 250, new(2026, 8, 17)),
            ],
            [
                new("Sabah", 8, 16, 30, "#FF9F0A"),
                new("Akşam", 16, 24, 30, "#0A84FF"),
                new("Gece", 0, 8, 30, "#5E5CE6"),
            ],
            Rotating: true, WorkDaysPerWeek: 6,
            [
                new("Elektrik Satışı (YEKDEM)", TransactionType.Income, 420_000, 560_000, 2, ["Elektrik satış faturası — 1. yarım ay", "Elektrik satış faturası — 2. yarım ay"]),
                new("Organik Gübre Satışı", TransactionType.Income, 35_000, 90_000, 3, ["Katı fermente gübre satışı", "Sıvı gübre satışı — tarım kooperatifi", "Kompost satışı"]),
                new("Karbon Kredisi", TransactionType.Income, 60_000, 140_000, 1, ["Gönüllü karbon kredisi satışı"]),
                new("Hammadde (Gübre/Silaj)", TransactionType.Expense, 40_000, 95_000, 4, ["Büyükbaş hayvan gübresi alımı", "Mısır silajı alımı", "Tavuk gübresi alımı", "Nakliye dahil hammadde"]),
                new("Bakım ve Yedek Parça", TransactionType.Expense, 8_000, 65_000, 3, ["Gaz motoru periyodik bakım", "Karıştırıcı rulman değişimi", "Pompa salmastra yenileme", "Desülfürizasyon filtre değişimi"]),
                new("Enerji ve Yakıt", TransactionType.Expense, 12_000, 30_000, 2, ["İç tüketim elektrik", "Kepçe ve araç yakıtı"]),
                new("Sigorta ve Lisans", TransactionType.Expense, 15_000, 45_000, 1, ["Tesis sigortası taksiti", "EPDK lisans bedeli"]),
                new("Laboratuvar ve Analiz", TransactionType.Expense, 4_000, 12_000, 1, ["Biyogaz kompozisyon analizi", "Fermente ürün analizi"]),
            ]);

        yield return new CompanyProfile(
            CompanyConfiguration.Company2Id, "S2",
            [
                new("Can", "Öztürk", "Genel Müdür", PayType.Monthly, 95_000, null, new(2021, 1, 4)),
                new("Selin", "Yılmaz", "Muhasebe Uzmanı", PayType.Monthly, 58_000, null, new(2022, 4, 11)),
                new("Deniz", "Acar", "Satış Temsilcisi", PayType.Monthly, 52_000, null, new(2023, 2, 20)),
                new("Gökhan", "Tekin", "Satış Temsilcisi", PayType.Monthly, 50_000, null, new(2024, 9, 2)),
                new("Merve", "Kılıç", "Proje Koordinatörü", PayType.Monthly, 64_000, null, new(2023, 7, 3)),
                new("Serkan", "Doğan", "Teknik Destek", PayType.Hourly, 0, 205, new(2025, 2, 17)),
                new("Esra", "Başaran", "Ofis Asistanı", PayType.Hourly, 0, 175, new(2025, 6, 9)),
                new("Kerem", "Uçar", "Saha Mühendisi", PayType.Monthly, 70_000, null, new(2024, 3, 25)),
            ],
            [new("Gündüz", 9, 18, 60, "#0A84FF")],
            Rotating: false, WorkDaysPerWeek: 5,
            [
                new("Hizmet Geliri", TransactionType.Income, 90_000, 260_000, 4, ["Kurulum hizmet bedeli", "Proje hakediş faturası", "Danışmanlık hizmeti"]),
                new("Bakım Sözleşmeleri", TransactionType.Income, 25_000, 60_000, 2, ["Yıllık bakım sözleşmesi taksiti"]),
                new("Kira", TransactionType.Expense, 65_000, 65_000, 1, ["Ofis kirası"]),
                new("Ofis Giderleri", TransactionType.Expense, 3_000, 15_000, 3, ["Kırtasiye ve sarf", "İnternet ve telefon", "Temizlik hizmeti"]),
                new("Araç ve Yol", TransactionType.Expense, 6_000, 22_000, 2, ["Araç kiralama", "Saha ziyareti yol gideri"]),
                new("Malzeme Alımı", TransactionType.Expense, 30_000, 120_000, 2, ["Proje malzemesi alımı", "Kablo ve bağlantı elemanı"]),
            ]);

        yield return new CompanyProfile(
            CompanyConfiguration.Company3Id, "S3",
            [
                new("Oğuz", "Karaca", "İşletme Müdürü", PayType.Monthly, 80_000, null, new(2022, 6, 1)),
                new("Pınar", "Sezer", "Depo Sorumlusu", PayType.Monthly, 54_000, null, new(2023, 3, 13)),
                new("Volkan", "Er", "Forklift Operatörü", PayType.Hourly, 0, 200, new(2024, 1, 8)),
                new("Tuğba", "Öz", "Sevkiyat Planlama", PayType.Monthly, 50_000, null, new(2024, 11, 4)),
                new("Cem", "Ateş", "Depo Personeli", PayType.Hourly, 0, 180, new(2025, 4, 14)),
                new("Yusuf", "Bulut", "Depo Personeli", PayType.Hourly, 0, 180, new(2025, 10, 6)),
                new("Nur", "Aslan", "Muhasebe", PayType.Monthly, 52_000, null, new(2023, 8, 28)),
            ],
            [new("Sabah", 7, 15, 30, "#30D158"), new("Öğle", 13, 21, 30, "#BF5AF2")],
            Rotating: true, WorkDaysPerWeek: 6,
            [
                new("Depolama Hizmeti", TransactionType.Income, 70_000, 180_000, 3, ["Aylık depolama faturası", "Palet depolama bedeli"]),
                new("Sevkiyat Hizmeti", TransactionType.Income, 20_000, 75_000, 3, ["Bölge içi dağıtım", "Parsiyel sevkiyat"]),
                new("Kira", TransactionType.Expense, 90_000, 90_000, 1, ["Depo kirası"]),
                new("Yakıt", TransactionType.Expense, 15_000, 40_000, 2, ["Forklift ve araç yakıtı"]),
                new("Ambalaj ve Sarf", TransactionType.Expense, 5_000, 20_000, 2, ["Streç film ve palet", "Koli ve etiket"]),
                new("Bakım", TransactionType.Expense, 4_000, 25_000, 1, ["Forklift bakımı", "Raf sistemi onarımı"]),
            ]);
    }
}
