using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniErp.Domain.Entities;

namespace MiniErp.Infrastructure.Persistence.Configurations;

public class EmployeeConfiguration : TenantEntityConfiguration<Employee>
{
    public override void Configure(EntityTypeBuilder<Employee> builder)
    {
        base.Configure(builder);
        builder.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.LastName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.NationalId).HasMaxLength(11);
        builder.Property(e => e.EmployeeNumber).HasMaxLength(30);
        builder.Property(e => e.Phone).HasMaxLength(30);
        builder.Property(e => e.MonthlyStandardHours).HasPrecision(6, 2);
        builder.Property(e => e.OvertimeMultiplier).HasPrecision(4, 2);

        builder.HasOne(e => e.Company).WithMany(c => c.Employees).HasForeignKey(e => e.CompanyId);

        // Sicil numarası şirket içinde benzersiz (farklı şirketlerde aynı numara olabilir)
        builder.HasIndex(e => new { e.CompanyId, e.EmployeeNumber })
            .IsUnique()
            .HasFilter("[EmployeeNumber] IS NOT NULL AND [IsDeleted] = 0");
    }
}

public class ShiftTemplateConfiguration : TenantEntityConfiguration<ShiftTemplate>
{
    public override void Configure(EntityTypeBuilder<ShiftTemplate> builder)
    {
        base.Configure(builder);
        builder.Property(s => s.Name).HasMaxLength(100).IsRequired();
        builder.Property(s => s.Color).HasMaxLength(9);
        builder.HasOne(s => s.Company).WithMany(c => c.ShiftTemplates).HasForeignKey(s => s.CompanyId);
    }
}

public class ShiftAssignmentConfiguration : TenantEntityConfiguration<ShiftAssignment>
{
    public override void Configure(EntityTypeBuilder<ShiftAssignment> builder)
    {
        base.Configure(builder);
        builder.Property(a => a.Note).HasMaxLength(500);

        // Composite FK: atanan çalışan ve vardiya, atamayla AYNI şirkete ait olmak zorunda.
        builder.HasOne(a => a.Employee).WithMany(e => e.ShiftAssignments)
            .HasForeignKey(a => new { a.CompanyId, a.EmployeeId })
            .HasPrincipalKey(e => new { e.CompanyId, e.Id });

        builder.HasOne(a => a.ShiftTemplate).WithMany(s => s.Assignments)
            .HasForeignKey(a => new { a.CompanyId, a.ShiftTemplateId })
            .HasPrincipalKey(s => new { s.CompanyId, s.Id });

        // Bir çalışana aynı gün aynı vardiya iki kez atanamaz
        builder.HasIndex(a => new { a.CompanyId, a.EmployeeId, a.Date, a.ShiftTemplateId })
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");
        builder.HasIndex(a => new { a.CompanyId, a.Date });
    }
}

public class TimeEntryConfiguration : TenantEntityConfiguration<TimeEntry>
{
    public override void Configure(EntityTypeBuilder<TimeEntry> builder)
    {
        base.Configure(builder);
        builder.Property(t => t.WorkedHours).HasPrecision(6, 2);
        builder.Property(t => t.OvertimeHours).HasPrecision(6, 2);
        builder.Property(t => t.Note).HasMaxLength(500);

        builder.HasOne(t => t.Employee).WithMany(e => e.TimeEntries)
            .HasForeignKey(t => new { t.CompanyId, t.EmployeeId })
            .HasPrincipalKey(e => new { e.CompanyId, e.Id });

        builder.HasOne(t => t.ShiftAssignment).WithOne(a => a.TimeEntry)
            .HasForeignKey<TimeEntry>(t => new { t.CompanyId, t.ShiftAssignmentId })
            .HasPrincipalKey<ShiftAssignment>(a => new { a.CompanyId, a.Id })
            .IsRequired(false);

        builder.HasIndex(t => new { t.CompanyId, t.EmployeeId, t.ClockIn });
    }
}
