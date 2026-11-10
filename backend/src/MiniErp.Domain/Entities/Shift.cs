using MiniErp.Domain.Common;
using MiniErp.Domain.Enums;

namespace MiniErp.Domain.Entities;

/// <summary>Vardiya tanımı (ör. "Sabah 08:00–16:00"). Şirket bazında tanımlanır.</summary>
public class ShiftTemplate : TenantEntity
{
    public string Name { get; set; } = default!;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public int BreakMinutes { get; set; }
    /// <summary>Gece vardiyası (bitiş ertesi gün).</summary>
    public bool CrossesMidnight { get; set; }
    public string? Color { get; set; }

    public Company Company { get; set; } = default!;
    public ICollection<ShiftAssignment> Assignments { get; set; } = new List<ShiftAssignment>();
}

/// <summary>Vardiya planı: hangi çalışan, hangi gün, hangi vardiyada.</summary>
public class ShiftAssignment : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = default!;

    public Guid ShiftTemplateId { get; set; }
    public ShiftTemplate ShiftTemplate { get; set; } = default!;

    public DateOnly Date { get; set; }
    public ShiftStatus Status { get; set; } = ShiftStatus.Planned;
    public string? Note { get; set; }

    public TimeEntry? TimeEntry { get; set; }
}

/// <summary>Gerçekleşen çalışma (giriş/çıkış). Maaş hesaplamasının kaynağıdır.</summary>
public class TimeEntry : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = default!;

    /// <summary>Planlı bir vardiyaya bağlıysa doldurulur (planlanmamış ek mesai için boş kalabilir).</summary>
    public Guid? ShiftAssignmentId { get; set; }
    public ShiftAssignment? ShiftAssignment { get; set; }

    public DateTime ClockIn { get; set; }
    public DateTime? ClockOut { get; set; }
    public int BreakMinutes { get; set; }
    public decimal WorkedHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public string? Note { get; set; }
}
