namespace Lighthouse.Web.Authorization;

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Donor = "Donor";
}

public static class AppPolicies
{
    public const string AdminOnly = "AdminOnly";
    public const string DonorOnly = "DonorOnly";
}
