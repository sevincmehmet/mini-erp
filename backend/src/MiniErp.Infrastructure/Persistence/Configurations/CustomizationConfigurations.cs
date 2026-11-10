using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniErp.Domain.Entities;

namespace MiniErp.Infrastructure.Persistence.Configurations;

public class DatasetConfiguration : TenantEntityConfiguration<Dataset>
{
    public override void Configure(EntityTypeBuilder<Dataset> builder)
    {
        base.Configure(builder);
        builder.Property(d => d.Name).HasMaxLength(150).IsRequired();
        builder.Property(d => d.Description).HasMaxLength(500);
        builder.Property(d => d.SourceFileName).HasMaxLength(260);
        builder.Property(d => d.SourceSheet).HasMaxLength(100);
        builder.Property(d => d.ColumnsJson).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(d => d.RowsJson).HasColumnType("nvarchar(max)").IsRequired();
    }
}

public class CustomPageConfiguration : TenantEntityConfiguration<CustomPage>
{
    public override void Configure(EntityTypeBuilder<CustomPage> builder)
    {
        base.Configure(builder);
        builder.Property(p => p.Title).HasMaxLength(120).IsRequired();
        builder.Property(p => p.Icon).HasMaxLength(16);
        builder.Property(p => p.LayoutJson).HasColumnType("nvarchar(max)").IsRequired();
        builder.HasIndex(p => new { p.CompanyId, p.SortOrder });
    }
}
