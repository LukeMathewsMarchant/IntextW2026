using System.ComponentModel.DataAnnotations;

namespace Lighthouse.Web.Models.Entities;

public class Supporter
{
    public int SupporterId { get; set; }

    public SupporterType SupporterType { get; set; } = SupporterType.MonetaryDonor;

    [MaxLength(150)]
    public string DisplayName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? OrganizationName { get; set; }

    [MaxLength(75)]
    public string? FirstName { get; set; }

    [MaxLength(75)]
    public string? LastName { get; set; }

    public RelationshipType RelationshipType { get; set; } = RelationshipType.Local;

    public PhRegion? Region { get; set; }

    [MaxLength(50)]
    public string Country { get; set; } = "Philippines";

    [MaxLength(255)]
    public string? Email { get; set; }

    [MaxLength(30)]
    public string? Phone { get; set; }

    public SupporterStatus Status { get; set; } = SupporterStatus.Active;

    public DateTimeOffset CreatedAt { get; set; }

    public DateOnly? FirstDonationDate { get; set; }

    public AcquisitionChannel? AcquisitionChannel { get; set; }

    public ICollection<Donation> Donations { get; set; } = new List<Donation>();
}
