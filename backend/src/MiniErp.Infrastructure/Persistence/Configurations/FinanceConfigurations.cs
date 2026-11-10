using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniErp.Domain.Entities;

namespace MiniErp.Infrastructure.Persistence.Configurations;

public class PayrollConfiguration : TenantEntityConfiguration<Payroll>
{
    public override void Configure(EntityTypeBuilder<Payroll> builder)
    {
        base.Configure(builder);
        builder.ToTable("Payrolls");
        builder.Property(p => p.RegularHours).HasPrecision(7, 2);
        builder.Property(p => p.OvertimeHours).HasPrecision(7, 2);

        builder.HasOne(p => p.Employee).WithMany(e => e.Payrolls)
            .HasForeignKey(p => new { p.CompanyId, p.EmployeeId })
            .HasPrincipalKey(e => new { e.CompanyId, e.Id });

        // Bir çalışan için ayda tek bordro
        builder.HasIndex(p => new { p.CompanyId, p.EmployeeId, p.Year, p.Month })
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");

        builder.ToTable(t => t.HasCheckConstraint("CK_Payroll_Month", "[Month] BETWEEN 1 AND 12"));
    }
}

public class FinanceCategoryConfiguration : TenantEntityConfiguration<FinanceCategory>
{
    public override void Configure(EntityTypeBuilder<FinanceCategory> builder)
    {
        base.Configure(builder);
        builder.Property(c => c.Name).HasMaxLength(100).IsRequired();
        builder.Property(c => c.Color).HasMaxLength(9);
        builder.HasOne(c => c.Company).WithMany(co => co.FinanceCategories).HasForeignKey(c => c.CompanyId);
        builder.HasIndex(c => new { c.CompanyId, c.Type, c.Name }).IsUnique().HasFilter("[IsDeleted] = 0");
    }
}

public class IncomeExpenseConfiguration : TenantEntityConfiguration<IncomeExpense>
{
    public override void Configure(EntityTypeBuilder<IncomeExpense> builder)
    {
        base.Configure(builder);
        builder.Property(t => t.Description).HasMaxLength(500).IsRequired();
        builder.Property(t => t.Currency).HasMaxLength(3);
        builder.Property(t => t.DocumentNo).HasMaxLength(50);

        builder.HasOne(t => t.Company).WithMany(c => c.Transactions).HasForeignKey(t => t.CompanyId);

        builder.HasOne(t => t.Category).WithMany(c => c.Transactions)
            .HasForeignKey(t => new { t.CompanyId, t.CategoryId })
            .HasPrincipalKey(c => new { c.CompanyId, c.Id })
            .IsRequired(false);

        builder.HasOne(t => t.Payroll).WithOne(p => p.Transaction)
            .HasForeignKey<IncomeExpense>(t => new { t.CompanyId, t.PayrollId })
            .HasPrincipalKey<Payroll>(p => new { p.CompanyId, p.Id })
            .IsRequired(false);

        builder.HasIndex(t => new { t.CompanyId, t.Date });
        builder.ToTable(t => t.HasCheckConstraint("CK_IncomeExpense_Amount", "[Amount] > 0"));
    }
}
