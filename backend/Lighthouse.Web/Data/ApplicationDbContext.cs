using Lighthouse.Web.Models.Entities;
using Lighthouse.Web.Models.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Lighthouse.Web.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<LegacyUser> LegacyUsers => Set<LegacyUser>();
    public DbSet<Safehouse> Safehouses => Set<Safehouse>();
    public DbSet<Supporter> Supporters => Set<Supporter>();
    public DbSet<Donation> Donations => Set<Donation>();
    public DbSet<DonationAllocation> DonationAllocations => Set<DonationAllocation>();
    public DbSet<InKindDonationItem> InKindDonationItems => Set<InKindDonationItem>();
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<PartnerAssignment> PartnerAssignments => Set<PartnerAssignment>();
    public DbSet<Resident> Residents => Set<Resident>();
    public DbSet<EducationRecord> EducationRecords => Set<EducationRecord>();
    public DbSet<HealthWellbeingRecord> HealthWellbeingRecords => Set<HealthWellbeingRecord>();
    public DbSet<InterventionPlan> InterventionPlans => Set<InterventionPlan>();
    public DbSet<HomeVisitation> HomeVisitations => Set<HomeVisitation>();
    public DbSet<ProcessRecording> ProcessRecordings => Set<ProcessRecording>();
    public DbSet<IncidentReport> IncidentReports => Set<IncidentReport>();
    public DbSet<SafehouseMonthlyMetric> SafehouseMonthlyMetrics => Set<SafehouseMonthlyMetric>();
    public DbSet<PublicImpactSnapshot> PublicImpactSnapshots => Set<PublicImpactSnapshot>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasPostgresEnum<SupporterType>("supporter_type");
        modelBuilder.HasPostgresEnum<RelationshipType>("relationship_type");
        modelBuilder.HasPostgresEnum<PhRegion>("ph_region");
        modelBuilder.HasPostgresEnum<SupporterStatus>("supporter_status");
        modelBuilder.HasPostgresEnum<AcquisitionChannel>("acquisition_channel");
        modelBuilder.HasPostgresEnum<DonationType>("donation_type");
        modelBuilder.HasPostgresEnum<ChannelSource>("channel_source");
        modelBuilder.HasPostgresEnum<ImpactUnit>("impact_unit");
        modelBuilder.HasPostgresEnum<ProgramArea>("program_area");
        modelBuilder.HasPostgresEnum<EmotionalState>("emotional_state");
        modelBuilder.HasPostgresEnum<SessionType>("session_type");
        modelBuilder.HasPostgresEnum<CooperationLevel>("cooperation_level");
        modelBuilder.HasPostgresEnum<VisitType>("visit_type");
        modelBuilder.HasPostgresEnum<VisitOutcome>("visit_outcome");
        modelBuilder.HasPostgresEnum<PlanCategory>("plan_category");
        modelBuilder.HasPostgresEnum<PlanStatus>("plan_status");

        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.HasOne(u => u.Supporter)
                .WithMany()
                .HasForeignKey(u => u.SupporterId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<LegacyUser>().ToTable("users", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<Safehouse>().ToTable("safehouses", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<Supporter>().ToTable("supporters", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<Donation>().ToTable("donations", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<DonationAllocation>().ToTable("donation_allocations", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<InKindDonationItem>().ToTable("in_kind_donation_items", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<Partner>().ToTable("partners", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<PartnerAssignment>().ToTable("partner_assignments", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<Resident>().ToTable("residents", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<EducationRecord>().ToTable("education_records", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<HealthWellbeingRecord>().ToTable("health_wellbeing_records", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<InterventionPlan>().ToTable("intervention_plans", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<HomeVisitation>().ToTable("home_visitations", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<ProcessRecording>().ToTable("process_recordings", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<IncidentReport>().ToTable("incident_reports", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<SafehouseMonthlyMetric>().ToTable("safehouse_monthly_metrics", t => t.ExcludeFromMigrations());
        modelBuilder.Entity<PublicImpactSnapshot>().ToTable("public_impact_snapshots", t => t.ExcludeFromMigrations());

        modelBuilder.Entity<AdminAuditLog>(entity =>
        {
            entity.ToTable("admin_audit_logs");
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<Donation>(entity =>
        {
            entity.HasOne(d => d.Supporter)
                .WithMany(s => s.Donations)
                .HasForeignKey(d => d.SupporterId);

            entity.Property(d => d.DonationId).HasColumnName("donation_id");
            entity.Property(d => d.SupporterId).HasColumnName("supporter_id");
            entity.Property(d => d.DonationType).HasColumnName("donation_type").HasColumnType("donation_type");
            entity.Property(d => d.DonationDate).HasColumnName("donation_date");
            entity.Property(d => d.IsRecurring).HasColumnName("is_recurring");
            entity.Property(d => d.CampaignName).HasColumnName("campaign_name");
            entity.Property(d => d.ChannelSource).HasColumnName("channel_source").HasColumnType("channel_source");
            entity.Property(d => d.CurrencyCode).HasColumnName("currency_code");
            entity.Property(d => d.Amount).HasColumnName("amount");
            entity.Property(d => d.EstimatedValue).HasColumnName("estimated_value");
            entity.Property(d => d.ImpactUnit).HasColumnName("impact_unit").HasColumnType("impact_unit");
            entity.Property(d => d.Notes).HasColumnName("notes");
            entity.Property(d => d.ReferralPostId).HasColumnName("referral_post_id");
            entity.Property(d => d.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Supporter>(entity =>
        {
            entity.Property(s => s.SupporterId).HasColumnName("supporter_id");
            entity.Property(s => s.SupporterType).HasColumnName("supporter_type").HasColumnType("supporter_type");
            entity.Property(s => s.DisplayName).HasColumnName("display_name");
            entity.Property(s => s.OrganizationName).HasColumnName("organization_name");
            entity.Property(s => s.FirstName).HasColumnName("first_name");
            entity.Property(s => s.LastName).HasColumnName("last_name");
            entity.Property(s => s.RelationshipType).HasColumnName("relationship_type").HasColumnType("relationship_type");
            entity.Property(s => s.Region).HasColumnName("region").HasColumnType("ph_region");
            entity.Property(s => s.Country).HasColumnName("country");
            entity.Property(s => s.Email).HasColumnName("email");
            entity.Property(s => s.Phone).HasColumnName("phone");
            entity.Property(s => s.Status).HasColumnName("status").HasColumnType("supporter_status");
            entity.Property(s => s.CreatedAt).HasColumnName("created_at");
            entity.Property(s => s.FirstDonationDate).HasColumnName("first_donation_date");
            entity.Property(s => s.AcquisitionChannel).HasColumnName("acquisition_channel").HasColumnType("acquisition_channel");
        });

        modelBuilder.Entity<Safehouse>(entity =>
        {
            entity.Property(s => s.SafehouseId).HasColumnName("safehouse_id");
            entity.Property(s => s.SafehouseCode).HasColumnName("safehouse_code");
            entity.Property(s => s.Name).HasColumnName("name");
            entity.Property(s => s.Region).HasColumnName("region");
            entity.Property(s => s.City).HasColumnName("city");
            entity.Property(s => s.Province).HasColumnName("province");
            entity.Property(s => s.Country).HasColumnName("country");
            entity.Property(s => s.OpenDate).HasColumnName("open_date");
            entity.Property(s => s.Status).HasColumnName("status");
            entity.Property(s => s.CapacityGirls).HasColumnName("capacity_girls");
            entity.Property(s => s.CapacityStaff).HasColumnName("capacity_staff");
            entity.Property(s => s.CurrentOccupancy).HasColumnName("current_occupancy");
            entity.Property(s => s.Notes).HasColumnName("notes");
        });

        modelBuilder.Entity<DonationAllocation>(entity =>
        {
            entity.Property(a => a.AllocationId).HasColumnName("allocation_id");
            entity.Property(a => a.DonationId).HasColumnName("donation_id");
            entity.Property(a => a.SafehouseId).HasColumnName("safehouse_id");
            entity.Property(a => a.ProgramArea).HasColumnName("program_area");
            entity.Property(a => a.AmountAllocated).HasColumnName("amount_allocated");
            entity.Property(a => a.AllocationDate).HasColumnName("allocation_date");
            entity.Property(a => a.AllocationNotes).HasColumnName("allocation_notes");

            entity.HasOne(a => a.Donation)
                .WithMany(d => d.DonationAllocations)
                .HasForeignKey(a => a.DonationId);

            entity.HasOne(a => a.Safehouse)
                .WithMany()
                .HasForeignKey(a => a.SafehouseId);
        });

        modelBuilder.Entity<InKindDonationItem>(entity =>
        {
            entity.Property(i => i.ItemId).HasColumnName("item_id");
            entity.Property(i => i.DonationId).HasColumnName("donation_id");
            entity.Property(i => i.ItemName).HasColumnName("item_name");
            entity.Property(i => i.ItemCategory).HasColumnName("item_category");
            entity.Property(i => i.Quantity).HasColumnName("quantity");
            entity.Property(i => i.UnitOfMeasure).HasColumnName("unit_of_measure");
            entity.Property(i => i.EstimatedUnitValue).HasColumnName("estimated_unit_value");
            entity.Property(i => i.IntendedUse).HasColumnName("intended_use");
            entity.Property(i => i.ReceivedCondition).HasColumnName("received_condition");

            entity.HasOne(i => i.Donation)
                .WithMany(d => d.InKindDonationItems)
                .HasForeignKey(i => i.DonationId);
        });

        modelBuilder.Entity<Partner>(entity =>
        {
            entity.Property(p => p.PartnerId).HasColumnName("partner_id");
            entity.Property(p => p.PartnerName).HasColumnName("partner_name");
            entity.Property(p => p.PartnerType).HasColumnName("partner_type");
            entity.Property(p => p.RoleType).HasColumnName("role_type");
            entity.Property(p => p.ContactName).HasColumnName("contact_name");
            entity.Property(p => p.StartDate).HasColumnName("start_date");
            entity.Property(p => p.EndDate).HasColumnName("end_date");
        });

        modelBuilder.Entity<PartnerAssignment>(entity =>
        {
            entity.Property(p => p.AssignmentId).HasColumnName("assignment_id");
            entity.Property(p => p.PartnerId).HasColumnName("partner_id");
            entity.Property(p => p.SafehouseId).HasColumnName("safehouse_id");
            entity.Property(p => p.ProgramArea).HasColumnName("program_area");
            entity.Property(p => p.AssignmentStart).HasColumnName("assignment_start");
            entity.Property(p => p.AssignmentEnd).HasColumnName("assignment_end");
            entity.Property(p => p.ResponsibilityNotes).HasColumnName("responsibility_notes");
            entity.Property(p => p.IsPrimary).HasColumnName("is_primary");

            entity.HasOne(p => p.Partner)
                .WithMany(x => x.PartnerAssignments)
                .HasForeignKey(p => p.PartnerId);

            entity.HasOne(p => p.Safehouse)
                .WithMany()
                .HasForeignKey(p => p.SafehouseId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Resident>(entity =>
        {
            entity.Property(r => r.ResidentId).HasColumnName("resident_id");
            entity.Property(r => r.CaseControlNo).HasColumnName("case_control_no");
            entity.Property(r => r.InternalCode).HasColumnName("internal_code");
            entity.Property(r => r.SafehouseId).HasColumnName("safehouse_id");
            entity.Property(r => r.CaseStatus).HasColumnName("case_status");
            entity.Property(r => r.Sex).HasColumnName("sex");
            entity.Property(r => r.DateOfBirth).HasColumnName("date_of_birth");
            entity.Property(r => r.BirthStatus).HasColumnName("birth_status").HasColumnType("birth_status");
            entity.Property(r => r.PlaceOfBirth).HasColumnName("place_of_birth");
            entity.Property(r => r.Religion).HasColumnName("religion");
            entity.Property(r => r.CaseCategory).HasColumnName("case_category");
            entity.Property(r => r.SubCatOrphaned).HasColumnName("sub_cat_orphaned");
            entity.Property(r => r.SubCatTrafficked).HasColumnName("sub_cat_trafficked");
            entity.Property(r => r.SubCatChildLabor).HasColumnName("sub_cat_child_labor");
            entity.Property(r => r.SubCatPhysicalAbuse).HasColumnName("sub_cat_physical_abuse");
            entity.Property(r => r.SubCatSexualAbuse).HasColumnName("sub_cat_sexual_abuse");
            entity.Property(r => r.SubCatOsaec).HasColumnName("sub_cat_osaec");
            entity.Property(r => r.SubCatCicl).HasColumnName("sub_cat_cicl");
            entity.Property(r => r.SubCatAtRisk).HasColumnName("sub_cat_at_risk");
            entity.Property(r => r.SubCatStreetChild).HasColumnName("sub_cat_street_child");
            entity.Property(r => r.SubCatChildWithHiv).HasColumnName("sub_cat_child_with_hiv");
            entity.Property(r => r.IsPwd).HasColumnName("is_pwd");
            entity.Property(r => r.PwdType).HasColumnName("pwd_type");
            entity.Property(r => r.HasSpecialNeeds).HasColumnName("has_special_needs");
            entity.Property(r => r.SpecialNeedsDiagnosis).HasColumnName("special_needs_diagnosis");
            entity.Property(r => r.FamilyIs4ps).HasColumnName("family_is_4ps");
            entity.Property(r => r.FamilySoloParent).HasColumnName("family_solo_parent");
            entity.Property(r => r.FamilyIndigenous).HasColumnName("family_indigenous");
            entity.Property(r => r.FamilyParentPwd).HasColumnName("family_parent_pwd");
            entity.Property(r => r.FamilyInformalSettler).HasColumnName("family_informal_settler");
            entity.Property(r => r.DateOfAdmission).HasColumnName("date_of_admission");
            entity.Property(r => r.AgeUponAdmission).HasColumnName("age_upon_admission");
            entity.Property(r => r.PresentAge).HasColumnName("present_age");
            entity.Property(r => r.LengthOfStay).HasColumnName("length_of_stay");
            entity.Property(r => r.ReferralSource).HasColumnName("referral_source");
            entity.Property(r => r.ReferringAgencyPerson).HasColumnName("referring_agency_person");
            entity.Property(r => r.DateColbRegistered).HasColumnName("date_colb_registered");
            entity.Property(r => r.DateColbObtained).HasColumnName("date_colb_obtained");
            entity.Property(r => r.AssignedSocialWorker).HasColumnName("assigned_social_worker");
            entity.Property(r => r.InitialCaseAssessment).HasColumnName("initial_case_assessment");
            entity.Property(r => r.DateCaseStudyPrepared).HasColumnName("date_case_study_prepared");
            entity.Property(r => r.ReintegrationType).HasColumnName("reintegration_type");
            entity.Property(r => r.ReintegrationStatus).HasColumnName("reintegration_status");
            entity.Property(r => r.InitialRiskLevel).HasColumnName("initial_risk_level");
            entity.Property(r => r.CurrentRiskLevel).HasColumnName("current_risk_level");
            entity.Property(r => r.DateEnrolled).HasColumnName("date_enrolled");
            entity.Property(r => r.DateClosed).HasColumnName("date_closed");
            entity.Property(r => r.CreatedAt).HasColumnName("created_at");
            entity.Property(r => r.NotesRestricted).HasColumnName("notes_restricted");

            entity.HasOne(r => r.Safehouse)
                .WithMany(s => s.Residents)
                .HasForeignKey(r => r.SafehouseId);
        });

        modelBuilder.Entity<EducationRecord>(entity =>
        {
            entity.Property(e => e.EducationRecordId).HasColumnName("education_record_id");
            entity.Property(e => e.ResidentId).HasColumnName("resident_id");
            entity.Property(e => e.RecordDate).HasColumnName("record_date");
            entity.Property(e => e.EducationLevel).HasColumnName("education_level");
            entity.Property(e => e.SchoolName).HasColumnName("school_name");
            entity.Property(e => e.EnrollmentStatus).HasColumnName("enrollment_status");
            entity.Property(e => e.AttendanceRate).HasColumnName("attendance_rate");
            entity.Property(e => e.ProgressPercent).HasColumnName("progress_percent");
            entity.Property(e => e.CompletionStatus).HasColumnName("completion_status");

            entity.HasOne(e => e.Resident)
                .WithMany(r => r.EducationRecords)
                .HasForeignKey(e => e.ResidentId);
        });

        modelBuilder.Entity<HealthWellbeingRecord>(entity =>
        {
            entity.Property(h => h.HealthRecordId).HasColumnName("health_record_id");
            entity.Property(h => h.ResidentId).HasColumnName("resident_id");
            entity.Property(h => h.RecordDate).HasColumnName("record_date");
            entity.Property(h => h.GeneralHealthScore).HasColumnName("general_health_score");
            entity.Property(h => h.NutritionScore).HasColumnName("nutrition_score");
            entity.Property(h => h.SleepQualityScore).HasColumnName("sleep_quality_score");
            entity.Property(h => h.EnergyLevelScore).HasColumnName("energy_level_score");
            entity.Property(h => h.HeightCm).HasColumnName("height_cm");
            entity.Property(h => h.WeightKg).HasColumnName("weight_kg");
            entity.Property(h => h.MedicalCheckupDone).HasColumnName("medical_checkup_done");
            entity.Property(h => h.DentalCheckupDone).HasColumnName("dental_checkup_done");
            entity.Property(h => h.PsychologicalCheckupDone).HasColumnName("psychological_checkup_done");

            entity.HasOne(h => h.Resident)
                .WithMany(r => r.HealthWellbeingRecords)
                .HasForeignKey(h => h.ResidentId);
        });

        modelBuilder.Entity<InterventionPlan>(entity =>
        {
            entity.Property(p => p.PlanId).HasColumnName("plan_id");
            entity.Property(p => p.ResidentId).HasColumnName("resident_id");
            entity.Property(p => p.PlanCategory).HasColumnName("plan_category").HasColumnType("plan_category");
            entity.Property(p => p.PlanDescription).HasColumnName("plan_description");
            entity.Property(p => p.ServicesProvided).HasColumnName("services_provided");
            entity.Property(p => p.TargetValue).HasColumnName("target_value");
            entity.Property(p => p.TargetDate).HasColumnName("target_date");
            entity.Property(p => p.Status).HasColumnName("status").HasColumnType("plan_status");
            entity.Property(p => p.CaseConferenceDate).HasColumnName("case_conference_date");
            entity.Property(p => p.CreatedAt).HasColumnName("created_at");
            entity.Property(p => p.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(p => p.Resident)
                .WithMany(r => r.InterventionPlans)
                .HasForeignKey(p => p.ResidentId);
        });

        modelBuilder.Entity<HomeVisitation>(entity =>
        {
            entity.Property(v => v.VisitationId).HasColumnName("visitation_id");
            entity.Property(v => v.ResidentId).HasColumnName("resident_id");
            entity.Property(v => v.VisitDate).HasColumnName("visit_date");
            entity.Property(v => v.SocialWorker).HasColumnName("social_worker");
            entity.Property(v => v.VisitType).HasColumnName("visit_type").HasColumnType("visit_type");
            entity.Property(v => v.LocationVisited).HasColumnName("location_visited");
            entity.Property(v => v.FamilyMembersPresent).HasColumnName("family_members_present");
            entity.Property(v => v.Purpose).HasColumnName("purpose");
            entity.Property(v => v.Observations).HasColumnName("observations");
            entity.Property(v => v.FamilyCooperationLevel).HasColumnName("family_cooperation_level").HasColumnType("cooperation_level");
            entity.Property(v => v.SafetyConcernsNoted).HasColumnName("safety_concerns_noted");
            entity.Property(v => v.FollowUpNeeded).HasColumnName("follow_up_needed");
            entity.Property(v => v.FollowUpNotes).HasColumnName("follow_up_notes");
            entity.Property(v => v.VisitOutcome).HasColumnName("visit_outcome").HasColumnType("visit_outcome");

            entity.HasOne(v => v.Resident)
                .WithMany(r => r.HomeVisitations)
                .HasForeignKey(v => v.ResidentId);
        });

        modelBuilder.Entity<ProcessRecording>(entity =>
        {
            entity.Property(p => p.RecordingId).HasColumnName("recording_id");
            entity.Property(p => p.ResidentId).HasColumnName("resident_id");
            entity.Property(p => p.SessionDate).HasColumnName("session_date");
            entity.Property(p => p.SocialWorker).HasColumnName("social_worker");
            entity.Property(p => p.SessionType).HasColumnName("session_type");
            entity.Property(p => p.SessionDurationMinutes).HasColumnName("session_duration_minutes");
            entity.Property(p => p.EmotionalStateObserved).HasColumnName("emotional_state_observed");
            entity.Property(p => p.EmotionalStateEnd).HasColumnName("emotional_state_end");
            entity.Property(p => p.SessionNarrative).HasColumnName("session_narrative");
            entity.Property(p => p.InterventionsApplied).HasColumnName("interventions_applied");
            entity.Property(p => p.FollowUpActions).HasColumnName("follow_up_actions");
            entity.Property(p => p.ProgressNoted).HasColumnName("progress_noted");
            entity.Property(p => p.ConcernsFlagged).HasColumnName("concerns_flagged");
            entity.Property(p => p.ReferralMade).HasColumnName("referral_made");
            entity.Property(p => p.NotesRestricted).HasColumnName("notes_restricted");

            entity.HasOne(p => p.Resident)
                .WithMany(r => r.ProcessRecordings)
                .HasForeignKey(p => p.ResidentId);
        });

        modelBuilder.Entity<IncidentReport>(entity =>
        {
            entity.Property(i => i.IncidentId).HasColumnName("incident_id");
            entity.Property(i => i.ResidentId).HasColumnName("resident_id");
            entity.Property(i => i.SafehouseId).HasColumnName("safehouse_id");
            entity.Property(i => i.IncidentDate).HasColumnName("incident_date");
            entity.Property(i => i.IncidentType).HasColumnName("incident_type");
            entity.Property(i => i.ResolutionDate).HasColumnName("resolution_date");
            entity.Property(i => i.ReportedBy).HasColumnName("reported_by");
            entity.Property(i => i.FollowUpRequired).HasColumnName("follow_up_required");

            entity.HasOne(i => i.Resident)
                .WithMany(r => r.IncidentReports)
                .HasForeignKey(i => i.ResidentId);

            entity.HasOne(i => i.Safehouse)
                .WithMany()
                .HasForeignKey(i => i.SafehouseId);
        });

        modelBuilder.Entity<SafehouseMonthlyMetric>(entity =>
        {
            entity.Property(m => m.MetricId).HasColumnName("metric_id");
            entity.Property(m => m.SafehouseId).HasColumnName("safehouse_id");
            entity.Property(m => m.MonthStart).HasColumnName("month_start");
            entity.Property(m => m.MonthEnd).HasColumnName("month_end");
            entity.Property(m => m.ActiveResidents).HasColumnName("active_residents");
            entity.Property(m => m.AvgEducationProgress).HasColumnName("avg_education_progress");
            entity.Property(m => m.AvgHealthScore).HasColumnName("avg_health_score");
            entity.Property(m => m.ProcessRecordingCount).HasColumnName("process_recording_count");
            entity.Property(m => m.HomeVisitationCount).HasColumnName("home_visitation_count");
            entity.Property(m => m.IncidentCount).HasColumnName("incident_count");
            entity.Property(m => m.Notes).HasColumnName("notes");

            entity.HasOne(m => m.Safehouse)
                .WithMany()
                .HasForeignKey(m => m.SafehouseId);
        });

        modelBuilder.Entity<PublicImpactSnapshot>(entity =>
        {
            entity.Property(s => s.SnapshotId).HasColumnName("snapshot_id");
            entity.Property(s => s.SnapshotDate).HasColumnName("snapshot_date");
            entity.Property(s => s.Headline).HasColumnName("headline");
            entity.Property(s => s.SummaryText).HasColumnName("summary_text");
            entity.Property(s => s.MetricPayloadJson).HasColumnName("metric_payload_json");
            entity.Property(s => s.IsPublished).HasColumnName("is_published");
            entity.Property(s => s.PublishedAt).HasColumnName("published_at");
        });

        modelBuilder.Entity<LegacyUser>(entity =>
        {
            entity.Property(u => u.UserId).HasColumnName("user_id");
            entity.Property(u => u.PasswordHash).HasColumnName("password_hash");
            entity.Property(u => u.FullName).HasColumnName("full_name");
            entity.Property(u => u.IsActive).HasColumnName("is_active");
            entity.Property(u => u.LastLogin).HasColumnName("last_login");
            entity.Property(u => u.CreatedAt).HasColumnName("created_at");
            entity.Property(u => u.UpdatedAt).HasColumnName("updated_at");
        });
    }
}
