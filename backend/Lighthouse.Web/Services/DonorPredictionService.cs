namespace Lighthouse.Web.Services;

/// <summary>
/// Heuristic / placeholder for textbook-aligned donor propensity; replace with model from ml-pipelines when ready.
/// </summary>
public interface IDonorPredictionService
{
    Task<DonorPredictionResult> PredictNextDonationLikelihoodAsync(int supporterId, CancellationToken cancellationToken = default);
}

public class DonorPredictionService : IDonorPredictionService
{
    private readonly DonationAnalyticsService _analytics;

    public DonorPredictionService(DonationAnalyticsService analytics)
    {
        _analytics = analytics;
    }

    public async Task<DonorPredictionResult> PredictNextDonationLikelihoodAsync(int supporterId, CancellationToken cancellationToken = default)
    {
        var summary = await _analytics.GetDonorSummaryAsync(supporterId, cancellationToken);
        if (summary.Count == 0)
            return new DonorPredictionResult(0.35m, "No donation history; baseline prior only.");

        var recencyScore = summary.DaysSinceLastDonation switch
        {
            null => 0.4m,
            <= 30 => 0.85m,
            <= 90 => 0.65m,
            <= 180 => 0.45m,
            _ => 0.25m
        };

        var freqScore = Math.Clamp(summary.Count / 20m, 0.1m, 1m);
        var score = Math.Round((recencyScore * 0.6m + freqScore * 0.4m), 2);

        return new DonorPredictionResult(score, "Heuristic blend of recency and frequency (placeholder).");
    }
}

public record DonorPredictionResult(decimal Score0To1, string Explanation);
