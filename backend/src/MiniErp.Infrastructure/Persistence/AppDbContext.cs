using System.Reflection;
using Microsoft.EntityFrameworkCore;
using MiniErp.Application.Abstractions;
using MiniErp.Domain.Common;
using MiniErp.Domain.Entities;

namespace MiniErp.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options, ITenantProvider tenantProvider)
    : DbContext(options)
{
    /// <summary>
    /// Global filtrede kullanılır. EF Core, DbContext üyelerine yapılan referansları
    /// her sorguda yeniden değerlendirir; böylece filtre istek bazında doğru şirkete uygulanır.
    /// Tenant yoksa Guid.Empty döner ve hiçbir şirket verisi görünmez (güvenli varsayılan).
    /// </summary>
    public Guid CurrentCompanyId => tenantProvider.CompanyId ?? Guid.Empty;

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<UserCompany> UserCompanies => Set<UserCompany>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<ShiftTemplate> ShiftTemplates => Set<ShiftTemplate>();
    public DbSet<ShiftAssignment> ShiftAssignments => Set<ShiftAssignment>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
    public DbSet<Payroll> Payrolls => Set<Payroll>();
    public DbSet<FinanceCategory> FinanceCategories => Set<FinanceCategory>();
    public DbSet<IncomeExpense> IncomeExpenses => Set<IncomeExpense>();
    public DbSet<Dataset> Datasets => Set<Dataset>();
    public DbSet<CustomPage> CustomPages => Set<CustomPage>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Party> Parties => Set<Party>();
    public DbSet<CariDocument> CariDocuments => Set<CariDocument>();
    public DbSet<CariPayment> CariPayments => Set<CariPayment>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<PayrollSettings> PayrollSettings => Set<PayrollSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());

        // ITenantEntity uygulayan her tipe şirket + soft delete filtresi
        var method = typeof(AppDbContext).GetMethod(nameof(ApplyTenantFilter), BindingFlags.NonPublic | BindingFlags.Instance)!;
        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                     .Where(t => typeof(TenantEntity).IsAssignableFrom(t.ClrType)))
        {
            method.MakeGenericMethod(entityType.ClrType).Invoke(this, [modelBuilder]);
        }

        modelBuilder.Entity<AuditLog>().HasQueryFilter(a => a.CompanyId == CurrentCompanyId);

        // SQL Server'da çoklu cascade yolu hatalarını önlemek ve veri kaybını engellemek için
        // hiçbir ilişki otomatik silme yapmaz (zaten soft delete kullanıyoruz).
        foreach (var fk in modelBuilder.Model.GetEntityTypes().SelectMany(t => t.GetForeignKeys()))
        {
            fk.DeleteBehavior = DeleteBehavior.Restrict;
        }

        // SQLite "nvarchar(max)/varbinary(max)" tiplerini tanımaz; demo veritabanında varsayılan TEXT/BLOB kullanılır
        if (Database.IsSqlite())
        {
            foreach (var prop in modelBuilder.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
                if (prop.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true) prop.SetColumnType(null);
        }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
        // SQLite decimal'i metin olarak saklar ve SUM/ORDER BY yapamaz; demo veritabanında REAL olarak tutulur
        // (kuruş düzeyindeki tutarlar için double hassasiyeti yeterli, hesaplamalar yine decimal ile yapılır).
        if (Database.IsSqlite())
        {
            configurationBuilder.Properties<decimal>().HaveConversion<double>();
            configurationBuilder.Properties<decimal?>().HaveConversion<double?>();
        }
        configurationBuilder.Properties<string>().HaveMaxLength(256);
    }

    private void ApplyTenantFilter<TEntity>(ModelBuilder modelBuilder) where TEntity : TenantEntity
    {
        modelBuilder.Entity<TEntity>()
            .HasQueryFilter(e => !e.IsDeleted && e.CompanyId == CurrentCompanyId);
    }
}
