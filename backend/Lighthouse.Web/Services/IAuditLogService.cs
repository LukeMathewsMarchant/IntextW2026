using Lighthouse.Web.Models.Entities;

namespace Lighthouse.Web.Services;

public interface IAuditLogService
{
    Task LogAsync(
        string userId,
        string action,
        string entityType,
        string? entityKey,
        string? oldValues,
        string? newValues,
        string? ipAddress,
        string? correlationId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminAuditLog>> GetRecentAsync(int take, CancellationToken cancellationToken = default);
}
