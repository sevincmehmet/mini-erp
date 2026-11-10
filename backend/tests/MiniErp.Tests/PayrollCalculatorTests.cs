using MiniErp.Application.Payroll;
using MiniErp.Domain.Entities;
using MiniErp.Domain.Enums;

namespace MiniErp.Tests;

public class PayrollCalculatorTests
{
    [Fact]
    public void Saatlik_calisan_normal_ve_fazla_mesai()
    {
        var e = new Employee { FirstName = "A", LastName = "B", PayType = PayType.Hourly, HourlyRate = 100m, OvertimeMultiplier = 1.5m };
        var entries = new[] { new TimeEntry { WorkedHours = 10, OvertimeHours = 2 }, new TimeEntry { WorkedHours = 8, OvertimeHours = 0 } };

        var r = PayrollCalculator.Calculate(e, entries, bonus: 50m);

        Assert.Equal(16m, r.RegularHours);
        Assert.Equal(2m, r.OvertimeHours);
        Assert.Equal(1600m, r.BasePay);
        Assert.Equal(300m, r.OvertimePay);
        Assert.Equal(1950m, r.GrossPay);
    }

    [Fact]
    public void Aylik_calisanin_saat_ucreti_standart_saatten_turetilir()
    {
        var e = new Employee { FirstName = "A", LastName = "B", PayType = PayType.Monthly, BaseSalary = 45_000m, MonthlyStandardHours = 225m };
        var r = PayrollCalculator.Calculate(e, [new TimeEntry { WorkedHours = 12, OvertimeHours = 4 }]);

        Assert.Equal(200m, r.HourlyRate);
        Assert.Equal(45_000m, r.BasePay);
        Assert.Equal(1200m, r.OvertimePay);
    }
}
