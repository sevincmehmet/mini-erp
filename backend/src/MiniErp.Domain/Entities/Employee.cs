using MiniErp.Domain.Common;
using MiniErp.Domain.Enums;

namespace MiniErp.Domain.Entities;

public class Employee : TenantEntity
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string? NationalId { get; set; }
    public string? EmployeeNumber { get; set; }
    public string? Position { get; set; }
    public string? Phone { get; set; }
    public DateOnly HireDate { get; set; }
    public DateOnly? TerminationDate { get; set; }
    public bool IsActive { get; set; } = true;

    // Ücret bilgileri — maaş hesaplamasının girdileri
    public PayType PayType { get; set; } = PayType.Monthly;
    /// <summary>Aylık ücretlide brüt maaş.</summary>
    public decimal BaseSalary { get; set; }
    /// <summary>Saatlik ücretlide saat ücreti; aylıkta boşsa BaseSalary / MonthlyStandardHours kullanılır.</summary>
    public decimal? HourlyRate { get; set; }
    public decimal MonthlyStandardHours { get; set; } = 225m;
    public decimal OvertimeMultiplier { get; set; } = 1.5m;

    public Company Company { get; set; } = default!;
    public ICollection<ShiftAssignment> ShiftAssignments { get; set; } = new List<ShiftAssignment>();
    public ICollection<TimeEntry> TimeEntries { get; set; } = new List<TimeEntry>();
    public ICollection<Payroll> Payrolls { get; set; } = new List<Payroll>();
}
