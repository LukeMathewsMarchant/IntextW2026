using System.Security.Claims;
using System.Text.Json;
using Lighthouse.Web.Authorization;
using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Lighthouse.Web.Controllers.Api;

[Authorize(Policy = AppPolicies.AdminOnly)]
[Route("api/admin")]
[ApiController]
[IgnoreAntiforgeryToken]
public class AdminApiController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles
    };

    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _audit;

    public AdminApiController(ApplicationDbContext db, IAuditLogService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet("metrics/okr")]
    public async Task<IActionResult> Okr([FromServices] OkrMetricsService okr, CancellationToken cancellationToken)
    {
        var snap = await okr.GetSnapshotAsync(cancellationToken);
        return Ok(snap);
    }

    [HttpGet("audit")]
    public async Task<IActionResult> AuditLog([FromQuery] int take = 200, CancellationToken cancellationToken = default)
    {
        var rows = await _audit.GetRecentAsync(Math.Clamp(take, 1, 2000), cancellationToken);
        return Ok(rows);
    }

    [HttpGet("analytics/donor-propensity")]
    public async Task<IActionResult> DonorPropensity([FromServices] OkrMetricsService okr, CancellationToken cancellationToken)
    {
        return Ok(await okr.GetChurnRiskDonorsAsync(120, cancellationToken));
    }

    [HttpGet("data/{entity}")]
    public async Task<IActionResult> List(string entity, CancellationToken cancellationToken)
    {
        return entity.ToLowerInvariant() switch
        {
            "users" => Ok(await _db.LegacyUsers.AsNoTracking().Take(500).ToListAsync(cancellationToken)),
            "safehouses" => Ok(await _db.Safehouses.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            "supporters" => Ok(await _db.Supporters.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            "donations" => Ok(await _db.Donations.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "donation_allocations" => Ok(await _db.DonationAllocations.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "in_kind_donation_items" => Ok(await _db.InKindDonationItems.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "partners" => Ok(await _db.Partners.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            "partner_assignments" => Ok(await _db.PartnerAssignments.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "residents" => Ok(await _db.Residents.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            "education_records" => Ok(await _db.EducationRecords.AsNoTracking().Take(8000).ToListAsync(cancellationToken)),
            "health_wellbeing_records" => Ok(await _db.HealthWellbeingRecords.AsNoTracking().Take(8000).ToListAsync(cancellationToken)),
            "intervention_plans" => Ok(await _db.InterventionPlans.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "home_visitations" => Ok(await _db.HomeVisitations.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "process_recordings" => Ok(await _db.ProcessRecordings.AsNoTracking().Take(8000).ToListAsync(cancellationToken)),
            "incident_reports" => Ok(await _db.IncidentReports.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "safehouse_monthly_metrics" => Ok(await _db.SafehouseMonthlyMetrics.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "public_impact_snapshots" => Ok(await _db.PublicImpactSnapshots.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            _ => NotFound()
        };
    }

    [HttpGet("data/{entity}/{id}")]
    public async Task<IActionResult> Get(string entity, string id, CancellationToken cancellationToken)
    {
        return entity.ToLowerInvariant() switch
        {
            "users" when Guid.TryParse(id, out var gid) => Ok(await _db.LegacyUsers.FindAsync(new object[] { gid }, cancellationToken)),
            "safehouses" when int.TryParse(id, out var sid) => Ok(await _db.Safehouses.FindAsync(new object[] { sid }, cancellationToken)),
            "supporters" when int.TryParse(id, out var sup) => Ok(await _db.Supporters.FindAsync(new object[] { sup }, cancellationToken)),
            "donations" when int.TryParse(id, out var did) => Ok(await _db.Donations.FindAsync(new object[] { did }, cancellationToken)),
            "donation_allocations" when int.TryParse(id, out var aid) => Ok(await _db.DonationAllocations.FindAsync(new object[] { aid }, cancellationToken)),
            "in_kind_donation_items" when int.TryParse(id, out var iid) => Ok(await _db.InKindDonationItems.FindAsync(new object[] { iid }, cancellationToken)),
            "partners" when int.TryParse(id, out var pid) => Ok(await _db.Partners.FindAsync(new object[] { pid }, cancellationToken)),
            "partner_assignments" when int.TryParse(id, out var paid) => Ok(await _db.PartnerAssignments.FindAsync(new object[] { paid }, cancellationToken)),
            "residents" when int.TryParse(id, out var rid) => Ok(await _db.Residents.FindAsync(new object[] { rid }, cancellationToken)),
            "education_records" when int.TryParse(id, out var eid) => Ok(await _db.EducationRecords.FindAsync(new object[] { eid }, cancellationToken)),
            "health_wellbeing_records" when int.TryParse(id, out var hid) => Ok(await _db.HealthWellbeingRecords.FindAsync(new object[] { hid }, cancellationToken)),
            "intervention_plans" when int.TryParse(id, out var pl) => Ok(await _db.InterventionPlans.FindAsync(new object[] { pl }, cancellationToken)),
            "home_visitations" when int.TryParse(id, out var vid) => Ok(await _db.HomeVisitations.FindAsync(new object[] { vid }, cancellationToken)),
            "process_recordings" when int.TryParse(id, out var pr) => Ok(await _db.ProcessRecordings.FindAsync(new object[] { pr }, cancellationToken)),
            "incident_reports" when int.TryParse(id, out var ir) => Ok(await _db.IncidentReports.FindAsync(new object[] { ir }, cancellationToken)),
            "safehouse_monthly_metrics" when int.TryParse(id, out var mid) => Ok(await _db.SafehouseMonthlyMetrics.FindAsync(new object[] { mid }, cancellationToken)),
            "public_impact_snapshots" when int.TryParse(id, out var psid) => Ok(await _db.PublicImpactSnapshots.FindAsync(new object[] { psid }, cancellationToken)),
            _ => NotFound()
        };
    }

    [HttpPost("data/{entity}")]
    public async Task<IActionResult> Create(string entity, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        object? added = entity.ToLowerInvariant() switch
        {
            "users" => JsonSerializer.Deserialize<LegacyUser>(body, JsonOptions),
            "safehouses" => JsonSerializer.Deserialize<Safehouse>(body, JsonOptions),
            "supporters" => JsonSerializer.Deserialize<Supporter>(body, JsonOptions),
            "donations" => JsonSerializer.Deserialize<Donation>(body, JsonOptions),
            "donation_allocations" => JsonSerializer.Deserialize<DonationAllocation>(body, JsonOptions),
            "in_kind_donation_items" => JsonSerializer.Deserialize<InKindDonationItem>(body, JsonOptions),
            "partners" => JsonSerializer.Deserialize<Partner>(body, JsonOptions),
            "partner_assignments" => JsonSerializer.Deserialize<PartnerAssignment>(body, JsonOptions),
            "residents" => JsonSerializer.Deserialize<Resident>(body, JsonOptions),
            "education_records" => JsonSerializer.Deserialize<EducationRecord>(body, JsonOptions),
            "health_wellbeing_records" => JsonSerializer.Deserialize<HealthWellbeingRecord>(body, JsonOptions),
            "intervention_plans" => JsonSerializer.Deserialize<InterventionPlan>(body, JsonOptions),
            "home_visitations" => JsonSerializer.Deserialize<HomeVisitation>(body, JsonOptions),
            "process_recordings" => JsonSerializer.Deserialize<ProcessRecording>(body, JsonOptions),
            "incident_reports" => JsonSerializer.Deserialize<IncidentReport>(body, JsonOptions),
            "safehouse_monthly_metrics" => JsonSerializer.Deserialize<SafehouseMonthlyMetric>(body, JsonOptions),
            "public_impact_snapshots" => JsonSerializer.Deserialize<PublicImpactSnapshot>(body, JsonOptions),
            _ => null
        };

        if (added == null)
            return NotFound();

        _db.Add(added);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(userId, "Create", entity, GetKey(added), null, body.GetRawText(), HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.TraceIdentifier, cancellationToken);
        return Ok(added);
    }

    [HttpPut("data/{entity}/{id}")]
    public async Task<IActionResult> Update(string entity, string id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var existing = await FindTrackedAsync(entity, id, cancellationToken);
        if (existing == null)
            return NotFound();

        var oldJson = JsonSerializer.Serialize(existing, JsonOptions);
        object? updated = entity.ToLowerInvariant() switch
        {
            "users" when existing is LegacyUser => JsonSerializer.Deserialize<LegacyUser>(body, JsonOptions),
            "safehouses" when existing is Safehouse => JsonSerializer.Deserialize<Safehouse>(body, JsonOptions),
            "supporters" when existing is Supporter => JsonSerializer.Deserialize<Supporter>(body, JsonOptions),
            "donations" when existing is Donation => JsonSerializer.Deserialize<Donation>(body, JsonOptions),
            "donation_allocations" when existing is DonationAllocation => JsonSerializer.Deserialize<DonationAllocation>(body, JsonOptions),
            "in_kind_donation_items" when existing is InKindDonationItem => JsonSerializer.Deserialize<InKindDonationItem>(body, JsonOptions),
            "partners" when existing is Partner => JsonSerializer.Deserialize<Partner>(body, JsonOptions),
            "partner_assignments" when existing is PartnerAssignment => JsonSerializer.Deserialize<PartnerAssignment>(body, JsonOptions),
            "residents" when existing is Resident => JsonSerializer.Deserialize<Resident>(body, JsonOptions),
            "education_records" when existing is EducationRecord => JsonSerializer.Deserialize<EducationRecord>(body, JsonOptions),
            "health_wellbeing_records" when existing is HealthWellbeingRecord => JsonSerializer.Deserialize<HealthWellbeingRecord>(body, JsonOptions),
            "intervention_plans" when existing is InterventionPlan => JsonSerializer.Deserialize<InterventionPlan>(body, JsonOptions),
            "home_visitations" when existing is HomeVisitation => JsonSerializer.Deserialize<HomeVisitation>(body, JsonOptions),
            "process_recordings" when existing is ProcessRecording => JsonSerializer.Deserialize<ProcessRecording>(body, JsonOptions),
            "incident_reports" when existing is IncidentReport => JsonSerializer.Deserialize<IncidentReport>(body, JsonOptions),
            "safehouse_monthly_metrics" when existing is SafehouseMonthlyMetric => JsonSerializer.Deserialize<SafehouseMonthlyMetric>(body, JsonOptions),
            "public_impact_snapshots" when existing is PublicImpactSnapshot => JsonSerializer.Deserialize<PublicImpactSnapshot>(body, JsonOptions),
            _ => null
        };

        if (updated == null)
            return BadRequest();

        _db.Entry(existing).State = EntityState.Detached;
        _db.Update(updated);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(userId, "Update", entity, id, oldJson, body.GetRawText(), HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.TraceIdentifier, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("data/{entity}/{id}")]
    public async Task<IActionResult> Delete(string entity, string id, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var normalizedEntity = entity.ToLowerInvariant();
        var existing = await FindTrackedAsync(normalizedEntity, id, cancellationToken);
        if (existing == null)
            return NotFound();

        var oldJson = JsonSerializer.Serialize(existing, JsonOptions);
        try
        {
            if (normalizedEntity == "supporters" && existing is Supporter supporter)
            {
                // Delete dependent rows first so supporter delete succeeds under FK constraints.
                var donationIds = await _db.Donations
                    .Where(d => d.SupporterId == supporter.SupporterId)
                    .Select(d => d.DonationId)
                    .ToListAsync(cancellationToken);

                if (donationIds.Count > 0)
                {
                    var allocations = await _db.DonationAllocations
                        .Where(a => donationIds.Contains(a.DonationId))
                        .ToListAsync(cancellationToken);
                    if (allocations.Count > 0)
                        _db.DonationAllocations.RemoveRange(allocations);

                    var inKindItems = await _db.InKindDonationItems
                        .Where(i => donationIds.Contains(i.DonationId))
                        .ToListAsync(cancellationToken);
                    if (inKindItems.Count > 0)
                        _db.InKindDonationItems.RemoveRange(inKindItems);

                    var donations = await _db.Donations
                        .Where(d => donationIds.Contains(d.DonationId))
                        .ToListAsync(cancellationToken);
                    _db.Donations.RemoveRange(donations);
                }
            }

            _db.Remove(existing);
            await _db.SaveChangesAsync(cancellationToken);
            await _audit.LogAsync(userId, "Delete", entity, id, oldJson, null, HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.TraceIdentifier, cancellationToken);
            return NoContent();
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23503")
        {
            return Conflict(new
            {
                error = "Cannot delete this record because it is referenced by other records. Remove dependent records first."
            });
        }
    }

    private async Task<object?> FindTrackedAsync(string entity, string id, CancellationToken cancellationToken)
    {
        return entity.ToLowerInvariant() switch
        {
            "users" when Guid.TryParse(id, out var gid) => await _db.LegacyUsers.FindAsync(new object[] { gid }, cancellationToken),
            "safehouses" when int.TryParse(id, out var sid) => await _db.Safehouses.FindAsync(new object[] { sid }, cancellationToken),
            "supporters" when int.TryParse(id, out var sup) => await _db.Supporters.FindAsync(new object[] { sup }, cancellationToken),
            "donations" when int.TryParse(id, out var did) => await _db.Donations.FindAsync(new object[] { did }, cancellationToken),
            "donation_allocations" when int.TryParse(id, out var aid) => await _db.DonationAllocations.FindAsync(new object[] { aid }, cancellationToken),
            "in_kind_donation_items" when int.TryParse(id, out var iid) => await _db.InKindDonationItems.FindAsync(new object[] { iid }, cancellationToken),
            "partners" when int.TryParse(id, out var pid) => await _db.Partners.FindAsync(new object[] { pid }, cancellationToken),
            "partner_assignments" when int.TryParse(id, out var paid) => await _db.PartnerAssignments.FindAsync(new object[] { paid }, cancellationToken),
            "residents" when int.TryParse(id, out var rid) => await _db.Residents.FindAsync(new object[] { rid }, cancellationToken),
            "education_records" when int.TryParse(id, out var eid) => await _db.EducationRecords.FindAsync(new object[] { eid }, cancellationToken),
            "health_wellbeing_records" when int.TryParse(id, out var hid) => await _db.HealthWellbeingRecords.FindAsync(new object[] { hid }, cancellationToken),
            "intervention_plans" when int.TryParse(id, out var pl) => await _db.InterventionPlans.FindAsync(new object[] { pl }, cancellationToken),
            "home_visitations" when int.TryParse(id, out var vid) => await _db.HomeVisitations.FindAsync(new object[] { vid }, cancellationToken),
            "process_recordings" when int.TryParse(id, out var pr) => await _db.ProcessRecordings.FindAsync(new object[] { pr }, cancellationToken),
            "incident_reports" when int.TryParse(id, out var ir) => await _db.IncidentReports.FindAsync(new object[] { ir }, cancellationToken),
            "safehouse_monthly_metrics" when int.TryParse(id, out var mid) => await _db.SafehouseMonthlyMetrics.FindAsync(new object[] { mid }, cancellationToken),
            "public_impact_snapshots" when int.TryParse(id, out var psid) => await _db.PublicImpactSnapshots.FindAsync(new object[] { psid }, cancellationToken),
            _ => null
        };
    }

    private static string? GetKey(object entity) => entity switch
    {
        LegacyUser u => u.UserId.ToString(),
        Safehouse s => s.SafehouseId.ToString(),
        Supporter s => s.SupporterId.ToString(),
        Donation d => d.DonationId.ToString(),
        DonationAllocation d => d.AllocationId.ToString(),
        InKindDonationItem i => i.ItemId.ToString(),
        Partner p => p.PartnerId.ToString(),
        PartnerAssignment p => p.AssignmentId.ToString(),
        Resident r => r.ResidentId.ToString(),
        EducationRecord e => e.EducationRecordId.ToString(),
        HealthWellbeingRecord h => h.HealthRecordId.ToString(),
        InterventionPlan p => p.PlanId.ToString(),
        HomeVisitation h => h.VisitationId.ToString(),
        ProcessRecording p => p.RecordingId.ToString(),
        IncidentReport i => i.IncidentId.ToString(),
        SafehouseMonthlyMetric m => m.MetricId.ToString(),
        PublicImpactSnapshot p => p.SnapshotId.ToString(),
        _ => null
    };
}
