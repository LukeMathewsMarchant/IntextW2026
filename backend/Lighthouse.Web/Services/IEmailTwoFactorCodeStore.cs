namespace Lighthouse.Web.Services;

public interface IEmailTwoFactorCodeStore
{
    string CreateChallenge(string userId);
    bool TryGetUserId(string challengeId, out string userId);
    string CreateCode(string challengeId);
    bool ValidateCode(string challengeId, string code);
}
