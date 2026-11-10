using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniErp.Domain.Entities;

namespace MiniErp.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.HasKey(a => a.Id);
        b.Property(a => a.UserName).HasMaxLength(150);
        b.Property(a => a.EntityType).HasMaxLength(60).IsRequired();
        b.Property(a => a.EntityLabel).HasMaxLength(200);
        b.Property(a => a.ChangesJson).HasColumnType("nvarchar(max)");
        b.HasIndex(a => new { a.CompanyId, a.At });
        b.HasIndex(a => new { a.CompanyId, a.EntityType, a.EntityId });
    }
}

public class PartyConfiguration : TenantEntityConfiguration<Party>
{
    public override void Configure(EntityTypeBuilder<Party> b)
    {
        base.Configure(b);
        b.Property(p => p.Name).HasMaxLength(200).IsRequired();
        b.Property(p => p.TaxNumber).HasMaxLength(20);
        b.Property(p => p.Phone).HasMaxLength(30);
        b.Property(p => p.Email).HasMaxLength(150);
        b.Property(p => p.Note).HasMaxLength(500);
        b.HasIndex(p => new { p.CompanyId, p.Name });
    }
}

public class CariDocumentConfiguration : TenantEntityConfiguration<CariDocument>
{
    public override void Configure(EntityTypeBuilder<CariDocument> b)
    {
        base.Configure(b);
        b.Property(d => d.DocumentNo).HasMaxLength(50);
        b.Property(d => d.Description).HasMaxLength(500);
        b.HasOne(d => d.Party).WithMany(p => p.Documents)
            .HasForeignKey(d => new { d.CompanyId, d.PartyId }).HasPrincipalKey(p => new { p.CompanyId, p.Id });
        b.HasIndex(d => new { d.CompanyId, d.DueDate });
        b.ToTable(t => t.HasCheckConstraint("CK_CariDocument_Amount", "[Amount] > 0"));
    }
}

public class CariPaymentConfiguration : TenantEntityConfiguration<CariPayment>
{
    public override void Configure(EntityTypeBuilder<CariPayment> b)
    {
        base.Configure(b);
        b.Property(p => p.Method).HasMaxLength(50);
        b.HasOne(p => p.Document).WithMany(d => d.Payments)
            .HasForeignKey(p => new { p.CompanyId, p.DocumentId }).HasPrincipalKey(d => new { d.CompanyId, d.Id });
        b.ToTable(t => t.HasCheckConstraint("CK_CariPayment_Amount", "[Amount] > 0"));
    }
}

public class LeaveRequestConfiguration : TenantEntityConfiguration<LeaveRequest>
{
    public override void Configure(EntityTypeBuilder<LeaveRequest> b)
    {
        base.Configure(b);
        b.Property(l => l.Days).HasPrecision(6, 1);
        b.Property(l => l.Note).HasMaxLength(500);
        b.HasOne(l => l.Employee).WithMany()
            .HasForeignKey(l => new { l.CompanyId, l.EmployeeId }).HasPrincipalKey(e => new { e.CompanyId, e.Id });
        b.HasIndex(l => new { l.CompanyId, l.StartDate });
    }
}

public class AttachmentConfiguration : TenantEntityConfiguration<Attachment>
{
    public override void Configure(EntityTypeBuilder<Attachment> b)
    {
        base.Configure(b);
        b.Property(a => a.EntityType).HasMaxLength(60).IsRequired();
        b.Property(a => a.FileName).HasMaxLength(260).IsRequired();
        b.Property(a => a.ContentType).HasMaxLength(120).IsRequired();
        b.Property(a => a.Data).HasColumnType("varbinary(max)");
        b.HasIndex(a => new { a.CompanyId, a.EntityType, a.EntityId });
    }
}

public class PayrollSettingsConfiguration : TenantEntityConfiguration<PayrollSettings>
{
    public override void Configure(EntityTypeBuilder<PayrollSettings> b)
    {
        base.Configure(b);
        b.Property(s => s.SgkEmployeeRate).HasPrecision(7, 5);
        b.Property(s => s.UnemploymentEmployeeRate).HasPrecision(7, 5);
        b.Property(s => s.SgkEmployerRate).HasPrecision(7, 5);
        b.Property(s => s.UnemploymentEmployerRate).HasPrecision(7, 5);
        b.Property(s => s.StampTaxRate).HasPrecision(7, 5);
        b.Property(s => s.SgkCeilingMultiplier).HasPrecision(5, 2);
        b.Property(s => s.ApproxDeductionRate).HasPrecision(5, 4);
        b.Property(s => s.Method).HasMaxLength(20);
        b.Property(s => s.TaxBracketsJson).HasColumnType("nvarchar(max)");
        b.HasIndex(s => new { s.CompanyId, s.Year }).IsUnique().HasFilter("[IsDeleted] = 0");
    }
}
