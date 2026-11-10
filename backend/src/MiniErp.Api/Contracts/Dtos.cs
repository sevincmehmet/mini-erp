using MiniErp.Domain.Enums;

namespace MiniErp.Api.Contracts;

public sealed record CompanyDto(Guid Id, string Name, string Currency, string? AccentColor);

// ---------- Personel ----------
public sealed record EmployeeDto(
    Guid Id, string? EmployeeNumber, string FirstName, string LastName, string? NationalId, string? Position, string? Phone,
    DateOnly HireDate, DateOnly? TerminationDate, bool IsActive, PayType PayType, decimal BaseSalary, decimal? HourlyRate,
    decimal OvertimeMultiplier, decimal MonthlyStandardHours);

public sealed record EmployeeRequest(
    string FirstName, string LastName, string? EmployeeNumber, string? NationalId, string? Position, string? Phone,
    DateOnly HireDate, DateOnly? TerminationDate, bool IsActive, PayType PayType, decimal BaseSalary, decimal? HourlyRate,
    decimal OvertimeMultiplier = 1.5m, decimal MonthlyStandardHours = 225m);

// ---------- Vardiya ----------
public sealed record ShiftTemplateDto(Guid Id, string Name, TimeOnly StartTime, TimeOnly EndTime, int BreakMinutes, string? Color);

/// <summary>Saatler "08:00" biçiminde metin olarak alınır (Excel ve formlarla uyumlu).</summary>
public sealed record ShiftTemplateRequest(string Name, string StartTime, string EndTime, int BreakMinutes, string? Color);

public sealed record ShiftAssignmentDto(
    Guid Id, Guid EmployeeId, Guid ShiftTemplateId, DateOnly Date, ShiftStatus Status, string? Note,
    decimal? WorkedHours, decimal? OvertimeHours);

public sealed record ShiftAssignmentRequest(Guid EmployeeId, Guid ShiftTemplateId, DateOnly Date, ShiftStatus Status, string? Note);

// ---------- Mesai (puantaj) ----------
public sealed record TimeEntryDto(
    Guid Id, Guid EmployeeId, string EmployeeName, string? EmployeeNumber, DateOnly Date, DateTime ClockIn, DateTime? ClockOut,
    int BreakMinutes, decimal WorkedHours, decimal OvertimeHours, string? ShiftName, string? Note, bool Locked);

public sealed record TimeEntryRequest(Guid EmployeeId, DateTime ClockIn, DateTime ClockOut, int BreakMinutes, string? Note);

// ---------- Finans ----------
public sealed record CategoryDto(Guid Id, string Name, TransactionType Type);

public sealed record CategoryRequest(string Name, TransactionType Type);

public sealed record TransactionDto(
    Guid Id, TransactionType Type, decimal Amount, DateOnly Date, string Description, string? DocumentNo,
    Guid? CategoryId, string? Category, bool IsPayroll);

/// <summary>Kategori Id ile ya da adıyla verilebilir; adı verilen kategori yoksa oluşturulur.</summary>
public sealed record TransactionRequest(
    TransactionType Type, decimal Amount, DateOnly Date, string Description, string? DocumentNo,
    Guid? CategoryId, string? CategoryName);

// ---------- Bordro ----------
public sealed record PayrollDto(
    Guid Id, Guid EmployeeId, string EmployeeName, string? Position, string? NationalId, string? EmployeeNumber, int Year, int Month,
    decimal WorkedDays, decimal RegularHours, decimal OvertimeHours, decimal BasePay, decimal OvertimePay, decimal Bonus,
    decimal SgkEmployee, decimal UnemploymentEmployee, decimal IncomeTax, decimal IncomeTaxExemption, decimal StampTax, decimal StampTaxExemption,
    decimal Deductions, decimal GrossPay, decimal NetPay, decimal EmployerSgk, decimal EmployerUnemployment, decimal EmployerCost,
    PayrollStatus Status, DateTime? PaidAt);

public sealed record PeriodRequest(int Year, int Month);

public sealed record PayrollAdjustRequest(decimal Bonus, decimal Deductions);

public sealed record BulkResult(int Affected, string Message);

// ---------- Genel Bakış ----------
public sealed record MonthTotalDto(int Year, int Month, decimal Income, decimal Expense);

public sealed record CategoryTotalDto(string Category, TransactionType Type, decimal Total);

public sealed record DashboardDto(
    int Year, int Month,
    decimal MonthIncome, decimal MonthExpense,
    int ActiveEmployees, int TodayShiftCount,
    decimal MonthOvertimeHours,
    decimal PendingPayrollTotal,
    IReadOnlyList<MonthTotalDto> Months,
    IReadOnlyList<CategoryTotalDto> TopExpenses,
    IReadOnlyList<TransactionDto> Recent);
