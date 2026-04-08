using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class Resident
{
    public int ResidentId { get; set; }

    [MaxLength(20)]
    public string CaseControlNo { get; set; } = string.Empty;

    [MaxLength(20)]
    public string InternalCode { get; set; } = string.Empty;

    public int SafehouseId { get; set; }
    public Safehouse Safehouse { get; set; } = null!;

    [MaxLength(20)]
    public string CaseStatus { get; set; } = "Active";

    [MaxLength(1)]
    [Column("sex")]
    public string Sex { get; set; } = "F";

    public DateOnly DateOfBirth { get; set; }

    [MaxLength(20)]
    public string? BirthStatus { get; set; }

    [MaxLength(100)]
    public string? PlaceOfBirth { get; set; }

    [MaxLength(50)]
    [Column("religion")]
    public string? Religion { get; set; }

    [MaxLength(30)]
    public string CaseCategory { get; set; } = string.Empty;

    public bool SubCatOrphaned { get; set; }
    public bool SubCatTrafficked { get; set; }
    public bool SubCatChildLabor { get; set; }
    public bool SubCatPhysicalAbuse { get; set; }
    public bool SubCatSexualAbuse { get; set; }
    public bool SubCatOsaec { get; set; }
    public bool SubCatCicl { get; set; }
    public bool SubCatAtRisk { get; set; }
    public bool SubCatStreetChild { get; set; }
    public bool SubCatChildWithHiv { get; set; }

    public bool IsPwd { get; set; }
    [MaxLength(100)]
    public string? PwdType { get; set; }
    public bool HasSpecialNeeds { get; set; }
    [MaxLength(200)]
    public string? SpecialNeedsDiagnosis { get; set; }

    public bool FamilyIs4ps { get; set; }
    public bool FamilySoloParent { get; set; }
    public bool FamilyIndigenous { get; set; }
    public bool FamilyParentPwd { get; set; }
    public bool FamilyInformalSettler { get; set; }

    public DateOnly DateOfAdmission { get; set; }
    [MaxLength(30)]
    public string? AgeUponAdmission { get; set; }
    [MaxLength(30)]
    public string? PresentAge { get; set; }
    [MaxLength(30)]
    public string? LengthOfStay { get; set; }

    [MaxLength(30)]
    public string? ReferralSource { get; set; }
    [MaxLength(100)]
    public string? ReferringAgencyPerson { get; set; }
    public DateOnly? DateColbRegistered { get; set; }
    public DateOnly? DateColbObtained { get; set; }

    [MaxLength(20)]
    public string? AssignedSocialWorker { get; set; }
    [MaxLength(40)]
    public string? InitialCaseAssessment { get; set; }
    public DateOnly? DateCaseStudyPrepared { get; set; }
    [MaxLength(40)]
    public string? ReintegrationType { get; set; }
    [MaxLength(30)]
    public string ReintegrationStatus { get; set; } = "Not Started";
    [MaxLength(20)]
    public string? InitialRiskLevel { get; set; }
    [MaxLength(20)]
    public string? CurrentRiskLevel { get; set; }
    public DateOnly? DateEnrolled { get; set; }
    public DateOnly? DateClosed { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public bool NotesRestricted { get; set; }

    public ICollection<EducationRecord> EducationRecords { get; set; } = new List<EducationRecord>();
    public ICollection<HealthWellbeingRecord> HealthWellbeingRecords { get; set; } = new List<HealthWellbeingRecord>();
    public ICollection<InterventionPlan> InterventionPlans { get; set; } = new List<InterventionPlan>();
    public ICollection<HomeVisitation> HomeVisitations { get; set; } = new List<HomeVisitation>();
    public ICollection<ProcessRecording> ProcessRecordings { get; set; } = new List<ProcessRecording>();
    public ICollection<IncidentReport> IncidentReports { get; set; } = new List<IncidentReport>();
}
