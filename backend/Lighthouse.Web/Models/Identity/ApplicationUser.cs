using System.ComponentModel.DataAnnotations.Schema;
using Lighthouse.Web.Models.Entities;
using Microsoft.AspNetCore.Identity;

namespace Lighthouse.Web.Models.Identity;

public class ApplicationUser : IdentityUser
{
    /// <summary>
    /// Links a Donor login to the case <c>supporters</c> row.
    /// </summary>
    public int? SupporterId { get; set; }

    [ForeignKey(nameof(SupporterId))]
    public Supporter? Supporter { get; set; }
}
