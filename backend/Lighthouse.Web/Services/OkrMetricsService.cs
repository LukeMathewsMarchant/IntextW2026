using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Services;

public class OkrMetricsService
{
    private readonly ApplicationDbContext _db;

    public OkrMetricsService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<OkrSnapshotDto> GetSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var supporterCount = await _db.Supporters.AsNoTracking().CountAsync(s => s.Status == SupporterStatus.Active, cancellationToken);
        var donationRows = await _db.Donations.AsNoTracking().ToListAsync(cancellationToken);
        var total = donationRows.Sum(d => d.Amount ?? d.EstimatedValue ?? 0);

        var last90 = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-90));
        var recent = donationRows.Where(d => d.DonationDate >= last90).ToList();
        var churnCandidates = await GetChurnRiskDonorsAsync(90, cancellationToken);

        return new OkrSnapshotDto(
            supporterCount,
            Math.Round(total, 2),
            recent.Count,
            churnCandidates);
    }

    /// <summary>
    /// Donors with no gift in <paramref name="days"/> days (recency heuristic vs static cohort baseline).
    /// </summary>
    public async Task<IReadOnlyList<ChurnRiskRow>> GetChurnRiskDonorsAsync(int days, CancellationToken cancellationToken = default)
    {
        var cutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-days));
        var donations = await _db.Donations.AsNoTracking().ToListAsync(cancellationToken);

        var gaps = new List<int>();
        foreach (var g in donations.GroupBy(d => d.SupporterId))
        {
            var ordered = g.OrderBy(x => x.DonationDate).Select(x => x.DonationDate).ToList();
            for (var i = 1; i < ordered.Count; i++)
                gaps.Add(ordered[i].DayNumber - ordered[i - 1].DayNumber);
        }

        var medianGap = gaps.Count == 0 ? 90m : (decimal)gaps.OrderBy(x => x).Skip(gaps.Count / 2).First();

        var lastBySupporter = donations
            .GroupBy(d => d.SupporterId)
            .Select(x => new { x.Key, Last = x.Max(d => d.DonationDate) })
            .Where(x => x.Last < cutoff)
            .ToList();

        var supporters = await _db.Supporters.AsNoTracking().ToDictionaryAsync(s => s.SupporterId, cancellationToken);

        return lastBySupporter
            .Select(x => new ChurnRiskRow(
                x.Key,
                supporters.TryGetValue(x.Key, out var s) ? s.DisplayName : $"Supporter {x.Key}",
                x.Last,
                medianGap))
            .OrderBy(r => r.LastDonation)
            .Take(50)
            .ToList();
    }
}

public record OkrSnapshotDto(int ActiveSupporters, decimal TotalDonationValue, int DonationsLast90Days, IReadOnlyList<ChurnRiskRow> ChurnRisks);

public record ChurnRiskRow(int SupporterId, string DisplayName, DateOnly LastDonation, decimal CohortMedianGapDays);
