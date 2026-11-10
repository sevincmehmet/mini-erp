using MiniErp.Domain.Common;

namespace MiniErp.Domain.Entities;

// ============================================================ Değişiklik kaydı
public enum AuditAction { Added = 1, Modified = 2, Deleted = 3, Restored = 4 }

/// <summary>Kim, neyi, ne zaman değiştirdi. TenantSaveChangesInterceptor ile aynı anda yazılır; silinemez.</summary>
public class AuditLog
{
    public long Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public string EntityType { get; set; } = default!;
    public Guid EntityId { get; set; }
    public string? EntityLabel { get; set; }
    public AuditAction Action { get; set; }
    /// <summary>{ "Alan": ["eski", "yeni"] }</summary>
    public string? ChangesJson { get; set; }
    public DateTime At { get; set; }
}

// ============================================================ Cari hesaplar
public enum PartyType { Customer = 1, Supplier = 2, Both = 3 }

/// <summary>Cari hesap: müşteri ya da tedarikçi.</summary>
public class Party : TenantEntity
{
    public string Name { get; set; } = default!;
    public PartyType Type { get; set; } = PartyType.Customer;
    public string? TaxNumber { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Note { get; set; }
    /// <summary>Varsayılan vade (gün): yeni belgelerde vade tarihi buna göre önerilir.</summary>
    public int DefaultTermDays { get; set; } = 30;

    public ICollection<CariDocument> Documents { get; set; } = new List<CariDocument>();
}

public enum CariDocumentType { Receivable = 1, Payable = 2 } // Alacak (satış faturası) / Borç (alış faturası)

/// <summary>Vadeli belge: satış faturası (alacak) ya da alış faturası (borç).</summary>
public class CariDocument : TenantEntity
{
    public Guid PartyId { get; set; }
    public Party Party { get; set; } = default!;
    public CariDocumentType Type { get; set; }
    public string? DocumentNo { get; set; }
    public DateOnly Date { get; set; }
    public DateOnly DueDate { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }

    public ICollection<CariPayment> Payments { get; set; } = new List<CariPayment>();
}

/// <summary>Belgeye karşı tahsilat ya da ödeme. Gelir-gidere de hareket olarak yansır.</summary>
public class CariPayment : TenantEntity
{
    public Guid DocumentId { get; set; }
    public CariDocument Document { get; set; } = default!;
    public DateOnly Date { get; set; }
    public decimal Amount { get; set; }
    public string? Method { get; set; }
    public Guid? TransactionId { get; set; }
}

// ============================================================ İzinler
public enum LeaveKind { Annual = 1, Excuse = 2, Sick = 3, Unpaid = 4, Other = 5 }
public enum LeaveStatus { Requested = 1, Approved = 2, Rejected = 3 }

public class LeaveRequest : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = default!;
    public LeaveKind Kind { get; set; } = LeaveKind.Annual;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    /// <summary>İş günü sayısı (Pazar hariç).</summary>
    public decimal Days { get; set; }
    public LeaveStatus Status { get; set; } = LeaveStatus.Requested;
    public string? Note { get; set; }
}

// ============================================================ Belge ekleri
/// <summary>Kayda iliştirilen dosya (fatura PDF'i, fiş fotoğrafı…). En fazla 10 MB, veritabanında saklanır.</summary>
public class Attachment : TenantEntity
{
    public string EntityType { get; set; } = default!;
    public Guid EntityId { get; set; }
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long Size { get; set; }
    public byte[] Data { get; set; } = [];
}

// ============================================================ Bordro parametreleri
/// <summary>
/// Yıl bazında bordro parametreleri (şirket başına). Varsayılanlar yaklaşık değerlerdir;
/// resmî bordro için muhasebeci tarafından doğrulanmalıdır.
/// </summary>
public class PayrollSettings : TenantEntity
{
    public int Year { get; set; }
    public decimal MinimumWageGross { get; set; }
    public decimal SgkEmployeeRate { get; set; } = 0.14m;
    public decimal UnemploymentEmployeeRate { get; set; } = 0.01m;
    public decimal SgkEmployerRate { get; set; } = 0.1575m;
    public decimal UnemploymentEmployerRate { get; set; } = 0.02m;
    public decimal StampTaxRate { get; set; } = 0.00759m;
    /// <summary>SGK tavanı = asgari ücret × bu katsayı</summary>
    public decimal SgkCeilingMultiplier { get; set; } = 7.5m;
    /// <summary>[{ "upTo": 190000, "rate": 0.15 }, …, { "upTo": null, "rate": 0.40 }]</summary>
    public string TaxBracketsJson { get; set; } = "[]";
    public bool ApplyMinimumWageExemption { get; set; } = true;
    /// <summary>Kesinti hesabı: "Approximate" (eski %15) ya da "Statutory" (mevzuat)</summary>
    public string Method { get; set; } = "Statutory";
    public decimal ApproxDeductionRate { get; set; } = 0.15m;
}
