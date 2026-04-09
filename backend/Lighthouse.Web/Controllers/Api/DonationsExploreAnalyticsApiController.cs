using Lighthouse.Web.Authorization;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lighthouse.Web.Controllers.Api;

/// <summary>
/// Proxies ml-service /donations/explore-summary (notebook-aligned EDA) for admin verification after deploy.
/// </summary>
[Authorize(Policy = AppPolicies.AdminOnly)]
[Route("api/admin/analytics/donations-explore")]
[ApiController]
public class DonationsExploreAnalyticsApiController : ControllerBase
{
    private readonly SocialMediaAnalyticsClient _client;

    public DonationsExploreAnalyticsApiController(SocialMediaAnalyticsClient client)
    {
        _client = client;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        try
        {
            var payload = await _client.GetDonationsExploreSummaryAsync(cancellationToken);
            if (payload is null)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    error = "ML donations explore summary returned no data."
                });
            }

            return Ok(payload);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                error = "ML donations explore service is unavailable.",
                detail = ex.Message
            });
        }
    }
}
