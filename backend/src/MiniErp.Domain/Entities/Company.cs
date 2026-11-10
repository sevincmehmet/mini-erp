using MiniErp.Domain.Common;

namespace MiniErp.Domain.Entities;

/// <summary>Tenant kökü. Diğer tüm iş verileri CompanyId ile buna bağlanır.</summary>
public class Company : BaseEntity
{
    public string Name { get; set; } = default!;
    public string? TaxNumber { get; set; }
    public string Currency { get; set; } = "TRY";
    /// <summary>Şirket geçişinde arayüzde görsel ayrım için (ör. "#34C759").</summary>
    public string? AccentColor { get; set; }
    public string? LogoUrl { get; set; }

    public ICollection<UserCompany> Users { get; set; } = new List<UserCompany>();
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<ShiftTemplate> ShiftTemplates { get; set; } = new List<ShiftTemplate>();
    public ICollection<FinanceCategory> FinanceCategories { get; set; } = new List<FinanceCategory>();
    public ICollection<IncomeExpense> Transactions { get; set; } = new List<IncomeExpense>();
}
