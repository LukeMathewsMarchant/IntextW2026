using DotNetEnv;
using Lighthouse.Web.Authorization;
using Lighthouse.Web.Data;
using Lighthouse.Web.Middleware;
using Lighthouse.Web.Models.Identity;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;

var contentRoot = Directory.GetCurrentDirectory();
var nestedApp = Path.Combine(contentRoot, "Lighthouse.Web");
if (Directory.Exists(Path.Combine(nestedApp, "wwwroot")))
    contentRoot = Path.GetFullPath(nestedApp);

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = contentRoot,
});

// Load .env from repo root (two levels up from backend/Lighthouse.Web) in Development
if (builder.Environment.IsDevelopment())
{
    var envPath = Path.Combine(builder.Environment.ContentRootPath, "..", "..", ".env");
    if (File.Exists(envPath))
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

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequiredLength = 12;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.AccessDeniedPath = "/Account/AccessDenied";
    options.SlidingExpiration = true;
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

builder.Services.AddControllersWithViews();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("ViteDev", policy =>
        {
            policy.WithOrigins("http://localhost:5173")
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
    });
}

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

if (app.Environment.IsDevelopment())
    app.UseCors("ViteDev");

app.UseSerilogRequestLogging();

app.UseMiddleware<ContentSecurityPolicyMiddleware>();

app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapControllerRoute("impact", "impact", new { controller = "Home", action = "Impact" });
app.MapControllerRoute("about", "about", new { controller = "Home", action = "About" });
app.MapControllerRoute("contact", "contact", new { controller = "Home", action = "Contact" });
app.MapControllerRoute("privacy", "privacy", new { controller = "Home", action = "Privacy" });

app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

await app.RunAsync();
