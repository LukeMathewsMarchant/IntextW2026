using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class PublicImpactSnapshot
{
    [Key]
    public int SnapshotId { get; set; }

    public DateOnly SnapshotDate { get; set; }

    [MaxLength(300)]
    public string Headline { get; set; } = string.Empty;

    public string? SummaryText { get; set; }

    [Column(TypeName = "jsonb")]
    public string? MetricPayloadJson { get; set; }

    public bool IsPublished { get; set; }
    public DateOnly? PublishedAt { get; set; }
}
