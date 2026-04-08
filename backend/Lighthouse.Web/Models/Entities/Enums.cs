using NpgsqlTypes;

namespace Lighthouse.Web.Models.Entities;

public enum SupporterType
{
    [PgName("MonetaryDonor")] MonetaryDonor,
    [PgName("InKindDonor")] InKindDonor,
    [PgName("Volunteer")] Volunteer,
    [PgName("SkillsContributor")] SkillsContributor,
    [PgName("SocialMediaAdvocate")] SocialMediaAdvocate,
    [PgName("PartnerOrganization")] PartnerOrganization
}

public enum RelationshipType
{
    [PgName("Local")] Local,
    [PgName("International")] International,
    [PgName("PartnerOrganization")] PartnerOrganization
}

public enum SupporterStatus
{
    [PgName("Active")] Active,
    [PgName("Inactive")] Inactive
}

public enum AcquisitionChannel
{
    [PgName("SocialMedia")] SocialMedia,
    [PgName("Website")] Website,
    [PgName("Event")] Event,
    [PgName("Church")] Church,
    [PgName("WordOfMouth")] WordOfMouth,
    [PgName("PartnerReferral")] PartnerReferral
}

public enum DonationType
{
    [PgName("Monetary")] Monetary,
    [PgName("InKind")] InKind,
    [PgName("Time")] Time,
    [PgName("Skills")] Skills,
    [PgName("SocialMedia")] SocialMedia
}

public enum ChannelSource
{
    [PgName("Direct")] Direct,
    [PgName("Campaign")] Campaign,
    [PgName("Event")] Event,
    [PgName("SocialMedia")] SocialMedia,
    [PgName("PartnerReferral")] PartnerReferral
}

public enum ImpactUnit
{
    [PgName("pesos")] pesos,
    [PgName("hours")] hours,
    [PgName("items")] items,
    [PgName("campaigns")] campaigns
}

public enum PhRegion
{
    [PgName("NCR")] NCR,
    [PgName("CAR")] CAR,
    [PgName("RegionI")] RegionI,
    [PgName("RegionII")] RegionII,
    [PgName("RegionIII")] RegionIII,
    [PgName("RegionIVA")] RegionIVA,
    [PgName("RegionIVB")] RegionIVB,
    [PgName("RegionV")] RegionV,
    [PgName("RegionVI")] RegionVI,
    [PgName("RegionVII")] RegionVII,
    [PgName("RegionVIII")] RegionVIII,
    [PgName("RegionIX")] RegionIX,
    [PgName("RegionX")] RegionX,
    [PgName("RegionXI")] RegionXI,
    [PgName("RegionXII")] RegionXII,
    [PgName("RegionXIII")] RegionXIII,
    [PgName("BARMM")] BARMM,
    [PgName("Luzon")] Luzon,
    [PgName("Visayas")] Visayas,
    [PgName("Mindanao")] Mindanao
}

public enum ProgramArea
{
    [PgName("Education")] Education,
    [PgName("Wellbeing")] Wellbeing,
    [PgName("Operations")] Operations,
    [PgName("Transport")] Transport,
    [PgName("Maintenance")] Maintenance,
    [PgName("Outreach")] Outreach
}

public enum EmotionalState
{
    [PgName("Angry")] Angry,
    [PgName("Anxious")] Anxious,
    [PgName("Calm")] Calm,
    [PgName("Distressed")] Distressed,
    [PgName("Happy")] Happy,
    [PgName("Hopeful")] Hopeful,
    [PgName("Sad")] Sad,
    [PgName("Withdrawn")] Withdrawn
}

public enum SessionType
{
    [PgName("Individual")] Individual,
    [PgName("Group")] Group
}

public enum CooperationLevel
{
    [PgName("Highly Cooperative")] HighlyCooperative,
    [PgName("Cooperative")] Cooperative,
    [PgName("Neutral")] Neutral,
    [PgName("Uncooperative")] Uncooperative
}

public enum VisitType
{
    [PgName("Initial Assessment")] InitialAssessment,
    [PgName("Routine Follow-Up")] RoutineFollowUp,
    [PgName("Reintegration Assessment")] ReintegrationAssessment,
    [PgName("Post-Placement Monitoring")] PostPlacementMonitoring,
    [PgName("Emergency")] Emergency
}

public enum VisitOutcome
{
    [PgName("Favorable")] Favorable,
    [PgName("Inconclusive")] Inconclusive,
    [PgName("Needs Improvement")] NeedsImprovement,
    [PgName("Unfavorable")] Unfavorable
}

public enum PlanCategory
{
    [PgName("Safety")] Safety,
    [PgName("Education")] Education,
    [PgName("Physical Health")] PhysicalHealth
}

public enum PlanStatus
{
    [PgName("Open")] Open,
    [PgName("In Progress")] InProgress,
    [PgName("On Hold")] OnHold,
    [PgName("Achieved")] Achieved,
    [PgName("Closed")] Closed
}
