using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class EducationRecord
{
    public int EducationRecordId { get; set; }

    public int ResidentId { get; set; }
    public Resident Resident { get; set; } = null!;

    public DateOnly RecordDate { get; set; }

    [MaxLength(30)]
    public string EducationLevel { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? SchoolName { get; set; }

    [MaxLength(20)]
    public string EnrollmentStatus { get; set; } = "Enrolled";

    [Column(TypeName = "numeric(5,4)")]
    public decimal? AttendanceRate { get; set; }

    [Column(TypeName = "numeric(5,2)")]
    public decimal? ProgressPercent { get; set; }

    [MaxLength(20)]
    public string CompletionStatus { get; set; } = "NotStarted";

    public string? Notes { get; set; }
}
