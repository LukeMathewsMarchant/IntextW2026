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
  chips?: string[]
  kpis?: { livesImpacted: number; safehouses: number; activePrograms: number; successRate: number }
  retention?: RetentionPoint[]
  retentionDetail?: RetentionDetail | null
  supportMix?: MixPoint[]
  dataFreshness?: {
    generatedAtUtc: string
    latestSafehouseMetricMonth: string | null
    /** Rolling case-activity window for safehouse comparison (UTC). */
    operationalCaseWindow?: string | null
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
    return <div className="text-secondary">Loading impact data...</div>
  }
  const chips = data.chips ?? []
  const kpis = data.kpis ?? { livesImpacted: 0, safehouses: 0, activePrograms: 0, successRate: 0 }
  const retention = data.retention ?? []
  const retentionDetail = data.retentionDetail ?? null
  const supportMix = data.supportMix ?? []
  const freshness = data.dataFreshness ?? { generatedAtUtc: new Date().toISOString(), latestSafehouseMetricMonth: null }
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
  const educationInsights = data.educationInsights ?? {
    avgProgressAllTime: null,
    totalRecords: 0,
    nonNullProgressRecords: 0,
    distinctResidentsWithEducation: 0,
    monthlyTrend: [] as Array<{ month: string; avgProgress: number | null; donations: number }>,
  }
  const donationChannels = data.donationChannelPerformance ?? []
  const socialPostTraction = data.socialPostTraction ?? []
  const allocationBreakdown = data.donationAllocationBreakdown ?? []
  const socialPlatformPerformance = data.socialMediaPlatformPerformance ?? []
  const socialAllocationBreakdown = data.socialMediaAllocationBreakdown ?? []
  const normalizeSocialApp = (raw: string) => {
    const name = raw.trim()
    const lower = name.toLowerCase()
    if (!name || /unknown|unlabeled|not set|n\/a/.test(lower)) return 'Unknown/Unlabeled'
    if (/instagram|insta/.test(lower)) return 'Instagram'
    if (/facebook|fb/.test(lower)) return 'Facebook'
    if (/tiktok|tik tok/.test(lower)) return 'TikTok'
    if (/youtube|yt/.test(lower)) return 'YouTube'
    if (/x\/twitter|twitter|x$/.test(lower)) return 'X / Twitter'
    return name
  }

  const buckets = new Map<string, { channel: string; donations: number; totalAmount: number }>()
  socialPlatformPerformance.forEach((row) => {
    const channel = normalizeSocialApp(row.channel)
    const current = buckets.get(channel)
    if (current) {
      current.donations += row.donations
      current.totalAmount += row.totalAmount
    } else {
      buckets.set(channel, { channel, donations: row.donations, totalAmount: row.totalAmount })
    }
  })

  let normalizedSocialPlatformPerformance = Array.from(buckets.values())
    .map((row) => ({ ...row, share: 0 }))
    .sort((a, b) => b.totalAmount - a.totalAmount)

  const socialTotal = normalizedSocialPlatformPerformance.reduce((sum, row) => sum + row.totalAmount, 0)
  normalizedSocialPlatformPerformance = normalizedSocialPlatformPerformance.map((row) => ({
    ...row,
    share: socialTotal <= 0 ? 0 : Math.round((row.totalAmount / socialTotal) * 10000) / 100,
  }))

  const large = normalizedSocialPlatformPerformance.filter((row) => row.share >= 5)
  const small = normalizedSocialPlatformPerformance.filter((row) => row.share < 5)
  if (small.length > 1) {
    const other = small.reduce(
      (acc, row) => ({
        channel: 'Other',
        donations: acc.donations + row.donations,
        totalAmount: acc.totalAmount + row.totalAmount,
        share: acc.share + row.share,
      }),
      { channel: 'Other', donations: 0, totalAmount: 0, share: 0 }
    )
    normalizedSocialPlatformPerformance = [...large, other].sort((a, b) => b.totalAmount - a.totalAmount)
  }

  if (normalizedSocialPlatformPerformance.length > 5) {
    const keep = normalizedSocialPlatformPerformance.slice(0, 4)
    const tail = normalizedSocialPlatformPerformance.slice(4)
    const other = tail.reduce(
      (acc, row) => ({
        channel: 'Other',
        donations: acc.donations + row.donations,
        totalAmount: acc.totalAmount + row.totalAmount,
        share: acc.share + row.share,
      }),
      { channel: 'Other', donations: 0, totalAmount: 0, share: 0 }
    )
    normalizedSocialPlatformPerformance = [...keep, other]
  }
  const donationChannelAmountRaw = donationChannels.reduce((sum, row) => sum + row.totalAmount, 0)
  const totalDonationChannelAmount = donationChannelAmountRaw || 1
  const socialPlatformAmountRaw = normalizedSocialPlatformPerformance.reduce((sum, row) => sum + row.totalAmount, 0)
  const totalSocialPlatformAmount = socialPlatformAmountRaw || 1
  const maxSocialPlatformAmount =
    normalizedSocialPlatformPerformance.length > 0
      ? Math.max(...normalizedSocialPlatformPerformance.map((s) => s.totalAmount))
      : 1
  const maxPostDonationValue = socialPostTraction.length > 0 ? Math.max(...socialPostTraction.map((row) => row.donationValue)) : 1
  const postDonationValueRaw = socialPostTraction.reduce((sum, row) => sum + row.donationValue, 0)
  const totalPostDonationValue = postDonationValueRaw || 1
  const allocationAmountRaw = allocationBreakdown.reduce((sum, row) => sum + row.amountAllocated, 0)
  const totalAllocationAmount = allocationAmountRaw || 1
  const socialAllocationAmountRaw = socialAllocationBreakdown.reduce((sum, row) => sum + row.amountAllocated, 0)
  const totalSocialAllocationAmount = socialAllocationAmountRaw || 1
  const socialAppsChartHeightPx = 460
  const educationTrendMax = educationInsights.monthlyTrend.length > 0
    ? Math.max(...educationInsights.monthlyTrend.map((p) => p.avgProgress ?? 0), 1)
    : 1
  const highlightColor = '#f3b11d'
  const mutedColor = '#c3c8d1'

  return (
    <div className="vstack gap-4">
      <section className="lh-impact lh-impact-page-hero">
        <p className="lh-impact-kicker text-center mb-2">Impact Dashboard</p>
        <h1 className="lh-impact-title text-center mb-2">From Crisis to Reintegration</h1>
        <p className="lh-section-sub text-center mb-3">
          Operational snapshot from your case data: donations, channels, programs, and resident outcomes.
        </p>
        <div className="d-flex flex-wrap justify-content-center gap-2 text-center">
          {chips.map((chip) => (
            <span key={chip} className="lh-impact-chip">{chip}</span>
          ))}
        </div>
        <p className="text-secondary small text-center mt-3 mb-0">
          Data freshness: generated {new Date(freshness.generatedAtUtc).toLocaleString()} UTC
          {freshness.operationalCaseWindow ? ` | case activity window: ${freshness.operationalCaseWindow}` : ''}
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
                    <div className="small text-secondary text-uppercase">In care now</div>
                    <div className="h4 mb-1 text-dark">{impactNarrative.inCareNow.toLocaleString()}</div>
                    <div className="small text-secondary">Active resident census</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary text-uppercase">Recent incidents</div>
                    <div className="h4 mb-1 text-dark">{impactNarrative.recentIncidents.toLocaleString()}</div>
                    <div className="small text-secondary">Current 30-day window</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary text-uppercase">Reintegrations (90d)</div>
                    <div className="h4 mb-1 text-dark">{impactNarrative.recentReintegrations.toLocaleString()}</div>
                    <div className="small text-secondary">
                      {impactNarrative.closureShareOfActivePct}% of active census
                    </div>
                  </div>
                </div>
              </div>
              <p className="small text-secondary mb-0 mt-3">{impactNarrative.storyWindowLabel}</p>
            </div>
            <div className="col-lg-5">
              <h2 className="h5 mb-3">Outcome per dollar lens</h2>
              <div className="d-flex flex-column gap-2">
                <div className="bg-body-tertiary rounded p-3">
                  <div className="small text-secondary text-uppercase">Dollars per reintegrated case</div>
                  <div className="h4 mb-1 text-dark">
                    {outcomePerDollar.dollarsPerReintegration == null
                      ? 'N/A'
                      : `$${outcomePerDollar.dollarsPerReintegration.toLocaleString()}`}
                  </div>
                  <div className="small text-secondary">
                    ${outcomePerDollar.donationsLast12Months.toLocaleString()} / {outcomePerDollar.reintegrationsLast12Months.toLocaleString()} reintegrations
                  </div>
                </div>
                <div className="bg-body-tertiary rounded p-3">
                  <div className="small text-secondary text-uppercase">Dollars per active resident</div>
                  <div className="h4 mb-1 text-dark">
                    {outcomePerDollar.dollarsPerActiveResident == null
                      ? 'N/A'
                      : `$${outcomePerDollar.dollarsPerActiveResident.toLocaleString()}`}
                  </div>
                  <div className="small text-secondary">
                    {outcomePerDollar.activeResidentsNow.toLocaleString()} active residents in latest census
                  </div>
                </div>
              </div>
              <p className="small text-secondary mb-0 mt-3">{outcomePerDollar.windowLabel}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm" aria-label="Live trends from API">
        <div className="card-body p-4">
          <h2 className="h5 mb-2">Live trends &amp; snapshot</h2>
          <div className="row g-4 align-items-stretch">
            <div className="col-lg-7">
              <h3 className="h6 mb-2">Supporter repeat rate by month</h3>
              <div className="lh-impact-mini-chart">
                {retention.map((d, idx) => (
                  <div key={`${d.month}-${idx}`} className="lh-impact-mini-col text-center">
                    <div className="small fw-semibold text-dark mb-1" title={`Retention ${d.month}: ${d.rate}%`}>
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
                    <small className="text-secondary">{d.month}</small>
                  </div>
                ))}
              </div>
              {retention.length === 0 ? (
                <p className="small text-secondary mb-0">Not enough monthly donation history yet to plot retention.</p>
              ) : null}
            </div>
            <div className="col-lg-5">
              <h3 className="h6 mb-2">Where support goes (program mix)</h3>
              <div className="d-flex flex-column gap-2">
                {supportMix.length === 0 ? (
                  <p className="small text-secondary mb-0">No support mix data in this response.</p>
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
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm" aria-label="Education">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h2 className="h5 mb-0">Education</h2>
            <small className="text-secondary">Case database education records</small>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-sm-6 col-lg-3">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-secondary">Avg progress (all-time)</div>
                <div className="h5 mb-0 text-body-emphasis">
                  {educationInsights.avgProgressAllTime == null ? 'N/A' : `${educationInsights.avgProgressAllTime}%`}
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-secondary">Residents with education records</div>
                <div className="h5 mb-0 text-body-emphasis">{educationInsights.distinctResidentsWithEducation.toLocaleString()}</div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-secondary">Total education rows</div>
                <div className="h5 mb-0 text-body-emphasis">{educationInsights.totalRecords.toLocaleString()}</div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-body-tertiary rounded p-3 h-100">
                <div className="small text-secondary">Rows with progress value</div>
                <div className="h5 mb-0 text-body-emphasis">{educationInsights.nonNullProgressRecords.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <h3 className="h6 mb-2">Monthly education progress (last 12 months)</h3>
          {educationInsights.monthlyTrend.length === 0 ? (
            <p className="small text-secondary mb-0">No monthly education trend data yet.</p>
          ) : (
            <div className="row g-2">
              {educationInsights.monthlyTrend.map((point) => (
                <div key={point.month} className="col-6 col-md-4 col-lg-2">
                  <div className="bg-body-tertiary rounded p-2 h-100">
                    <div className="small fw-semibold text-body-emphasis">{point.month}</div>
                    <div className="small text-secondary mb-1">
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
                    <div className="small text-secondary mt-1">Donations: ${point.donations.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="row g-2 g-md-3" aria-label="Key metrics at a glance">
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3 px-3">
              <div className="small text-secondary text-uppercase">Active supporters</div>
              <div className="h4 mb-0 text-dark">{kpis.livesImpacted.toLocaleString()}</div>
              <div className="small text-secondary mt-1">Supporters with status Active</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3 px-3">
              <div className="small text-secondary text-uppercase">Active safehouses</div>
              <div className="h4 mb-0 text-dark">{kpis.safehouses.toLocaleString()}</div>
              <div className="small text-secondary mt-1">In network (status Active)</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3 px-3">
              <div className="small text-secondary text-uppercase">Partner programs</div>
              <div className="h4 mb-0 text-dark">{kpis.activePrograms.toLocaleString()}</div>
              <div className="small text-secondary mt-1">Partner records in case data</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            
            <div className="card-body py-3 px-3">
              <div className="small text-secondary text-uppercase">Closure / reintegration rate</div>
              <div className="h4 mb-0 text-dark">{kpis.successRate}%</div>
              <div className="small text-secondary mt-1">Residents closed or reintegrated</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-lg">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3 px-3">
              <div className="small text-secondary text-uppercase">Donations (12 mo)</div>
              <div className="h4 mb-0 text-dark">${outcomeSignals.donationsLast12Months.toLocaleString()}</div>
              <div className="small text-secondary mt-1">Sum of recorded amounts</div>
            </div>
          </div>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">Social Media & Donation Intelligence</h2>
              <p className="small text-secondary mb-3">
                Answers: which channel drives donations, which post labels convert best, and where donated funds are allocated.
              </p>
              <div className="row g-3">
                <div className="col-lg-4">
                  <h3 className="h6 mb-2">Donations by Channel Source <span className="text-secondary">(${donationChannelAmountRaw.toLocaleString()} total)</span></h3>
                  <div className="d-flex flex-column gap-2">
                    {donationChannels.length === 0 ? (
                      <p className="small text-secondary mb-0">No donation channel data yet.</p>
                    ) : donationChannels.map((row) => (
                      <div key={row.channel} className="bg-body-tertiary rounded p-2">
                        <div className="d-flex justify-content-between"><strong>{row.channel}</strong><span>{row.share}%</span></div>
                        <div className="small text-secondary">{row.donations} donations | ${row.totalAmount.toLocaleString()}</div>
                        <div className="progress mt-2" role="img" aria-label={`${row.channel} total donation value`}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${animateCharts ? Math.max((row.totalAmount / totalDonationChannelAmount) * 100, 2) : 0}%`,
                              transition: 'width 900ms ease-out',
                              backgroundColor: row.totalAmount === Math.max(...donationChannels.map((d) => d.totalAmount)) ? highlightColor : mutedColor
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-lg-4">
                  <h3 className="h6 mb-2">Top Converting Post / Campaign Labels <span className="text-secondary">(${postDonationValueRaw.toLocaleString()} total)</span></h3>
                  <div className="d-flex flex-column gap-2">
                    {socialPostTraction.length === 0 ? (
                      <p className="small text-secondary mb-0">No post-linked donation data yet.</p>
                    ) : socialPostTraction.map((row) => (
                      <div key={row.postLabel} className="bg-body-tertiary rounded p-2">
                        <div className="fw-semibold">{row.postLabel}</div>
                        <div className="small text-secondary">{row.referrals} referrals | ${row.donationValue.toLocaleString()} total</div>
                        <div className="progress mt-2" role="img" aria-label={`${row.postLabel} campaign donation value`}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${animateCharts ? Math.max((row.donationValue / totalPostDonationValue) * 100, 2) : 0}%`,
                              transition: 'width 900ms ease-out',
                              backgroundColor: row.donationValue === maxPostDonationValue ? highlightColor : mutedColor
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-lg-4">
                  <h3 className="h6 mb-2">Donation Allocation Breakdown <span className="text-secondary">(${allocationAmountRaw.toLocaleString()} total)</span></h3>
                  <div className="d-flex flex-column gap-2">
                    {allocationBreakdown.length === 0 ? (
                      <p className="small text-secondary mb-0">No allocation records yet.</p>
                    ) : allocationBreakdown.map((row) => (
                      <div key={row.programArea} className="bg-body-tertiary rounded p-2">
                        <div className="d-flex justify-content-between"><strong>{row.programArea}</strong><span>${row.amountAllocated.toLocaleString()}</span></div>
                        <div className="small text-secondary">{row.allocationCount} allocations</div>
                        <div className="progress mt-2" role="img" aria-label={`${row.programArea} allocation amount`}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${animateCharts ? Math.max((row.amountAllocated / totalAllocationAmount) * 100, 2) : 0}%`,
                              transition: 'width 900ms ease-out',
                              backgroundColor: row.amountAllocated === Math.max(...allocationBreakdown.map((a) => a.amountAllocated)) ? highlightColor : mutedColor
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">Social Media Donations: App Performance and Allocation</h2>
              <p className="small text-secondary mb-3">Shows which social apps convert and where those social-source funds are allocated.</p>
              <div className="row g-3">
                <div className="col-lg-6">
                  <h3 className="h6 mb-2">Apps Driving Social Donations <span className="text-secondary">(${socialPlatformAmountRaw.toLocaleString()} total)</span></h3>
                  {normalizedSocialPlatformPerformance.length === 0 ? (
                    <p className="small text-secondary mb-0">No social-media-labeled donation data yet.</p>
                  ) : (
                    <div className="bg-body-tertiary rounded p-3">
                      <div
                        className="d-flex gap-2 align-items-stretch"
                        style={{ height: `${socialAppsChartHeightPx}px` }}
                        role="img"
                        aria-label="Apps driving social donations vertical chart"
                      >
                        {normalizedSocialPlatformPerformance.map((row) => (
                          <div key={row.channel} className="d-flex flex-column align-items-center flex-fill h-100">
                            <div className="small fw-semibold text-dark mb-1">{row.share}%</div>
                            <div className="d-flex align-items-end justify-content-center w-100 flex-grow-1">
                              <div
                                className="rounded-top"
                                style={{
                                  width: '62%',
                                  height: `${animateCharts ? Math.max((row.totalAmount / totalSocialPlatformAmount) * 100, 6) : 0}%`,
                                  transition: 'height 900ms ease-out',
                                  backgroundColor: row.totalAmount === maxSocialPlatformAmount ? highlightColor : mutedColor,
                                  minHeight: animateCharts ? '2rem' : 0,
                                }}
                                title={`${row.channel}: ${row.donations} donations, $${row.totalAmount.toLocaleString()}`}
                              />
                            </div>
                            <div className="small text-center mt-2 text-dark fw-semibold text-break">{row.channel}</div>
                            <div className="small text-secondary text-center">
                              {row.donations} | ${row.totalAmount.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-lg-6">
                  <h3 className="h6 mb-2">Where Social Donations Go <span className="text-secondary">(${socialAllocationAmountRaw.toLocaleString()} total)</span></h3>
                  <div className="d-flex flex-column gap-2">
                    {socialAllocationBreakdown.length === 0 ? (
                      <p className="small text-secondary mb-0">No allocations linked to social-source donations yet.</p>
                    ) : socialAllocationBreakdown.map((row) => (
                      <div key={row.programArea} className="bg-body-tertiary rounded p-2">
                        <div className="d-flex justify-content-between"><strong>{row.programArea}</strong><span>${row.amountAllocated.toLocaleString()}</span></div>
                        <div className="small text-secondary">{row.allocationCount} allocations</div>
                        <div className="progress mt-2" role="img" aria-label={`${row.programArea} social allocation amount`}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${animateCharts ? Math.max((row.amountAllocated / totalSocialAllocationAmount) * 100, 2) : 0}%`,
                              transition: 'width 900ms ease-out',
                              backgroundColor: row.amountAllocated === Math.max(...socialAllocationBreakdown.map((a) => a.amountAllocated)) ? highlightColor : mutedColor
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h2 className="h4 mb-0">Donation Allocation vs Outcome Signals</h2>
                <small className="text-secondary">
                  Donation value, donor count, and average gift: last 12 months. Residents and incidents: current operational window.
                </small>
              </div>
              <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-5 g-3">
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary">Donations (last 12 months)</div>
                    <div className="h5 mb-0">${outcomeSignals.donationsLast12Months.toLocaleString()}</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary">Active residents (census)</div>
                    <div className="h5 mb-0">{outcomeSignals.activeResidentsLatest.toLocaleString()}</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary">Incidents (last 30 days)</div>
                    <div className="h5 mb-0">{outcomeSignals.incidentsLatest.toLocaleString()}</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary">Distinct donors (12 months)</div>
                    <div className="h5 mb-0">{outcomeSignals.donorsLast12Months.toLocaleString()}</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary">Avg donation amount (12 months)</div>
                    <div className="h5 mb-0">
                      {outcomeSignals.avgDonationAmountLast12Months == null
                        ? 'N/A'
                        : `$${outcomeSignals.avgDonationAmountLast12Months.toLocaleString()}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">Retention Trend</h2>
              <p className="text-secondary mb-0 mt-3 small">
                {retentionHeadline?.kind === 'undefined' && (
                  <>
                    Month-over-month repeat rate for <strong>{retentionHeadline.monthLabel}</strong>:{' '}
                    <strong className="text-dark">not defined</strong> — there were no supporters who donated in the{' '}
                    <em>prior</em> calendar month, so “% who came back” has no denominator.
                  </>
                )}
                {retentionHeadline?.kind === 'pct' && retentionHeadline.prior != null && retentionHeadline.returning != null && (
                  <>
                    Repeat rate for <strong>{retentionHeadline.monthLabel}</strong>:{' '}
                    <strong className="text-dark">{retentionHeadline.value}%</strong>{' '}
                    ({retentionHeadline.returning.toLocaleString()} of {retentionHeadline.prior.toLocaleString()} prior-month supporters gave again).
                  </>
                )}
                {retentionHeadline?.kind === 'pct' && retentionHeadline.prior == null && (
                  <>
                    Latest month on chart (repeat rate): <strong className="text-dark">{retentionHeadline.value}%</strong>
                    {retentionHeadline.monthLabel ? ` (${retentionHeadline.monthLabel})` : ''}.
                  </>
                )}
                {!retentionHeadline && (
                  <>
                    Month-over-month repeat rate is not shown yet — we need at least two months of supporter donation history to compute it (it is not the same as total donors in the latest month).
                  </>
                )}
              </p>
              {retentionDetail && (
                <div className="border-top pt-3 mt-3">
                  <h3 className="h6 mb-2">Latest month ({retentionDetail.monthLabel})</h3>
                  <p className="small text-secondary mb-2">
                    Unique supporters = distinct donor IDs with at least one gift in that calendar month. “Returning” gave in the prior month too; the others had no gift in the prior month (often new or lapsed).
                  </p>
                  <div className="row g-2 small">
                    <div className="col-sm-6 col-md-4">
                      <div className="bg-body-tertiary rounded p-2 h-100">
                        <div className="text-secondary">Unique supporters</div>
                        <div className="fw-semibold">{retentionDetail.uniqueSupportersThisMonth.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="col-sm-6 col-md-4">
                      <div className="bg-body-tertiary rounded p-2 h-100">
                        <div className="text-secondary">Donation rows</div>
                        <div className="fw-semibold">{retentionDetail.donationRowsThisMonth.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="col-sm-6 col-md-4">
                      <div className="bg-body-tertiary rounded p-2 h-100">
                        <div className="text-secondary">Prior month supporters</div>
                        <div className="fw-semibold">{retentionDetail.uniqueSupportersPriorMonth.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="col-sm-6 col-md-4">
                      <div className="bg-body-tertiary rounded p-2 h-100">
                        <div className="text-secondary">Returning (both months)</div>
                        <div className="fw-semibold text-dark">{retentionDetail.returningSupporters.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="col-sm-6 col-md-4">
                      <div className="bg-body-tertiary rounded p-2 h-100">
                        <div className="text-secondary">No gift prior month</div>
                        <div className="fw-semibold">{retentionDetail.noGiftInPriorMonth.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-12">
          <div
            className="card shadow-sm h-100 overflow-hidden"
            style={{ borderLeft: `4px solid ${highlightColor}` }}
            aria-label="Donor churn OKR from donation records"
          >
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
                <h2 className="h4 mb-0">Donor churn (OKR view)</h2>
                <small className="text-secondary">{donorOkrs.windowLabel}</small>
              </div>
              <p className="text-secondary small mb-3">{donorOkrs.summary}</p>
              <div className="row g-3 align-items-stretch">
                <div className="col-sm-6 col-xl-4">
                  <div className="rounded p-3 h-100" style={{ background: 'rgba(243, 177, 29, 0.15)' }}>
                    <div className="small text-secondary text-uppercase fw-semibold mb-1">Churn risk (12→90 day)</div>
                    <div className="display-6 fw-semibold text-dark">{donorOkrs.churnRatePct}%</div>
                    <div className="small text-secondary mt-2">
                      {donorOkrs.donorsStaleYearNot90.toLocaleString()} of {donorOkrs.donorsLast365Days.toLocaleString()} year donors
                      with no gift in the last 90 days.
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-xl-4">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary">Donors active (last 90 days)</div>
                    <div className="h3 mb-0 text-dark">{donorOkrs.donorsLast90Days.toLocaleString()}</div>
                    <div className="small text-secondary mt-2">Distinct supporters with ≥1 donation in the rolling 90-day window.</div>
                  </div>
                </div>
                <div className="col-sm-12 col-xl-4">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary">12-month donor cohort</div>
                    <div className="h3 mb-0 text-dark">{donorOkrs.donorsLast365Days.toLocaleString()}</div>
                    <div className="small text-secondary mt-2">
                      All-time distinct donors with a gift on record: {donorOkrs.distinctDonorsAllTime.toLocaleString()}. Pair with the
                      retention chart for month-over-month repeat behavior.
                    </div>
                  </div>
                </div>
              </div>
              <p className="small text-secondary mb-0 mt-3">
                <strong>Other questions to explore:</strong> channel quality past 90 days, gift-size upgrades, reactivation after lapses.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
