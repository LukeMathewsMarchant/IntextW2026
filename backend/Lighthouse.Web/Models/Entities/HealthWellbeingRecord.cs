using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class HealthWellbeingRecord
{
    [Key]
    public int HealthRecordId { get; set; }

    public int ResidentId { get; set; }
    public Resident Resident { get; set; } = null!;

    public DateOnly RecordDate { get; set; }

    [Column(TypeName = "numeric(4,2)")]
    public decimal? GeneralHealthScore { get; set; }
    [Column(TypeName = "numeric(4,2)")]
    public decimal? NutritionScore { get; set; }
    [Column(TypeName = "numeric(4,2)")]
    public decimal? SleepQualityScore { get; set; }
    [Column(TypeName = "numeric(4,2)")]
    public decimal? EnergyLevelScore { get; set; }

    [Column(TypeName = "numeric(5,1)")]
    public decimal? HeightCm { get; set; }
    [Column(TypeName = "numeric(5,2)")]
    public decimal? WeightKg { get; set; }
    [Column(TypeName = "numeric(5,2)")]
    public decimal? Bmi { get; set; }

    public bool MedicalCheckupDone { get; set; }
    public bool DentalCheckupDone { get; set; }
    public bool PsychologicalCheckupDone { get; set; }

    public string? Notes { get; set; }
}
