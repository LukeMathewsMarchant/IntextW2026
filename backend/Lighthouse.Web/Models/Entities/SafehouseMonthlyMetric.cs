using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class SafehouseMonthlyMetric
{
    [Key]
    public int MetricId { get; set; }

    public int SafehouseId { get; set; }
    public Safehouse Safehouse { get; set; } = null!;

    public DateOnly MonthStart { get; set; }
    public DateOnly MonthEnd { get; set; }

    public int ActiveResidents { get; set; }

    [Column(TypeName = "numeric(6,2)")]
    public decimal? AvgEducationProgress { get; set; }

    [Column(TypeName = "numeric(4,2)")]
    public decimal? AvgHealthScore { get; set; }

    public int ProcessRecordingCount { get; set; }
    public int HomeVisitationCount { get; set; }
    public int IncidentCount { get; set; }

    public string? Notes { get; set; }
}
