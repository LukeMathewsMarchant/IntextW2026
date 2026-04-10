import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'

type RetentionPoint = { month: string; rate: number }
type RetentionDetail = {
  monthKey: string
  monthLabel: string
  uniqueSupportersThisMonth: number
  uniqueSupportersPriorMonth: number
  returningSupporters: number
  noGiftInPriorMonth: number
  donationRowsThisMonth: number
}
type MixPoint = { name: string; value: number; color: string }
type SafehouseDeltaPoint = {
  safehouseId: number
  safehouseName: string
  activeResidents: number
  activeResidentsDelta: number
  incidents: number
  incidentsDelta: number
  avgEducationProgress: number | null
  avgEducationDelta: number | null
  avgHealthScore: number | null
  avgHealthDelta: number | null
  month: string
}
type ChannelPerformancePoint = { channel: string; donations: number; totalAmount: number; share: number }
type PostTractionPoint = { postLabel: string; referrals: number; donationValue: number; avgDonationValue: number }
type AllocationPoint = { programArea: string; amountAllocated: number; allocationCount: number }
type DonorOkrs = {
  donorsLast365Days: number
  donorsLast90Days: number
  donorsStaleYearNot90: number
  churnRatePct: number
  distinctDonorsAllTime: number
  windowLabel: string
  summary: string
}
type PipelineInsights = {
  generatedAtUtc?: string
  pipelineName?: string
  dataSource?: string
  headline?: string
  summary?: string
  metricHighlights?: Record<string, number | string | boolean | null>
  loadWarning?: string
  relatedPipelines?: string[]
}

type ImpactResponse = {
  kpis?: { livesImpacted: number; safehouses: number; activePrograms: number; successRate: number }
  retention?: RetentionPoint[]
  retentionDetail?: RetentionDetail | null
  supportMix?: MixPoint[]
  dataFreshness?: {
    generatedAtUtc: string
    latestSafehouseMetricMonth: string | null
  }
  outcomeSignals?: {
    donationsLast12Months: number
    donorsLast12Months: number
    avgDonationAmountLast12Months: number | null
    activeResidentsLatest: number
    incidentsLatest: number
    avgEducationLatest: number | null
    avgHealthLatest: number | null
  }
  impactNarrative?: {
    inCareNow: number
    recentReintegrations: number
    recentIncidents: number
    closureShareOfActivePct: number
    storyWindowLabel: string
  }
  outcomePerDollar?: {
    donationsLast12Months: number
    reintegrationsLast12Months: number
    activeResidentsNow: number
    dollarsPerReintegration: number | null
    dollarsPerActiveResident: number | null
    windowLabel: string
  }
  upcomingCaseConferences?: {
    next30Days: number
    windowLabel: string
  }
  riskLevels?: {
    low: number
    medium: number
    high: number
    critical: number
  }
  residentPipeline?: {
    intake: number
    assessment: number
    activeCare: number
    preReintegration: number
    reintegrated: number
  }
  givingInAction?: {
    metricKey: string
    headline: string
    value: number | null
    context: string
  }
  spreadingTheWord?: {
    totalReachThisMonth: number | null
    totalReachLabel: string
    mostEffectivePlatform: string
    mostEffectivePlatformSharePct: number
    socialDonationsCountThisMonth?: number
    socialDonationsAmountThisMonth?: number
    donationReferralsFromSocialPosts: number
    /** All platforms in the window (by dollar), for auditing 100% / single-bucket cases. */
    platformBreakdown?: { platform: string; giftCount: number; totalAmount: number; sharePct: number }[]
    windowLabel: string
  }
  educationInsights?: {
    avgProgressAllTime: number | null
    totalRecords: number
    nonNullProgressRecords: number
    distinctResidentsWithEducation: number
    monthlyTrend: Array<{
      month: string
      avgProgress: number | null
      donations: number
    }>
  }
  safehousePerformance?: SafehouseDeltaPoint[]
  donorOkrs?: DonorOkrs
  donationChannelPerformance?: ChannelPerformancePoint[]
  socialPostTraction?: PostTractionPoint[]
  donationAllocationBreakdown?: AllocationPoint[]
  socialMediaPlatformPerformance?: ChannelPerformancePoint[]
  socialMediaAllocationBreakdown?: AllocationPoint[]
  metricDefinitions?: Array<{ key: string; label: string; definition: string }>
  /** Merged from ml-service GET /impact/analytics (public_impact_snapshots pipeline + related notebooks). */
  pipelineInsights?: PipelineInsights
}

export function Impact() {
  const [data, setData] = useState<ImpactResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [animateCharts, setAnimateCharts] = useState(false)

  useEffect(() => {
    fetchJson<ImpactResponse>('/api/impact')
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!data) return
    setAnimateCharts(false)
    const timer = window.setTimeout(() => setAnimateCharts(true), 80)
    return () => window.clearTimeout(timer)
  }, [data])

  /** Prefer API detail so we don’t show “0%” when the rate is actually undefined (no prior-month donors). */
  const retentionHeadline = useMemo(() => {
    if (!data) return null
    const detail = data.retentionDetail
    if (detail) {
      if (detail.uniqueSupportersPriorMonth <= 0) {
        return {
          kind: 'undefined' as const,
          monthLabel: detail.monthLabel,
        }
      }
      const pct = Math.round((detail.returningSupporters * 100) / detail.uniqueSupportersPriorMonth)
      return {
        kind: 'pct' as const,
        value: pct,
        monthLabel: detail.monthLabel,
        prior: detail.uniqueSupportersPriorMonth,
        returning: detail.returningSupporters,
      }
    }
    if (data.retention?.length) {
      const last = data.retention[data.retention.length - 1]
      return { kind: 'pct' as const, value: last.rate, monthLabel: null as string | null, prior: null as number | null, returning: null as number | null }
    }
    return null
  }, [data])

  if (error) {
    return <div className="alert alert-warning">Unable to load impact data: {error}</div>
  }

  if (!data) {
    return <div className="text-body-secondary">Loading impact data...</div>
  }
  const kpis = data.kpis ?? { livesImpacted: 0, safehouses: 0, activePrograms: 0, successRate: 0 }
  const retention = data.retention ?? []
  const supportMix = data.supportMix ?? []
  const outcomeSignals = {
    donationsLast12Months: data.outcomeSignals?.donationsLast12Months ?? 0,
    donorsLast12Months: data.outcomeSignals?.donorsLast12Months ?? 0,
    avgDonationAmountLast12Months: data.outcomeSignals?.avgDonationAmountLast12Months ?? null,
    activeResidentsLatest: data.outcomeSignals?.activeResidentsLatest ?? 0,
    incidentsLatest: data.outcomeSignals?.incidentsLatest ?? 0,
    avgEducationLatest: data.outcomeSignals?.avgEducationLatest ?? null,
    avgHealthLatest: data.outcomeSignals?.avgHealthLatest ?? null
  }
  const donorOkrs = data.donorOkrs ?? {
    donorsLast365Days: 0,
    donorsLast90Days: 0,
    donorsStaleYearNot90: 0,
    churnRatePct: 0,
    distinctDonorsAllTime: 0,
    windowLabel: '',
    summary: '',
  }
  const impactNarrative = {
    inCareNow: data.impactNarrative?.inCareNow ?? outcomeSignals.activeResidentsLatest,
    recentReintegrations: data.impactNarrative?.recentReintegrations ?? 0,
    recentIncidents: data.impactNarrative?.recentIncidents ?? outcomeSignals.incidentsLatest,
    closureShareOfActivePct: data.impactNarrative?.closureShareOfActivePct ?? 0,
    storyWindowLabel: data.impactNarrative?.storyWindowLabel ?? 'Last 90 days (UTC)'
  }
  const outcomePerDollar = {
    donationsLast12Months: data.outcomePerDollar?.donationsLast12Months ?? outcomeSignals.donationsLast12Months,
    reintegrationsLast12Months: data.outcomePerDollar?.reintegrationsLast12Months ?? 0,
    activeResidentsNow: data.outcomePerDollar?.activeResidentsNow ?? outcomeSignals.activeResidentsLatest,
    dollarsPerReintegration: data.outcomePerDollar?.dollarsPerReintegration ?? null,
    dollarsPerActiveResident: data.outcomePerDollar?.dollarsPerActiveResident ?? null,
    windowLabel: data.outcomePerDollar?.windowLabel ?? 'Last 12 months (UTC)'
  }
  const upcomingCaseConferences = data.upcomingCaseConferences ?? { next30Days: 0, windowLabel: '' }
  const riskLevels = data.riskLevels ?? { low: 0, medium: 0, high: 0, critical: 0 }
  const residentPipeline = data.residentPipeline ?? { intake: 0, assessment: 0, activeCare: 0, preReintegration: 0, reintegrated: 0 }
  const givingInAction = data.givingInAction ?? {
    metricKey: 'estimatedMonthlyCostPerGirlInCare',
    headline: 'Monthly equivalent',
    value: null,
    context: '',
  }
  const spreadingTheWord = data.spreadingTheWord ?? {
    totalReachThisMonth: null,
    totalReachLabel: 'No published reach snapshot in this window',
    mostEffectivePlatform: 'N/A',
    mostEffectivePlatformSharePct: 0,
    socialDonationsCountThisMonth: 0,
    socialDonationsAmountThisMonth: 0,
    donationReferralsFromSocialPosts: 0,
    platformBreakdown: [],
    windowLabel: '',
  }
  const socialGivingCount = spreadingTheWord.socialDonationsCountThisMonth ?? 0
  const socialGivingAmount = spreadingTheWord.socialDonationsAmountThisMonth ?? 0
  const platformIsUnlabeled =
    spreadingTheWord.mostEffectivePlatform === 'Unknown/Unlabeled' || spreadingTheWord.mostEffectivePlatform === 'N/A'
  const platformBreakdown = spreadingTheWord.platformBreakdown ?? []
  const allocationBreakdown = data.donationAllocationBreakdown ?? []
  const allocationAmountRaw = allocationBreakdown.reduce((sum, row) => sum + row.amountAllocated, 0)
  const totalAllocationAmount = allocationAmountRaw || 1
  const highlightColor = '#f3b11d'
  /** Theme-aware bar fill (non-highlighted allocation rows). */
  const mutedBarFill = 'var(--bs-secondary)'
  const supportMixDescriptions: Record<string, string> = {
    'Safety & shelter': 'Keeps girls in secure homes with daily supervision, food, and immediate protection.',
    'Healing & education': 'Funds counseling, schooling support, and learning plans that rebuild confidence.',
    'Justice services': 'Supports legal coordination, documentation, and survivor advocacy follow-through.',
    Empowerment: 'Builds practical life and reintegration readiness through coaching and skill-building.',
  }
  const pipelineStages = [
    { key: 'intake', label: 'Intake', value: residentPipeline.intake },
    { key: 'assessment', label: 'Assessment', value: residentPipeline.assessment },
    { key: 'activeCare', label: 'Active Care', value: residentPipeline.activeCare },
    { key: 'preReintegration', label: 'Pre-Reintegration', value: residentPipeline.preReintegration },
    { key: 'reintegrated', label: 'Reintegrated', value: residentPipeline.reintegrated },
  ]
  const maxPipelineValue = Math.max(...pipelineStages.map((s) => s.value), 1)

  return (
    <div className="vstack gap-4">
      <section className="lh-impact lh-impact-page-hero">
        <p className="lh-impact-kicker text-center mb-2">Impact Dashboard</p>
        <h1 className="lh-impact-title text-center mb-2">From Crisis to Reintegration</h1>
        <p className="lh-section-sub text-center mb-3">
          See how your support powers safe care, healing services, and long-term reintegration for girls in our network.
        </p>
      </section>

      <section className="card border-0 shadow-sm" aria-label="Impact narrative and outcome efficiency">
        <div className="card-body p-4">
          <div className="row g-4">
            <div className="col-lg-7">
              <h2 className="h5 mb-3">Journey Snapshot</h2>
              <div className="row g-2 row-cols-1 row-cols-md-3">
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-body-secondary text-uppercase">In care now</div>
                    <div className="h4 mb-1 text-body-emphasis">{impactNarrative.inCareNow.toLocaleString()}</div>
                    <div className="small text-body-secondary">Girls currently receiving care and support</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-body-secondary text-uppercase">Recent protection incidents</div>
                    <div className="h4 mb-1 text-body-emphasis">{impactNarrative.recentIncidents.toLocaleString()}</div>
                    <div className="small text-body-secondary">Current 30-day window</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-body-secondary text-uppercase">Reintegrations (90d)</div>
                    <div className="h4 mb-1 text-body-emphasis">{impactNarrative.recentReintegrations.toLocaleString()}</div>
                    <div className="small text-body-secondary">
                      {impactNarrative.closureShareOfActivePct}% of active census
                    </div>
                  </div>
                </div>
              </div>
              <p className="small text-body-secondary mb-0 mt-3">{impactNarrative.storyWindowLabel}</p>
            </div>
            <div className="col-lg-5">
              <h2 className="h5 mb-3">Outcome per dollar lens</h2>
              <div className="d-flex flex-column gap-2">
                <div className="bg-body-tertiary rounded p-3">
                  <div className="small text-body-secondary fw-semibold">Donations per closure</div>
                  <div className="h4 mb-1 text-body-emphasis">
                    {outcomePerDollar.dollarsPerReintegration == null
                      ? 'N/A'
                      : `$${outcomePerDollar.dollarsPerReintegration.toLocaleString()}`}
                  </div>
                  <div className="small text-body-secondary">
                    ${outcomePerDollar.donationsLast12Months.toLocaleString()} ÷{' '}
                    {outcomePerDollar.reintegrationsLast12Months.toLocaleString()} closures in period
                  </div>
                  {outcomePerDollar.dollarsPerReintegration != null ? (
                    <p className="small text-body-secondary mb-0 mt-2">
                      On average, donations in this period work out to about{' '}
                      <strong>${outcomePerDollar.dollarsPerReintegration.toLocaleString()}</strong> per girl who closed
                      her case in this period — an illustration of the giving that makes each reintegration possible.
                    </p>
                  ) : null}
                </div>
                <div className="bg-body-tertiary rounded p-3">
                  <div className="small text-body-secondary fw-semibold">Giving share per girl in care (today)</div>
                  <div className="h4 mb-1 text-body-emphasis">
                    {outcomePerDollar.dollarsPerActiveResident == null
                      ? 'N/A'
                      : `$${outcomePerDollar.dollarsPerActiveResident.toLocaleString()}`}
                  </div>
                  <div className="small text-body-secondary">
                    {outcomePerDollar.activeResidentsNow.toLocaleString()} active residents (latest census)
                  </div>
                  {outcomePerDollar.dollarsPerActiveResident != null ? (
                    <p className="small text-body-secondary mb-0 mt-2">
                      If donations from the last 12 months were shared evenly across the{' '}
                      {outcomePerDollar.activeResidentsNow.toLocaleString()} girls currently in care, each girl&apos;s
                      share would be about{' '}
                      <strong>${outcomePerDollar.dollarsPerActiveResident.toLocaleString()}</strong> — a window into
                      the scale of support our donors collectively provide.
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="small text-body-secondary mb-0 mt-3">{outcomePerDollar.windowLabel}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm" aria-label="Your Giving In Action">
        <div className="card-body p-4 text-center">
          <p className="small text-body-secondary text-uppercase mb-2">Your Giving In Action</p>
          <h2 className="h3 mb-1">{givingInAction.headline}</h2>
          <div className="display-5 fw-semibold text-body-emphasis mb-2">
            {givingInAction.value == null ? 'N/A' : `$${givingInAction.value.toLocaleString()}`}
          </div>
          {givingInAction.value != null ? (
            <p className="small text-body-secondary mb-0">
              Spread across 12 months, that share works out to roughly{' '}
              <strong>${givingInAction.value.toLocaleString()}</strong> per month — an illustration of the ongoing
              commitment behind every girl&apos;s care, not a fixed sponsorship rate.
            </p>
          ) : (
            <p className="small text-body-secondary mb-0">{givingInAction.context}</p>
          )}
        </div>
      </section>

      <section className="card border-0 shadow-sm" aria-label="Your Impact in Action">
        <div className="card-body p-4">
          <h2 className="h5 mb-2">Your Impact in Action</h2>
          <p className="small text-body-secondary mb-3">
            This section shows where resources are going and what those services do for girls in care.
          </p>
          <div className="d-flex flex-column gap-2">
            {supportMix.length === 0 ? (
              <p className="small text-body-secondary mb-0">No support mix data in this response.</p>
            ) : (
              supportMix.map((m) => (
                <div key={m.name} className="lh-impact-trend-block">
                  <div className="d-flex justify-content-between align-items-center">
                    <span>{m.name}</span>
                    <strong>{m.value}%</strong>
                  </div>
                  <div className="lh-impact-trend-bar">
                    <span
                      style={{
                        width: `${animateCharts ? m.value : 0}%`,
                        transition: 'width 900ms ease-out',
                        background: m.color,
                      }}
                    ></span>
                  </div>
                  <div className="small text-body-secondary mt-1">
                    {supportMixDescriptions[m.name] ?? 'Program-area investment supporting resident care outcomes.'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Education card kept commented for potential reuse elsewhere.
      <section className="card border-0 shadow-sm" aria-label="Education">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h2 className="h5 mb-0">Education</h2>
            <small className="text-body-secondary">Case database education records</small>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-sm-6 col-lg-3">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-body-secondary">Avg progress (all-time)</div>
                <div className="h5 mb-0 text-body-emphasis">
                  {educationInsights.avgProgressAllTime == null ? 'N/A' : `${educationInsights.avgProgressAllTime}%`}
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-body-secondary">Residents with education records</div>
                <div className="h5 mb-0 text-body-emphasis">{educationInsights.distinctResidentsWithEducation.toLocaleString()}</div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-body-secondary">Total education rows</div>
                <div className="h5 mb-0 text-body-emphasis">{educationInsights.totalRecords.toLocaleString()}</div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-body-secondary">Rows with progress value</div>
                <div className="h5 mb-0 text-body-emphasis">{educationInsights.nonNullProgressRecords.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <h3 className="h6 mb-2">Monthly education progress (last 12 months)</h3>
          {educationInsights.monthlyTrend.length === 0 ? (
            <p className="small text-body-secondary mb-0">No monthly education trend data yet.</p>
          ) : (
            <div className="row g-2">
              {educationInsights.monthlyTrend.map((point) => (
                <div key={point.month} className="col-6 col-md-4 col-lg-2">
                  <div className="bg-body-tertiary rounded p-2 h-100">
                    <div className="small fw-semibold text-body-emphasis">{point.month}</div>
                    <div className="small text-body-secondary mb-1">
                      {point.avgProgress == null ? 'Progress: N/A' : `Progress: ${point.avgProgress}%`}
                    </div>
                    <div className="progress" style={{ height: 6 }} role="img" aria-label={`${point.month} education progress`}>
                      <div
                        className="progress-bar"
                        style={{
                          width: `${animateCharts ? Math.max(((point.avgProgress ?? 0) / educationTrendMax) * 100, point.avgProgress == null ? 0 : 4) : 0}%`,
                          transition: 'width 900ms ease-out',
                          backgroundColor: highlightColor,
                        }}
                      />
                    </div>
                    <div className="small text-body-secondary mt-1">Donations: ${point.donations.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      */}

      <section aria-label="Key metrics at a glance">
        <div className="row g-2 g-md-3">
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3 px-3">
              <div className="small text-body-secondary text-uppercase">Active supporters</div>
              <div className="h4 mb-0 text-body-emphasis">{kpis.livesImpacted.toLocaleString()}</div>
              <div className="small text-body-secondary mt-1">People currently standing with our mission</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3 px-3">
              <div className="small text-body-secondary text-uppercase">Active safehouses</div>
              <div className="h4 mb-0 text-body-emphasis">{kpis.safehouses.toLocaleString()}</div>
              <div className="small text-body-secondary mt-1">Homes currently providing frontline care</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3 px-3">
              <div className="small text-body-secondary text-uppercase">Partner programs</div>
              <div className="h4 mb-0 text-body-emphasis">{kpis.activePrograms.toLocaleString()}</div>
              <div className="small text-body-secondary mt-1">Programs helping girls heal and thrive</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            
            <div className="card-body py-3 px-3">
              <div className="small text-body-secondary text-uppercase">Closure / reintegration rate</div>
              <div className="h4 mb-0 text-body-emphasis">{kpis.successRate}%</div>
              <div className="small text-body-secondary mt-1">Girls who reached closure or reintegration</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3 px-3">
              <div className="small text-body-secondary text-uppercase">Donations (12 mo)</div>
              <div className="h4 mb-0 text-body-emphasis">${outcomeSignals.donationsLast12Months.toLocaleString()}</div>
              <div className="small text-body-secondary mt-1">Total giving invested in the last 12 months</div>
            </div>
          </div>
        </div>
        </div>
      </section>

      <section aria-label="Case flow and risk overview">
        <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="small text-body-secondary text-uppercase">Upcoming case conferences</div>
              <div className="display-6 fw-semibold text-body-emphasis">{upcomingCaseConferences.next30Days.toLocaleString()}</div>
              <div className="small text-body-secondary">{upcomingCaseConferences.windowLabel}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h6 mb-3">Current resident risk levels</h2>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge rounded-pill text-bg-success">Low: {riskLevels.low.toLocaleString()}</span>
                <span className="badge rounded-pill text-bg-warning">Medium: {riskLevels.medium.toLocaleString()}</span>
                <span className="badge rounded-pill" style={{ backgroundColor: 'var(--bs-orange)', color: 'var(--bs-white)' }}>
                  High: {riskLevels.high.toLocaleString()}
                </span>
                <span className="badge rounded-pill text-bg-danger">Critical: {riskLevels.critical.toLocaleString()}</span>
              </div>
              <p className="small text-body-secondary mb-0 mt-3">
                This view helps donors understand the current complexity of care needs across the program.
              </p>
            </div>
          </div>
        </div>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">Where Your Donation Goes</h2>
              <p className="small text-body-secondary mb-3">
                This shows how recorded donations are allocated across program areas in the database.
              </p>
              <div className="d-flex flex-column gap-2">
                {allocationBreakdown.length === 0 ? (
                  <p className="small text-body-secondary mb-0">No allocation records yet.</p>
                ) : (
                  allocationBreakdown.map((row) => (
                    <div key={row.programArea} className="bg-body-tertiary rounded p-2">
                      <div className="d-flex justify-content-between">
                        <strong>{row.programArea}</strong>
                        <span>${row.amountAllocated.toLocaleString()}</span>
                      </div>
                      <div className="small text-body-secondary">{row.allocationCount} allocations</div>
                      <div className="progress mt-2" role="img" aria-label={`${row.programArea} allocation amount`}>
                        <div
                          className="progress-bar"
                          style={{
                            width: `${animateCharts ? Math.max((row.amountAllocated / totalAllocationAmount) * 100, 2) : 0}%`,
                            transition: 'width 900ms ease-out',
                            backgroundColor:
                              row.amountAllocated === Math.max(...allocationBreakdown.map((a) => a.amountAllocated))
                                ? highlightColor
                                : mutedBarFill
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="small text-body-secondary mb-0 mt-3">
                <strong>Why this matters:</strong> donors can see exactly how giving is translated into real services.
              </p>
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">Donor Momentum</h2>
              <p className="small text-body-secondary mb-3">
                Consistent giving helps us keep staffing, shelter, and case planning stable month after month.
              </p>
              <div className="row g-2">
                <div className="col-6">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-body-secondary">Distinct donors (12 months)</div>
                    <div className="h5 mb-0 text-body-emphasis">{outcomeSignals.donorsLast12Months.toLocaleString()}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-body-secondary">Average gift (12 months)</div>
                    <div className="h5 mb-0 text-body-emphasis">
                      {outcomeSignals.avgDonationAmountLast12Months == null
                        ? 'N/A'
                        : `$${outcomeSignals.avgDonationAmountLast12Months.toLocaleString()}`}
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className="bg-body-tertiary rounded p-3">
                    <div className="small text-body-secondary">Donors active (last 90 days)</div>
                    <div className="h5 mb-0 text-body-emphasis">{donorOkrs.donorsLast90Days.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <p className="small text-body-secondary mb-0 mt-3">{donorOkrs.windowLabel}</p>
            </div>
          </div>
        </div>
        <div className="col-12">
          <div className="card border border-secondary-subtle shadow-sm lh-impact-pipeline-card">
            <div className="card-body p-4">
              <h2 className="h4 mb-2 text-body-emphasis">Resident Journey Pipeline</h2>
              <p className="small text-body-secondary mb-3">
                A stage view of how girls are progressing through care and reintegration.
              </p>
              <div className="d-flex flex-wrap align-items-center gap-2">
                {pipelineStages.map((stage, idx) => (
                  <div key={stage.key} className="d-flex align-items-center">
                    <div
                      className="rounded-3 p-3 text-center bg-body-secondary border border-secondary-subtle shadow-sm lh-impact-pipeline-stage"
                      style={{ minWidth: 132 }}
                    >
                      <div className="small fw-medium text-body-emphasis lh-sm">{stage.label}</div>
                      <div className="fs-5 fw-semibold text-body-emphasis mt-1">{stage.value.toLocaleString()}</div>
                      <div className="progress mt-2 bg-secondary-subtle" style={{ height: 6 }} role="presentation">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${animateCharts ? Math.max((stage.value / maxPipelineValue) * 100, stage.value > 0 ? 6 : 0) : 0}%`,
                            transition: 'width 900ms ease-out',
                            backgroundColor: highlightColor,
                          }}
                        />
                      </div>
                    </div>
                    {idx < pipelineStages.length - 1 ? (
                      <div className="mx-1 mx-sm-2 fs-5 text-body-secondary" aria-hidden>
                        →
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h4 mb-2">Supporters Who Continue Giving</h2>
              <div className="lh-impact-mini-chart">
                {retention.map((d, idx) => (
                  <div key={`${d.month}-${idx}`} className="lh-impact-mini-col text-center">
                    <div className="small fw-semibold text-body-emphasis mb-1" title={`Retention ${d.month}: ${d.rate}%`}>
                      {d.rate}%
                    </div>
                    <div className="lh-impact-mini-bar-wrap">
                      <span
                        className="lh-impact-mini-bar"
                        style={{
                          height: `${animateCharts ? Math.max(d.rate, 6) : 0}%`,
                          transition: 'height 900ms ease-out',
                        }}
                      ></span>
                    </div>
                    <small className="text-body-secondary">{d.month}</small>
                  </div>
                ))}
              </div>
              <p className="text-body-secondary mb-0 mt-3 small">
                {retentionHeadline?.kind === 'undefined' && (
                  <>
                    For <strong>{retentionHeadline.monthLabel}</strong>, repeat rate is not defined yet because there were no prior-month donors.
                  </>
                )}
                {retentionHeadline?.kind === 'pct' && retentionHeadline.prior != null && retentionHeadline.returning != null && (
                  <>
                    Latest repeat rate is <strong className="text-body-emphasis">{retentionHeadline.value}%</strong> — {retentionHeadline.returning.toLocaleString()} of{' '}
                    {retentionHeadline.prior.toLocaleString()} prior-month supporters gave again.
                  </>
                )}
                {retentionHeadline?.kind === 'pct' && retentionHeadline.prior == null && (
                  <>
                    Latest month repeat rate is <strong className="text-body-emphasis">{retentionHeadline.value}%</strong>.
                  </>
                )}
                {!retentionHeadline && (
                  <>
                    We need at least two months of donation history to display supporter repeat rate.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm" aria-label="Spreading the Word">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h2 className="h5 mb-0">Spreading the Word</h2>
            <small className="text-body-secondary">{spreadingTheWord.windowLabel}</small>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-body-secondary text-uppercase">Social-channel giving (rolling 90 days)</div>
                <div className="h4 mb-1 text-body-emphasis">${socialGivingAmount.toLocaleString()}</div>
                <div className="small text-body-secondary">
                  {socialGivingCount.toLocaleString()} gift{socialGivingCount === 1 ? '' : 's'} recorded with channel &quot;SocialMedia&quot;
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-body-secondary text-uppercase">Largest share of social gifts (rolling 90 days)</div>
                {socialGivingCount === 0 ? (
                  <div className="small text-body-secondary mt-2 mb-0">No social-channel donations in the last 90 days yet.</div>
                ) : platformIsUnlabeled ? (
                  <>
                    <div className="fw-semibold text-body-emphasis mt-1">Platform not detected in text</div>
                    <div className="small text-body-secondary mt-1 mb-0">
                      Add platform names (Instagram, Facebook, TikTok, etc.) in campaign or notes so we can show which app drove each gift.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h4 mb-1 text-body-emphasis">
                      {spreadingTheWord.mostEffectivePlatform}{' '}
                      <span className="fs-6 text-body-secondary">({spreadingTheWord.mostEffectivePlatformSharePct}% of last 90 days&apos; social gifts)</span>
                    </div>
                    {platformBreakdown.length > 0 ? (
                      <ul className="small text-body-secondary mb-0 ps-3">
                        {platformBreakdown.map((row) => (
                          <li key={row.platform}>
                            <span className="text-body-emphasis">{row.platform}</span>: {row.sharePct}% of dollars (
                            {row.giftCount} gift{row.giftCount === 1 ? '' : 's'}, ${row.totalAmount.toLocaleString()})
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <div className="col-12">
              <div className="bg-body-tertiary rounded p-3">
                <div className="small text-body-secondary text-uppercase">Gifts tied to a specific social post</div>
                <div className="h5 mb-0 text-body-emphasis">{spreadingTheWord.donationReferralsFromSocialPosts.toLocaleString()}</div>
                <div className="small text-body-secondary mt-1 mb-0">
                  {spreadingTheWord.donationReferralsFromSocialPosts === 0
                    ? 'When a donation is linked to a specific social post, it will show up here.'
                    : 'Donations in this window that are linked to a specific social post.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
