using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Lighthouse.Web.Services;

public class SmtpEmailCodeSender : IEmailCodeSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailCodeSender> _logger;

    public SmtpEmailCodeSender(IConfiguration config, ILogger<SmtpEmailCodeSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_config["SMTP_HOST"])
        && !string.IsNullOrWhiteSpace(_config["SMTP_FROM"]);

    public async Task SendTwoFactorCodeAsync(string toEmail, string code, CancellationToken cancellationToken = default)
    {
        var host = _config["SMTP_HOST"];
        var from = _config["SMTP_FROM"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
            throw new InvalidOperationException("SMTP is not configured. Set SMTP_HOST and SMTP_FROM.");

        var port = int.TryParse(_config["SMTP_PORT"], out var p) ? p : 587;
        var enableSsl = !string.Equals(_config["SMTP_ENABLE_SSL"], "false", StringComparison.OrdinalIgnoreCase);
        var user = _config["SMTP_USER"];
        var pass = _config["SMTP_PASS"];

        using var message = new MailMessage(from, toEmail)
        {
            Subject = "Your verification code",
            Body = $"Your Light on a Hill verification code is: {code}\n\nThis code expires shortly. If you did not try to sign in, you can ignore this email."
        };

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl
        };

        if (!string.IsNullOrWhiteSpace(user))
            client.Credentials = new NetworkCredential(user, pass ?? string.Empty);

        _logger.LogInformation("Sending 2FA email code to {Email}", toEmail);
        cancellationToken.ThrowIfCancellationRequested();
        await client.SendMailAsync(message, cancellationToken);
    }
}
