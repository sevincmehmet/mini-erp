using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MiniErp.Api.Auth;
using MiniErp.Api.Common;
using MiniErp.Api.Dev;
using MiniErp.Api.Services;
using MiniErp.Api.Tenancy;
using MiniErp.Application.Abstractions;
using MiniErp.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("ConnectionStrings:Default tanımlı değil (üretimde ortam değişkeni: ConnectionStrings__Default).");
var dbProvider = builder.Configuration["Database:Provider"];
var demoMode = builder.Configuration.GetValue<bool>("Demo:Enabled"); // sunucusuz demo: masaüstü uygulaması API'yi yerelde başlatır
builder.Services.AddInfrastructure(connectionString, dbProvider);

// Tenant: aynı scoped nesne hem somut tip hem arayüz olarak çözülür
builder.Services.AddScoped<HttpTenantProvider>();
builder.Services.AddScoped<ITenantProvider>(sp => sp.GetRequiredService<HttpTenantProvider>());

// ---------- Kimlik doğrulama (JWT)
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (jwt.Key.Length < 32) throw new InvalidOperationException("Jwt:Key en az 32 karakter olmalı (üretimde ortam değişkeninden verin: Jwt__Key).");
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton<TokenService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<HttpCurrentUser>();
builder.Services.AddScoped<MiniErp.Application.Abstractions.ICurrentUser>(sp => sp.GetRequiredService<HttpCurrentUser>());
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = jwt.Issuer, ValidAudience = jwt.Issuer,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
        NameClaimType = ClaimTypes.Name, ClockSkew = TimeSpan.FromMinutes(1),
    };
    // Şifre değiştiyse ya da kullanıcı pasifleştirildiyse eski oturum anahtarı geçersiz
    o.Events = new JwtBearerEvents
    {
        OnTokenValidated = async ctx =>
        {
            var id = Guid.TryParse(ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var g) ? g : Guid.Empty;
            var stamp = ctx.Principal?.FindFirstValue("stamp");
            var db = ctx.HttpContext.RequestServices.GetRequiredService<MiniErp.Infrastructure.Persistence.AppDbContext>();
            var user = await db.Users.AsNoTracking().Where(u => u.Id == id).Select(u => new { u.IsActive, u.SecurityStamp }).FirstOrDefaultAsync();
            if (user is null || !user.IsActive || user.SecurityStamp.ToString() != stamp) ctx.Fail("Oturum geçersiz.");
        },
    };
});
// Varsayılan: her uç nokta giriş ister ([AllowAnonymous] olanlar hariç)
builder.Services.AddAuthorization(o => o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

// Uygulama servisleri (istek bazında)
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<TimeEntryService>();
builder.Services.AddScoped<FinanceService>();
builder.Services.AddScoped<PayrollService>();
builder.Services.AddScoped<PayrollSettingsService>();
builder.Services.AddScoped<ImportService>();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddOpenApi();

// Şifre deneme saldırılarına karşı: IP başına dakikada 10 giriş/kurulum/şifre isteği
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = (ctx, ct) => new ValueTask(ctx.HttpContext.Response.WriteAsJsonAsync(new Microsoft.AspNetCore.Mvc.ProblemDetails
    {
        Status = 429, Title = "Çok fazla deneme yapıldı. Lütfen bir dakika bekleyip tekrar deneyin.",
    }, ct));
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "?",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

// Sunucu bir ters vekilin (Caddy/Nginx/IIS) arkasında çalışırken gerçek istemci IP'si ve https şeması
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

// Yalnızca masaüstü uygulamasının kaynaklarına izin ver:
// Vite dev sunucusu + paketlenmiş Electron (file:// sayfaları Origin olarak "null" gönderir).
// Asıl koruma CORS değil, JWT kimlik doğrulamasıdır (cookie kullanılmadığı için CSRF riski yok).
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:5173", "null")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

// Geliştirme: `dotnet run -- --seed` örnek veriyi üretip çıkar
if (args.Contains("--seed"))
{
    if (!app.Environment.IsDevelopment() && !demoMode) throw new InvalidOperationException("Örnek veri yalnızca Development ortamında ya da demo sürümde üretilebilir.");
    await DevDataSeeder.RunAsync(app.Services);
    return;
}

// Kurulum/güncelleme: `--migrate` veritabanı şemasını son sürüme getirir ve çıkar
if (args.Contains("--migrate") || app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using (var scope = app.Services.CreateScope())
        await scope.ServiceProvider.GetRequiredService<MiniErp.Infrastructure.Persistence.AppDbContext>().EnsureSchemaAsync();
    Console.WriteLine("✓ Veritabanı şeması güncel.");
    if (args.Contains("--migrate")) return;
}

// Demo: ilk açılışta yerel veritabanını örnek veriyle doldur
if (demoMode)
{
    bool empty;
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<MiniErp.Infrastructure.Persistence.AppDbContext>();
        await db.EnsureSchemaAsync();
        empty = !await db.Users.AnyAsync();
    }
    if (empty) await DevDataSeeder.RunAsync(app.Services);
}

app.UseForwardedHeaders();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); // production'da API şeması dışarı açılmaz
}

app.UseExceptionHandler();
// HTTPS'i ters vekil sonlandırıyorsa (konteyner içi düz http) yönlendirme kapatılabilir: Https__Redirect=false
if (app.Configuration.GetValue("Https:Redirect", true)) app.UseHttpsRedirection();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<TenantMiddleware>();
app.UseAuthorization();
app.MapControllers();
// Konteyner/izleme için sağlık kontrolü (kimlik gerektirmez, veri döndürmez)
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.Run();
