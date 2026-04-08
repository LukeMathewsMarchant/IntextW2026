using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class InterventionPlan
{
    [Key]
    public int PlanId { get; set; }

    public int ResidentId { get; set; }
    public Resident Resident { get; set; } = null!;

    [MaxLength(30)]
    public string PlanCategory { get; set; } = string.Empty;

    public string? PlanDescription { get; set; }
    public string? ServicesProvided { get; set; }

    [Column(TypeName = "numeric(8,2)")]
    public decimal? TargetValue { get; set; }

    public DateOnly? TargetDate { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Open";

    public DateOnly? CaseConferenceDate { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
