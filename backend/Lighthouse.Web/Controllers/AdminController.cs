using Lighthouse.Web.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lighthouse.Web.Controllers;

[Authorize(Policy = AppPolicies.AdminOnly)]
public class AdminController : Controller
{
    public IActionResult Index()
    {
        ViewBag.Page = "admin";
        return View("ReactApp");
    }

    public IActionResult Crud(string entity)
    {
        ViewBag.Page = "admin-crud";
        ViewBag.Entity = entity;
        return View("ReactApp");
    }

    public IActionResult Audit()
    {
        ViewBag.Page = "admin-audit";
        return View("ReactApp");
    }

    public IActionResult Okr()
    {
        ViewBag.Page = "admin-okr";
        return View("ReactApp");
    }

    public IActionResult Analytics()
    {
        ViewBag.Page = "admin-analytics";
        return View("ReactApp");
    }
}
