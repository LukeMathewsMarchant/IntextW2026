using Lighthouse.Web.Data;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Services;

public class DonationAnalyticsService
{
    private readonly ApplicationDbContext _db;

    public DonationAnalyticsService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<DonorSummaryDto> GetDonorSummaryAsync(int supporterId, CancellationToken cancellationToken = default)
    {
        var donations = await _db.Donations
            .AsNoTracking()
            .Where(d => d.SupporterId == supporterId)
            .OrderBy(d => d.DonationDate)
            .ToListAsync(cancellationToken);

        var total = donations.Sum(d => d.Amount ?? d.EstimatedValue ?? 0);
        var last = donations.LastOrDefault();
        var daysSince = last != null
            ? (DateOnly.FromDateTime(DateTime.UtcNow).DayNumber - last.DonationDate.DayNumber)
            : (int?)null;

        return new DonorSummaryDto(
            donations.Count,
            total,
            last?.DonationDate,
            daysSince);
    }

    public async Task<IReadOnlyList<MonthlyDonationPoint>> GetMonthlyTotalsAsync(int supporterId, CancellationToken cancellationToken = default)
    {
        var rows = await _db.Donations
            .AsNoTracking()
            .Where(d => d.SupporterId == supporterId)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(d => new { d.DonationDate.Year, d.DonationDate.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new MonthlyDonationPoint(
                $"{g.Key.Year}-{g.Key.Month:D2}",
                g.Sum(x => x.Amount ?? x.EstimatedValue ?? 0)))
            .ToList();
    }

    public async Task<IReadOnlyList<DonationHistoryRow>> GetDonationHistoryAsync(int supporterId, CancellationToken cancellationToken = default)
    {
        return await _db.Donations
            .AsNoTracking()
            .Where(d => d.SupporterId == supporterId)
            .OrderByDescending(d => d.DonationDate)
            .ThenByDescending(d => d.CreatedAt)
            .Select(d => new DonationHistoryRow(
                d.DonationDate,
                d.Amount ?? d.EstimatedValue ?? 0))
            .ToListAsync(cancellationToken);
    }
}

public record DonorSummaryDto(int Count, decimal TotalEstimated, DateOnly? LastDonationDate, int? DaysSinceLastDonation);

public record MonthlyDonationPoint(string Month, decimal Total);
public record DonationHistoryRow(DateOnly DonationDate, decimal Amount);
