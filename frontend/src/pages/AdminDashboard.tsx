import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchJson } from '../api/client'
import { formatUsd } from '../utils/formatUsd'

const LAST_VISIT_KEY = 'lh-admin-dashboard-last-visit-at'
const LAST_READ_KEY = 'lh-admin-dashboard-last-read-at'

type ActivityItem = {
  icon: string
  title: string
  detail: string
  at: Date
  amount: number
  typeLabel: string
  unitLabel: string
}

type DonationActivity = {
  donationId: number
  supporterId: number
  donationType?: string | number | null
  impactUnit?: string | number | null
  currencyCode?: string | null
  amount?: number | null
  estimatedValue?: number | null
  createdAt: string
}

/** Same shape as /api/admin/analytics/donations-ml (ml-service pipeline dataset). */
type DonationsMlPayload = {
  generatedAtUtc: string
  dataSource: string
  loadWarning: string
  summary: {
    totalGifts: number
    totalEstimatedValue: number
    avgEstimatedValue: number
    recurringShare: number
    withSocialReferralCount: number
  }
  monthlyTotals: Array<{ month: string; totalEstimatedValue: number }>
  pipelineModel: {
    holdoutMaePredictive?: number
    holdoutR2Predictive?: number
  } | null
}

type ResidentsTransferRiskPayload = {
  generatedAtUtc: string
  dataSource: string
  loadWarning: string
  endpointVersion: string
  question: string
  summary: {
    scoredResidents: number
    highRiskResidents: number
    highRiskShare: number
    avgTransferProbability: number
  }
  modelMetrics: {
    selectedModel: string
    threshold: number
    rocAuc: number
    avgPrecision: number
    precisionAtThreshold: number
    recallAtThreshold: number
    f1AtThreshold: number
  } | null
  riskTierCounts: Array<{ tier: string; count: number }>
  topResidents: Array<{
    residentId: number
    caseControlNo: string
    internalCode: string
    assignedSocialWorker: string
    safehouseId: string
    riskTier: string
    predTransferProb: number
  }>
}

const DONATION_TYPE_LABELS = ['Monetary', 'In-kind', 'Time', 'Skills', 'Social media'] as const

function enumLikeToLabel(value: string | number | null | undefined, labels: readonly string[], fallback: string) {
  if (typeof value === 'number' && value >= 0 && value < labels.length) return labels[value]
  if (typeof value === 'string' && value.trim().length > 0) return value
  return fallback
}

function inferUnitLabel(typeLabel: string) {
  switch (typeLabel) {
    case 'Monetary':
      return 'dollars'
    case 'Time':
      return 'hours'
    case 'In-kind':
      return 'estimated dollars'
    case 'Skills':
      return 'estimated dollars'
    case 'Social media':
      return 'estimated dollars'
    default:
      return 'units'
  }
}

function formatRelativeTime(at: Date) {
  const nowMs = Date.now()
  const deltaMs = Math.max(0, nowMs - at.getTime())
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (deltaMs < hour) {
    const minutes = Math.max(1, Math.floor(deltaMs / minute))
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }
  if (deltaMs < day) {
    const hours = Math.floor(deltaMs / hour)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(deltaMs / day)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function parseIsoDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function transferRiskTierLabel(tier: string) {
  const t = tier.trim().toLowerCase()
  if (t === 'high') return 'Needs immediate review'
  if (t === 'medium') return 'Needs follow-up'
  if (t === 'monitor') return 'Stable / monitor'
  if (t === 'unknown' || t === 'nan' || t === '') return 'Unclassified'
  return tier
}

function transferRiskActionHint(highRiskCount: number) {
  if (highRiskCount <= 0) return 'No residents are currently flagged as urgent. Continue weekly monitoring.'
  if (highRiskCount === 1) return '1 resident needs immediate case review this week.'
  return `${highRiskCount} residents need immediate case review this week.`
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<{ activeSupporters: number; totalDonationValue: number; donationsLast90Days: number } | null>(
    null,
  )
  const [residentCount, setResidentCount] = useState<number | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [cutoffDate, setCutoffDate] = useState<Date>(() => {
    const lastVisit = parseIsoDate(localStorage.getItem(LAST_VISIT_KEY))
    const lastRead = parseIsoDate(localStorage.getItem(LAST_READ_KEY))
    if (lastVisit && lastRead) return lastVisit > lastRead ? lastVisit : lastRead
    if (lastVisit) return lastVisit
    if (lastRead) return lastRead
    return new Date(0)
  })
  const [err, setErr] = useState<string | null>(null)
  const [donationsMl, setDonationsMl] = useState<DonationsMlPayload | null>(null)
  const [donationsMlErr, setDonationsMlErr] = useState<string | null>(null)
  const [residentsTransferRisk, setResidentsTransferRisk] = useState<ResidentsTransferRiskPayload | null>(null)
  const [residentsTransferRiskErr, setResidentsTransferRiskErr] = useState<string | null>(null)
  const contributionCountByType = recentActivity.reduce<Record<string, number>>((acc, item) => {
    acc[item.typeLabel] = (acc[item.typeLabel] ?? 0) + 1
    return acc
  }, {})
  const contributionTotalsByUnit = recentActivity.reduce<Record<string, number>>((acc, item) => {
    acc[item.unitLabel] = (acc[item.unitLabel] ?? 0) + item.amount
    return acc
  }, {})
  const totalContributionCount = recentActivity.length

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      const [m, residents] = await Promise.all([
        fetchJson<{ activeSupporters: number; totalDonationValue: number; donationsLast90Days: number }>(
          '/api/admin/metrics/okr?donorRecencyPageSize=0',
        ),
        fetchJson<unknown[]>('/api/admin/data/residents'),
      ])
      if (cancelled) return
      setMetrics(m)
      setResidentCount(Array.isArray(residents) ? residents.length : 0)
    }

    async function loadRecentContributions() {
      const donations = await fetchJson<DonationActivity[]>('/api/admin/data/donations')
      if (cancelled) return

      const donationEvents: ActivityItem[] = (Array.isArray(donations) ? donations : [])
        .map((d) => {
          const typeLabel = enumLikeToLabel(d.donationType, DONATION_TYPE_LABELS, 'Contribution')
          const unitLabel = inferUnitLabel(typeLabel)
          const amountValue = d.amount ?? d.estimatedValue
          const normalizedAmount = Number(amountValue ?? 0)
          const formattedAmount = normalizedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          return {
            icon: '\u{1F4B0}',
            title: 'New contribution received',
            detail: `Donation #${d.donationId} from supporter #${d.supporterId} - ${typeLabel} (${formattedAmount} ${unitLabel})`,
            at: new Date(d.createdAt),
            amount: normalizedAmount,
            typeLabel,
            unitLabel,
          }
        })
        .filter((e) => !Number.isNaN(e.at.getTime()))
        .filter((e) => e.at.getTime() > cutoffDate.getTime())
        .sort((a, b) => b.at.getTime() - a.at.getTime())

      setRecentActivity(donationEvents)
    }

    Promise.all([loadOverview(), loadRecentContributions()]).catch((e: Error) => {
      if (!cancelled) setErr(e.message)
    })

    const refreshMs = 30000
    const interval = window.setInterval(() => {
      void loadRecentContributions().catch((e: Error) => {
        if (!cancelled) setErr(e.message)
      })
    }, refreshMs)

    const nowIso = new Date().toISOString()
    localStorage.setItem(LAST_VISIT_KEY, nowIso)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [cutoffDate])

  useEffect(() => {
    let cancelled = false
    fetchJson<DonationsMlPayload>('/api/admin/analytics/donations-ml')
      .then((data) => {
        if (!cancelled) setDonationsMl(data)
      })
      .catch((e: Error) => {
        if (!cancelled) setDonationsMlErr(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchJson<ResidentsTransferRiskPayload>('/api/admin/analytics/residents-transfer-risk')
      .then((data) => {
        if (!cancelled) setResidentsTransferRisk(data)
      })
      .catch((e: Error) => {
        if (!cancelled) setResidentsTransferRiskErr(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function markActivityRead() {
    const now = new Date()
    setCutoffDate(now)
    localStorage.setItem(LAST_READ_KEY, now.toISOString())
    setRecentActivity([])
  }

  return (
    <div>
      <div className="lh-dash-header">
        <div>
          <h1 className="lh-dash-title h3 mb-1">Dashboard</h1>
          <p className="lh-dash-sub mb-0">Welcome back — here&apos;s what&apos;s happening today.</p>
        </div>
      </div>
      {err ? <div className="alert alert-warning">{err}</div> : null}

      <div className="lh-kpi-row">
        <div className="lh-kpi-card lh-kpi-primary">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="small opacity-75">Total donations (USD)</div>
              <div className="lh-kpi-value mt-1">{metrics ? formatUsd(Number(metrics.totalDonationValue)) : '—'}</div>
              <div className="lh-kpi-meta mt-1">Live from current dataset</div>
            </div>
            <span className="lh-kpi-icon fs-4">&#36;</span>
          </div>
        </div>
        <div className="lh-kpi-card">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-secondary small">Active donors</div>
              <div className="lh-kpi-value lh-kpi-value-strong mt-1">{metrics ? metrics.activeSupporters : '—'}</div>
              <div className="lh-kpi-meta text-success small mt-1">Current active donors</div>
            </div>
            <span className="text-primary fs-4">&#9829;</span>
          </div>
        </div>
        <div className="lh-kpi-card">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-secondary small">Active residents</div>
              <div className="lh-kpi-value lh-kpi-value-strong mt-1">{residentCount ?? '—'}</div>
              <div className="lh-kpi-meta text-success small mt-1">Current resident records</div>
            </div>
            <span className="text-secondary fs-4">&#128101;</span>
          </div>
        </div>
        <div className="lh-kpi-card">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-secondary small">Donations (90 days)</div>
              <div className="lh-kpi-value lh-kpi-value-strong mt-1">{metrics ? metrics.donationsLast90Days : '—'}</div>
              <div className="lh-kpi-meta text-success small mt-1">Live rolling count</div>
            </div>
            <span className="text-secondary fs-4">&#128200;</span>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="lh-chart-card h-100">
            <div className="fw-semibold fs-4 mb-1">Donation trends</div>
            <div className="text-secondary small mb-1">
              Monthly donation activity over time to quickly spot high and low giving periods.
            </div>
            {donationsMlErr ? (
              <div className="alert alert-warning py-2 small mb-0">
                Pipeline trends unavailable ({donationsMlErr}). Check ml-service URL and dataset on the host.
              </div>
            ) : null}
            {donationsMl?.loadWarning ? (
              <div className="alert alert-info py-2 small mb-2">{donationsMl.loadWarning}</div>
            ) : null}
            {donationsMl && donationsMl.monthlyTotals.length > 0 ? (
              <>
                <div style={{ width: '100%', height: 240, marginTop: '8px' }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={donationsMl.monthlyTotals.map((m) => ({
                        month: m.month,
                        total: m.totalEstimatedValue,
                      }))}
                    >
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--bs-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : donationsMl && donationsMl.monthlyTotals.length === 0 ? (
              <p className="small text-secondary mb-0">No monthly rows in the pipeline dataset (empty or filtered).</p>
            ) : !donationsMlErr ? (
              <div className="text-secondary small">Loading pipeline trends…</div>
            ) : null}
          </div>
        </div>
        <div className="col-lg-4">
          <div className="lh-chart-card h-100">
            <div className="fw-semibold mb-1">Residents to Reach Out</div>
            <div className="text-secondary small mb-1">Residents likely to transfer instead of close (early warning)</div>
            {residentsTransferRiskErr ? (
              <div className="alert alert-warning py-2 small mb-2">
                Program enrollment analytics unavailable ({residentsTransferRiskErr}).
              </div>
            ) : null}
            {residentsTransferRisk?.loadWarning ? (
              <div className="alert alert-info py-2 small mb-2">{residentsTransferRisk.loadWarning}</div>
            ) : null}
            {residentsTransferRisk ? (
              <>
                <p className="small text-secondary mb-2">
                  {transferRiskActionHint(residentsTransferRisk.summary.highRiskResidents)}
                </p>
                {residentsTransferRisk.riskTierCounts?.length ? (
                  <div style={{ width: '100%', height: 150 }} className="mb-1">
                    <ResponsiveContainer>
                      <BarChart
                        data={residentsTransferRisk.riskTierCounts.map((r) => ({
                          tier: transferRiskTierLabel(r.tier),
                          count: r.count,
                        }))}
                      >
                        <XAxis dataKey="tier" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value) => [`${value}`, 'Residents']} />
                        <Bar dataKey="count" fill="var(--bs-success)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                {residentsTransferRisk.topResidents?.length ? (
                  <div className="mt-1">
                    <div className="small fw-semibold mb-1">Residents</div>
                    <ul
                      className="list-unstyled mb-1 overflow-auto"
                      style={{ height: 48, fontSize: '0.9rem' }}
                    >
                      {residentsTransferRisk.topResidents.map((r) => (
                        <li key={`${r.residentId}-${r.caseControlNo}`} className="py-0 border-bottom border-light-subtle">
                          <strong>{r.caseControlNo || `Resident #${r.residentId}`}</strong>
                          {' '}({transferRiskTierLabel(r.riskTier)} · {(r.predTransferProb * 100).toFixed(1)}%)
                          {r.assignedSocialWorker ? ` — SW ${r.assignedSocialWorker}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="small text-secondary mt-1">No residents to prioritize yet.</div>
                )}
              </>
            ) : !residentsTransferRiskErr ? (
              <div className="text-secondary small">Loading program enrollment analytics…</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <div className="lh-chart-card">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
              <div>
                <div className="fw-semibold">Missed contributions</div>
                <div className="text-secondary small">
                  Total contributions since last read: {totalContributionCount}
                </div>
                <div className="text-secondary small">
                  Counts by type:{' '}
                  {Object.entries(contributionCountByType).length > 0
                    ? Object.entries(contributionCountByType).map(([type, count]) => `${type}: ${count}`).join(' | ')
                    : 'None'}
                </div>
                <div className="text-secondary small">
                  Total by type since last read:{' '}
                  {Object.entries(contributionTotalsByUnit).length > 0
                    ? Object.entries(contributionTotalsByUnit)
                        .map(([unit, total]) => `${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`)
                        .join(' | ')
                    : '0.00 units'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary lh-btn-pill"
                onClick={markActivityRead}
                disabled={recentActivity.length === 0}
              >
                Mark as read
              </button>
            </div>
            {recentActivity.length === 0 ? (
              <div className="text-secondary small">No missed contributions since your last visit/read.</div>
            ) : (
              <ul className="list-unstyled mb-0 small overflow-auto" style={{ maxHeight: 280 }}>
                {recentActivity.map((item, index) => (
                  <li
                    key={`${item.title}-${item.at.toISOString()}-${index}`}
                    className={`d-flex gap-2 py-2 ${index < recentActivity.length - 1 ? 'border-bottom border-light-subtle' : ''}`}
                  >
                    <span>{item.icon}</span>
                    <div>
                      <div className="fw-semibold">{item.title}</div>
                      <div className="text-secondary">
                        {item.detail} - {formatRelativeTime(item.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="col-lg-5">
          <div className="lh-chart-card">
            <div className="fw-semibold mb-3">Quick actions</div>
            <div className="row g-2">
              <div className="col-6">
                <Link className="btn btn-primary w-100 lh-btn-pill btn-sm" to="/Admin/DonorsContributions">
                  Donor Stats
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn btn-success w-100 lh-btn-pill btn-sm" to="/Admin/CaseloadInventory">
                  Resident list
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn lh-btn-ghost w-100 lh-btn-pill btn-sm" to="/Admin/ProcessRecording">
                  Process notes
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn lh-btn-ghost w-100 lh-btn-pill btn-sm" to="/Admin/HomeVisitationConferences">
                  Visitations
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn lh-btn-ghost w-100 lh-btn-pill btn-sm" to="/Admin/Analytics">
                  Reports & analytics
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn lh-btn-ghost w-100 lh-btn-pill btn-sm" to="/Admin/Okr">
                  OKR metrics
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
