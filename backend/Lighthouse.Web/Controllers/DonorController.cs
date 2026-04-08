using Lighthouse.Web.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lighthouse.Web.Controllers;

[Authorize(Policy = AppPolicies.DonorOnly)]
public class DonorController : Controller
{
    public IActionResult Index()
    {
        ViewBag.Page = "donor";
        return View("ReactApp");
    }

    public IActionResult History()
    {
        ViewBag.Page = "donor-history";
        return View("ReactApp");
    }

    public IActionResult Insights()
    {
        ViewBag.Page = "donor-insights";
        return View("ReactApp");
    }
}
