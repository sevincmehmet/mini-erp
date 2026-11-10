using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Controllers;

public sealed record AuditDto(long Id, DateTime At, string? UserName, string EntityType, Guid EntityId, string? EntityLabel, AuditAction Action, string? ChangesJson);

/// <summary>Değişiklik kaydı: kim, neyi, ne zaman. Salt okunur.</summary>
[ApiController]
[Route("api/audit")]
public class AuditController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<AuditDto>> Get([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] string? entityType, [FromQuery] Guid? entityId, CancellationToken ct)
    {
        var start = from.ToDateTime(TimeOnly.MinValue).ToUniversalTime();
        var end = to.AddDays(1).ToDateTime(TimeOnly.MinValue).ToUniversalTime();
        return await db.AuditLogs.AsNoTracking()
            .Where(a => a.At >= start && a.At < end && (entityType == null || a.EntityType == entityType) && (entityId == null || a.EntityId == entityId))
            .OrderByDescending(a => a.Id).Take(5000)
            .Select(a => new AuditDto(a.Id, a.At, a.UserName, a.EntityType, a.EntityId, a.EntityLabel, a.Action, a.ChangesJson))
            .ToListAsync(ct);
    }
}
