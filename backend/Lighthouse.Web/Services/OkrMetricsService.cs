using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Services;

public class OkrMetricsService
{
    public const int DefaultDonorRecencyPageSize = 50;
    public const int MaxDonorRecencyPageSize = 100;

    private readonly ApplicationDbContext _db;

    public OkrMetricsService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<OkrSnapshotDto> GetSnapshotAsync(
        int donorRecencyPage = 1,
        int donorRecencyPageSize = DefaultDonorRecencyPageSize,
        CancellationToken cancellationToken = default)
    {
        var supporterCount = await _db.Supporters.AsNoTracking().CountAsync(s => s.Status == SupporterStatus.Active, cancellationToken);
        var donationRows = await _db.Donations.AsNoTracking().ToListAsync(cancellationToken);
        var total = donationRows.Sum(d => d.Amount ?? d.EstimatedValue ?? 0);

        var last90 = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-90));
        var recent = donationRows.Where(d => d.DonationDate >= last90).ToList();
        var medianGap = ComputeMedianInterGiftGapDays(donationRows);
        var (donorRecency, donorRecencyTotalCount, pageOut, pageSizeOut) =
            await BuildDonorRecencyPageAsync(
                donationRows,
                donorRecencyPage,
                donorRecencyPageSize,
                DonorRecencySort.ByDisplayName,
                cancellationToken);

        return new OkrSnapshotDto(
            supporterCount,
            Math.Round(total, 2),
            recent.Count,
            medianGap,
            donorRecency,
            donorRecencyTotalCount,
            pageOut,
            pageSizeOut);
    }

    /// <summary>
    /// All supporters with at least one donation, paged. Includes cohort-wide median inter-gift gap.
    /// </summary>
    public async Task<DonorPropensitySnapshotDto> GetDonorPropensityAsync(
        int page = 1,
        int pageSize = DefaultDonorRecencyPageSize,
        CancellationToken cancellationToken = default)
    {
        var donations = await _db.Donations.AsNoTracking().ToListAsync(cancellationToken);
        var medianGap = ComputeMedianInterGiftGapDays(donations);
        var (items, total, pageOut, pageSizeOut) =
            await BuildDonorRecencyPageAsync(donations, page, pageSize, DonorRecencySort.LapsedGiftsFirst, cancellationToken);
        return new DonorPropensitySnapshotDto(medianGap, items, total, pageOut, pageSizeOut);
    }

    private static decimal ComputeMedianInterGiftGapDays(IReadOnlyCollection<Donation> donations)
    {
        var gaps = new List<int>();
        foreach (var g in donations.GroupBy(d => d.SupporterId))
        {
            var ordered = g.OrderBy(x => x.DonationDate).Select(x => x.DonationDate).ToList();
            for (var i = 1; i < ordered.Count; i++)
                gaps.Add(ordered[i].DayNumber - ordered[i - 1].DayNumber);
        }

        return gaps.Count == 0 ? 90m : (decimal)gaps.OrderBy(x => x).Skip(gaps.Count / 2).First();
    }

    private enum DonorRecencySort
    {
        ByDisplayName,
        RecentGiftsFirst,
        LapsedGiftsFirst,
    }

    private async Task<(IReadOnlyList<ChurnRiskRow> Items, int TotalCount, int Page, int PageSize)> BuildDonorRecencyPageAsync(
        List<Donation> donations,
        int page,
        int pageSize,
        DonorRecencySort sort,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var bySupporter = donations
            .GroupBy(d => d.SupporterId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(x => x.DonationDate).Select(x => x.DonationDate).ToList());

        var total = bySupporter.Count;

        if (pageSize <= 0)
            return (Array.Empty<ChurnRiskRow>(), total, 1, 0);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxDonorRecencyPageSize);

        var supporters = await _db.Supporters.AsNoTracking().ToDictionaryAsync(s => s.SupporterId, cancellationToken);

        var rows = bySupporter
            .Select(kv =>
            {
                var dates = kv.Value;
                var last = dates[^1];
                var daysSinceLastGift = today.DayNumber - last.DayNumber;
                decimal? averageDaysBetweenGifts = null;
                if (dates.Count >= 2)
                {
                    var gapSum = 0;
                    for (var i = 1; i < dates.Count; i++)
                        gapSum += dates[i].DayNumber - dates[i - 1].DayNumber;
                    averageDaysBetweenGifts = Math.Round((decimal)gapSum / (dates.Count - 1), 1);
                }

                var displayName = supporters.TryGetValue(kv.Key, out var s) ? s.DisplayName : $"Supporter {kv.Key}";
                return new ChurnRiskRow(kv.Key, displayName, daysSinceLastGift, averageDaysBetweenGifts);
            })
            .ToList();

        var ordered = sort switch
        {
            DonorRecencySort.RecentGiftsFirst => rows
                .OrderBy(r => r.DaysSinceLastGift)
                .ThenBy(r => r.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ToList(),
            DonorRecencySort.LapsedGiftsFirst => rows
                .OrderByDescending(r => r.DaysSinceLastGift)
                .ThenBy(r => r.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ToList(),
            _ => rows
                .OrderBy(r => r.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(r => r.SupporterId)
                .ToList(),
        };

        var maxPage = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        if (page > maxPage)
            page = maxPage;

        var slice = ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return (slice, total, page, pageSize);
    }
}

public record OkrSnapshotDto(
    int ActiveSupporters,
    decimal TotalDonationValue,
    int DonationsLast90Days,
    decimal CohortMedianGapDays,
    IReadOnlyList<ChurnRiskRow> ChurnRisks,
    int DonorRecencyTotalCount,
    int DonorRecencyPage,
    int DonorRecencyPageSize);

public record DonorPropensitySnapshotDto(
    decimal CohortMedianGapDays,
    IReadOnlyList<ChurnRiskRow> Donors,
    int TotalCount,
    int Page,
    int PageSize);

public record ChurnRiskRow(
    int SupporterId,
    string DisplayName,
    int DaysSinceLastGift,
    decimal? AverageDaysBetweenGifts);
