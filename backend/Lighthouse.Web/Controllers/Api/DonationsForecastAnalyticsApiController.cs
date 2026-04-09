using Lighthouse.Web.Authorization;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lighthouse.Web.Controllers.Api;

/// <summary>
/// Proxies ml-service next-month donations forecast for admin analytics.
/// </summary>
[Authorize(Policy = AppPolicies.AdminOnly)]
[Route("api/admin/analytics/donations-forecast")]
[ApiController]
public class DonationsForecastAnalyticsApiController : ControllerBase
{
    private readonly SocialMediaAnalyticsClient _client;

    public DonationsForecastAnalyticsApiController(SocialMediaAnalyticsClient client)
    {
        _client = client;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        try
        {
            var payload = await _client.GetDonationsForecastAsync(cancellationToken);
            if (payload is null)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    error = "ML donations forecast returned no data."
                });
            }

            return Ok(payload);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                error = "ML donations forecast service is unavailable.",
                detail = ex.Message
            });
        }
    }
}
