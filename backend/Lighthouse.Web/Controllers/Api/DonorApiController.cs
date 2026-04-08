using System.Security.Claims;
using Lighthouse.Web.Authorization;
using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Lighthouse.Web.Models.Identity;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Controllers.Api;

[Authorize(Policy = AppPolicies.DonorOnly)]
[Route("api/donor")]
[ApiController]
public class DonorApiController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;
    private readonly DonationAnalyticsService _analytics;
    private readonly IDonorPredictionService _prediction;

    public DonorApiController(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext db,
        DonationAnalyticsService analytics,
        IDonorPredictionService prediction)
    {
        _userManager = userManager;
        _db = db;
        _analytics = analytics;
        _prediction = prediction;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken cancellationToken)
    {
        var supporterId = await ResolveSupporterIdAsync(cancellationToken);
        if (supporterId is null)
            return BadRequest(new { error = "Donor account is not linked to a supporter record." });

        var summary = await _analytics.GetDonorSummaryAsync(supporterId.Value, cancellationToken);
        return Ok(summary);
    }

    [HttpGet("donations")]
    public async Task<IActionResult> Donations(CancellationToken cancellationToken)
    {
        var supporterId = await ResolveSupporterIdAsync(cancellationToken);
        if (supporterId is null)
            return BadRequest(new { error = "Donor account is not linked to a supporter record." });

        var monthly = await _analytics.GetMonthlyTotalsAsync(supporterId.Value, cancellationToken);
        return Ok(monthly);
    }

    [HttpGet("history")]
    public async Task<IActionResult> History(CancellationToken cancellationToken)
    {
        var supporterId = await ResolveSupporterIdAsync(cancellationToken);
        if (supporterId is null)
            return BadRequest(new { error = "Donor account is not linked to a supporter record." });

        var rows = await _analytics.GetDonationHistoryAsync(supporterId.Value, cancellationToken);
        return Ok(rows);
    }

    [HttpGet("prediction")]
    public async Task<IActionResult> Prediction(CancellationToken cancellationToken)
    {
        var supporterId = await ResolveSupporterIdAsync(cancellationToken);
        if (supporterId is null)
            return BadRequest(new { error = "Donor account is not linked to a supporter record." });

        var result = await _prediction.PredictNextDonationLikelihoodAsync(supporterId.Value, cancellationToken);
        return Ok(result);
    }

    public record DonorDonateRequest(decimal Amount, string? Notes, bool IsRecurring);

    [HttpPost("donate")]
    public async Task<IActionResult> Donate([FromBody] DonorDonateRequest req, CancellationToken cancellationToken)
    {
        if (req.Amount <= 0)
            return BadRequest(new { error = "Amount must be greater than zero." });

        var supporterId = await ResolveSupporterIdAsync(cancellationToken);
        if (supporterId is null)
            return BadRequest(new { error = "Donor account is not linked to a supporter record." });

        var donation = new Donation
        {
            SupporterId = supporterId.Value,
            DonationType = DonationType.Monetary,
            DonationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            IsRecurring = req.IsRecurring,
            ChannelSource = ChannelSource.Direct,
            CurrencyCode = "USD",
            Amount = req.Amount,
            EstimatedValue = req.Amount,
            ImpactUnit = ImpactUnit.pesos,
            Notes = req.Notes?.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Donations.Add(donation);
        await _db.SaveChangesAsync(cancellationToken);

        return Created(string.Empty, new { donationId = donation.DonationId, message = "Donation recorded." });
    }

    private async Task<int?> ResolveSupporterIdAsync(CancellationToken cancellationToken)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return null;

        if (user.SupporterId is > 0)
            return user.SupporterId.Value;

        if (string.IsNullOrWhiteSpace(user.Email))
            return null;

        var email = user.Email.Trim().ToLowerInvariant();
        var supporterId = await _db.Supporters
            .AsNoTracking()
            .Where(s => s.Email != null && s.Email.ToLower() == email)
            .Select(s => (int?)s.SupporterId)
            .FirstOrDefaultAsync(cancellationToken);

        if (supporterId is null)
            return null;

        // Persist the discovered link so future calls are direct.
        user.SupporterId = supporterId.Value;
        await _userManager.UpdateAsync(user);
        return supporterId.Value;
    }
}
