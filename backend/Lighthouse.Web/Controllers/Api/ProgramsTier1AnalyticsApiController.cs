using Lighthouse.Web.Authorization;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lighthouse.Web.Controllers.Api;

/// <summary>
/// Proxies ml-service tier-1 program analytics (residents, education, health &amp; wellbeing) for Reports &amp; analytics.
/// </summary>
[Authorize(Policy = AppPolicies.AdminOnly)]
[Route("api/admin/analytics/programs-tier1")]
[ApiController]
public class ProgramsTier1AnalyticsApiController : ControllerBase
{
    private readonly SocialMediaAnalyticsClient _client;

    public ProgramsTier1AnalyticsApiController(SocialMediaAnalyticsClient client)
    {
        _client = client;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        try
        {
            var payload = await _client.GetProgramsTier1AnalyticsAsync(cancellationToken);
            if (payload is null)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    error = "Programs tier-1 analytics returned no data."
                });
            }

            return Ok(payload);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                error = "Programs tier-1 ML service is unavailable.",
                detail = ex.Message
            });
        }
    }
}
