using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;

namespace MiniErp.Application.Payroll;

public sealed record PayrollResult(
    decimal RegularHours,
    decimal OvertimeHours,
    decimal HourlyRate,
    decimal BasePay,
    decimal OvertimePay,
    decimal GrossPay,
    decimal NetPay);

/// <summary>
/// Mesai kayıtlarından aylık hakediş hesaplar. Saf (yan etkisiz) bir sınıftır;
/// veritabanına dokunmaz, bu yüzden kolayca test edilir.
/// </summary>
public static class PayrollCalculator
{
    public static PayrollResult Calculate(
        Employee employee,
        IEnumerable<TimeEntry> entries,
        decimal bonus = 0m,
        decimal deductions = 0m)
    {
        var list = entries.ToList();
        var regular = list.Sum(e => e.WorkedHours - e.OvertimeHours);
        var overtime = list.Sum(e => e.OvertimeHours);

        var hourlyRate = employee.HourlyRate
            ?? (employee.MonthlyStandardHours > 0 ? employee.BaseSalary / employee.MonthlyStandardHours : 0m);

        var basePay = employee.PayType == PayType.Monthly
            ? employee.BaseSalary
            : regular * hourlyRate;

        var overtimePay = overtime * hourlyRate * employee.OvertimeMultiplier;
        var gross = Round(basePay + overtimePay + bonus);
        var net = Round(gross - deductions);

        return new PayrollResult(regular, overtime, Round(hourlyRate), Round(basePay), Round(overtimePay), gross, net);
    }

    private static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
