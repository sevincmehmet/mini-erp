using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MiniErp.Application.Abstractions;
using MiniErp.Domain.Common;
using MiniErp.Domain.Entities;

namespace MiniErp.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Şirket verisindeki her ekleme, değişiklik, silme ve geri getirmeyi AuditLog tablosuna yazar
/// (kim, ne zaman, hangi alan eskiden neydi şimdi ne). Aynı SaveChanges içinde kaydedilir.
/// </summary>
public sealed class AuditTrailInterceptor(ICurrentUser user, AuditOptions options, TimeProvider clock) : SaveChangesInterceptor
{
    // Büyük ya da anlamsız alanlar kayda girmez
    private static readonly HashSet<string> Ignored = ["UpdatedAt", "CreatedAt", "RowsJson", "ColumnsJson", "LayoutJson", "Data", "TaxBracketsJson", "PasswordHash", "SecurityStamp"];

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Write(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Write(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Write(DbContext? context)
    {
        if (context is null || options.Suppress) return;
        var now = clock.GetUtcNow().UtcDateTime;
        var logs = new List<AuditLog>();

        foreach (var entry in context.ChangeTracker.Entries<BaseEntity>().ToList())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified)) continue;
            var companyId = entry.Entity is ITenantEntity t ? t.CompanyId : entry.Entity is Company c ? c.Id : (Guid?)null;
            if (companyId is null || companyId == Guid.Empty) continue;

            var action = entry.State == EntityState.Added ? AuditAction.Added : ModifiedAction(entry);
            if (action is null) continue;

            logs.Add(new AuditLog
            {
                CompanyId = companyId.Value,
                UserId = user.UserId,
                UserName = user.Name,
                EntityType = entry.Metadata.ClrType.Name,
                EntityId = entry.Entity.Id,
                EntityLabel = Label(entry.Entity),
                Action = action.Value,
                ChangesJson = action == AuditAction.Modified ? Changes(entry) : null,
                At = now,
            });
        }
        if (logs.Count > 0) context.Set<AuditLog>().AddRange(logs);
    }

    /// <summary>Soft delete: IsDeleted false→true "silindi", true→false "geri getirildi"; diğerleri "değiştirildi".</summary>
    private static AuditAction? ModifiedAction(EntityEntry<BaseEntity> entry)
    {
        var del = entry.Property(nameof(BaseEntity.IsDeleted));
        if (del.IsModified && (bool)del.CurrentValue! && !(bool)del.OriginalValue!) return AuditAction.Deleted;
        if (del.IsModified && !(bool)del.CurrentValue! && (bool)del.OriginalValue!) return AuditAction.Restored;
        return entry.Properties.Any(p => p.IsModified && !Ignored.Contains(p.Metadata.Name)) ? AuditAction.Modified : null;
    }

    private static string? Changes(EntityEntry<BaseEntity> entry)
    {
        var diff = entry.Properties
            .Where(p => p.IsModified && !Ignored.Contains(p.Metadata.Name) && !Equals(p.OriginalValue, p.CurrentValue))
            .ToDictionary(p => p.Metadata.Name, p => new[] { Format(p.OriginalValue), Format(p.CurrentValue) });
        return diff.Count == 0 ? null : JsonSerializer.Serialize(diff);
    }

    private static string? Format(object? v) => v switch
    {
        null => null,
        DateTime d => d.ToString("yyyy-MM-dd HH:mm"),
        DateOnly d => d.ToString("yyyy-MM-dd"),
        decimal m => m.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture),
        _ => v.ToString(),
    };

    private static string? Label(BaseEntity e) => e switch
    {
        Employee x => $"{x.FirstName} {x.LastName}",
        IncomeExpense x => x.Description,
        Party x => x.Name,
        CariDocument x => x.DocumentNo ?? x.Description,
        CustomPage x => x.Title,
        Dataset x => x.Name,
        ShiftTemplate x => x.Name,
        FinanceCategory x => x.Name,
        Company x => x.Name,
        Payroll x => $"{x.Month:00}.{x.Year}",
        TimeEntry x => x.ClockIn.ToString("yyyy-MM-dd HH:mm"),
        ShiftAssignment x => x.Date.ToString("yyyy-MM-dd"),
        LeaveRequest x => $"{x.StartDate:yyyy-MM-dd} – {x.EndDate:yyyy-MM-dd}",
        Attachment x => x.FileName,
        _ => null,
    };
}
