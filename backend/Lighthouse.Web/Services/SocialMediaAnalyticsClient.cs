using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Lighthouse.Web.Services;

public class SocialMediaMlApiOptions
{
    public string BaseUrl { get; set; } = "http://localhost:8001";
    public string AnalyticsPath { get; set; } = "/social-media/analytics";
    /// <summary>Optional; same Python service as social media. Defaults to /donations/analytics.</summary>
    public string DonationsAnalyticsPath { get; set; } = "/donations/analytics";
    /// <summary>Notebook-aligned EDA JSON; defaults to /donations/explore-summary.</summary>
    public string DonationsExploreSummaryPath { get; set; } = "/donations/explore-summary";
    /// <summary>Tier-1 program analytics (residents, education, health). Defaults to /reports/tier1-analytics.</summary>
    public string ProgramsTier1AnalyticsPath { get; set; } = "/reports/tier1-analytics";
    public string? ApiKey { get; set; }
}

public class SocialMediaAnalyticsClient
{
    private static readonly JsonSerializerOptions JsonReadOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    private readonly HttpClient _httpClient;
    private readonly SocialMediaMlApiOptions _options;

    public SocialMediaAnalyticsClient(HttpClient httpClient, IOptions<SocialMediaMlApiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;

        if (_httpClient.BaseAddress is null)
        {
            var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl)
                ? "http://localhost:8001"
                : _options.BaseUrl.TrimEnd('/');
            _httpClient.BaseAddress = new Uri(baseUrl);
        }

        if (!string.IsNullOrWhiteSpace(_options.ApiKey)
            && !_httpClient.DefaultRequestHeaders.Contains("X-Api-Key"))
        {
            _httpClient.DefaultRequestHeaders.Add("X-Api-Key", _options.ApiKey);
        }

        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<SocialMediaAnalyticsResponse?> GetAnalyticsAsync(CancellationToken cancellationToken = default)
    {
        var path = string.IsNullOrWhiteSpace(_options.AnalyticsPath)
            ? "/social-media/analytics"
            : _options.AnalyticsPath;

        return await _httpClient.GetFromJsonAsync<SocialMediaAnalyticsResponse>(path, JsonReadOptions, cancellationToken);
    }

    public async Task<DonationsMlAnalyticsResponse?> GetDonationsAnalyticsAsync(CancellationToken cancellationToken = default)
    {
        var path = string.IsNullOrWhiteSpace(_options.DonationsAnalyticsPath)
            ? "/donations/analytics"
            : _options.DonationsAnalyticsPath;

        return await _httpClient.GetFromJsonAsync<DonationsMlAnalyticsResponse>(path, JsonReadOptions, cancellationToken);
    }

    public async Task<DonationsExploreSummaryResponse?> GetDonationsExploreSummaryAsync(CancellationToken cancellationToken = default)
    {
        var path = string.IsNullOrWhiteSpace(_options.DonationsExploreSummaryPath)
            ? "/donations/explore-summary"
            : _options.DonationsExploreSummaryPath;

        return await _httpClient.GetFromJsonAsync<DonationsExploreSummaryResponse>(path, JsonReadOptions, cancellationToken);
    }

    public async Task<ProgramsTier1AnalyticsResponse?> GetProgramsTier1AnalyticsAsync(CancellationToken cancellationToken = default)
    {
        var path = string.IsNullOrWhiteSpace(_options.ProgramsTier1AnalyticsPath)
            ? "/reports/tier1-analytics"
            : _options.ProgramsTier1AnalyticsPath;

        return await _httpClient.GetFromJsonAsync<ProgramsTier1AnalyticsResponse>(path, JsonReadOptions, cancellationToken);
    }
}

public record DonationsMlAnalyticsResponse(
    string GeneratedAtUtc,
    string DataSource,
    string LoadWarning,
    DonationsMlSummary Summary,
    IReadOnlyList<DonationsMlChannelRow> ChannelMix,
    IReadOnlyList<DonationsMlGiftTypeRow> GiftTypeMix,
    IReadOnlyList<DonationsMlMonthlyRow> MonthlyTotals,
    DonationsMlPipelineModel? PipelineModel
);

public record DonationsMlSummary(
    int TotalGifts,
    decimal TotalEstimatedValue,
    decimal AvgEstimatedValue,
    decimal RecurringShare,
    int WithSocialReferralCount
);

public record DonationsMlChannelRow(
    string ChannelSource,
    int GiftCount,
    decimal TotalEstimatedValue,
    decimal AvgEstimatedValue
);

public record DonationsMlGiftTypeRow(
    string DonationType,
    int GiftCount,
    decimal TotalEstimatedValue
);

public record DonationsMlMonthlyRow(
    string Month,
    decimal TotalEstimatedValue
);

public record DonationsMlPipelineModel(
    string Name,
    string TargetDescription,
    decimal? HoldoutMaePredictive,
    decimal? HoldoutR2Predictive,
    decimal? HoldoutMaeExplanatory,
    decimal? HoldoutR2Explanatory
);

public record DonationsExploreSummaryResponse(
    string GeneratedAtUtc,
    string DataSource,
    string LoadWarning,
    string EndpointVersion,
    string NotebookRef,
    DonationsExploreValueStats? EstimatedValue,
    DonationsExploreIqr? IqrOutliers,
    IReadOnlyList<DonationsExploreTypeMean> MeanByDonationType,
    IReadOnlyList<DonationsExploreChannelMean> MeanByChannelSource,
    DonationsExploreDataQuality? DataQuality
);

public record DonationsExploreValueStats(
    int Count,
    decimal Mean,
    decimal Std,
    decimal Min,
    decimal Q25,
    decimal Median,
    decimal Q75,
    decimal Max
);

public record DonationsExploreIqr(
    decimal LowerBound,
    decimal UpperBound,
    int Count
);

public record DonationsExploreTypeMean(
    string DonationType,
    int GiftCount,
    decimal MeanEstimatedValue
);

public record DonationsExploreChannelMean(
    string ChannelSource,
    int GiftCount,
    decimal MeanEstimatedValue
);

public record DonationsExploreDataQuality(
    int DuplicateDonationIds,
    int MissingDonationDates,
    string? DateRangeStart,
    string? DateRangeEnd,
    int NegativeEstimatedValues,
    decimal MissingCampaignNameShare,
    int DistinctDonationTypes,
    int DistinctChannelSources
);

public record SocialMediaAnalyticsResponse(
    string GeneratedAtUtc,
    string Currency,
    SocialMediaSummary Summary,
    IReadOnlyList<SocialMediaPlatformRankingRow> PlatformRanking,
    IReadOnlyList<SocialMediaRecommendationRow> Recommendations,
    IReadOnlyList<SocialMediaPostingWindowRow> BestPostingWindows
);

public record SocialMediaSummary(
    int TotalPosts,
    int TotalDonationReferrals,
    decimal TotalEstimatedDonationValuePhp,
    decimal AvgEngagementRate
);

public record SocialMediaPlatformRankingRow(
    string Platform,
    int Posts,
    int DonationReferrals,
    decimal EstimatedDonationValuePhp,
    decimal AvgEngagementRate,
    decimal ShareOfDonationValue
);

public record SocialMediaRecommendationRow(
    string Platform,
    string Priority,
    string Reason,
    string RecommendedAction,
    IReadOnlyList<string> SuggestedPostHours,
    decimal EstimatedMonthlyLiftPhp
);

public record SocialMediaPostingWindowRow(
    string Platform,
    string DayOfWeek,
    int PostHour,
    decimal AvgDonationValuePhp,
    decimal AvgReferrals
);

public record ProgramsTier1AnalyticsResponse(
    string GeneratedAtUtc,
    ResidentsTier1Section Residents,
    EducationTier1Section Education,
    HealthWellbeingTier1Section HealthWellbeing
);

public record ResidentsTier1Section(
    string DataSource,
    string LoadWarning,
    ResidentsTier1Summary Summary,
    IReadOnlyList<ProgramsTier1ChartRow> ChartRows,
    IReadOnlyList<ProgramsTier1ChartRow> SecondaryChartRows,
    IReadOnlyList<ProgramsTier1SafehouseRow> SafehouseRows,
    IReadOnlyList<ProgramsTier1DriverRow> TopDrivers,
    string? PipelineTarget,
    string? ModelNote,
    string? BusinessQuestion,
    ProgramsTier1ModelQuality? ModelQuality
);

public record EducationTier1Section(
    string DataSource,
    string LoadWarning,
    EducationTier1Summary Summary,
    IReadOnlyList<ProgramsTier1ChartRow> ChartRows,
    IReadOnlyList<ProgramsTier1ChartRow> SecondaryChartRows,
    IReadOnlyList<ProgramsTier1SafehouseRow> SafehouseRows,
    IReadOnlyList<ProgramsTier1DriverRow> TopDrivers,
    string? PipelineTarget,
    string? ModelNote,
    string? BusinessQuestion,
    ProgramsTier1ModelQuality? ModelQuality
);

public record HealthWellbeingTier1Section(
    string DataSource,
    string LoadWarning,
    HealthWellbeingTier1Summary Summary,
    IReadOnlyList<ProgramsTier1ChartRow> ChartRows,
    IReadOnlyList<ProgramsTier1ChartRow> SecondaryChartRows,
    IReadOnlyList<ProgramsTier1SafehouseRow> SafehouseRows,
    IReadOnlyList<ProgramsTier1DriverRow> TopDrivers,
    string? PipelineTarget,
    string? ModelNote,
    string? BusinessQuestion,
    ProgramsTier1ModelQuality? ModelQuality
);

public record ResidentsTier1Summary(int TotalResidents, int ActiveResidents, int DistinctSafehouses);

public record EducationTier1Summary(
    int TotalRecords,
    int UniqueResidents,
    decimal? AvgAttendancePercent,
    decimal? AvgProgressPercent
);

public record HealthWellbeingTier1Summary(
    int TotalRecords,
    int UniqueResidents,
    decimal? AvgGeneralHealthScore,
    decimal? MedianGeneralHealthScore,
    decimal? AvgNutritionScore,
    decimal? AvgSleepQualityScore,
    decimal? AvgEnergyLevelScore,
    decimal? MedicalCheckupShare,
    decimal? DentalCheckupShare,
    decimal? PsychologicalCheckupShare
);

public record ProgramsTier1ChartRow(string Label, int Count, decimal Share);

public record ProgramsTier1SafehouseRow(string SafehouseId, int Count);

public record ProgramsTier1DriverRow(string Label, double Importance);

public record ProgramsTier1ModelQuality(
    string SelectedModel,
    double? HoldoutMae,
    double? HoldoutRmse,
    double? HoldoutR2
);
