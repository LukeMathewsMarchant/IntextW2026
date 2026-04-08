using System.ComponentModel.DataAnnotations;

namespace Lighthouse.Web.Models.Entities;

public class PartnerAssignment
{
    [Key]
    public int AssignmentId { get; set; }

    public int PartnerId { get; set; }
    public Partner Partner { get; set; } = null!;

    public int? SafehouseId { get; set; }
    public Safehouse? Safehouse { get; set; }

    [MaxLength(30)]
    public string ProgramArea { get; set; } = string.Empty;

    public DateOnly AssignmentStart { get; set; }
    public DateOnly? AssignmentEnd { get; set; }

    public string? ResponsibilityNotes { get; set; }

    public bool IsPrimary { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Active";
}
