using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Controllers.Api;

/// <summary>
/// Public (unauthenticated) endpoint for website donations.
/// Creates a Supporter record (or reuses an existing one by email)
/// and inserts a Donation row.
/// </summary>
[Route("api/donate")]
[ApiController]
public class DonateApiController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public DonateApiController(ApplicationDbContext db) => _db = db;

    public record DonateRequest(
        string FirstName,
        string LastName,
        string Email,
        decimal Amount,
        string? Notes);

    [HttpPost]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> Post([FromBody] DonateRequest req, CancellationToken ct)
    {
        // ── validation ──────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(req.FirstName))
            return BadRequest(new { error = "First name is required." });
        if (string.IsNullOrWhiteSpace(req.LastName))
            return BadRequest(new { error = "Last name is required." });
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { error = "Email is required." });
        if (req.Amount <= 0)
            return BadRequest(new { error = "Amount must be greater than zero." });

        // ── find or create supporter ────────────────────────────
        var email = req.Email.Trim();
        var normalizedEmail = email.ToLowerInvariant();
        var supporter = await _db.Supporters
            .FirstOrDefaultAsync(s => s.Email != null && s.Email.ToLower() == normalizedEmail, ct);

        if (supporter is null)
        {
            supporter = new Supporter
            {
                SupporterType = SupporterType.MonetaryDonor,
                DisplayName = $"{req.FirstName.Trim()} {req.LastName.Trim()}",
                FirstName = req.FirstName.Trim(),
                LastName = req.LastName.Trim(),
                Email = email,
                RelationshipType = RelationshipType.International,
                Country = "United States",
                Status = SupporterStatus.Active,
                AcquisitionChannel = AcquisitionChannel.Website,
                CreatedAt = DateTimeOffset.UtcNow,
                FirstDonationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            };
            _db.Supporters.Add(supporter);
            await _db.SaveChangesAsync(ct);          // generates supporter_id
        }

        // ── create donation ─────────────────────────────────────
        var donation = new Donation
        {
            SupporterId = supporter.SupporterId,
            DonationType = DonationType.Monetary,
            DonationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            IsRecurring = false,
            ChannelSource = ChannelSource.Direct,
            CurrencyCode = "USD",
            Amount = req.Amount,
            EstimatedValue = req.Amount,
            ImpactUnit = ImpactUnit.pesos,
            Notes = req.Notes?.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Donations.Add(donation);
        await _db.SaveChangesAsync(ct);

        return Created("", new
        {
            donationId = donation.DonationId,
            message = "Thank you for your generous donation!"
        });
    }
}
