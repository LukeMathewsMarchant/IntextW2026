using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lighthouse.Web.Models.Entities;

/// <summary>
/// Case schema <c>users</c> table (bcrypt). Not used for ASP.NET Identity login.
/// </summary>
[Table("users")]
public class LegacyUser
{
    [Key]
    [Column("user_id")]
    public Guid UserId { get; set; }

    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? FullName { get; set; }

    /// <summary>PostgreSQL enum: admin, staff, viewer</summary>
    [MaxLength(20)]
    public string Role { get; set; } = "staff";

    public bool IsActive { get; set; } = true;

    public DateTimeOffset? LastLogin { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
