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
    activeResidentsLatest: number
    incidentsLatest: number
    avgEducationLatest: number | null
    avgHealthLatest: number | null
  }
  safehousePerformance?: SafehouseDeltaPoint[]
  donorOkrs?: DonorOkrs
  donationChannelPerformance?: ChannelPerformancePoint[]
  socialPostTraction?: PostTractionPoint[]
  donationAllocationBreakdown?: AllocationPoint[]
  socialMediaPlatformPerformance?: ChannelPerformancePoint[]
  socialMediaAllocationBreakdown?: AllocationPoint[]
  metricDefinitions?: Array<{ key: string; label: string; definition: string }>
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
  const outcomeSignals = data.outcomeSignals ?? {
    donationsLast12Months: 0,
    activeResidentsLatest: 0,
    incidentsLatest: 0,
    avgEducationLatest: null,
    avgHealthLatest: null
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
  const donationChannels = data.donationChannelPerformance ?? []
  const socialPostTraction = data.socialPostTraction ?? []
  const allocationBreakdown = data.donationAllocationBreakdown ?? []
  const socialPlatformPerformance = data.socialMediaPlatformPerformance ?? []
  const socialAllocationBreakdown = data.socialMediaAllocationBreakdown ?? []
  const metricDefinitions = data.metricDefinitions ?? []
  const donationChannelAmountRaw = donationChannels.reduce((sum, row) => sum + row.totalAmount, 0)
  const totalDonationChannelAmount = donationChannelAmountRaw || 1
  const socialPlatformAmountRaw = socialPlatformPerformance.reduce((sum, row) => sum + row.totalAmount, 0)
  const totalSocialPlatformAmount = socialPlatformAmountRaw || 1
  const maxPostDonationValue = socialPostTraction.length > 0 ? Math.max(...socialPostTraction.map((row) => row.donationValue)) : 1
  const postDonationValueRaw = socialPostTraction.reduce((sum, row) => sum + row.donationValue, 0)
  const totalPostDonationValue = postDonationValueRaw || 1
  const allocationAmountRaw = allocationBreakdown.reduce((sum, row) => sum + row.amountAllocated, 0)
  const totalAllocationAmount = allocationAmountRaw || 1
  const socialAllocationAmountRaw = socialAllocationBreakdown.reduce((sum, row) => sum + row.amountAllocated, 0)
  const totalSocialAllocationAmount = socialAllocationAmountRaw || 1
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
                  <div className="d-flex flex-column gap-2">
                    {socialPlatformPerformance.length === 0 ? (
                      <p className="small text-secondary mb-0">No social-media-labeled donation data yet.</p>
                    ) : socialPlatformPerformance.map((row) => (
                      <div key={row.channel} className="bg-body-tertiary rounded p-2">
                        <div className="d-flex justify-content-between"><strong>{row.channel}</strong><span>{row.share}%</span></div>
                        <div className="small text-secondary">{row.donations} donations | ${row.totalAmount.toLocaleString()}</div>
                        <div className="progress mt-2" role="img" aria-label={`${row.channel} social donations`}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${animateCharts ? Math.max((row.totalAmount / totalSocialPlatformAmount) * 100, 2) : 0}%`,
                              transition: 'width 900ms ease-out',
                              backgroundColor: row.totalAmount === Math.max(...socialPlatformPerformance.map((s) => s.totalAmount)) ? highlightColor : mutedColor
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
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
                  Donations: last 12 months. Residents / incidents / education / health: from case records in the current operational window (see header).
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
                    <div className="small text-secondary">Avg education % (last 30 days)</div>
                    <div className="h5 mb-0">{outcomeSignals.avgEducationLatest ?? 'N/A'}</div>
                  </div>
                </div>
                <div className="col">
                  <div className="bg-body-tertiary rounded p-3 h-100">
                    <div className="small text-secondary">Avg health score (last 30 days)</div>
                    <div className="h5 mb-0">{outcomeSignals.avgHealthLatest ?? 'N/A'}</div>
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
              <p className="text-secondary small mb-3">
                Share of supporters who gave in the previous month and gave again this month. Each column shows that month’s rate.
              </p>
              <div className="lh-impact-mini-chart">
                {retention.map((d, idx) => (
                  <div key={`${d.month}-${idx}`} className="lh-impact-mini-col text-center">
                    <div className="small fw-semibold text-dark mb-1" title={`Retention ${d.month}: ${d.rate}%`}>
                      {d.rate}%
                    </div>
                    <div className="lh-impact-mini-bar-wrap">
                      <span className="lh-impact-mini-bar" style={{ height: `${Math.max(d.rate, 6)}%` }}></span>
                    </div>
                    <small className="text-secondary">{d.month}</small>
                  </div>
                ))}
              </div>
              {retention.length === 0 && (
                <p className="small text-secondary mb-0">Not enough monthly donation history yet to plot retention.</p>
              )}
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
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">Where Support Goes</h2>
              <p className="text-secondary small mb-3">Program effort mix by impact pillar.</p>
              <div className="d-flex flex-column gap-2">
                {supportMix.map((m) => (
                  <div key={m.name} className="lh-impact-trend-block">
                    <div className="d-flex justify-content-between align-items-center">
                      <span>{m.name}</span>
                      <strong>{m.value}%</strong>
                    </div>
                    <div className="lh-impact-trend-bar">
                      <span style={{ width: `${m.value}%`, background: m.color }}></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-7">
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

      <section className="row g-3">
        <div className="col-12">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Metric Definitions</h2>
              <div className="d-flex flex-column gap-3">
                {metricDefinitions.map((metric) => (
                  <div key={metric.key}>
                    <div className="fw-semibold">{metric.label}</div>
                    <div className="small text-secondary">{metric.definition}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lh-impact lh-impact-method">
        <p className="text-center text-secondary mb-0 small max-width mx-auto" style={{ maxWidth: '42rem' }}>
          Method note: figures currently reflect case seed data and existing aggregates. As your Jupyter pipeline is productionized,
          this page can consume forecast metrics through a dedicated API response without redesigning the layout.
        </p>
      </section>
    </div>
  )
}
