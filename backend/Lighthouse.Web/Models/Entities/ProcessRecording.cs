using System.ComponentModel.DataAnnotations;

namespace Lighthouse.Web.Models.Entities;

public class ProcessRecording
{
    [Key]
    public int RecordingId { get; set; }

    public int ResidentId { get; set; }
    public Resident Resident { get; set; } = null!;

    public DateOnly SessionDate { get; set; }

    [MaxLength(20)]
    public string SocialWorker { get; set; } = string.Empty;

    public SessionType SessionType { get; set; }

    public int? SessionDurationMinutes { get; set; }

    public EmotionalState? EmotionalStateObserved { get; set; }
    public EmotionalState? EmotionalStateEnd { get; set; }

    public string? SessionNarrative { get; set; }
    public string? InterventionsApplied { get; set; }
    public string? FollowUpActions { get; set; }

    public bool ProgressNoted { get; set; }
    public bool ConcernsFlagged { get; set; }
    public bool ReferralMade { get; set; }

    public bool NotesRestricted { get; set; }
}
