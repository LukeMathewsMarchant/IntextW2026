using System.Security.Cryptography;
using Microsoft.Extensions.Caching.Memory;

namespace Lighthouse.Web.Services;

public class InMemoryEmailTwoFactorCodeStore : IEmailTwoFactorCodeStore
{
    private const int CodeLifetimeMinutes = 10;
    private readonly IMemoryCache _cache;

    public InMemoryEmailTwoFactorCodeStore(IMemoryCache cache)
    {
        _cache = cache;
    }

    public string CreateChallenge(string userId)
    {
        var challengeId = Guid.NewGuid().ToString("N");
        _cache.Set(GetUserKey(challengeId), userId, TimeSpan.FromMinutes(CodeLifetimeMinutes));
        return challengeId;
    }

    public bool TryGetUserId(string challengeId, out string userId)
    {
        if (_cache.TryGetValue<string>(GetUserKey(challengeId), out var storedUserId) && !string.IsNullOrWhiteSpace(storedUserId))
        {
            userId = storedUserId;
            return true;
        }

        userId = string.Empty;
        return false;
    }

    public string CreateCode(string challengeId)
    {
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        _cache.Set(GetCodeKey(challengeId), code, TimeSpan.FromMinutes(CodeLifetimeMinutes));
        return code;
    }

    public bool ValidateCode(string challengeId, string code)
    {
        if (!_cache.TryGetValue<string>(GetCodeKey(challengeId), out var expected) || string.IsNullOrWhiteSpace(expected))
            return false;

        var isValid = string.Equals(expected, code, StringComparison.Ordinal);
        if (!isValid)
            return false;

        _cache.Remove(GetCodeKey(challengeId));
        _cache.Remove(GetUserKey(challengeId));
        return true;
    }

    private static string GetCodeKey(string challengeId) => $"email-2fa:code:{challengeId}";
    private static string GetUserKey(string challengeId) => $"email-2fa:user:{challengeId}";
}
