using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Services;

public class AuditLogService : IAuditLogService
{
    private readonly ApplicationDbContext _db;

    public AuditLogService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task LogAsync(
        string userId,
        string action,
        string entityType,
        string? entityKey,
        string? oldValues,
        string? newValues,
        string? ipAddress,
        string? correlationId,
        CancellationToken cancellationToken = default)
    {
        var row = new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityKey = entityKey,
            OldValues = oldValues,
            NewValues = newValues,
            IpAddress = ipAddress,
            CorrelationId = correlationId,
            Timestamp = DateTimeOffset.UtcNow
        };
        _db.AdminAuditLogs.Add(row);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AdminAuditLog>> GetRecentAsync(int take, CancellationToken cancellationToken = default)
    {
        return await _db.AdminAuditLogs
            .AsNoTracking()
            .OrderByDescending(a => a.Timestamp)
            .Take(take)
            .ToListAsync(cancellationToken);
    }
}
