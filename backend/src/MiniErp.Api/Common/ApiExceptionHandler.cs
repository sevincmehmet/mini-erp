using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Common;

/// <summary>Bilinen hataları anlaşılır ProblemDetails yanıtlarına çevirir; geri kalanı 500 olarak kalır.</summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, title, errors) = exception switch
        {
            AppValidationException v => (400, v.Errors.Count == 1 ? v.Errors[0] : "Kayıt doğrulanamadı.", v.Errors),
            DbUpdateException d when DbErrors.IsUniqueViolation(d) =>
                (409, "Bu kayıt zaten mevcut (ör. aynı sicil numarası veya aynı gün aynı vardiya).", (IReadOnlyList<string>)[]),
            UnauthorizedAccessException u => (403, u.Message, (IReadOnlyList<string>)[]),
            _ => (0, "", (IReadOnlyList<string>)[]),
        };
        if (status == 0) return false;

        logger.LogInformation("İstek reddedildi ({Status}): {Message}", status, title);
        context.Response.StatusCode = status;
        await Results.Problem(title: title, statusCode: status,
                extensions: errors.Count > 1 ? new Dictionary<string, object?> { ["errors"] = errors } : null)
            .ExecuteAsync(context);
        return true;
    }
}
