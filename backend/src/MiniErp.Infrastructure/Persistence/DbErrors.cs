using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;

namespace MiniErp.Infrastructure.Persistence;

/// <summary>Veritabanı kısıt hatalarını sağlayıcıdan bağımsız tanır (SQL Server ve SQLite).</summary>
public static class DbErrors
{
    private static Exception Root(Exception e) => e.InnerException is { } inner ? Root(inner) : e;

    public static bool IsUniqueViolation(Exception e) => Root(e) switch
    {
        SqlException s => s.Number is 2601 or 2627,
        SqliteException q => q.SqliteExtendedErrorCode is 2067 or 1555, // UNIQUE / PRIMARY KEY
        _ => false,
    };

    public static bool IsForeignKeyViolation(Exception e) => Root(e) switch
    {
        SqlException s => s.Number == 547,
        SqliteException q => q.SqliteExtendedErrorCode == 787, // FOREIGN KEY
        _ => false,
    };
}
