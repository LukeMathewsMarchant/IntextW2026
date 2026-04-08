using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
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
        // Must compare enum to constant — EF cannot translate Status.ToString() to SQL on PostgreSQL enums.
        var activeSupporters = await _db.Supporters.AsNoTracking()
            .CountAsync(s => s.Status == SupporterStatus.Active, cancellationToken);

        var safehouseCount = await _db.Safehouses.AsNoTracking()
            .CountAsync(s => s.Status == "Active", cancellationToken);

        var activePrograms = await _db.Partners.AsNoTracking().CountAsync(cancellationToken);

        var residents = await _db.Residents.AsNoTracking().ToListAsync(cancellationToken);
        var closedCases = residents.Count(r => r.CaseStatus == "Closed" || r.ReintegrationStatus == "Reintegrated");
        var successRate = residents.Count == 0 ? 0 : (int)Math.Round((closedCases * 100m) / residents.Count, MidpointRounding.AwayFromZero);

        var donations = await _db.Donations.AsNoTracking().ToListAsync(cancellationToken);
        var allocations = await _db.DonationAllocations.AsNoTracking().ToListAsync(cancellationToken);
        var retention = BuildRetention(donations);
        var retentionDetail = BuildRetentionDetail(donations);
        var donationsLast12Months = donations
            .Where(d => d.DonationDate >= DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-12)))
            .Sum(d => d.Amount ?? 0m);
        var channelTotals = donations
            .GroupBy(d => d.ChannelSource?.ToString() ?? "Unknown")
            .Select(g => new ChannelPerformancePoint(
                g.Key,
                g.Count(),
                Math.Round(g.Sum(x => x.Amount ?? 0m), 2)))
            .OrderByDescending(x => x.TotalAmount)
            .ToList();
        var totalDonationAmount = channelTotals.Sum(c => c.TotalAmount);
        channelTotals = channelTotals
            .Select(c => c with
            {
                Share = totalDonationAmount <= 0m ? 0m : Math.Round((c.TotalAmount / totalDonationAmount) * 100m, 2)
            })
            .OrderByDescending(c => c.TotalAmount)
            .ToList();

        var postTraction = donations
            .Where(d => d.ReferralPostId.HasValue || !string.IsNullOrWhiteSpace(d.CampaignName))
            .GroupBy(d => !string.IsNullOrWhiteSpace(d.CampaignName) ? d.CampaignName!.Trim() : $"Post #{d.ReferralPostId}")
            .Select(g => new PostTractionPoint(
                g.Key,
                g.Count(),
                Math.Round(g.Sum(x => x.Amount ?? 0m), 2),
                Math.Round(g.Average(x => x.Amount ?? 0m), 2)))
            .OrderByDescending(p => p.DonationValue)
            .Take(6)
            .ToList();

        var allocationBreakdown = allocations
            .GroupBy(a => a.ProgramArea)
            .Select(g => new AllocationPoint(
                g.Key,
                Math.Round(g.Sum(x => x.AmountAllocated), 2),
                g.Count()))
            .OrderByDescending(a => a.AmountAllocated)
            .ToList();
        var socialDonations = donations
            .Where(d => string.Equals(d.ChannelSource?.ToString(), "SocialMedia", StringComparison.OrdinalIgnoreCase))
            .ToList();
        var socialDonationIds = socialDonations.Select(d => d.DonationId).ToHashSet();
        var socialAllocationBreakdown = allocations
            .Where(a => socialDonationIds.Contains(a.DonationId))
            .GroupBy(a => a.ProgramArea)
            .Select(g => new AllocationPoint(
                g.Key,
                Math.Round(g.Sum(x => x.AmountAllocated), 2),
                g.Count()))
            .OrderByDescending(a => a.AmountAllocated)
            .ToList();
        var socialPlatformPerformance = socialDonations
            .GroupBy(d => InferPlatform(d.CampaignName, d.Notes))
            .Select(g => new ChannelPerformancePoint(
                g.Key,
                g.Count(),
                Math.Round(g.Sum(x => x.Amount ?? 0m), 2)))
            .OrderByDescending(x => x.TotalAmount)
            .ToList();
        var socialTotal = socialPlatformPerformance.Sum(x => x.TotalAmount);
        socialPlatformPerformance = socialPlatformPerformance
            .Select(c => c with
            {
                Share = socialTotal <= 0m ? 0m : Math.Round((c.TotalAmount / socialTotal) * 100m, 2)
            })
            .OrderByDescending(c => c.TotalAmount)
            .ToList();

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

        var (safehousePerformance, outcomeFromCase, operationalCaseWindow) =
            await BuildOperationalSafehouseComparisonAsync(cancellationToken);

        var donorOkrs = BuildDonorOkrs(donations);

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
            retentionDetail,
            supportMix,
            dataFreshness = new
            {
                generatedAtUtc = DateTime.UtcNow,
                latestSafehouseMetricMonth = (string?)null,
                operationalCaseWindow
            },
            outcomeSignals = new
            {
                donationsLast12Months = Math.Round(donationsLast12Months, 2),
                activeResidentsLatest = outcomeFromCase.ActiveResidentsLatest,
                incidentsLatest = outcomeFromCase.IncidentsLatest,
                avgEducationLatest = outcomeFromCase.AvgEducationLatest,
                avgHealthLatest = outcomeFromCase.AvgHealthLatest
            },
            safehousePerformance,
            donorOkrs,
            donationChannelPerformance = channelTotals,
            socialPostTraction = postTraction,
            donationAllocationBreakdown = allocationBreakdown,
            socialMediaPlatformPerformance = socialPlatformPerformance,
            socialMediaAllocationBreakdown = socialAllocationBreakdown,
            metricDefinitions = new[]
            {
                new { key = "successRate", label = "Success Rate", definition = "Share of residents with case_status = Closed or reintegration status marked Reintegrated." },
                new { key = "retention", label = "Retention Trend", definition = "Share of supporters giving again month-over-month based on unique supporter IDs." },
                new { key = "avgEducationLatest", label = "Avg Education Progress", definition = "Average education progress_percent on education_records in the last 30 days (UTC), across all active safehouses." },
                new { key = "avgHealthLatest", label = "Avg Health Score", definition = "Average general_health_score on health_wellbeing_records in the last 30 days (UTC), across all active safehouses." },
                new { key = "safehouseCaseComparison", label = "Safehouse Case Activity", definition = "Per safehouse: active resident census (case_status Active); incident_reports in last vs prior 30 days; average education progress and health scores from records in those windows. Deltas compare the two 30-day periods." },
                new { key = "donorChurnOkr", label = "Donor churn (OKR)", definition = "Among distinct supporters with at least one donation in the trailing 12 months, churn risk counts those with no donation in the last 90 days. Churn rate = that count divided by the 12-month donor cohort." },
                new { key = "donationChannelPerformance", label = "Donation Channel Performance", definition = "Donation amount and count grouped by recorded channel source (e.g., SocialMedia, Campaign, Direct)." },
                new { key = "socialPostTraction", label = "Social Post Traction", definition = "Top campaign/post labels by donation value and referrals, based on campaign_name or referral_post_id links." },
                new { key = "donationAllocationBreakdown", label = "Donation Allocation Breakdown", definition = "Allocated donation totals grouped by program area from donation allocation records." },
                new { key = "socialMediaPlatformPerformance", label = "Social App Performance", definition = "Social-media donations grouped by inferred app using campaign labels and notes (Facebook, Instagram, TikTok, YouTube, X/Twitter)." },
                new { key = "socialMediaAllocationBreakdown", label = "Where Social Donations Go", definition = "Program-area allocation totals limited to donations marked as SocialMedia channel source." }
            }
        });
    }

    private sealed record OperationalOutcomeTotals(
        int ActiveResidentsLatest,
        int IncidentsLatest,
        decimal? AvgEducationLatest,
        decimal? AvgHealthLatest);

    /// <summary>
    /// Safehouse comparison from operational case tables (not safehouse_monthly_metrics): rolling 30-day vs prior 30-day UTC windows.
    /// </summary>
    private async Task<(List<SafehouseDeltaPoint> Rows, OperationalOutcomeTotals Outcome, string WindowLabel)>
        BuildOperationalSafehouseComparisonAsync(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var currentEnd = today;
        var currentStart = today.AddDays(-29);
        var priorEnd = today.AddDays(-30);
        var priorStart = today.AddDays(-59);
        var windowLabel =
            $"Last 30 days ({currentStart:yyyy-MM-dd}–{currentEnd:yyyy-MM-dd} UTC) vs prior 30 days ({priorStart:yyyy-MM-dd}–{priorEnd:yyyy-MM-dd} UTC)";

        var houses = await _db.Safehouses.AsNoTracking()
            .Where(s => s.Status == "Active")
            .OrderBy(s => s.SafehouseId)
            .ToListAsync(cancellationToken);

        var incidentRows = await _db.IncidentReports.AsNoTracking()
            .Where(i => i.IncidentDate >= priorStart && i.IncidentDate <= currentEnd)
            .Select(i => new { i.SafehouseId, i.IncidentDate })
            .ToListAsync(cancellationToken);

        var eduRows = await (
            from e in _db.EducationRecords.AsNoTracking()
            join r in _db.Residents.AsNoTracking() on e.ResidentId equals r.ResidentId
            where e.RecordDate >= priorStart && e.RecordDate <= currentEnd && e.ProgressPercent != null
            select new { r.SafehouseId, e.RecordDate, Progress = e.ProgressPercent!.Value }
        ).ToListAsync(cancellationToken);

        var healthRows = await (
            from h in _db.HealthWellbeingRecords.AsNoTracking()
            join r in _db.Residents.AsNoTracking() on h.ResidentId equals r.ResidentId
            where h.RecordDate >= priorStart && h.RecordDate <= currentEnd && h.GeneralHealthScore != null
            select new { r.SafehouseId, h.RecordDate, Score = h.GeneralHealthScore!.Value }
        ).ToListAsync(cancellationToken);

        var activeResidentsBySh = await _db.Residents.AsNoTracking()
            .Where(r => r.CaseStatus == "Active")
            .GroupBy(r => r.SafehouseId)
            .Select(g => new { g.Key, Cnt = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Cnt, cancellationToken);

        static decimal? RoundAvg(IEnumerable<decimal> values)
        {
            var list = values.ToList();
            return list.Count == 0 ? null : Math.Round(list.Average(), 2);
        }

        var rows = new List<SafehouseDeltaPoint>();
        foreach (var sh in houses)
        {
            var id = sh.SafehouseId;
            _ = activeResidentsBySh.TryGetValue(id, out var census);
            var activeResidents = census;

            var incCur = incidentRows.Count(i =>
                i.SafehouseId == id && i.IncidentDate >= currentStart && i.IncidentDate <= currentEnd);
            var incPrior = incidentRows.Count(i =>
                i.SafehouseId == id && i.IncidentDate >= priorStart && i.IncidentDate <= priorEnd);

            var eduCur = RoundAvg(eduRows
                .Where(x => x.SafehouseId == id && x.RecordDate >= currentStart && x.RecordDate <= currentEnd)
                .Select(x => x.Progress));
            var eduPrior = RoundAvg(eduRows
                .Where(x => x.SafehouseId == id && x.RecordDate >= priorStart && x.RecordDate <= priorEnd)
                .Select(x => x.Progress));
            var eduDelta = eduCur.HasValue && eduPrior.HasValue
                ? Math.Round(eduCur.Value - eduPrior.Value, 2)
                : (decimal?)null;

            var healthCur = RoundAvg(healthRows
                .Where(x => x.SafehouseId == id && x.RecordDate >= currentStart && x.RecordDate <= currentEnd)
                .Select(x => x.Score));
            var healthPrior = RoundAvg(healthRows
                .Where(x => x.SafehouseId == id && x.RecordDate >= priorStart && x.RecordDate <= priorEnd)
                .Select(x => x.Score));
            var healthDelta = healthCur.HasValue && healthPrior.HasValue
                ? Math.Round(healthCur.Value - healthPrior.Value, 2)
                : (decimal?)null;

            var displayName = string.IsNullOrWhiteSpace(sh.Name) ? $"Safehouse {sh.SafehouseId}" : sh.Name.Trim();

            rows.Add(new SafehouseDeltaPoint(
                id,
                displayName,
                activeResidents,
                0,
                incCur,
                incCur - incPrior,
                eduCur,
                eduDelta,
                healthCur,
                healthDelta,
                windowLabel));
        }

        var incidentsLatest = incidentRows.Count(i => i.IncidentDate >= currentStart && i.IncidentDate <= currentEnd);
        var activeResidentsLatest = activeResidentsBySh.Values.Sum();
        var avgEducationLatest = RoundAvg(eduRows
            .Where(x => x.RecordDate >= currentStart && x.RecordDate <= currentEnd)
            .Select(x => x.Progress));
        var avgHealthLatest = RoundAvg(healthRows
            .Where(x => x.RecordDate >= currentStart && x.RecordDate <= currentEnd)
            .Select(x => x.Score));

        var outcome = new OperationalOutcomeTotals(activeResidentsLatest, incidentsLatest, avgEducationLatest, avgHealthLatest);

        return (rows.OrderByDescending(r => r.Incidents).ThenBy(r => r.SafehouseName).ToList(), outcome, windowLabel);
    }

    /// <summary>
    /// Donor churn OKR: year cohort vs 90-day recency from donation rows only.
    /// </summary>
    private static object BuildDonorOkrs(IReadOnlyCollection<Models.Entities.Donation> donations)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var start90 = today.AddDays(-90);
        var start365 = today.AddDays(-365);

        var donorIdsLast365 = donations
            .Where(d => d.DonationDate >= start365 && d.DonationDate <= today)
            .Select(d => d.SupporterId)
            .Distinct()
            .ToHashSet();

        var donorIdsLast90 = donations
            .Where(d => d.DonationDate >= start90 && d.DonationDate <= today)
            .Select(d => d.SupporterId)
            .Distinct()
            .ToHashSet();

        var staleYearNot90 = donorIdsLast365.Count(id => !donorIdsLast90.Contains(id));
        var churnRatePct = donorIdsLast365.Count == 0
            ? 0
            : (int)Math.Round((100m * staleYearNot90) / donorIdsLast365.Count, MidpointRounding.AwayFromZero);

        var distinctDonorsAllTime = donations.Select(d => d.SupporterId).Distinct().Count();

        return new
        {
            donorsLast365Days = donorIdsLast365.Count,
            donorsLast90Days = donorIdsLast90.Count,
            donorsStaleYearNot90 = staleYearNot90,
            churnRatePct,
            distinctDonorsAllTime,
            windowLabel = "12-month donor cohort vs 90-day gift recency (UTC)",
            summary =
                "Among donors who gave at least once in the last 12 months, how many have no gift in the last 90 days — a practical churn-risk view for stewardship."
        };
    }

    private static string InferPlatform(string? campaignName, string? notes)
    {
        var text = $"{campaignName} {notes}".ToLowerInvariant();
        if (text.Contains("instagram") || text.Contains("ig"))
            return "Instagram";
        if (text.Contains("facebook") || text.Contains("fb"))
            return "Facebook";
        if (text.Contains("tiktok"))
            return "TikTok";
        if (text.Contains("youtube") || text.Contains("yt"))
            return "YouTube";
        if (text.Contains("twitter") || text.Contains("x "))
            return "X / Twitter";
        return "Unknown/Unlabeled";
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

    /// <summary>
    /// Latest calendar month with donations: unique supporters this month vs prior month,
    /// and how many "returned" (gave in both) vs did not give in the prior month.
    /// </summary>
    private static RetentionDetail? BuildRetentionDetail(IReadOnlyCollection<Models.Entities.Donation> donations)
    {
        if (donations.Count == 0)
            return null;

        var byMonth = donations
            .GroupBy(d => new DateOnly(d.DonationDate.Year, d.DonationDate.Month, 1))
            .ToDictionary(g => g.Key, g => g.Select(x => x.SupporterId).Distinct().ToHashSet());

        var latestMonth = byMonth.Keys.Max();
        var priorMonth = latestMonth.AddMonths(-1);

        if (!byMonth.TryGetValue(latestMonth, out var currentSet))
            return null;

        byMonth.TryGetValue(priorMonth, out var priorSet);
        priorSet ??= new HashSet<int>();

        var returning = currentSet.Count(priorSet.Contains);
        var noGiftInPriorMonth = currentSet.Count - returning;

        return new RetentionDetail(
            latestMonth.ToString("yyyy-MM"),
            latestMonth.ToString("MMMM yyyy"),
            currentSet.Count,
            priorSet.Count,
            returning,
            noGiftInPriorMonth,
            donations.Count(d => d.DonationDate.Year == latestMonth.Year && d.DonationDate.Month == latestMonth.Month)
        );
    }

    public record RetentionDetail(
        string MonthKey,
        string MonthLabel,
        int UniqueSupportersThisMonth,
        int UniqueSupportersPriorMonth,
        int ReturningSupporters,
        int NoGiftInPriorMonth,
        int DonationRowsThisMonth
    );

    public record RetentionPoint(string Month, int Rate);
    public record MixPoint(string Name, int Value, string Color);
    public record SafehouseDeltaPoint(
        int SafehouseId,
        string SafehouseName,
        int ActiveResidents,
        int ActiveResidentsDelta,
        int Incidents,
        int IncidentsDelta,
        decimal? AvgEducationProgress,
        decimal? AvgEducationDelta,
        decimal? AvgHealthScore,
        decimal? AvgHealthDelta,
        string Month
    );
    public record ChannelPerformancePoint(
        string Channel,
        int Donations,
        decimal TotalAmount)
    {
        public decimal Share { get; init; }
    }
    public record PostTractionPoint(
        string PostLabel,
        int Referrals,
        decimal DonationValue,
        decimal AvgDonationValue
    );
    public record AllocationPoint(
        string ProgramArea,
        decimal AmountAllocated,
        int AllocationCount
    );
}

