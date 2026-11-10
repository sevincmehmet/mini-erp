using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Domain.Entities;
using MiniErp.Infrastructure.Persistence;

namespace MiniErp.Api.Services;

/// <summary>Excel'deki "çalışan" hücresini (sicil no ya da ad soyad) gerçek çalışana çevirir.</summary>
public sealed class EmployeeLookup
{
    private readonly Dictionary<string, Employee> _byNumber;
    private readonly ILookup<string, Employee> _byName;

    private EmployeeLookup(List<Employee> employees)
    {
        _byNumber = employees.Where(e => e.EmployeeNumber != null)
            .GroupBy(e => Text.Normalize(e.EmployeeNumber))
            .ToDictionary(g => g.Key, g => g.First());
        _byName = employees.ToLookup(e => Text.Normalize($"{e.FirstName} {e.LastName}"));
    }

    public static async Task<EmployeeLookup> LoadAsync(AppDbContext db, CancellationToken ct) =>
        new(await db.Employees.AsNoTracking().ToListAsync(ct));

    public Employee? Resolve(string? value, out string? error)
    {
        error = null;
        var key = Text.Normalize(value);
        if (key.Length == 0) { error = "Çalışan boş."; return null; }
        if (_byNumber.TryGetValue(key, out var byNumber)) return byNumber;

        var matches = _byName[key].ToList();
        if (matches.Count == 1) return matches[0];
        error = matches.Count == 0
            ? $"Çalışan bulunamadı: \"{value}\" (sicil no ya da ad soyad yazın)."
            : $"\"{value}\" adında birden fazla çalışan var; sicil numarası kullanın.";
        return null;
    }
}
