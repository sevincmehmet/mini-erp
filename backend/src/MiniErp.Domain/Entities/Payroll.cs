using MiniErp.Domain.Common;
using MiniErp.Domain.Enums;

namespace MiniErp.Domain.Entities;

/// <summary>Bir çalışanın bir aylık hakediş/maaş bordrosu.</summary>
public class Payroll : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = default!;

    public int Year { get; set; }
    public int Month { get; set; }

    public decimal RegularHours { get; set; }
    public decimal OvertimeHours { get; set; }
    /// <summary>Hesaplama anındaki saat ücreti (sonradan ücret değişse de bordro sabit kalır).</summary>
    public decimal HourlyRateSnapshot { get; set; }

    public decimal BasePay { get; set; }
    public decimal OvertimePay { get; set; }
    public decimal Bonus { get; set; }
    public decimal Deductions { get; set; }
    public decimal GrossPay { get; set; }
    public decimal NetPay { get; set; }

    // Mevzuat hesabı ayrıntıları
    public decimal WorkedDays { get; set; } = 30;
    public decimal SgkEmployee { get; set; }
    public decimal UnemploymentEmployee { get; set; }
    public decimal IncomeTax { get; set; }
    public decimal StampTax { get; set; }
    public decimal IncomeTaxExemption { get; set; }
    public decimal StampTaxExemption { get; set; }
    /// <summary>Yıl başından bu aya kadar (bu ay dahil) gelir vergisi matrahı</summary>
    public decimal CumulativeTaxBase { get; set; }
    public decimal EmployerSgk { get; set; }
    public decimal EmployerUnemployment { get; set; }
    public decimal EmployerCost { get; set; }

    public PayrollStatus Status { get; set; } = PayrollStatus.Draft;
    public DateTime? PaidAt { get; set; }

    /// <summary>Bordro onaylandığında oluşturulan gider kaydı.</summary>
    public IncomeExpense? Transaction { get; set; }
}
