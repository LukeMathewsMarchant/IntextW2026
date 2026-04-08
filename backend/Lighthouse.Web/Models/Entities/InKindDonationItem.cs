using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class InKindDonationItem
{
    [Key]
    public int ItemId { get; set; }

    public int DonationId { get; set; }
    public Donation Donation { get; set; } = null!;

    [MaxLength(150)]
    public string ItemName { get; set; } = string.Empty;

    [MaxLength(30)]
    public string ItemCategory { get; set; } = string.Empty;

    public int Quantity { get; set; }

    [MaxLength(30)]
    public string? UnitOfMeasure { get; set; }

    [Column(TypeName = "numeric(12,2)")]
    public decimal? EstimatedUnitValue { get; set; }

    [MaxLength(30)]
    public string? IntendedUse { get; set; }

    [MaxLength(20)]
    public string? ReceivedCondition { get; set; }
}
