using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

public class DonationAllocation
{
    [Key]
    public int AllocationId { get; set; }

    public int DonationId { get; set; }
    public Donation Donation { get; set; } = null!;

    public int SafehouseId { get; set; }
    public Safehouse Safehouse { get; set; } = null!;

    public ProgramArea ProgramArea { get; set; }

    [Column(TypeName = "numeric(12,2)")]
    public decimal AmountAllocated { get; set; }

    public DateOnly AllocationDate { get; set; }

    public string? AllocationNotes { get; set; }
}
