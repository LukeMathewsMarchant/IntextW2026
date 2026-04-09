using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Lighthouse.Web.Controllers.Api;

[Route("api/impact")]
[ApiController]
public class ImpactApiController : ControllerBase
{
    private static readonly JsonSerializerOptions ImpactJsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ImpactApiController> _logger;
    private readonly ImpactPipelineClient _impactPipelineClient;

    public ImpactApiController(
        ApplicationDbContext db,
        IConfiguration configuration,
        ILogger<ImpactApiController> logger,
        ImpactPipelineClient impactPipelineClient)
    {
        _db = db;
        _configuration = configuration;
        _logger = logger;
        _impactPipelineClient = impactPipelineClient;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        try
        {
            var timeoutSec = _configuration.GetValue("Impact:CommandTimeoutSeconds", 120);
            if (timeoutSec > 0)
                _db.Database.SetCommandTimeout(TimeSpan.FromSeconds(timeoutSec));

            return await GetCore(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GET /api/impact failed");
            if (_configuration.GetValue("Impact:ExposeErrors", false))
            {
                var detail = $"{ex.GetType().Name}: {ex.Message}";
                if (ex.InnerException != null)
                    detail += $" | Inner: {ex.InnerException.Message}";
                return Problem(detail: detail, statusCode: 500);
            }

            return Problem(detail: "An error occurred in the Light on a Hill Foundation API.", statusCode: 500);
        }
    }

    private async Task<IActionResult> GetCore(CancellationToken cancellationToken)
    {
        var payload = await BuildImpactDashboardAsync(cancellationToken);
        JsonNode? node = JsonSerializer.SerializeToNode(payload, ImpactJsonOptions);
        if (node is not JsonObject jsonObject)
            return new JsonResult(node, ImpactJsonOptions);

        var mlEnabled = _configuration.GetValue("ImpactMlApi:Enabled", true);
        var mlOverlayPresent = false;
        if (mlEnabled)
        {
            try
            {
                var insights = await _impactPipelineClient.GetPipelineInsightsAsync(cancellationToken);
                if (insights != null)
                {
                    jsonObject["pipelineInsights"] = JsonSerializer.SerializeToNode(insights, ImpactJsonOptions);
                    mlOverlayPresent = true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Impact ML pipeline overlay unavailable; returning EF aggregates only.");
            }
        }

        jsonObject["connection"] = JsonSerializer.SerializeToNode(new
        {
            endpoint = "/api/impact",
            servedAtUtc = DateTime.UtcNow,
            mlPipelineOverlay = mlOverlayPresent,
            mlApiEnabled = mlEnabled,
        }, ImpactJsonOptions);

        return new JsonResult(node, ImpactJsonOptions);
    }

    /// <summary>Core EF aggregates for the public Impact dashboard. Pipeline overlay is merged in <see cref="GetCore"/>.</summary>
    private async Task<object> BuildImpactDashboardAsync(CancellationToken cancellationToken)
    {
        // Must compare enum to constant — EF cannot translate Status.ToString() to SQL on PostgreSQL enums.
        var activeSupporters = await _db.Supporters.AsNoTracking()
            .CountAsync(s => s.Status == SupporterStatus.Active, cancellationToken);

        var safehouseCount = await _db.Safehouses.AsNoTracking()
            .CountAsync(s => s.Status == "Active", cancellationToken);

        var activePrograms = await _db.Partners.AsNoTracking().CountAsync(cancellationToken);

        var residents = await _db.Residents.AsNoTracking().ToListAsync(cancellationToken);
        var closedCases = residents.Count(r => r.CaseStatus == "Closed" || r.ReintegrationStatus == "Completed");
        var successRate = residents.Count == 0 ? 0 : (int)Math.Round((closedCases * 100m) / residents.Count, MidpointRounding.AwayFromZero);

        var donations = await _db.Donations.AsNoTracking().ToListAsync(cancellationToken);
        var allocations = await _db.DonationAllocations.AsNoTracking().ToListAsync(cancellationToken);
        var retention = BuildRetention(donations);
        var retentionDetail = BuildRetentionDetail(donations);
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var last12MonthsStart = todayUtc.AddDays(-364);
        var donations12MonthRows = donations
            .Where(d => d.DonationDate >= last12MonthsStart && d.DonationDate <= todayUtc)
            .ToList();
        var donationsLast12Months = donations12MonthRows
            .Sum(d => d.Amount ?? 0m);
        var donorsLast12Months = donations12MonthRows
            .Select(d => d.SupporterId)
            .Distinct()
            .Count();
        var avgDonationAmountLast12Months = donations12MonthRows.Count == 0
            ? (decimal?)null
            : Math.Round(donations12MonthRows.Average(d => d.Amount ?? 0m), 2);
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
        var educationRows = await _db.EducationRecords.AsNoTracking()
            .Select(e => new { e.ResidentId, e.RecordDate, e.ProgressPercent })
            .ToListAsync(cancellationToken);
        var educationRowsWithProgress = educationRows
            .Where(e => e.ProgressPercent != null)
            .Select(e => new { e.ResidentId, e.RecordDate, Progress = e.ProgressPercent!.Value })
            .ToList();
        var avgEducationAllTimeRounded = educationRowsWithProgress.Count == 0
            ? (decimal?)null
            : Math.Round(educationRowsWithProgress.Average(e => e.Progress), 2);
        var firstMonth = new DateOnly(todayUtc.Year, todayUtc.Month, 1).AddMonths(-11);
        var monthKeys = Enumerable.Range(0, 12)
            .Select(i => firstMonth.AddMonths(i))
            .ToList();
        var educationAvgByMonth = educationRowsWithProgress
            .GroupBy(e => new DateOnly(e.RecordDate.Year, e.RecordDate.Month, 1))
            .ToDictionary(
                g => g.Key,
                g => Math.Round(g.Average(x => x.Progress), 2));
        var donationAmountByMonth = donations12MonthRows
            .GroupBy(d => new DateOnly(d.DonationDate.Year, d.DonationDate.Month, 1))
            .ToDictionary(
                g => g.Key,
                g => Math.Round(g.Sum(x => x.Amount ?? 0m), 2));
        var educationMonthlyTrend = monthKeys
            .Select(m => new
            {
                month = m.ToString("yyyy-MM"),
                avgProgress = educationAvgByMonth.TryGetValue(m, out var avg) ? avg : (decimal?)null,
                donations = donationAmountByMonth.TryGetValue(m, out var amt) ? amt : 0m
            })
            .ToList();

        var donorOkrs = BuildDonorOkrs(donations);
        var last90Start = todayUtc.AddDays(-89);
        var last365Start = todayUtc.AddDays(-364);
        var spreadingWindowStart = todayUtc.AddDays(-89);
        var reintegratedLast90Days = residents.Count(r =>
            r.DateClosed.HasValue
            && r.DateClosed.Value >= last90Start
            && (r.CaseStatus == "Closed" || r.ReintegrationStatus == "Completed"));
        var reintegratedLast365Days = residents.Count(r =>
            r.DateClosed.HasValue
            && r.DateClosed.Value >= last365Start
            && (r.CaseStatus == "Closed" || r.ReintegrationStatus == "Completed"));
        var inCareNow = outcomeFromCase.ActiveResidentsLatest;
        var closureShareOfActivePct = inCareNow <= 0
            ? 0m
            : Math.Round((reintegratedLast90Days * 100m) / inCareNow, 2);
        var dollarsPerReintegration = reintegratedLast365Days <= 0
            ? (decimal?)null
            : Math.Round(donationsLast12Months / reintegratedLast365Days, 2);
        var dollarsPerActiveResident = inCareNow <= 0
            ? (decimal?)null
            : Math.Round(donationsLast12Months / inCareNow, 2);
        var estimatedMonthlyCostPerGirlInCare = inCareNow <= 0
            ? (decimal?)null
            : Math.Round(donationsLast12Months / (inCareNow * 12m), 2);

        var upcomingCaseConferencesNext30Days = await _db.InterventionPlans.AsNoTracking()
            .CountAsync(p => p.CaseConferenceDate.HasValue
                && p.CaseConferenceDate.Value >= todayUtc
                && p.CaseConferenceDate.Value <= todayUtc.AddDays(30), cancellationToken);

        var riskLevelBreakdown = BuildRiskLevelBreakdown(residents);
        var residentPipeline = BuildResidentPipeline(residents);
        var (spreadingReachThisMonth, spreadingReachLabel) = await BuildTotalReachInWindowAsync(spreadingWindowStart, cancellationToken);
        var donationReferralsFromSocialPosts = donations
            .Count(d => d.DonationDate >= spreadingWindowStart
                && d.DonationDate <= todayUtc
                && d.ReferralPostId.HasValue);
        var socialDonationsThisMonth = socialDonations
            .Where(d => d.DonationDate >= spreadingWindowStart && d.DonationDate <= todayUtc)
            .ToList();
        var socialDonationsCountThisMonth = socialDonationsThisMonth.Count;
        var socialDonationsAmountThisMonth = Math.Round(socialDonationsThisMonth.Sum(d => d.Amount ?? 0m), 2);
        var postPlatformById = await BuildPostPlatformLookupAsync(socialDonationsThisMonth, cancellationToken);
        var socialPlatformPerformanceThisMonth = socialDonationsThisMonth
            .GroupBy(d => GetDonationPlatform(d, postPlatformById))
            .Select(g => new ChannelPerformancePoint(
                g.Key,
                g.Count(),
                Math.Round(g.Sum(x => x.Amount ?? 0m), 2)))
            .OrderByDescending(x => x.TotalAmount)
            .ToList();
        var socialMonthTotal = socialPlatformPerformanceThisMonth.Sum(x => x.TotalAmount);
        socialPlatformPerformanceThisMonth = socialPlatformPerformanceThisMonth
            .Select(c => c with
            {
                Share = socialMonthTotal <= 0m ? 0m : Math.Round((c.TotalAmount / socialMonthTotal) * 100m, 2)
            })
            .OrderByDescending(c => c.TotalAmount)
            .ToList();
        var labeledPlatformThisMonth = socialPlatformPerformanceThisMonth
            .FirstOrDefault(p => !string.Equals(p.Channel, "Unknown/Unlabeled", StringComparison.OrdinalIgnoreCase));
        var topPlatformRow = labeledPlatformThisMonth ?? socialPlatformPerformanceThisMonth.FirstOrDefault();
        var mostEffectivePlatform = topPlatformRow?.Channel ?? "N/A";
        var mostEffectivePlatformSharePct = topPlatformRow?.Share ?? 0m;
        var platformAttributionNote = socialDonationsCountThisMonth == 0
            ? "No donations with channel SocialMedia in the last 90 days yet."
            : labeledPlatformThisMonth == null
                ? "Social gifts are logged, but we could not map referral posts to a known platform; missing links fall back to campaign/notes text."
                : "Share of last-90-days social-channel donation dollars by platform (from linked social_media_posts when available, else campaign/notes fallback).";
        var platformBreakdown = socialPlatformPerformanceThisMonth
            .Select(p => new
            {
                platform = p.Channel,
                giftCount = p.Donations,
                totalAmount = p.TotalAmount,
                sharePct = p.Share
            })
            .ToList();

        return new
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
                donorsLast12Months,
                avgDonationAmountLast12Months,
                activeResidentsLatest = outcomeFromCase.ActiveResidentsLatest,
                incidentsLatest = outcomeFromCase.IncidentsLatest,
                avgEducationLatest = avgEducationAllTimeRounded,
                avgHealthLatest = outcomeFromCase.AvgHealthLatest
            },
            impactNarrative = new
            {
                inCareNow,
                recentReintegrations = reintegratedLast90Days,
                recentIncidents = outcomeFromCase.IncidentsLatest,
                closureShareOfActivePct,
                storyWindowLabel = $"Last 90 days ({last90Start:yyyy-MM-dd}–{todayUtc:yyyy-MM-dd} UTC)"
            },
            outcomePerDollar = new
            {
                donationsLast12Months = Math.Round(donationsLast12Months, 2),
                reintegrationsLast12Months = reintegratedLast365Days,
                activeResidentsNow = inCareNow,
                dollarsPerReintegration,
                dollarsPerActiveResident,
                windowLabel = $"Last 12 months ({last365Start:yyyy-MM-dd}–{todayUtc:yyyy-MM-dd} UTC)"
            },
            upcomingCaseConferences = new
            {
                next30Days = upcomingCaseConferencesNext30Days,
                windowLabel = $"Next 30 days ({todayUtc:yyyy-MM-dd}–{todayUtc.AddDays(30):yyyy-MM-dd} UTC)"
            },
            riskLevels = riskLevelBreakdown,
            residentPipeline,
            givingInAction = new
            {
                metricKey = "estimatedMonthlyCostPerGirlInCare",
                headline = "Estimated monthly cost per girl in care",
                value = estimatedMonthlyCostPerGirlInCare,
                context = estimatedMonthlyCostPerGirlInCare == null
                    ? "Not enough active resident data yet."
                    : $"Based on last-12-month donations divided by active census and spread across 12 months.",
                formula = "donationsLast12Months / (activeResidentsNow * 12)"
            },
            spreadingTheWord = new
            {
                totalReachThisMonth = spreadingReachThisMonth,
                totalReachLabel = spreadingReachLabel,
                mostEffectivePlatform,
                mostEffectivePlatformSharePct,
                socialDonationsCountThisMonth,
                socialDonationsAmountThisMonth,
                donationReferralsFromSocialPosts,
                platformAttributionNote,
                platformBreakdown,
                windowLabel = $"{spreadingWindowStart:yyyy-MM-dd} through {todayUtc:yyyy-MM-dd} UTC (rolling 90 days)"
            },
            educationInsights = new
            {
                avgProgressAllTime = avgEducationAllTimeRounded,
                totalRecords = educationRows.Count,
                nonNullProgressRecords = educationRowsWithProgress.Count,
                distinctResidentsWithEducation = educationRowsWithProgress
                    .Select(e => e.ResidentId)
                    .Distinct()
                    .Count(),
                monthlyTrend = educationMonthlyTrend
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
                new { key = "successRate", label = "Success Rate", definition = "Share of residents with case_status = Closed or reintegration status marked Completed." },
                new { key = "retention", label = "Retention Trend", definition = "Share of supporters giving again month-over-month based on unique supporter IDs." },
                new { key = "avgEducationLatest", label = "Avg Education Progress", definition = "All-time average education progress_percent across non-null education_records." },
                new { key = "avgHealthLatest", label = "Avg Health Score", definition = "Average general_health_score on health_wellbeing_records in the last 30 days (UTC), across all active safehouses." },
                new { key = "safehouseCaseComparison", label = "Safehouse Case Activity", definition = "Per safehouse: active resident census (case_status Active); incident_reports in last vs prior 30 days; average education progress and health scores from records in those windows. Deltas compare the two 30-day periods." },
                new { key = "donorChurnOkr", label = "Donor churn (OKR)", definition = "Among distinct supporters with at least one donation in the trailing 12 months, churn risk counts those with no donation in the last 90 days. Churn rate = that count divided by the 12-month donor cohort." },
                new { key = "donationChannelPerformance", label = "Donation Channel Performance", definition = "Donation amount and count grouped by recorded channel source (e.g., SocialMedia, Campaign, Direct)." },
                new { key = "socialPostTraction", label = "Social Post Traction", definition = "Top campaign/post labels by donation value and referrals, based on campaign_name or referral_post_id links." },
                new { key = "donationAllocationBreakdown", label = "Donation Allocation Breakdown", definition = "Allocated donation totals grouped by program area from donation allocation records." },
                new { key = "socialMediaPlatformPerformance", label = "Social App Performance", definition = "Social-media donations grouped by inferred app using campaign labels and notes (Facebook, Instagram, TikTok, YouTube, X/Twitter)." },
                new { key = "socialMediaAllocationBreakdown", label = "Where Social Donations Go", definition = "Program-area allocation totals limited to donations marked as SocialMedia channel source." }
            }
        };
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

        // Avoid EF in-database joins on education/health → residents (can fail to translate or behave differently on some PG hosts).
        // Load rows + resident→safehouse map, then join in memory.
        var eduScoped = await _db.EducationRecords.AsNoTracking()
            .Where(e => e.RecordDate >= priorStart && e.RecordDate <= currentEnd && e.ProgressPercent != null)
            .Select(e => new { e.ResidentId, e.RecordDate, Progress = e.ProgressPercent!.Value })
            .ToListAsync(cancellationToken);
        var eduRows = new List<(int SafehouseId, DateOnly RecordDate, decimal Progress)>();
        if (eduScoped.Count > 0)
        {
            var eduResIds = eduScoped.Select(e => e.ResidentId).Distinct().ToArray();
            var eduShMap = await _db.Residents.AsNoTracking()
                .Where(r => eduResIds.Contains(r.ResidentId))
                .Select(r => new { r.ResidentId, r.SafehouseId })
                .ToDictionaryAsync(x => x.ResidentId, x => x.SafehouseId, cancellationToken);
            foreach (var e in eduScoped)
            {
                if (eduShMap.TryGetValue(e.ResidentId, out var shId))
                    eduRows.Add((shId, e.RecordDate, e.Progress));
            }
        }

        var healthScoped = await _db.HealthWellbeingRecords.AsNoTracking()
            .Where(h => h.RecordDate >= priorStart && h.RecordDate <= currentEnd && h.GeneralHealthScore != null)
            .Select(h => new { h.ResidentId, h.RecordDate, Score = h.GeneralHealthScore!.Value })
            .ToListAsync(cancellationToken);
        var healthRows = new List<(int SafehouseId, DateOnly RecordDate, decimal Score)>();
        if (healthScoped.Count > 0)
        {
            var healthResIds = healthScoped.Select(h => h.ResidentId).Distinct().ToArray();
            var healthShMap = await _db.Residents.AsNoTracking()
                .Where(r => healthResIds.Contains(r.ResidentId))
                .Select(r => new { r.ResidentId, r.SafehouseId })
                .ToDictionaryAsync(x => x.ResidentId, x => x.SafehouseId, cancellationToken);
            foreach (var h in healthScoped)
            {
                if (healthShMap.TryGetValue(h.ResidentId, out var shId))
                    healthRows.Add((shId, h.RecordDate, h.Score));
            }
        }

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

    private async Task<Dictionary<int, string>> BuildPostPlatformLookupAsync(
        IReadOnlyCollection<Donation> socialDonationsInWindow,
        CancellationToken cancellationToken)
    {
        var ids = socialDonationsInWindow
            .Where(d => d.ReferralPostId.HasValue)
            .Select(d => d.ReferralPostId!.Value)
            .Distinct()
            .ToArray();
        if (ids.Length == 0)
            return new Dictionary<int, string>();

        await using var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(cancellationToken);

        await using var existsCmd = new NpgsqlCommand(@"
            select exists (
                select 1
                from information_schema.tables
                where table_schema = 'public' and table_name = 'social_media_posts'
            )", conn);
        var tableExists = (bool?)await existsCmd.ExecuteScalarAsync(cancellationToken) ?? false;
        if (!tableExists)
            return new Dictionary<int, string>();

        await using var cmd = new NpgsqlCommand(@"
            select post_id, platform
            from public.social_media_posts
            where post_id = any(@ids)", conn);
        cmd.Parameters.AddWithValue("ids", ids);

        var map = new Dictionary<int, string>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var postId = reader.GetInt32(0);
            var platform = reader.IsDBNull(1) ? null : reader.GetString(1);
            if (!string.IsNullOrWhiteSpace(platform))
                map[postId] = platform.Trim();
        }

        return map;
    }

    private static string GetDonationPlatform(Donation donation, IReadOnlyDictionary<int, string> postPlatformById)
    {
        if (donation.ReferralPostId.HasValue
            && postPlatformById.TryGetValue(donation.ReferralPostId.Value, out var platform)
            && !string.IsNullOrWhiteSpace(platform))
        {
            return platform;
        }

        return InferPlatform(donation.CampaignName, donation.Notes);
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
        if (text.Contains("whatsapp"))
            return "WhatsApp";
        return "Unknown/Unlabeled";
    }

    private static object BuildRiskLevelBreakdown(IReadOnlyCollection<Resident> residents)
    {
        var buckets = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["Low"] = 0,
            ["Medium"] = 0,
            ["High"] = 0,
            ["Critical"] = 0
        };

        foreach (var resident in residents)
        {
            var normalized = NormalizeRiskLevel(resident.CurrentRiskLevel);
            if (normalized != null)
                buckets[normalized]++;
        }

        return new
        {
            low = buckets["Low"],
            medium = buckets["Medium"],
            high = buckets["High"],
            critical = buckets["Critical"]
        };
    }

    private static object BuildResidentPipeline(IReadOnlyCollection<Resident> residents)
    {
        var intake = 0;
        var assessment = 0;
        var activeCare = 0;
        var preReintegration = 0;
        var reintegrated = 0;

        foreach (var resident in residents)
        {
            var caseStatus = resident.CaseStatus?.Trim() ?? string.Empty;
            var reintegration = resident.ReintegrationStatus?.Trim() ?? string.Empty;

            if (IsClosedOrReintegrated(caseStatus, reintegration))
            {
                reintegrated++;
                continue;
            }

            if (IsPreReintegration(reintegration))
            {
                preReintegration++;
                continue;
            }

            if (caseStatus.Equals("Active", StringComparison.OrdinalIgnoreCase))
            {
                activeCare++;
                continue;
            }

            if (caseStatus.Contains("Assess", StringComparison.OrdinalIgnoreCase))
            {
                assessment++;
                continue;
            }

            intake++;
        }

        return new
        {
            intake,
            assessment,
            activeCare,
            preReintegration,
            reintegrated
        };
    }

    private async Task<(int? Reach, string Label)> BuildTotalReachInWindowAsync(DateOnly windowStart, CancellationToken cancellationToken)
    {
        var latestPublished = await _db.PublicImpactSnapshots.AsNoTracking()
            .Where(s => s.IsPublished && s.SnapshotDate >= windowStart)
            .OrderByDescending(s => s.SnapshotDate)
            .Select(s => s.MetricPayloadJson)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(latestPublished))
            return (null, "No published reach snapshot in this window");

        try
        {
            using var doc = JsonDocument.Parse(latestPublished);
            if (TryExtractReachValue(doc.RootElement, out var reach))
                return (reach, "From public impact snapshot payload");
        }
        catch
        {
            // Best-effort parse only; silently fall back to null.
        }

        return (null, "Reach metric unavailable in snapshot payload");
    }

    private static bool TryExtractReachValue(JsonElement element, out int reach)
    {
        reach = 0;
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in element.EnumerateObject())
            {
                if (prop.Name.Contains("reach", StringComparison.OrdinalIgnoreCase)
                    && TryReadIntLike(prop.Value, out var value))
                {
                    reach = value;
                    return true;
                }

                if (TryExtractReachValue(prop.Value, out value))
                {
                    reach = value;
                    return true;
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                if (TryExtractReachValue(item, out var value))
                {
                    reach = value;
                    return true;
                }
            }
        }

        return false;
    }

    private static bool TryReadIntLike(JsonElement value, out int parsed)
    {
        parsed = 0;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out parsed))
            return true;

        if (value.ValueKind == JsonValueKind.String)
        {
            var s = value.GetString();
            if (!string.IsNullOrWhiteSpace(s)
                && int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed))
            {
                return true;
            }
        }

        return false;
    }

    private static string? NormalizeRiskLevel(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var s = raw.Trim().ToLowerInvariant();
        if (s.StartsWith("crit"))
            return "Critical";
        if (s.StartsWith("high"))
            return "High";
        if (s.StartsWith("med"))
            return "Medium";
        if (s.StartsWith("low"))
            return "Low";
        return null;
    }

    private static bool IsClosedOrReintegrated(string caseStatus, string reintegrationStatus) =>
        caseStatus.Equals("Closed", StringComparison.OrdinalIgnoreCase)
        || reintegrationStatus.Equals("Completed", StringComparison.OrdinalIgnoreCase)
        || reintegrationStatus.Contains("reintegrat", StringComparison.OrdinalIgnoreCase) && reintegrationStatus.Contains("complete", StringComparison.OrdinalIgnoreCase);

    private static bool IsPreReintegration(string reintegrationStatus) =>
        reintegrationStatus.Contains("progress", StringComparison.OrdinalIgnoreCase)
        || reintegrationStatus.Contains("pre", StringComparison.OrdinalIgnoreCase)
        || reintegrationStatus.Contains("planned", StringComparison.OrdinalIgnoreCase)
        || reintegrationStatus.Contains("ready", StringComparison.OrdinalIgnoreCase);

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

