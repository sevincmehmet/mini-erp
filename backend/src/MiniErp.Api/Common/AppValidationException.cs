namespace MiniErp.Api.Common;

/// <summary>Kullanıcıya gösterilecek doğrulama hataları (400). Mesajlar Türkçe ve doğrudan ekranda gösterilir.</summary>
public sealed class AppValidationException(IReadOnlyList<string> errors)
    : Exception(string.Join(" ", errors))
{
    public IReadOnlyList<string> Errors { get; } = errors;

    public AppValidationException(string error) : this([error]) { }

    public static void ThrowIfAny(List<string> errors)
    {
        if (errors.Count > 0) throw new AppValidationException(errors);
    }
}
