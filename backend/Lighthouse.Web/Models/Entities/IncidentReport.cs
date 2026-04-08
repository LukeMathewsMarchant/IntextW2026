using System.ComponentModel.DataAnnotations;

namespace Lighthouse.Web.Models.Entities;

public class IncidentReport
{
    [Key]
    public int IncidentId { get; set; }

    public int ResidentId { get; set; }
    public Resident Resident { get; set; } = null!;

    public int SafehouseId { get; set; }
    public Safehouse Safehouse { get; set; } = null!;

    public DateOnly IncidentDate { get; set; }

    [MaxLength(30)]
    public string IncidentType { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Severity { get; set; } = string.Empty;

    public string? Description { get; set; }
    public string? ResponseTaken { get; set; }

    public bool Resolved { get; set; }
    public DateOnly? ResolutionDate { get; set; }

    [MaxLength(20)]
    public string? ReportedBy { get; set; }

    public bool FollowUpRequired { get; set; }
}
