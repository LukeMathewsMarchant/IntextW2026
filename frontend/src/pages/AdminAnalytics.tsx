import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchJson } from '../api/client'

const DONOR_PAGE_SIZE = 50
const OUTREACH_TOP = 3

type Row = {
  supporterId: number
  displayName: string
  daysSinceLastGift: number
  averageDaysBetweenGifts: number | null
}

type DonorPropensity = {
  cohortMedianGapDays: number
  donors: Row[]
  totalCount: number
  page: number
  pageSize: number
}

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
  channelMix: Array<{
    channelSource: string
    giftCount: number
    totalEstimatedValue: number
    avgEstimatedValue: number
  }>
  giftTypeMix: Array<{
    donationType: string
    giftCount: number
    totalEstimatedValue: number
  }>
  monthlyTotals: Array<{ month: string; totalEstimatedValue: number }>
  pipelineModel: {
    name: string
    targetDescription: string
    holdoutMaePredictive?: number
    holdoutR2Predictive?: number
    holdoutMaeExplanatory?: number
    holdoutR2Explanatory?: number
  } | null
}

type ProgramsTier1ChartRow = { label: string; count: number; share: number }

type ProgramsTier1Payload = {
  generatedAtUtc: string
  residents: {
    dataSource: string
    loadWarning: string
    summary: { totalResidents: number; activeResidents: number; distinctSafehouses: number }
    chartRows: ProgramsTier1ChartRow[]
    secondaryChartRows: ProgramsTier1ChartRow[]
  }
  education: {
    dataSource: string
    loadWarning: string
    summary: {
      totalRecords: number
      uniqueResidents: number
      avgAttendancePercent: number | null
      avgProgressPercent: number | null
    }
    chartRows: ProgramsTier1ChartRow[]
  }
  healthWellbeing: {
    dataSource: string
    loadWarning: string
    summary: {
      totalRecords: number
      uniqueResidents: number
      avgGeneralHealthScore: number | null
      medianGeneralHealthScore: number | null
      avgNutritionScore: number | null
      avgSleepQualityScore: number | null
      avgEnergyLevelScore: number | null
      medicalCheckupShare: number | null
      dentalCheckupShare: number | null
      psychologicalCheckupShare: number | null
    }
  }
}

function formatPct01(x: number | null | undefined) {
  if (x == null || Number.isNaN(x)) return '—'
  return `${(x * 100).toFixed(1)}%`
}

function dominantBucket(rows: ProgramsTier1ChartRow[]): { label: string; pct: number } | null {
  if (!rows.length) return null
  const top = [...rows].reduce((a, b) => (b.count > a.count ? b : a))
  return { label: top.label, pct: Math.round(top.share * 1000) / 10 }
}

function healthCheckupInsight(
  med: number | null | undefined,
  dental: number | null | undefined,
  psych: number | null | undefined,
): string | null {
  const pairs: [string, number][] = []
  if (med != null && !Number.isNaN(med)) pairs.push(['Medical', med])
  if (dental != null && !Number.isNaN(dental)) pairs.push(['Dental', dental])
  if (psych != null && !Number.isNaN(psych)) pairs.push(['Psychological', psych])
  if (pairs.length < 2) return null
  pairs.sort((a, b) => a[1] - b[1])
  const [name, share] = pairs[0]
  if (share >= 0.55) return null
  return `${name} check-ins are recorded least often on recent visits—good area to schedule follow-ups.`
}

/** Above this, % change is usually a tiny prior month—show a qualitative line instead of a huge number. */
const MOM_PCT_QUALITATIVE_THRESHOLD = 200

function computeMomGrowth(monthly: Array<{ month: string; total: number }>) {
  if (monthly.length < 2) return null
  const m = [...monthly].sort((a, b) => a.month.localeCompare(b.month))
  const cur = m[m.length - 1]
  const prev = m[m.length - 2]
  if (prev.total <= 0) {
    if (cur.total <= 0) return null
    return { pct: 100, curLabel: cur.month, prevLabel: prev.month, fromZero: true as const }
  }
  const pct = ((cur.total - prev.total) / prev.total) * 100
  return { pct, curLabel: cur.month, prevLabel: prev.month, fromZero: false as const }
}

type MomGrowth = NonNullable<ReturnType<typeof computeMomGrowth>>

/** Short tip for the donation trends card (friendly tone; avoids absurd % when last month was tiny). */
function momTipMessage(mom: MomGrowth): string {
  if (mom.fromZero) {
    return 'Giving picked up this month after a quiet stretch—nice work!'
  }
  const abs = Math.abs(mom.pct)
  if (abs < 2) {
    return 'Donations are about even with last month.'
  }
  const up = mom.pct >= 0
  if (abs >= MOM_PCT_QUALITATIVE_THRESHOLD) {
    return up
      ? 'Donations are way up compared to last month—good job!'
      : 'Donations are down sharply vs last month—re-engage donors and boost posts.'
  }
  return up
    ? `Donations are up ${mom.pct.toFixed(0)}% this month—good job!`
    : `Donations are down ${abs.toFixed(0)}% this month—re-engage donors and boost posts.`
}

/** One-line insight for the ranked list (same logic, slightly tighter wording). */
function momInsightLine(mom: MomGrowth): string {
  if (mom.fromZero) {
    return 'Giving picked up after a very quiet prior month—keep the momentum going.'
  }
  const abs = Math.abs(mom.pct)
  const up = mom.pct >= 0
  if (abs >= MOM_PCT_QUALITATIVE_THRESHOLD) {
    return up
      ? 'Donations jumped vs last month—strong month; keep thanking and following up.'
      : 'Donations fell vs last month—prioritize lapsed donors and visibility.'
  }
  return up
    ? `Donations are up ${mom.pct.toFixed(0)}% this month—good job!`
    : `Donations are down ${abs.toFixed(0)}% this month—re-engage donors and boost posts.`
}

type InsightCand = { priority: number; text: string }

function buildTopInsights(
  monthly: Array<{ month: string; total: number }>,
  donationsMl: DonationsMlPayload | null,
  programsTier1: ProgramsTier1Payload | null,
  outreach: Row[],
): string[] {
  const cands: InsightCand[] = []
  const mom = computeMomGrowth(monthly)
  if (mom) {
    if (mom.fromZero && mom.pct > 0) {
      cands.push({
        priority: 1,
        text: momInsightLine(mom),
      })
    } else if (!mom.fromZero && Math.abs(mom.pct) >= 2) {
      cands.push({
        priority: 2,
        text: momInsightLine(mom),
      })
    }
  }

  if (donationsMl?.channelMix?.length) {
    const sorted = [...donationsMl.channelMix].sort((a, b) => b.totalEstimatedValue - a.totalEstimatedValue)
    const top = sorted[0]
    const totVal = sorted.reduce((s, x) => s + x.totalEstimatedValue, 0)
    if (totVal > 0 && top) {
      const share = (top.totalEstimatedValue / totVal) * 100
      if (share >= 20) {
        cands.push({
          priority: 3,
          text: `${top.channelSource} brings roughly ${share.toFixed(0)}% of estimated value—prioritize campaigns and follow-ups in that channel.`,
        })
      }
    }
  }

  if (donationsMl?.giftTypeMix?.length) {
    const sorted = [...donationsMl.giftTypeMix].sort((a, b) => b.totalEstimatedValue - a.totalEstimatedValue)
    const top = sorted[0]
    const totG = donationsMl.summary?.totalGifts ?? sorted.reduce((s, x) => s + x.giftCount, 0)
    if (totG > 0 && top) {
      const gShare = (top.giftCount / totG) * 100
      if (gShare >= 45) {
        cands.push({
          priority: 4,
          text: `${top.donationType} is over ${gShare.toFixed(0)}% of gifts by count—grow in-kind, time, and skills so revenue is less concentrated.`,
        })
      }
    }
  }

  if (outreach.length) {
    const worst = outreach[0]
    if (worst && worst.daysSinceLastGift >= 90) {
      cands.push({
        priority: 2,
        text: `Several supporters are 90+ days since their last gift—start with personalized notes to your longest-quiet donors.`,
      })
    }
  }

  if (programsTier1) {
    const risk = dominantBucket(programsTier1.residents.chartRows)
    if (risk && ['High', 'Critical'].includes(risk.label) && risk.pct >= 12) {
      cands.push({
        priority: 5,
        text: `A notable share of residents are ${risk.label} risk—review caseloads and staffing for those cases this week.`,
      })
    }
    const edu = dominantBucket(programsTier1.education.chartRows)
    if (edu && edu.label === 'InProgress' && edu.pct >= 50) {
      cands.push({
        priority: 6,
        text: `Most education records are still in progress—check in with schools or tutors where progress has stalled.`,
      })
    }
    const h = healthCheckupInsight(
      programsTier1.healthWellbeing.summary.medicalCheckupShare,
      programsTier1.healthWellbeing.summary.dentalCheckupShare,
      programsTier1.healthWellbeing.summary.psychologicalCheckupShare,
    )
    if (h) {
      cands.push({ priority: 7, text: h })
    }
  }

  cands.sort((a, b) => a.priority - b.priority)
  const seen = new Set<string>()
  const texts: string[] = []
  for (const c of cands) {
    if (texts.length >= 3) break
    if (seen.has(c.text)) continue
    seen.add(c.text)
    texts.push(c.text)
  }

  const fallbacks = [
    'Scan the education and health sections below for youth who need a nudge on school or check-ups.',
    'Use the donor list to thank recent givers and re-engage anyone who has gone quiet.',
    'Compare channels and gift types to decide where the next campaign will have the most impact.',
  ]
  let i = 0
  while (texts.length < 3 && i < fallbacks.length) {
    if (!seen.has(fallbacks[i])) {
      texts.push(fallbacks[i])
      seen.add(fallbacks[i])
    }
    i++
  }
  return texts.slice(0, 3)
}

export function AdminAnalytics() {
  const [rows, setRows] = useState<Row[]>([])
  const [outreachRows, setOutreachRows] = useState<Row[]>([])
  const [cohortMedianGapDays, setCohortMedianGapDays] = useState<number | null>(null)
  const [donorPage, setDonorPage] = useState(1)
  const [donorListPage, setDonorListPage] = useState(1)
  const [donorTotalCount, setDonorTotalCount] = useState(0)
  const [donorPageSize, setDonorPageSize] = useState(DONOR_PAGE_SIZE)
  const [monthly, setMonthly] = useState<Array<{ month: string; total: number }>>([])
  const [err, setErr] = useState<string | null>(null)
  const [donationsMl, setDonationsMl] = useState<DonationsMlPayload | null>(null)
  const [donationsMlErr, setDonationsMlErr] = useState<string | null>(null)
  const [programsTier1, setProgramsTier1] = useState<ProgramsTier1Payload | null>(null)
  const [programsTier1Err, setProgramsTier1Err] = useState<string | null>(null)

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
    fetchJson<ProgramsTier1Payload>('/api/admin/analytics/programs-tier1')
      .then((data) => {
        if (!cancelled) setProgramsTier1(data)
      })
      .catch((e: Error) => {
        if (!cancelled) setProgramsTier1Err(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    fetchJson<Array<{ donationDate?: string; estimatedValue?: number; amount?: number }>>('/api/admin/data/donations')
      .then((donations) => {
        const monthTotals = new Map<string, number>()
        ;(Array.isArray(donations) ? donations : []).forEach((d) => {
          const month = (d.donationDate ?? '').slice(0, 7) || 'Unknown'
          const value = Number(d.estimatedValue ?? d.amount ?? 0)
          monthTotals.set(month, (monthTotals.get(month) ?? 0) + (Number.isFinite(value) ? value : 0))
        })
        setMonthly(
          Array.from(monthTotals, ([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)),
        )
      })
      .catch((e: Error) => setErr(e.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchJson<DonorPropensity>(
      `/api/admin/analytics/donor-propensity?page=1&pageSize=${OUTREACH_TOP}`,
    )
      .then((propensity) => {
        if (cancelled) return
        setOutreachRows(Array.isArray(propensity?.donors) ? propensity.donors : [])
      })
      .catch(() => {
        if (!cancelled) setOutreachRows([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const requestedPage = donorPage
    let cancelled = false
    fetchJson<DonorPropensity>(
      `/api/admin/analytics/donor-propensity?page=${requestedPage}&pageSize=${DONOR_PAGE_SIZE}`,
    )
      .then((propensity) => {
        if (cancelled) return
        setRows(Array.isArray(propensity?.donors) ? propensity.donors : [])
        setCohortMedianGapDays(
          typeof propensity?.cohortMedianGapDays === 'number' ? propensity.cohortMedianGapDays : null,
        )
        setDonorTotalCount(typeof propensity?.totalCount === 'number' ? propensity.totalCount : 0)
        setDonorPageSize(
          typeof propensity?.pageSize === 'number' && propensity.pageSize > 0 ? propensity.pageSize : DONOR_PAGE_SIZE,
        )
        if (typeof propensity?.page === 'number') {
          setDonorListPage(propensity.page)
          if (propensity.page !== requestedPage) setDonorPage(propensity.page)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [donorPage])

  const donorTotalPages =
    donorPageSize > 0 ? Math.max(1, Math.ceil(donorTotalCount / donorPageSize)) : 1

  const riskDom = programsTier1 ? dominantBucket(programsTier1.residents.chartRows) : null
  const statusDom = programsTier1 ? dominantBucket(programsTier1.residents.secondaryChartRows) : null
  const eduDom = programsTier1 ? dominantBucket(programsTier1.education.chartRows) : null

  const mom = useMemo(() => computeMomGrowth(monthly), [monthly])
  const topInsights = useMemo(
    () => buildTopInsights(monthly, donationsMl, programsTier1, outreachRows),
    [monthly, donationsMl, programsTier1, outreachRows],
  )

  const channelInsightDisplay = useMemo(() => {
    if (!donationsMl?.channelMix?.length) return null
    const sorted = [...donationsMl.channelMix].sort((a, b) => b.totalEstimatedValue - a.totalEstimatedValue)
    const top = sorted[0]
    const tot = sorted.reduce((s, c) => s + c.totalEstimatedValue, 0)
    if (!top || tot <= 0) return null
    const share = (top.totalEstimatedValue / tot) * 100
    const runners = sorted.slice(1, 3).filter((x) => x.totalEstimatedValue > 0)
    return (
      <p className="small mb-3">
        <strong>{top.channelSource}</strong> leads on estimated value ({share.toFixed(0)}% of the mix). Plan the next
        campaign emphasis there first.
        {runners.length > 0 ? (
          <>
            {' '}
            Keep{' '}
            {runners.map((r, i) => (
              <span key={r.channelSource}>
                {i > 0 ? ' and ' : null}
                <strong>{r.channelSource}</strong>
              </span>
            ))}
            {' '}
            warm—they're the next tier.
          </>
        ) : null}
      </p>
    )
  }, [donationsMl])

  const typeInsightDisplay = useMemo(() => {
    if (!donationsMl?.giftTypeMix?.length) return null
    const sorted = [...donationsMl.giftTypeMix].sort((a, b) => b.totalEstimatedValue - a.totalEstimatedValue)
    const top = sorted[0]
    const totVal = sorted.reduce((s, x) => s + x.totalEstimatedValue, 0)
    const totGifts = sorted.reduce((s, x) => s + x.giftCount, 0)
    if (!top || totVal <= 0 || totGifts <= 0) return null
    const valueShare = (top.totalEstimatedValue / totVal) * 100
    const countShare = (top.giftCount / totGifts) * 100
    return (
      <p className="small mb-3">
        <strong>{top.donationType}</strong> gifts are the largest slice ({valueShare.toFixed(0)}% of estimated value,{' '}
        {countShare.toFixed(0)}% of gifts). Balance with in-kind, volunteer time, and skills so support stays diversified.
      </p>
    )
  }, [donationsMl])

  const momTip = useMemo(() => (mom ? momTipMessage(mom) : null), [mom])

  return (
    <div>
      <h1 className="h3 mb-2">Reports &amp; analytics</h1>
      <p className="text-secondary mb-4">
        Snapshot of fundraising, resident programs, and donor engagement—use it to spot where to focus next.
      </p>
      {err ? <div className="alert alert-warning">{err}</div> : null}

      <div className="row g-3 mb-4">
        <div className="col-lg-6 align-self-start">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-2">Most important insights right now</h2>
              <ol className="small mb-0 ps-3">
                {topInsights.map((t, i) => (
                  <li key={i} className="mb-2">
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-1">Donation trends</h2>
              <p className="small text-secondary mb-2">Estimated gift value by month from your live records.</p>
              {momTip ? (
                <div className="alert alert-light border small py-2 mb-3 mb-lg-2">
                  <span className="fw-semibold">Tip:</span> {momTip}
                </div>
              ) : (
                <p className="small text-secondary mb-3">Add a couple of months of gifts to see month-over-month change.</p>
              )}
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={monthly}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                    <YAxis tick={{ fontSize: 10 }} width={48} />
                    <Tooltip />
                    <Bar dataKey="total" fill="var(--bs-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {monthly.length === 0 ? <p className="small text-secondary mb-0">No donations yet to chart.</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-1">Giving channels</h2>
              <p className="small text-secondary mb-2">Where gifts originate—use this to focus marketing and events.</p>
              {donationsMlErr ? (
                <div className="alert alert-warning py-2 small mb-0">Could not load this section.</div>
              ) : null}
              {donationsMl?.loadWarning ? (
                <div className="alert alert-info py-2 small mb-2">{donationsMl.loadWarning}</div>
              ) : null}
              {donationsMl && channelInsightDisplay}
              {donationsMl ? (
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th>Gifts</th>
                        <th>Total (est.)</th>
                        <th>Avg (est.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donationsMl.channelMix.map((c) => (
                        <tr key={c.channelSource}>
                          <td>{c.channelSource}</td>
                          <td>{c.giftCount}</td>
                          <td>{c.totalEstimatedValue.toLocaleString()}</td>
                          <td>{c.avgEstimatedValue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : !donationsMlErr ? (
                <p className="small text-secondary mb-0">Loading…</p>
              ) : null}
              {donationsMl && donationsMl.channelMix.length === 0 ? (
                <p className="small text-secondary mb-0">No channel breakdown.</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-1">Gift types</h2>
              <p className="small text-secondary mb-2">Cash vs in-kind, time, and skills—balance keeps you resilient.</p>
              {donationsMlErr ? (
                <div className="alert alert-warning py-2 small mb-0">Could not load this section.</div>
              ) : null}
              {donationsMl && typeInsightDisplay}
              {donationsMl ? (
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Gifts</th>
                        <th>Total (est.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donationsMl.giftTypeMix.map((t) => (
                        <tr key={t.donationType}>
                          <td>{t.donationType}</td>
                          <td>{t.giftCount}</td>
                          <td>{t.totalEstimatedValue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : !donationsMlErr ? (
                <p className="small text-secondary mb-0">Loading…</p>
              ) : null}
              {donationsMl && donationsMl.giftTypeMix.length === 0 ? (
                <p className="small text-secondary mb-0">No type breakdown.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <h2 className="h5 mb-2">Residents, learning &amp; health</h2>
      <p className="small text-secondary mb-3">Program-level picture: who is in care, how education records look, and wellbeing check-in patterns.</p>
      {programsTier1Err ? (
        <div className="alert alert-warning mb-3">Program snapshot unavailable right now.</div>
      ) : null}
      {programsTier1 ? (
        <div className="row g-3 mb-4">
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h3 className="h6 mb-2">Residents in care</h3>
                {programsTier1.residents.loadWarning ? (
                  <div className="alert alert-info py-2 small mb-2">{programsTier1.residents.loadWarning}</div>
                ) : null}
                <p className="small mb-3">
                  {riskDom && statusDom ? (
                    <>
                      Most residents are <strong>{riskDom.label}</strong> risk and <strong>{statusDom.label}</strong> in
                      case status ({riskDom.pct}% / {statusDom.pct}% of the roster). Put extra attention on higher-risk
                      cases and anyone moving between statuses.
                    </>
                  ) : (
                    <>Use risk and case status together to see where supervision and reintegration support may matter most.</>
                  )}
                </p>
                <div className="d-flex flex-wrap gap-3 small text-secondary mb-3">
                  <span>
                    <strong className="text-body">{programsTier1.residents.summary.totalResidents}</strong> in roster
                  </span>
                  <span>
                    <strong className="text-body">{programsTier1.residents.summary.activeResidents}</strong> active
                  </span>
                  <span>
                    <strong className="text-body">{programsTier1.residents.summary.distinctSafehouses}</strong> sites
                  </span>
                </div>
                <div className="row g-2">
                  <div className="col-md-6">
                    <div className="small text-secondary mb-1">Risk level</div>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer>
                        <BarChart data={programsTier1.residents.chartRows} margin={{ bottom: 4, left: 0 }}>
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                          <YAxis width={32} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => [v, 'Residents']} />
                          <Bar dataKey="count" fill="var(--bs-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="small text-secondary mb-1">Case status</div>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer>
                        <BarChart data={programsTier1.residents.secondaryChartRows} margin={{ bottom: 4, left: 0 }}>
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                          <YAxis width={32} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => [v, 'Residents']} />
                          <Bar dataKey="count" fill="var(--bs-success)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h3 className="h6 mb-2">Education</h3>
                {programsTier1.education.loadWarning ? (
                  <div className="alert alert-info py-2 small mb-2">{programsTier1.education.loadWarning}</div>
                ) : null}
                <p className="small mb-3">
                  {eduDom ? (
                    <>
                      Most records are <strong>{eduDom.label}</strong> ({eduDom.pct}% of entries).
                      {programsTier1.education.summary.avgProgressPercent != null ? (
                        <> Average reported progress is {programsTier1.education.summary.avgProgressPercent}%.</>
                      ) : null}{' '}
                      Prioritize tutoring or school follow-up where progress has stalled.
                    </>
                  ) : (
                    <>Completion and progress patterns highlight where youth may need stronger academic support.</>
                  )}
                </p>
                <div className="d-flex flex-wrap gap-3 small text-secondary mb-3">
                  <span>
                    <strong className="text-body">{programsTier1.education.summary.totalRecords}</strong> records
                  </span>
                  <span>
                    <strong className="text-body">{programsTier1.education.summary.uniqueResidents}</strong> youth
                  </span>
                  {programsTier1.education.summary.avgAttendancePercent != null ? (
                    <span>
                      Avg attendance{' '}
                      <strong className="text-body">{programsTier1.education.summary.avgAttendancePercent}</strong>
                    </span>
                  ) : null}
                </div>
                <div className="small text-secondary mb-1">Record status</div>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={programsTier1.education.chartRows} margin={{ bottom: 4, left: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis width={32} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [v, 'Records']} />
                      <Bar dataKey="count" fill="var(--bs-warning)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h3 className="h6 mb-2">Health &amp; wellbeing</h3>
                {programsTier1.healthWellbeing.loadWarning ? (
                  <div className="alert alert-info py-2 small mb-2">{programsTier1.healthWellbeing.loadWarning}</div>
                ) : null}
                <p className="small mb-3">
                  {healthCheckupInsight(
                    programsTier1.healthWellbeing.summary.medicalCheckupShare,
                    programsTier1.healthWellbeing.summary.dentalCheckupShare,
                    programsTier1.healthWellbeing.summary.psychologicalCheckupShare,
                  ) ??
                    'Overall scores and check-in rates show whether routine medical, dental, and psych visits are keeping pace.'}
                </p>
                <div className="d-flex flex-wrap gap-3 small text-secondary mb-2">
                  <span>
                    Avg score{' '}
                    <strong className="text-body">
                      {programsTier1.healthWellbeing.summary.avgGeneralHealthScore ?? '—'}
                    </strong>
                  </span>
                  <span>
                    Median{' '}
                    <strong className="text-body">
                      {programsTier1.healthWellbeing.summary.medianGeneralHealthScore ?? '—'}
                    </strong>
                  </span>
                </div>
                <div className="small text-secondary mb-1">Nutrition, sleep, energy (avg.)</div>
                {(() => {
                  const sub = [
                    { label: 'Nutrition', value: programsTier1.healthWellbeing.summary.avgNutritionScore },
                    { label: 'Sleep', value: programsTier1.healthWellbeing.summary.avgSleepQualityScore },
                    { label: 'Energy', value: programsTier1.healthWellbeing.summary.avgEnergyLevelScore },
                  ]
                  const has = sub.some((r) => r.value != null && !Number.isNaN(r.value))
                  if (!has) {
                    return <p className="small text-secondary mb-2">No sub-score averages yet.</p>
                  }
                  return (
                    <div style={{ width: '100%', height: 140 }} className="mb-3">
                      <ResponsiveContainer>
                        <BarChart
                          data={sub.map((r) => ({
                            label: r.label,
                            value: typeof r.value === 'number' ? r.value : 0,
                          }))}
                          margin={{ bottom: 4, left: 0 }}
                        >
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis width={28} domain={[0, 5]} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="var(--bs-danger)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })()}
                <div className="small text-secondary mb-1">Check-in rate (recent records)</div>
                <ul className="small mb-0">
                  <li>Medical {formatPct01(programsTier1.healthWellbeing.summary.medicalCheckupShare)}</li>
                  <li>Dental {formatPct01(programsTier1.healthWellbeing.summary.dentalCheckupShare)}</li>
                  <li>Psychological {formatPct01(programsTier1.healthWellbeing.summary.psychologicalCheckupShare)}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : !programsTier1Err ? (
        <p className="small text-secondary mb-4">Loading program snapshot…</p>
      ) : null}

      <h2 className="h5 mb-2">Donor engagement</h2>
      <p className="small text-secondary mb-3">
        Sorted with the longest quiet period first—reach out at the top, thank recent givers at the bottom of each page.
      </p>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-secondary small">Typical days between gifts</div>
              <div className="display-6">{cohortMedianGapDays ?? '—'}</div>
              <p className="small text-secondary mb-0 mt-2">Among donors with two or more gifts—lower often means a steadier habit.</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h3 className="h6 mb-2">Reach out soon</h3>
              <p className="small text-secondary mb-2">Three supporters with the longest gap since their last gift.</p>
              {outreachRows.length === 0 ? (
                <p className="small text-secondary mb-0">No donor list yet.</p>
              ) : (
                <ul className="list-unstyled small mb-0">
                  {outreachRows.map((r) => (
                    <li key={r.supporterId} className="mb-2 pb-2 border-bottom border-light">
                      <div className="fw-semibold">{r.displayName}</div>
                      <div className="text-secondary">{r.daysSinceLastGift} days since last gift</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Supporter</th>
              <th>Days since last gift</th>
              <th>Avg. days between gifts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.supporterId}>
                <td>{r.displayName}</td>
                <td>{r.daysSinceLastGift}</td>
                <td>
                  {r.averageDaysBetweenGifts != null
                    ? r.averageDaysBetweenGifts.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 1,
                      })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex align-items-center justify-content-between mt-2">
        <div className="small text-secondary">
          Page {donorListPage} of {donorTotalPages} · {donorTotalCount} donors
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={donorListPage <= 1}
            onClick={() => setDonorPage(Math.max(1, donorListPage - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={donorListPage >= donorTotalPages}
            onClick={() => setDonorPage(Math.min(donorTotalPages, donorListPage + 1))}
          >
            Next
          </button>
        </div>
      </div>
      {donorTotalCount === 0 ? <p className="small text-secondary mb-0">No donors with gifts yet.</p> : null}
    </div>
  )
}
