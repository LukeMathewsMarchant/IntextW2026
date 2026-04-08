namespace Lighthouse.Web.Middleware;

public class ContentSecurityPolicyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _csp;

    public ContentSecurityPolicyMiddleware(RequestDelegate next, IWebHostEnvironment env)
    {
        _next = next;
        _csp = env.IsDevelopment()
            ? "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http://localhost:* ws://localhost:*;"
            : "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self';";
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers.Append("Content-Security-Policy", _csp);
        await _next(context);
    }
}
