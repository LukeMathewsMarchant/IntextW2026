using System.Security.Claims;
using System.Text.Json;
using Lighthouse.Web.Authorization;
using Lighthouse.Web.Data;
using Lighthouse.Web.Models.Entities;
using Lighthouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Lighthouse.Web.Controllers.Api;

[Authorize(Policy = AppPolicies.AdminOnly)]
[Route("api/admin")]
[ApiController]
[IgnoreAntiforgeryToken]
public class AdminApiController : ControllerBase
{
    private static readonly HashSet<string> ValidCaseStatuses = new(StringComparer.Ordinal)
    {
        "Active", "Closed", "On Hold"
    };
    private static readonly HashSet<string> ValidCaseCategories = new(StringComparer.Ordinal)
    {
        "Neglected", "Abandoned", "Surrendered", "Foundling"
    };
    private static readonly HashSet<string> ValidReferralSources = new(StringComparer.Ordinal)
    {
        "NGO", "Government Agency", "Court Order", "Police", "Community", "Self-Referral"
    };
    private static readonly HashSet<string> ValidReintegrationTypes = new(StringComparer.Ordinal)
    {
        "Family Reunification", "Foster Care", "Adoption (Domestic)", "Adoption (Inter-Country)", "Independent Living"
    };
    private static readonly HashSet<string> ValidReintegrationStatuses = new(StringComparer.Ordinal)
    {
        "Not Started", "In Progress", "Completed", "On Hold"
    };
    private static readonly HashSet<string> ValidRiskLevels = new(StringComparer.Ordinal)
    {
        "Low", "Medium", "High", "Critical"
    };

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles
    };

    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _audit;

    public AdminApiController(ApplicationDbContext db, IAuditLogService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet("metrics/okr")]
    public async Task<IActionResult> Okr(
        [FromServices] OkrMetricsService okr,
        [FromQuery] int donorRecencyPage = 1,
        [FromQuery] int donorRecencyPageSize = OkrMetricsService.DefaultDonorRecencyPageSize,
        CancellationToken cancellationToken = default)
    {
        var snap = await okr.GetSnapshotAsync(donorRecencyPage, donorRecencyPageSize, cancellationToken);
        return Ok(snap);
    }

    [HttpGet("audit")]
    public async Task<IActionResult> AuditLog([FromQuery] int take = 200, CancellationToken cancellationToken = default)
    {
        var rows = await _audit.GetRecentAsync(Math.Clamp(take, 1, 2000), cancellationToken);
        return Ok(rows);
    }

    [HttpGet("analytics/donor-propensity")]
    public async Task<IActionResult> DonorPropensity(
        [FromServices] OkrMetricsService okr,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = OkrMetricsService.DefaultDonorRecencyPageSize,
        CancellationToken cancellationToken = default)
    {
        return Ok(await okr.GetDonorPropensityAsync(page, pageSize, cancellationToken));
    }

    [HttpGet("data/{entity}")]
    public async Task<IActionResult> List(string entity, CancellationToken cancellationToken)
    {
        return entity.ToLowerInvariant() switch
        {
            "users" => Ok(await _db.LegacyUsers.AsNoTracking().Take(500).ToListAsync(cancellationToken)),
            "safehouses" => Ok(await _db.Safehouses.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            "supporters" => Ok(await _db.Supporters.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            "donations" => Ok(await _db.Donations.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "donation_allocations" => Ok(await _db.DonationAllocations.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "in_kind_donation_items" => Ok(await _db.InKindDonationItems.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "partners" => Ok(await _db.Partners.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            "partner_assignments" => Ok(await _db.PartnerAssignments.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "residents" => Ok(await _db.Residents.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            "education_records" => Ok(await _db.EducationRecords.AsNoTracking().Take(8000).ToListAsync(cancellationToken)),
            "health_wellbeing_records" => Ok(await _db.HealthWellbeingRecords.AsNoTracking().Take(8000).ToListAsync(cancellationToken)),
            "intervention_plans" => Ok(await _db.InterventionPlans.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "home_visitations" => Ok(await _db.HomeVisitations.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "process_recordings" => Ok(await _db.ProcessRecordings.AsNoTracking().Take(8000).ToListAsync(cancellationToken)),
            "incident_reports" => Ok(await _db.IncidentReports.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "safehouse_monthly_metrics" => Ok(await _db.SafehouseMonthlyMetrics.AsNoTracking().Take(5000).ToListAsync(cancellationToken)),
            "public_impact_snapshots" => Ok(await _db.PublicImpactSnapshots.AsNoTracking().Take(2000).ToListAsync(cancellationToken)),
            _ => NotFound()
        };
    }

    [HttpGet("data/{entity}/{id}")]
    public async Task<IActionResult> Get(string entity, string id, CancellationToken cancellationToken)
    {
        return entity.ToLowerInvariant() switch
        {
            "users" when Guid.TryParse(id, out var gid) => Ok(await _db.LegacyUsers.FindAsync(new object[] { gid }, cancellationToken)),
            "safehouses" when int.TryParse(id, out var sid) => Ok(await _db.Safehouses.FindAsync(new object[] { sid }, cancellationToken)),
            "supporters" when int.TryParse(id, out var sup) => Ok(await _db.Supporters.FindAsync(new object[] { sup }, cancellationToken)),
            "donations" when int.TryParse(id, out var did) => Ok(await _db.Donations.FindAsync(new object[] { did }, cancellationToken)),
            "donation_allocations" when int.TryParse(id, out var aid) => Ok(await _db.DonationAllocations.FindAsync(new object[] { aid }, cancellationToken)),
            "in_kind_donation_items" when int.TryParse(id, out var iid) => Ok(await _db.InKindDonationItems.FindAsync(new object[] { iid }, cancellationToken)),
            "partners" when int.TryParse(id, out var pid) => Ok(await _db.Partners.FindAsync(new object[] { pid }, cancellationToken)),
            "partner_assignments" when int.TryParse(id, out var paid) => Ok(await _db.PartnerAssignments.FindAsync(new object[] { paid }, cancellationToken)),
            "residents" when int.TryParse(id, out var rid) => Ok(await _db.Residents.FindAsync(new object[] { rid }, cancellationToken)),
            "education_records" when int.TryParse(id, out var eid) => Ok(await _db.EducationRecords.FindAsync(new object[] { eid }, cancellationToken)),
            "health_wellbeing_records" when int.TryParse(id, out var hid) => Ok(await _db.HealthWellbeingRecords.FindAsync(new object[] { hid }, cancellationToken)),
            "intervention_plans" when int.TryParse(id, out var pl) => Ok(await _db.InterventionPlans.FindAsync(new object[] { pl }, cancellationToken)),
            "home_visitations" when int.TryParse(id, out var vid) => Ok(await _db.HomeVisitations.FindAsync(new object[] { vid }, cancellationToken)),
            "process_recordings" when int.TryParse(id, out var pr) => Ok(await _db.ProcessRecordings.FindAsync(new object[] { pr }, cancellationToken)),
            "incident_reports" when int.TryParse(id, out var ir) => Ok(await _db.IncidentReports.FindAsync(new object[] { ir }, cancellationToken)),
            "safehouse_monthly_metrics" when int.TryParse(id, out var mid) => Ok(await _db.SafehouseMonthlyMetrics.FindAsync(new object[] { mid }, cancellationToken)),
            "public_impact_snapshots" when int.TryParse(id, out var psid) => Ok(await _db.PublicImpactSnapshots.FindAsync(new object[] { psid }, cancellationToken)),
            _ => NotFound()
        };
    }

    [HttpPost("data/{entity}")]
    public async Task<IActionResult> Create(string entity, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        object? added = entity.ToLowerInvariant() switch
        {
            "users" => JsonSerializer.Deserialize<LegacyUser>(body, JsonOptions),
            "safehouses" => JsonSerializer.Deserialize<Safehouse>(body, JsonOptions),
            "supporters" => JsonSerializer.Deserialize<Supporter>(body, JsonOptions),
            "donations" => JsonSerializer.Deserialize<Donation>(body, JsonOptions),
            "donation_allocations" => JsonSerializer.Deserialize<DonationAllocation>(body, JsonOptions),
            "in_kind_donation_items" => JsonSerializer.Deserialize<InKindDonationItem>(body, JsonOptions),
            "partners" => JsonSerializer.Deserialize<Partner>(body, JsonOptions),
            "partner_assignments" => JsonSerializer.Deserialize<PartnerAssignment>(body, JsonOptions),
            "residents" => JsonSerializer.Deserialize<Resident>(body, JsonOptions),
            "education_records" => JsonSerializer.Deserialize<EducationRecord>(body, JsonOptions),
            "health_wellbeing_records" => JsonSerializer.Deserialize<HealthWellbeingRecord>(body, JsonOptions),
            "intervention_plans" => JsonSerializer.Deserialize<InterventionPlan>(body, JsonOptions),
            "home_visitations" => JsonSerializer.Deserialize<HomeVisitation>(body, JsonOptions),
            "process_recordings" => JsonSerializer.Deserialize<ProcessRecording>(body, JsonOptions),
            "incident_reports" => JsonSerializer.Deserialize<IncidentReport>(body, JsonOptions),
            "safehouse_monthly_metrics" => JsonSerializer.Deserialize<SafehouseMonthlyMetric>(body, JsonOptions),
            "public_impact_snapshots" => JsonSerializer.Deserialize<PublicImpactSnapshot>(body, JsonOptions),
            _ => null
        };

        if (added == null)
            return NotFound();

        if (added is Resident addedResident)
        {
            // Use explicit SQL for resident create to avoid varchar-to-enum binding issues.
            var connection = (NpgsqlConnection)_db.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
            }

            await using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO residents
                (
                    case_control_no, internal_code, safehouse_id, case_status,
                    sex, date_of_birth, place_of_birth, religion, case_category,
                    sub_cat_orphaned, sub_cat_trafficked, sub_cat_child_labor, sub_cat_physical_abuse,
                    sub_cat_sexual_abuse, sub_cat_osaec, sub_cat_cicl, sub_cat_at_risk, sub_cat_street_child, sub_cat_child_with_hiv,
                    is_pwd, pwd_type, has_special_needs, special_needs_diagnosis,
                    family_is_4ps, family_solo_parent, family_indigenous, family_parent_pwd, family_informal_settler,
                    date_of_admission, referring_agency_person, assigned_social_worker, reintegration_status
                )
                VALUES
                (
                    @case_control_no, @internal_code, @safehouse_id, CAST(@case_status AS case_status),
                    @sex, @date_of_birth, @place_of_birth, @religion, CAST(@case_category AS case_category),
                    @sub_cat_orphaned, @sub_cat_trafficked, @sub_cat_child_labor, @sub_cat_physical_abuse,
                    @sub_cat_sexual_abuse, @sub_cat_osaec, @sub_cat_cicl, @sub_cat_at_risk, @sub_cat_street_child, @sub_cat_child_with_hiv,
                    @is_pwd, @pwd_type, @has_special_needs, @special_needs_diagnosis,
                    @family_is_4ps, @family_solo_parent, @family_indigenous, @family_parent_pwd, @family_informal_settler,
                    @date_of_admission, @referring_agency_person, @assigned_social_worker, CAST(@reintegration_status AS reintegration_status)
                )
                RETURNING resident_id;";

            cmd.Parameters.AddWithValue("case_control_no", addedResident.CaseControlNo);
            cmd.Parameters.AddWithValue("internal_code", addedResident.InternalCode);
            cmd.Parameters.AddWithValue("safehouse_id", addedResident.SafehouseId);
            cmd.Parameters.AddWithValue("case_status", string.IsNullOrWhiteSpace(addedResident.CaseStatus) ? "Active" : addedResident.CaseStatus);
            cmd.Parameters.AddWithValue("sex", string.IsNullOrWhiteSpace(addedResident.Sex) ? "F" : addedResident.Sex);
            cmd.Parameters.AddWithValue("date_of_birth", addedResident.DateOfBirth);
            cmd.Parameters.AddWithValue("place_of_birth", (object?)addedResident.PlaceOfBirth ?? DBNull.Value);
            cmd.Parameters.AddWithValue("religion", (object?)addedResident.Religion ?? DBNull.Value);
            cmd.Parameters.AddWithValue("case_category", addedResident.CaseCategory);
            cmd.Parameters.AddWithValue("sub_cat_orphaned", addedResident.SubCatOrphaned);
            cmd.Parameters.AddWithValue("sub_cat_trafficked", addedResident.SubCatTrafficked);
            cmd.Parameters.AddWithValue("sub_cat_child_labor", addedResident.SubCatChildLabor);
            cmd.Parameters.AddWithValue("sub_cat_physical_abuse", addedResident.SubCatPhysicalAbuse);
            cmd.Parameters.AddWithValue("sub_cat_sexual_abuse", addedResident.SubCatSexualAbuse);
            cmd.Parameters.AddWithValue("sub_cat_osaec", addedResident.SubCatOsaec);
            cmd.Parameters.AddWithValue("sub_cat_cicl", addedResident.SubCatCicl);
            cmd.Parameters.AddWithValue("sub_cat_at_risk", addedResident.SubCatAtRisk);
            cmd.Parameters.AddWithValue("sub_cat_street_child", addedResident.SubCatStreetChild);
            cmd.Parameters.AddWithValue("sub_cat_child_with_hiv", addedResident.SubCatChildWithHiv);
            cmd.Parameters.AddWithValue("is_pwd", addedResident.IsPwd);
            cmd.Parameters.AddWithValue("pwd_type", (object?)addedResident.PwdType ?? DBNull.Value);
            cmd.Parameters.AddWithValue("has_special_needs", addedResident.HasSpecialNeeds);
            cmd.Parameters.AddWithValue("special_needs_diagnosis", (object?)addedResident.SpecialNeedsDiagnosis ?? DBNull.Value);
            cmd.Parameters.AddWithValue("family_is_4ps", addedResident.FamilyIs4ps);
            cmd.Parameters.AddWithValue("family_solo_parent", addedResident.FamilySoloParent);
            cmd.Parameters.AddWithValue("family_indigenous", addedResident.FamilyIndigenous);
            cmd.Parameters.AddWithValue("family_parent_pwd", addedResident.FamilyParentPwd);
            cmd.Parameters.AddWithValue("family_informal_settler", addedResident.FamilyInformalSettler);
            cmd.Parameters.AddWithValue("date_of_admission", addedResident.DateOfAdmission);
            cmd.Parameters.AddWithValue("referring_agency_person", (object?)addedResident.ReferringAgencyPerson ?? DBNull.Value);
            cmd.Parameters.AddWithValue("assigned_social_worker", (object?)addedResident.AssignedSocialWorker ?? DBNull.Value);
            cmd.Parameters.AddWithValue("reintegration_status", string.IsNullOrWhiteSpace(addedResident.ReintegrationStatus) ? "Not Started" : addedResident.ReintegrationStatus);

            object? newIdObj;
            try
            {
                newIdObj = await cmd.ExecuteScalarAsync(cancellationToken);
            }
            catch (PostgresException pg) when (pg.SqlState == "23505")
            {
                if (string.Equals(pg.ConstraintName, "residents_case_control_no_key", StringComparison.OrdinalIgnoreCase))
                {
                    return Conflict(new { error = "Case control number already exists. Please use a unique value." });
                }
                if (string.Equals(pg.ConstraintName, "residents_internal_code_key", StringComparison.OrdinalIgnoreCase))
                {
                    return Conflict(new { error = "Internal code already exists. Please use a unique value." });
                }
                return Conflict(new { error = "A resident with one of these unique identifiers already exists." });
            }
            if (newIdObj == null || newIdObj == DBNull.Value)
                return BadRequest("Failed to create resident.");

            var newId = Convert.ToInt32(newIdObj);
            var created = await _db.Residents.FindAsync(new object[] { newId }, cancellationToken);
            await _audit.LogAsync(userId, "Create", entity, newId.ToString(), null, body.GetRawText(), HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.TraceIdentifier, cancellationToken);
            return Ok(created);
        }

        _db.Add(added);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(userId, "Create", entity, GetKey(added), null, body.GetRawText(), HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.TraceIdentifier, cancellationToken);
        return Ok(added);
    }

    [HttpPut("data/{entity}/{id}")]
    public async Task<IActionResult> Update(string entity, string id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var normalizedEntity = entity.ToLowerInvariant();
        var existing = await FindTrackedAsync(normalizedEntity, id, cancellationToken);
        if (existing == null)
            return NotFound();

        var oldJson = JsonSerializer.Serialize(existing, JsonOptions);

        if (normalizedEntity == "residents" && existing is Resident trackedResident)
        {
            var incomingResident = JsonSerializer.Deserialize<Resident>(body, JsonOptions);
            if (incomingResident == null)
                return BadRequest();

            // Never allow key mutation from generic admin payloads.
            incomingResident.ResidentId = trackedResident.ResidentId;
            string? requestedCaseStatus = null;
            if (body.TryGetProperty("caseStatus", out var caseStatusEl) && caseStatusEl.ValueKind == JsonValueKind.String)
            {
                requestedCaseStatus = caseStatusEl.GetString();
            }
            else if (body.TryGetProperty("CaseStatus", out caseStatusEl) && caseStatusEl.ValueKind == JsonValueKind.String)
            {
                requestedCaseStatus = caseStatusEl.GetString();
            }
            string? requestedCaseCategory = null;
            if (body.TryGetProperty("caseCategory", out var caseCategoryEl) && caseCategoryEl.ValueKind == JsonValueKind.String)
            {
                requestedCaseCategory = caseCategoryEl.GetString();
            }
            else if (body.TryGetProperty("CaseCategory", out caseCategoryEl) && caseCategoryEl.ValueKind == JsonValueKind.String)
            {
                requestedCaseCategory = caseCategoryEl.GetString();
            }
            string? requestedReferralSource = null;
            if (body.TryGetProperty("referralSource", out var referralSourceEl) && referralSourceEl.ValueKind == JsonValueKind.String)
            {
                requestedReferralSource = referralSourceEl.GetString();
            }
            else if (body.TryGetProperty("ReferralSource", out referralSourceEl) && referralSourceEl.ValueKind == JsonValueKind.String)
            {
                requestedReferralSource = referralSourceEl.GetString();
            }
            string? requestedReintegrationType = null;
            if (body.TryGetProperty("reintegrationType", out var reintegrationTypeEl) && reintegrationTypeEl.ValueKind == JsonValueKind.String)
            {
                requestedReintegrationType = reintegrationTypeEl.GetString();
            }
            else if (body.TryGetProperty("ReintegrationType", out reintegrationTypeEl) && reintegrationTypeEl.ValueKind == JsonValueKind.String)
            {
                requestedReintegrationType = reintegrationTypeEl.GetString();
            }
            string? requestedReintegrationStatus = null;
            if (body.TryGetProperty("reintegrationStatus", out var reintegrationStatusEl) && reintegrationStatusEl.ValueKind == JsonValueKind.String)
            {
                requestedReintegrationStatus = reintegrationStatusEl.GetString();
            }
            else if (body.TryGetProperty("ReintegrationStatus", out reintegrationStatusEl) && reintegrationStatusEl.ValueKind == JsonValueKind.String)
            {
                requestedReintegrationStatus = reintegrationStatusEl.GetString();
            }
            string? requestedCurrentRiskLevel = null;
            if (body.TryGetProperty("currentRiskLevel", out var currentRiskLevelEl) && currentRiskLevelEl.ValueKind == JsonValueKind.String)
            {
                requestedCurrentRiskLevel = currentRiskLevelEl.GetString();
            }
            else if (body.TryGetProperty("CurrentRiskLevel", out currentRiskLevelEl) && currentRiskLevelEl.ValueKind == JsonValueKind.String)
            {
                requestedCurrentRiskLevel = currentRiskLevelEl.GetString();
            }

            var preservedCaseStatus = trackedResident.CaseStatus;
            var preservedCaseCategory = trackedResident.CaseCategory;
            var preservedReferralSource = trackedResident.ReferralSource;
            var preservedReintegrationType = trackedResident.ReintegrationType;
            var preservedReintegrationStatus = trackedResident.ReintegrationStatus;
            var preservedBirthStatus = trackedResident.BirthStatus;
            var preservedInitialCaseAssessment = trackedResident.InitialCaseAssessment;
            var preservedInitialRiskLevel = trackedResident.InitialRiskLevel;
            var preservedCurrentRiskLevel = trackedResident.CurrentRiskLevel;
            _db.Entry(trackedResident).CurrentValues.SetValues(incomingResident);
            // Enum-backed columns in PostgreSQL: preserve current values in generic CRUD path.
            trackedResident.CaseStatus = preservedCaseStatus;
            trackedResident.CaseCategory = preservedCaseCategory;
            trackedResident.ReferralSource = preservedReferralSource;
            trackedResident.ReintegrationType = preservedReintegrationType;
            trackedResident.ReintegrationStatus = preservedReintegrationStatus;
            trackedResident.BirthStatus = preservedBirthStatus;
            trackedResident.InitialCaseAssessment = preservedInitialCaseAssessment;
            trackedResident.InitialRiskLevel = preservedInitialRiskLevel;
            trackedResident.CurrentRiskLevel = preservedCurrentRiskLevel;
            _db.Entry(trackedResident).Property(r => r.CaseStatus).IsModified = false;
            _db.Entry(trackedResident).Property(r => r.CaseCategory).IsModified = false;
            _db.Entry(trackedResident).Property(r => r.ReferralSource).IsModified = false;
            _db.Entry(trackedResident).Property(r => r.ReintegrationType).IsModified = false;
            _db.Entry(trackedResident).Property(r => r.ReintegrationStatus).IsModified = false;
            _db.Entry(trackedResident).Property(r => r.BirthStatus).IsModified = false;
            _db.Entry(trackedResident).Property(r => r.InitialCaseAssessment).IsModified = false;
            _db.Entry(trackedResident).Property(r => r.InitialRiskLevel).IsModified = false;
            _db.Entry(trackedResident).Property(r => r.CurrentRiskLevel).IsModified = false;

            await _db.SaveChangesAsync(cancellationToken);

            if (
                !string.IsNullOrWhiteSpace(requestedCaseStatus) ||
                !string.IsNullOrWhiteSpace(requestedCaseCategory) ||
                !string.IsNullOrWhiteSpace(requestedReferralSource) ||
                !string.IsNullOrWhiteSpace(requestedReintegrationType) ||
                !string.IsNullOrWhiteSpace(requestedReintegrationStatus) ||
                !string.IsNullOrWhiteSpace(requestedCurrentRiskLevel))
            {
                if (!string.IsNullOrWhiteSpace(requestedCaseStatus) && ValidCaseStatuses.Contains(requestedCaseStatus))
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $"UPDATE residents SET case_status = CAST({requestedCaseStatus} AS case_status), date_closed = CASE WHEN CAST({requestedCaseStatus} AS case_status) = CAST({"Closed"} AS case_status) THEN CURRENT_DATE ELSE date_closed END WHERE resident_id = {trackedResident.ResidentId}",
                        cancellationToken
                    );
                }
                if (!string.IsNullOrWhiteSpace(requestedCaseCategory) && ValidCaseCategories.Contains(requestedCaseCategory))
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $"UPDATE residents SET case_category = CAST({requestedCaseCategory} AS case_category) WHERE resident_id = {trackedResident.ResidentId}",
                        cancellationToken
                    );
                }
                if (!string.IsNullOrWhiteSpace(requestedReferralSource) && ValidReferralSources.Contains(requestedReferralSource))
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $"UPDATE residents SET referral_source = CAST({requestedReferralSource} AS referral_source) WHERE resident_id = {trackedResident.ResidentId}",
                        cancellationToken
                    );
                }
                if (!string.IsNullOrWhiteSpace(requestedReintegrationType) && ValidReintegrationTypes.Contains(requestedReintegrationType))
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $"UPDATE residents SET reintegration_type = CAST({requestedReintegrationType} AS reintegration_type) WHERE resident_id = {trackedResident.ResidentId}",
                        cancellationToken
                    );
                }
                if (!string.IsNullOrWhiteSpace(requestedReintegrationStatus) && ValidReintegrationStatuses.Contains(requestedReintegrationStatus))
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $"UPDATE residents SET reintegration_status = CAST({requestedReintegrationStatus} AS reintegration_status) WHERE resident_id = {trackedResident.ResidentId}",
                        cancellationToken
                    );
                }
                if (!string.IsNullOrWhiteSpace(requestedCurrentRiskLevel) && ValidRiskLevels.Contains(requestedCurrentRiskLevel))
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $"UPDATE residents SET current_risk_level = CAST({requestedCurrentRiskLevel} AS risk_level) WHERE resident_id = {trackedResident.ResidentId}",
                        cancellationToken
                    );
                }
                await _db.Entry(trackedResident).ReloadAsync(cancellationToken);
            }

            await _audit.LogAsync(userId, "Update", entity, id, oldJson, body.GetRawText(), HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.TraceIdentifier, cancellationToken);
            return Ok(trackedResident);
        }

        object? updated = entity.ToLowerInvariant() switch
        {
            "users" when existing is LegacyUser => JsonSerializer.Deserialize<LegacyUser>(body, JsonOptions),
            "safehouses" when existing is Safehouse => JsonSerializer.Deserialize<Safehouse>(body, JsonOptions),
            "supporters" when existing is Supporter => JsonSerializer.Deserialize<Supporter>(body, JsonOptions),
            "donations" when existing is Donation => JsonSerializer.Deserialize<Donation>(body, JsonOptions),
            "donation_allocations" when existing is DonationAllocation => JsonSerializer.Deserialize<DonationAllocation>(body, JsonOptions),
            "in_kind_donation_items" when existing is InKindDonationItem => JsonSerializer.Deserialize<InKindDonationItem>(body, JsonOptions),
            "partners" when existing is Partner => JsonSerializer.Deserialize<Partner>(body, JsonOptions),
            "partner_assignments" when existing is PartnerAssignment => JsonSerializer.Deserialize<PartnerAssignment>(body, JsonOptions),
            "residents" when existing is Resident => JsonSerializer.Deserialize<Resident>(body, JsonOptions),
            "education_records" when existing is EducationRecord => JsonSerializer.Deserialize<EducationRecord>(body, JsonOptions),
            "health_wellbeing_records" when existing is HealthWellbeingRecord => JsonSerializer.Deserialize<HealthWellbeingRecord>(body, JsonOptions),
            "intervention_plans" when existing is InterventionPlan => JsonSerializer.Deserialize<InterventionPlan>(body, JsonOptions),
            "home_visitations" when existing is HomeVisitation => JsonSerializer.Deserialize<HomeVisitation>(body, JsonOptions),
            "process_recordings" when existing is ProcessRecording => JsonSerializer.Deserialize<ProcessRecording>(body, JsonOptions),
            "incident_reports" when existing is IncidentReport => JsonSerializer.Deserialize<IncidentReport>(body, JsonOptions),
            "safehouse_monthly_metrics" when existing is SafehouseMonthlyMetric => JsonSerializer.Deserialize<SafehouseMonthlyMetric>(body, JsonOptions),
            "public_impact_snapshots" when existing is PublicImpactSnapshot => JsonSerializer.Deserialize<PublicImpactSnapshot>(body, JsonOptions),
            _ => null
        };

        if (updated == null)
            return BadRequest();

        _db.Entry(existing).State = EntityState.Detached;
        _db.Update(updated);
        if (updated is Resident updatedResident)
        {
            // Keep current DB enum value for birth_status until enum-backed editing is implemented.
            _db.Entry(updatedResident).Property(r => r.BirthStatus).IsModified = false;
        }
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(userId, "Update", entity, id, oldJson, body.GetRawText(), HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.TraceIdentifier, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("data/{entity}/{id}")]
    public async Task<IActionResult> Delete(string entity, string id, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var normalizedEntity = entity.ToLowerInvariant();
        var existing = await FindTrackedAsync(normalizedEntity, id, cancellationToken);
        if (existing == null)
            return NotFound();

        var oldJson = JsonSerializer.Serialize(existing, JsonOptions);
        try
        {
            if (normalizedEntity == "supporters" && existing is Supporter supporter)
            {
                // Delete dependent rows first so supporter delete succeeds under FK constraints.
                var donationIds = await _db.Donations
                    .Where(d => d.SupporterId == supporter.SupporterId)
                    .Select(d => d.DonationId)
                    .ToListAsync(cancellationToken);

                if (donationIds.Count > 0)
                {
                    var allocations = await _db.DonationAllocations
                        .Where(a => donationIds.Contains(a.DonationId))
                        .ToListAsync(cancellationToken);
                    if (allocations.Count > 0)
                        _db.DonationAllocations.RemoveRange(allocations);

                    var inKindItems = await _db.InKindDonationItems
                        .Where(i => donationIds.Contains(i.DonationId))
                        .ToListAsync(cancellationToken);
                    if (inKindItems.Count > 0)
                        _db.InKindDonationItems.RemoveRange(inKindItems);

                    var donations = await _db.Donations
                        .Where(d => donationIds.Contains(d.DonationId))
                        .ToListAsync(cancellationToken);
                    _db.Donations.RemoveRange(donations);
                }
            }

            _db.Remove(existing);
            await _db.SaveChangesAsync(cancellationToken);
            await _audit.LogAsync(userId, "Delete", entity, id, oldJson, null, HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.TraceIdentifier, cancellationToken);
            return NoContent();
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23503")
        {
            return Conflict(new
            {
                error = "Cannot delete this record because it is referenced by other records. Remove dependent records first."
            });
        }
    }

    private async Task<object?> FindTrackedAsync(string entity, string id, CancellationToken cancellationToken)
    {
        return entity.ToLowerInvariant() switch
        {
            "users" when Guid.TryParse(id, out var gid) => await _db.LegacyUsers.FindAsync(new object[] { gid }, cancellationToken),
            "safehouses" when int.TryParse(id, out var sid) => await _db.Safehouses.FindAsync(new object[] { sid }, cancellationToken),
            "supporters" when int.TryParse(id, out var sup) => await _db.Supporters.FindAsync(new object[] { sup }, cancellationToken),
            "donations" when int.TryParse(id, out var did) => await _db.Donations.FindAsync(new object[] { did }, cancellationToken),
            "donation_allocations" when int.TryParse(id, out var aid) => await _db.DonationAllocations.FindAsync(new object[] { aid }, cancellationToken),
            "in_kind_donation_items" when int.TryParse(id, out var iid) => await _db.InKindDonationItems.FindAsync(new object[] { iid }, cancellationToken),
            "partners" when int.TryParse(id, out var pid) => await _db.Partners.FindAsync(new object[] { pid }, cancellationToken),
            "partner_assignments" when int.TryParse(id, out var paid) => await _db.PartnerAssignments.FindAsync(new object[] { paid }, cancellationToken),
            "residents" when int.TryParse(id, out var rid) => await _db.Residents.FindAsync(new object[] { rid }, cancellationToken),
            "education_records" when int.TryParse(id, out var eid) => await _db.EducationRecords.FindAsync(new object[] { eid }, cancellationToken),
            "health_wellbeing_records" when int.TryParse(id, out var hid) => await _db.HealthWellbeingRecords.FindAsync(new object[] { hid }, cancellationToken),
            "intervention_plans" when int.TryParse(id, out var pl) => await _db.InterventionPlans.FindAsync(new object[] { pl }, cancellationToken),
            "home_visitations" when int.TryParse(id, out var vid) => await _db.HomeVisitations.FindAsync(new object[] { vid }, cancellationToken),
            "process_recordings" when int.TryParse(id, out var pr) => await _db.ProcessRecordings.FindAsync(new object[] { pr }, cancellationToken),
            "incident_reports" when int.TryParse(id, out var ir) => await _db.IncidentReports.FindAsync(new object[] { ir }, cancellationToken),
            "safehouse_monthly_metrics" when int.TryParse(id, out var mid) => await _db.SafehouseMonthlyMetrics.FindAsync(new object[] { mid }, cancellationToken),
            "public_impact_snapshots" when int.TryParse(id, out var psid) => await _db.PublicImpactSnapshots.FindAsync(new object[] { psid }, cancellationToken),
            _ => null
        };
    }

    private static string? GetKey(object entity) => entity switch
    {
        LegacyUser u => u.UserId.ToString(),
        Safehouse s => s.SafehouseId.ToString(),
        Supporter s => s.SupporterId.ToString(),
        Donation d => d.DonationId.ToString(),
        DonationAllocation d => d.AllocationId.ToString(),
        InKindDonationItem i => i.ItemId.ToString(),
        Partner p => p.PartnerId.ToString(),
        PartnerAssignment p => p.AssignmentId.ToString(),
        Resident r => r.ResidentId.ToString(),
        EducationRecord e => e.EducationRecordId.ToString(),
        HealthWellbeingRecord h => h.HealthRecordId.ToString(),
        InterventionPlan p => p.PlanId.ToString(),
        HomeVisitation h => h.VisitationId.ToString(),
        ProcessRecording p => p.RecordingId.ToString(),
        IncidentReport i => i.IncidentId.ToString(),
        SafehouseMonthlyMetric m => m.MetricId.ToString(),
        PublicImpactSnapshot p => p.SnapshotId.ToString(),
        _ => null
    };
}
