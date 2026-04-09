using Lighthouse.Web.Authorization;
using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Lighthouse.Web.Models.Identity;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Lighthouse.Web.Services;

namespace Lighthouse.Web.Controllers.Api;

// Cookie-based login/register/logout + email 2FA for the React SPA (credentials fetch from Vite).
[Route("api/auth")]
[ApiController]
public class AuthApiController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;
    private readonly IEmailCodeSender _emailCodeSender;
    private readonly IEmailTwoFactorCodeStore _emailTwoFactorCodeStore;

    public AuthApiController(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext db,
        IEmailCodeSender emailCodeSender,
        IEmailTwoFactorCodeStore emailTwoFactorCodeStore)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _db = db;
        _emailCodeSender = emailCodeSender;
        _emailTwoFactorCodeStore = emailTwoFactorCodeStore;
    }

    public record LoginRequest(string Email, string Password);
    public record TwoFactorLoginRequest(string Code, string ChallengeId, bool RememberMachine = false);
    public record RegisterRequest(string Email, string Password, string ConfirmPassword, int? SupporterId);
    public record TwoFactorEnableRequest(string? Code = null);

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
        if (result.RequiresTwoFactor)
        {
            try
            {
                var challengeId = await SendTwoFactorCodeAsync(user);
                return Ok(new { requiresTwoFactor = true, challengeId });
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = ex.Message });
            }
        }

        if (!result.Succeeded)
            return Unauthorized(new { error = "Invalid login attempt." });

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new { isAuthenticated = true, requiresTwoFactor = false, name = user.Email, roles });
    }

    [HttpPost("login-2fa")]
    [AllowAnonymous]
    public async Task<IActionResult> LoginTwoFactor([FromBody] TwoFactorLoginRequest req)
    {
        var code = req.Code?.Replace(" ", string.Empty).Replace("-", string.Empty);
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { error = "Authentication code is required." });
        if (string.IsNullOrWhiteSpace(req.ChallengeId))
            return BadRequest(new { error = "Two-factor challenge not found. Please sign in again." });

        if (!_emailTwoFactorCodeStore.TryGetUserId(req.ChallengeId, out var userId))
            return Unauthorized(new { error = "Two-factor challenge not found. Please sign in again." });
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return Unauthorized(new { error = "Two-factor challenge not found. Please sign in again." });

        if (!_emailTwoFactorCodeStore.ValidateCode(req.ChallengeId, code))
            return Unauthorized(new { error = "Invalid authentication code." });

        await _signInManager.SignInAsync(user, isPersistent: true);
        if (req.RememberMachine)
            await _signInManager.RememberTwoFactorClientAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new { isAuthenticated = true, requiresTwoFactor = false, name = user.Email, roles });
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

    [HttpGet("2fa/status")]
    [Authorize]
    public async Task<IActionResult> TwoFactorStatus()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        return Ok(new
        {
            enabled = user.TwoFactorEnabled,
            email = user.Email
        });
    }

    [HttpPost("2fa/enable")]
    [Authorize]
    public async Task<IActionResult> TwoFactorEnable([FromBody] TwoFactorEnableRequest? req = null)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(user.Email))
            return BadRequest(new { error = "Account email is required for email-based 2FA." });
        if (!_emailCodeSender.IsConfigured)
            return BadRequest(new { error = "SMTP is not configured. Set SMTP_HOST and SMTP_FROM before enabling email 2FA." });

        await _userManager.SetTwoFactorEnabledAsync(user, true);
        return Ok(new
        {
            enabled = true
        });
    }

    [HttpPost("2fa/disable")]
    [Authorize]
    public async Task<IActionResult> TwoFactorDisable()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        await _userManager.SetTwoFactorEnabledAsync(user, false);
        return Ok(new { enabled = false });
    }

    [HttpPost("2fa/send-code")]
    [AllowAnonymous]
    public async Task<IActionResult> SendTwoFactorCode([FromBody] TwoFactorResendRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.ChallengeId))
                return BadRequest(new { error = "Two-factor challenge not found. Please sign in again." });
            if (!_emailTwoFactorCodeStore.TryGetUserId(req.ChallengeId, out var userId))
                return Unauthorized(new { error = "Two-factor challenge not found. Please sign in again." });

            var user = await _userManager.FindByIdAsync(userId);
            if (user is null)
                return Unauthorized(new { error = "Two-factor challenge not found. Please sign in again." });

            await SendTwoFactorCodeAsync(user, req.ChallengeId);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = ex.Message });
        }
        return NoContent();
    }

    public record TwoFactorResendRequest(string ChallengeId);

    private async Task<string> SendTwoFactorCodeAsync(ApplicationUser user, string? challengeId = null)
    {
        if (string.IsNullOrWhiteSpace(user.Email))
            throw new InvalidOperationException("Two-factor challenge is not in progress.");

        var id = challengeId ?? _emailTwoFactorCodeStore.CreateChallenge(user.Id);
        var code = _emailTwoFactorCodeStore.CreateCode(id);
        await _emailCodeSender.SendTwoFactorCodeAsync(user.Email, code);
        return id;
    }
}
