using Lighthouse.Web.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Controllers.Api;

[Route("api/impact")]
[ApiController]
public class ImpactApiController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ImpactApiController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var activeSupporters = await _db.Supporters.AsNoTracking()
            .CountAsync(s => s.Status.ToString() == "Active", cancellationToken);

        var safehouseCount = await _db.Safehouses.AsNoTracking()
            .CountAsync(s => s.Status == "Active", cancellationToken);

        var activePrograms = await _db.Partners.AsNoTracking().CountAsync(cancellationToken);

        var residents = await _db.Residents.AsNoTracking().ToListAsync(cancellationToken);
        var closedCases = residents.Count(r => r.CaseStatus == "Closed" || r.ReintegrationStatus == "Reintegrated");
        var successRate = residents.Count == 0 ? 0 : (int)Math.Round((closedCases * 100m) / residents.Count, MidpointRounding.AwayFromZero);

        var donations = await _db.Donations.AsNoTracking().ToListAsync(cancellationToken);
        var retention = BuildRetention(donations);

        var effortSafety = residents.Count;
        var effortHealing = await _db.EducationRecords.AsNoTracking().CountAsync(cancellationToken);
        var effortJustice = await _db.IncidentReports.AsNoTracking().CountAsync(cancellationToken);
        var effortEmpowerment = await _db.InterventionPlans.AsNoTracking().CountAsync(cancellationToken);
        var effortTotal = Math.Max(1, effortSafety + effortHealing + effortJustice + effortEmpowerment);

        var supportMix = new[]
        {
            new MixPoint("Safety & shelter", (int)Math.Round(effortSafety * 100m / effortTotal, MidpointRounding.AwayFromZero), "#1f2f6b"),
            new MixPoint("Healing & education", (int)Math.Round(effortHealing * 100m / effortTotal, MidpointRounding.AwayFromZero), "#3d9d72"),
            new MixPoint("Justice services", (int)Math.Round(effortJustice * 100m / effortTotal, MidpointRounding.AwayFromZero), "#8b5cf6"),
            new MixPoint("Empowerment", (int)Math.Round(effortEmpowerment * 100m / effortTotal, MidpointRounding.AwayFromZero), "#ffb200"),
        };

        var milestones = await _db.PublicImpactSnapshots.AsNoTracking()
            .Where(s => s.IsPublished)
            .OrderByDescending(s => s.SnapshotDate)
            .Take(4)
            .Select(s => new MilestonePoint(
                $"{s.SnapshotDate:yyyy-MM}",
                s.Headline,
                s.SummaryText ?? "Published impact snapshot"))
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            chips = new[] { "Source: INTEX case data", $"Coverage: {safehouseCount} safehouses", $"Updated: {DateTime.UtcNow:yyyy-MM-dd}" },
            kpis = new
            {
                livesImpacted = activeSupporters,
                safehouses = safehouseCount,
                activePrograms,
                successRate
            },
            retention,
            supportMix,
            milestones
        });
    }

    private static IReadOnlyList<RetentionPoint> BuildRetention(IReadOnlyCollection<Models.Entities.Donation> donations)
    {
        var monthKeys = donations
            .Select(d => new DateOnly(d.DonationDate.Year, d.DonationDate.Month, 1))
            .Distinct()
            .OrderBy(d => d)
            .TakeLast(7)
            .ToList();

        var byMonth = donations
            .GroupBy(d => new DateOnly(d.DonationDate.Year, d.DonationDate.Month, 1))
            .ToDictionary(g => g.Key, g => g.Select(x => x.SupporterId).Distinct().ToHashSet());

        var points = new List<RetentionPoint>();
        for (var i = 0; i < monthKeys.Count; i++)
        {
            var month = monthKeys[i];
            if (!byMonth.TryGetValue(month, out var currentSet))
                continue;

            var rate = 0;
            if (i > 0 && byMonth.TryGetValue(monthKeys[i - 1], out var prevSet) && prevSet.Count > 0)
            {
                var retained = currentSet.Count(prevSet.Contains);
                rate = (int)Math.Round((retained * 100m) / prevSet.Count, MidpointRounding.AwayFromZero);
            }

            points.Add(new RetentionPoint(month.ToString("MMM"), rate));
        }

        return points;
    }

    public record RetentionPoint(string Month, int Rate);
    public record MixPoint(string Name, int Value, string Color);
    public record MilestonePoint(string Period, string Headline, string Summary);
}

