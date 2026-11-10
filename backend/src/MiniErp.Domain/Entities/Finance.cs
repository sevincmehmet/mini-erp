using MiniErp.Domain.Common;
using MiniErp.Domain.Enums;

namespace MiniErp.Domain.Entities;

public class FinanceCategory : TenantEntity
{
    public string Name { get; set; } = default!;
    public TransactionType Type { get; set; }
    public string? Color { get; set; }

    public Company Company { get; set; } = default!;
    public ICollection<IncomeExpense> Transactions { get; set; } = new List<IncomeExpense>();
}

/// <summary>Gelir veya gider hareketi.</summary>
public class IncomeExpense : TenantEntity
{
    public TransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";
    public DateOnly Date { get; set; }
    public string Description { get; set; } = default!;
    public string? DocumentNo { get; set; }

    public Guid? CategoryId { get; set; }
    public FinanceCategory? Category { get; set; }

    /// <summary>Maaş ödemesinden doğan giderlerde bordro bağlantısı.</summary>
    public Guid? PayrollId { get; set; }
    public Payroll? Payroll { get; set; }

    public Company Company { get; set; } = default!;
}
