using System.ComponentModel.DataAnnotations;

namespace Lighthouse.Web.Models.Entities;

public class Partner
{
    public int PartnerId { get; set; }

    [MaxLength(150)]
    public string PartnerName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string PartnerType { get; set; } = string.Empty;

    [MaxLength(30)]
    public string RoleType { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ContactName { get; set; }

    [MaxLength(255)]
    public string? Email { get; set; }

    [MaxLength(30)]
    public string? Phone { get; set; }

    [MaxLength(20)]
    public string? Region { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Active";

    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    public string? Notes { get; set; }

    public ICollection<PartnerAssignment> PartnerAssignments { get; set; } = new List<PartnerAssignment>();
}
