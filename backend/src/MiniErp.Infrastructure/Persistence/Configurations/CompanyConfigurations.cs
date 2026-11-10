using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniErp.Domain.Entities;

namespace MiniErp.Infrastructure.Persistence.Configurations;

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public static readonly Guid Solar7Id = Guid.Parse("7a1e0c3e-0000-4000-8000-000000000007");
    public static readonly Guid Company2Id = Guid.Parse("7a1e0c3e-0000-4000-8000-000000000002");
    public static readonly Guid Company3Id = Guid.Parse("7a1e0c3e-0000-4000-8000-000000000003");

    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.Property(c => c.Name).HasMaxLength(150).IsRequired();
        builder.Property(c => c.TaxNumber).HasMaxLength(20);
        builder.Property(c => c.Currency).HasMaxLength(3);
        builder.Property(c => c.AccentColor).HasMaxLength(9);
        builder.Property(c => c.LogoUrl).HasMaxLength(500);
        builder.HasQueryFilter(c => !c.IsDeleted);

        // Başlangıç verisi: isimler uygulamadan değiştirilebilir.
        var seedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        builder.HasData(
            new Company { Id = Solar7Id, Name = "Solar 7", AccentColor = "#FF9F0A", CreatedAt = seedDate },
            new Company { Id = Company2Id, Name = "Şirket 2", AccentColor = "#0A84FF", CreatedAt = seedDate },
            new Company { Id = Company3Id, Name = "Şirket 3", AccentColor = "#30D158", CreatedAt = seedDate });
    }
}

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        builder.Property(u => u.Email).HasMaxLength(200).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();
        builder.Property(u => u.FullName).HasMaxLength(150).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(500).IsRequired();
        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}

public class UserCompanyConfiguration : IEntityTypeConfiguration<UserCompany>
{
    public void Configure(EntityTypeBuilder<UserCompany> builder)
    {
        builder.HasKey(uc => new { uc.UserId, uc.CompanyId });
        builder.HasOne(uc => uc.User).WithMany(u => u.Companies).HasForeignKey(uc => uc.UserId);
        builder.HasOne(uc => uc.Company).WithMany(c => c.Users).HasForeignKey(uc => uc.CompanyId);
        builder.HasQueryFilter(uc => !uc.User.IsDeleted && !uc.Company.IsDeleted);
    }
}
