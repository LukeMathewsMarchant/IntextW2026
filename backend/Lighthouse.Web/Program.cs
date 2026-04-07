using DotNetEnv;
using Lighthouse.Web.Authorization;
using Lighthouse.Web.Data;
using Lighthouse.Web.Middleware;
using Lighthouse.Web.Models.Entities;
using Lighthouse.Web.Models.Identity;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.FileProviders;
using Npgsql;
using Serilog;

var contentRoot = ResolveContentRoot();

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = contentRoot,
});

// Load .env from repo root (two levels up from backend/Lighthouse.Web) in Development
if (builder.Environment.IsDevelopment())
{
    var envPath = FindNearestFile(builder.Environment.ContentRootPath, ".env");
    if (envPath is not null)
        Env.Load(envPath);
}

builder.Configuration.AddEnvironmentVariables();

builder.Host.UseSerilog((ctx, lc) =>
{
    var logsDir = Path.Combine(ctx.HostingEnvironment.ContentRootPath, "Logs");
    Directory.CreateDirectory(logsDir);
    lc.ReadFrom.Configuration(ctx.Configuration)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .WriteTo.File(
            Path.Combine(logsDir, "log-.txt"),
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 14);
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? "Host=127.0.0.1;Port=5432;Database=postgres;Username=postgres;Password=postgres";

var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
dataSourceBuilder.MapEnum<SupporterType>("supporter_type");
dataSourceBuilder.MapEnum<RelationshipType>("relationship_type");
dataSourceBuilder.MapEnum<PhRegion>("ph_region");
dataSourceBuilder.MapEnum<SupporterStatus>("supporter_status");
dataSourceBuilder.MapEnum<AcquisitionChannel>("acquisition_channel");
dataSourceBuilder.MapEnum<DonationType>("donation_type");
dataSourceBuilder.MapEnum<ChannelSource>("channel_source");
dataSourceBuilder.MapEnum<ImpactUnit>("impact_unit");
var dataSource = dataSourceBuilder.Build();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(dataSource, npgsqlOptions =>
    {
        npgsqlOptions.MapEnum<SupporterType>("supporter_type");
        npgsqlOptions.MapEnum<RelationshipType>("relationship_type");
        npgsqlOptions.MapEnum<PhRegion>("ph_region");
        npgsqlOptions.MapEnum<SupporterStatus>("supporter_status");
        npgsqlOptions.MapEnum<AcquisitionChannel>("acquisition_channel");
        npgsqlOptions.MapEnum<DonationType>("donation_type");
        npgsqlOptions.MapEnum<ChannelSource>("channel_source");
        npgsqlOptions.MapEnum<ImpactUnit>("impact_unit");
    })
    // Existing schema tables are excluded from migrations in this app.
    // Suppress this warning so startup doesn't log a misleading stack trace.
    .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning)));

builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequiredLength = 12;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// Enforce password policy globally in case other identity configuration paths run.
builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequiredLength = 12;
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
});

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.AccessDeniedPath = "/Account/AccessDenied";
    options.SlidingExpiration = true;
    options.Cookie.SameSite = SameSiteMode.None;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AppPolicies.AdminOnly, p => p.RequireRole(AppRoles.Admin));
    options.AddPolicy(AppPolicies.DonorOnly, p => p.RequireRole(AppRoles.Donor));
});

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
});

builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<DonationAnalyticsService>();
builder.Services.AddScoped<IDonorPredictionService, DonorPredictionService>();
builder.Services.AddScoped<OkrMetricsService>();
builder.Services.AddScoped<IEmailCodeSender, SmtpEmailCodeSender>();

builder.Services
    .AddControllersWithViews()
    .AddRazorOptions(options =>
    {
        // Support both content roots:
        // - backend/Lighthouse.Web (standard /Views/*)
        // - backend (files live under /Lighthouse.Web/Views/*)
        options.ViewLocationFormats.Add("/Lighthouse.Web/Views/{1}/{0}.cshtml");
        options.ViewLocationFormats.Add("/Lighthouse.Web/Views/Shared/{0}.cshtml");
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendIntegration", policy =>
    {
        policy.SetIsOriginAllowed(static origin =>
            IsAllowedFrontendOrigin(origin))
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment()
    && connectionString.Contains("YOUR_PROJECT", StringComparison.OrdinalIgnoreCase))
{
    Log.Warning(
        "ConnectionStrings__DefaultConnection still contains YOUR_PROJECT — set a real host in .env at the repo root (or use local Postgres: Host=127.0.0.1;Port=5432;...).");
}

try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();
}
catch (Exception ex)
{
    Log.Warning(ex, "Database migration skipped or failed; ensure PostgreSQL is reachable.");
}

try
{
    await DbInitializer.SeedAsync(app.Services);
}
catch (Exception ex)
{
    Log.Warning(ex, "Database seed skipped or failed (roles/admin user); fix the connection string and restart.");
}

if (!app.Environment.IsDevelopment())
    app.UseExceptionHandler("/Home/Error");

app.UseCors("FrontendIntegration");

app.UseSerilogRequestLogging();

app.UseMiddleware<ContentSecurityPolicyMiddleware>();

app.UseStaticFiles();
foreach (var fallbackRoot in GetFallbackStaticRoots(app.Environment.ContentRootPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(fallbackRoot)
    });
}

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapControllerRoute("impact", "impact", new { controller = "Home", action = "Impact" });
app.MapControllerRoute("about", "about", new { controller = "Home", action = "About" });
app.MapControllerRoute("contact", "contact", new { controller = "Home", action = "Contact" });
app.MapControllerRoute("donate", "donate", new { controller = "Home", action = "Donate" });
app.MapControllerRoute("privacy", "privacy", new { controller = "Home", action = "Privacy" });

app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

// Allow SPA deep links (e.g., /donate, /Admin/...) to resolve to the app entry point.
app.MapControllerRoute(
    name: "spa-fallback",
    pattern: "{*path:regex(^(?!api).*)}",
    defaults: new { controller = "Home", action = "Index" });

await app.RunAsync();

static string ResolveContentRoot()
{
    var cwd = Directory.GetCurrentDirectory();
    var candidates = new[]
    {
        cwd,
        Path.Combine(cwd, "Lighthouse.Web"),
        Path.Combine(cwd, "backend", "Lighthouse.Web"),
        Path.GetFullPath(Path.Combine(cwd, "..", "Lighthouse.Web")),
        Path.GetFullPath(Path.Combine(cwd, "..", "backend", "Lighthouse.Web")),
    };

    foreach (var candidate in candidates)
    {
        if (Directory.Exists(Path.Combine(candidate, "Views"))
            && Directory.Exists(Path.Combine(candidate, "wwwroot")))
        {
            return Path.GetFullPath(candidate);
        }
    }

    return cwd;
}

static string? FindNearestFile(string startDirectory, string fileName)
{
    var dir = new DirectoryInfo(startDirectory);
    while (dir is not null)
    {
        var candidate = Path.Combine(dir.FullName, fileName);
        if (File.Exists(candidate))
            return candidate;
        dir = dir.Parent;
    }
    return null;
}

static IEnumerable<string> GetFallbackStaticRoots(string contentRootPath)
{
    var candidates = new[]
    {
        Path.Combine(contentRootPath, "Lighthouse.Web", "wwwroot"),
        Path.GetFullPath(Path.Combine(contentRootPath, "..", "Lighthouse.Web", "wwwroot")),
        Path.GetFullPath(Path.Combine(contentRootPath, "backend", "Lighthouse.Web", "wwwroot")),
        Path.GetFullPath(Path.Combine(contentRootPath, "..", "..", "frontend", "public")),
        Path.GetFullPath(Path.Combine(contentRootPath, "..", "frontend", "public")),
        Path.GetFullPath(Path.Combine(contentRootPath, "frontend", "public")),
    };

    foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
    {
        if (Directory.Exists(candidate))
            yield return candidate;
    }
}

static bool IsAllowedFrontendOrigin(string? origin)
{
    if (string.IsNullOrWhiteSpace(origin))
        return false;

    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        return false;

    // Local frontend dev server.
    if ((uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
        && string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)
        && uri.Port == 5173)
    {
        return true;
    }

    // Production + preview deployments on Vercel for this app.
    if (uri.Scheme == Uri.UriSchemeHttps
        && string.Equals(uri.Host, "intext-w2026.vercel.app", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    if (uri.Scheme == Uri.UriSchemeHttps
        && uri.Host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase)
        && uri.Host.StartsWith("intext-w2026-", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    return false;
}
