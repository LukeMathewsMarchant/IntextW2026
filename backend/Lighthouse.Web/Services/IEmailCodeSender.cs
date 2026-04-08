namespace Lighthouse.Web.Services;

public interface IEmailCodeSender
{
    bool IsConfigured { get; }
    Task SendTwoFactorCodeAsync(string toEmail, string code, CancellationToken cancellationToken = default);
}
