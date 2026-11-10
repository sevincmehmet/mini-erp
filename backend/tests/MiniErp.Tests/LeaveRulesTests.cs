using MiniErp.Api.Controllers;

namespace MiniErp.Tests;

public class LeaveRulesTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 14)]
    [InlineData(4, 14)]
    [InlineData(5, 20)]
    [InlineData(14, 20)]
    [InlineData(15, 26)]
    public void Kidem_yilina_gore_yillik_izin(int years, int days) => Assert.Equal(days, LeavesController.Entitlement(years));

    [Fact]
    public void Pazar_izin_gununden_sayilmaz()
    {
        // 2025-10-06 Pazartesi → 2025-10-12 Pazar
        Assert.Equal(6m, LeavesController.WorkDays(new DateOnly(2025, 10, 6), new DateOnly(2025, 10, 12)));
        Assert.Equal(0m, LeavesController.WorkDays(new DateOnly(2025, 10, 12), new DateOnly(2025, 10, 12)));
    }
}
