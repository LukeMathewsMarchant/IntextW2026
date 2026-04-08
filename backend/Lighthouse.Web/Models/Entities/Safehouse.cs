using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class Safehouse
{
    public int SafehouseId { get; set; }

    [MaxLength(10)]
    public string SafehouseCode { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Region { get; set; } = string.Empty;

    [MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Province { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Country { get; set; } = "Philippines";

    public DateOnly OpenDate { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Active";

    public int CapacityGirls { get; set; }
    public int CapacityStaff { get; set; }
    public int CurrentOccupancy { get; set; }

    public string? Notes { get; set; }

    public ICollection<Resident> Residents { get; set; } = new List<Resident>();
}
