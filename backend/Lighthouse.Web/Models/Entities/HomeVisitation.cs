using System.ComponentModel.DataAnnotations;

namespace Lighthouse.Web.Models.Entities;

public class HomeVisitation
{
    [Key]
    public int VisitationId { get; set; }

    public int ResidentId { get; set; }
    public Resident Resident { get; set; } = null!;

    public DateOnly VisitDate { get; set; }

    [MaxLength(20)]
    public string SocialWorker { get; set; } = string.Empty;

    public VisitType VisitType { get; set; }

    [MaxLength(150)]
    public string? LocationVisited { get; set; }

    public string? FamilyMembersPresent { get; set; }
    public string? Purpose { get; set; }
    public string? Observations { get; set; }

    public CooperationLevel? FamilyCooperationLevel { get; set; }

    public bool SafetyConcernsNoted { get; set; }
    public bool FollowUpNeeded { get; set; }
    public string? FollowUpNotes { get; set; }

    public VisitOutcome? VisitOutcome { get; set; }
}
