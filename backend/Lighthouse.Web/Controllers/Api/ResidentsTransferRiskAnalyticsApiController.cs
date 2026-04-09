using Lighthouse.Web.Authorization;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lighthouse.Web.Controllers.Api;

/// <summary>
/// Proxies ml-service resident transfer-risk summary for the admin dashboard Program Enrollment card.
/// </summary>
[Authorize(Policy = AppPolicies.AdminOnly)]
[Route("api/admin/analytics/residents-transfer-risk")]
[ApiController]
public class ResidentsTransferRiskAnalyticsApiController : ControllerBase
{
    private readonly SocialMediaAnalyticsClient _client;

    public ResidentsTransferRiskAnalyticsApiController(SocialMediaAnalyticsClient client)
    {
        _client = client;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        try
        {
            var payload = await _client.GetResidentsTransferRiskSummaryAsync(cancellationToken);
            if (payload is null)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    error = "Residents transfer-risk summary returned no data."
                });
            }

            return Ok(payload);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                error = "Residents transfer-risk ML service is unavailable.",
                detail = ex.Message
            });
        }
    }
}
