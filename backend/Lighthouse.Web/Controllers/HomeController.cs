using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Lighthouse.Web.Models;

namespace Lighthouse.Web.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {
        return Ok("Light on a Hill Foundation API is running!");
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return Problem(detail: "An error occurred in the Light on a Hill Foundation API.");
    }
}
