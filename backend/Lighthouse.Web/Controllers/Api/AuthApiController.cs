using Lighthouse.Web.Authorization;
using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Lighthouse.Web.Models.Identity;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Controllers.Api;

[Route("api/auth")]
[ApiController]
public class AuthApiController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;

    public AuthApiController(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext db)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _db = db;
    }

    public record LoginRequest(string Email, string Password);
    public record RegisterRequest(string Email, string Password, string ConfirmPassword, int? SupporterId);

    [HttpGet("me")]
    [AllowAnonymous]
    public IActionResult Me()
    {
        if (User.Identity?.IsAuthenticated != true)
            return Ok(new { isAuthenticated = false, roles = Array.Empty<string>() });

        var roles = User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToArray();
        return Ok(new { isAuthenticated = true, name = User.Identity?.Name, roles });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var email = req.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
            return Unauthorized(new { error = "Invalid login attempt." });

        var result = await _signInManager.PasswordSignInAsync(user, req.Password, isPersistent: true, lockoutOnFailure: true);
        if (!result.Succeeded)
            return Unauthorized(new { error = "Invalid login attempt." });

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new { isAuthenticated = true, name = user.Email, roles });
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        var email = req.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        if (!string.Equals(req.Password, req.ConfirmPassword, StringComparison.Ordinal))
            return BadRequest(new { error = "Passwords do not match." });

        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null)
            return Conflict(new { error = "An account with this email already exists." });

        var normalizedEmail = email.ToLowerInvariant();
        var supporter = req.SupporterId is > 0
            ? await _db.Supporters.FirstOrDefaultAsync(s => s.SupporterId == req.SupporterId.Value)
            : await _db.Supporters.FirstOrDefaultAsync(s => s.Email != null && s.Email.ToLower() == normalizedEmail);

        if (supporter is null)
        {
            var displayName = email.Contains('@', StringComparison.Ordinal)
                ? email[..email.IndexOf('@', StringComparison.Ordinal)]
                : email;

            supporter = new Supporter
            {
                SupporterType = SupporterType.MonetaryDonor,
                DisplayName = displayName,
                Email = email,
                RelationshipType = RelationshipType.International,
                Country = "United States",
                Status = SupporterStatus.Active,
                AcquisitionChannel = AcquisitionChannel.Website,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.Supporters.Add(supporter);
            await _db.SaveChangesAsync();
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            SupporterId = supporter.SupporterId
        };

        var result = await _userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return BadRequest(new { error = string.Join(" ", result.Errors.Select(e => e.Description)) });

        await _userManager.AddToRoleAsync(user, AppRoles.Donor);
        await _signInManager.SignInAsync(user, isPersistent: true);

        return Ok(new { message = "Registration successful.", role = AppRoles.Donor });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return NoContent();
    }
}
