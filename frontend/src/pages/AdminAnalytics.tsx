import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchJson } from '../api/client'

const DONOR_PAGE_SIZE = 50

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

type DonationsMlSummary = {
  totalGifts: number
  totalEstimatedValue: number
  avgEstimatedValue: number
  recurringShare: number
  withSocialReferralCount: number
}

type DonationsMlPayload = {
  generatedAtUtc: string
  dataSource: string
  loadWarning: string
  summary: DonationsMlSummary
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

export function AdminAnalytics() {
  const [rows, setRows] = useState<Row[]>([])
  const [cohortMedianGapDays, setCohortMedianGapDays] = useState<number | null>(null)
  const [donorPage, setDonorPage] = useState(1)
  const [donorListPage, setDonorListPage] = useState(1)
  const [donorTotalCount, setDonorTotalCount] = useState(0)
  const [donorPageSize, setDonorPageSize] = useState(DONOR_PAGE_SIZE)
  const [monthly, setMonthly] = useState<Array<{ month: string; total: number }>>([])
  const [safehouseCounts, setSafehouseCounts] = useState<Array<{ safehouseId: string; residents: number }>>([])
  const [err, setErr] = useState<string | null>(null)
  const [donationsMl, setDonationsMl] = useState<DonationsMlPayload | null>(null)
  const [donationsMlErr, setDonationsMlErr] = useState<string | null>(null)

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
    Promise.all([
      fetchJson<Array<{ donationDate?: string; estimatedValue?: number; amount?: number }>>('/api/admin/data/donations'),
      fetchJson<Array<{ safehouseId?: number }>>('/api/admin/data/residents'),
    ])
      .then(([donations, residents]) => {
        const monthTotals = new Map<string, number>()
        ;(Array.isArray(donations) ? donations : []).forEach((d) => {
          const month = (d.donationDate ?? '').slice(0, 7) || 'Unknown'
          const value = Number(d.estimatedValue ?? d.amount ?? 0)
          monthTotals.set(month, (monthTotals.get(month) ?? 0) + (Number.isFinite(value) ? value : 0))
        })
        setMonthly(Array.from(monthTotals, ([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)))
        const counts = new Map<string, number>()
        ;(Array.isArray(residents) ? residents : []).forEach((x) => {
          const key = String(x.safehouseId ?? 'Unassigned')
          counts.set(key, (counts.get(key) ?? 0) + 1)
        })
        setSafehouseCounts(Array.from(counts, ([safehouseId, residentsCount]) => ({ safehouseId, residents: residentsCount })))
      })
      .catch((e: Error) => setErr(e.message))
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

  return (
    <div>
      <h1 className="h3 mb-3">Reports & analytics</h1>
      <p className="text-secondary">Operational trends with graceful placeholders until full production data import is complete.</p>
      {err ? <div className="alert alert-warning">{err}</div> : null}

      <div className="row g-3 mb-3">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5">Donation trends over time</h2>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={monthly}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="var(--bs-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {monthly.length === 0 ? <p className="small text-secondary mb-0">No donation trend rows yet.</p> : null}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5">Safehouse performance comparison</h2>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead><tr><th>Safehouse</th><th>Residents</th></tr></thead>
                  <tbody>
                    {safehouseCounts.map((x) => (
                      <tr key={x.safehouseId}><td>{x.safehouseId}</td><td>{x.residents}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {safehouseCounts.length === 0 ? <p className="small text-secondary mt-2 mb-0">No safehouse comparison rows yet.</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5">Donations (ML service)</h2>
              <p className="small text-secondary mb-2">
                Trends from the Python ml-service using <code>datasets/donations.csv</code> and optional notebook metrics.
                Does not replace the chart above (live DB); adds pipeline-aligned mix and model holdout scores.
              </p>
              {donationsMlErr ? (
                <div className="alert alert-warning py-2 mb-0 small">
                  ML donations analytics unavailable ({donationsMlErr}). Social media ML is unchanged; check ml-service URL
                  and paths in Azure.
                </div>
              ) : null}
              {donationsMl?.loadWarning ? (
                <div className="alert alert-info py-2 small mb-2">{donationsMl.loadWarning}</div>
              ) : null}
              {donationsMl ? (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-3 small">
                    <span>
                      <span className="text-secondary">Source:</span> {donationsMl.dataSource}
                    </span>
                    <span>
                      <span className="text-secondary">Gifts:</span> {donationsMl.summary.totalGifts}
                    </span>
                    <span>
                      <span className="text-secondary">Total est. value:</span>{' '}
                      {donationsMl.summary.totalEstimatedValue.toLocaleString()}
                    </span>
                    <span>
                      <span className="text-secondary">Avg / gift:</span>{' '}
                      {donationsMl.summary.avgEstimatedValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </span>
                    <span>
                      <span className="text-secondary">Recurring share:</span>{' '}
                      {(donationsMl.summary.recurringShare * 100).toFixed(1)}%
                    </span>
                    <span>
                      <span className="text-secondary">Social referral rows:</span>{' '}
                      {donationsMl.summary.withSocialReferralCount}
                    </span>
                  </div>
                  {donationsMl.pipelineModel ? (
                    <p className="small text-secondary mb-2">
                      <strong>Notebook model (holdout):</strong> MAE{' '}
                      {donationsMl.pipelineModel.holdoutMaePredictive != null
                        ? donationsMl.pipelineModel.holdoutMaePredictive.toFixed(1)
                        : '—'}{' '}
                      · R²{' '}
                      {donationsMl.pipelineModel.holdoutR2Predictive != null
                        ? donationsMl.pipelineModel.holdoutR2Predictive.toFixed(3)
                        : '—'}{' '}
                      (predictive RF)
                    </p>
                  ) : null}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <h3 className="h6">By channel</h3>
                      <div className="table-responsive">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Channel</th>
                              <th>Gifts</th>
                              <th>Total est.</th>
                              <th>Avg</th>
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
                      {donationsMl.channelMix.length === 0 ? (
                        <p className="small text-secondary mb-0">No channel breakdown.</p>
                      ) : null}
                    </div>
                    <div className="col-md-6">
                      <h3 className="h6">By gift type</h3>
                      <div className="table-responsive">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Gifts</th>
                              <th>Total est.</th>
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
                      {donationsMl.giftTypeMix.length === 0 ? (
                        <p className="small text-secondary mb-0">No type breakdown.</p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : !donationsMlErr ? (
                <p className="small text-secondary mb-0">Loading ML donations summary…</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h6 mb-1">Reintegration success rates</h2>
              <p className="small text-secondary mb-0">Available after data import.</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h6 mb-1">Annual Accomplishment format (Caring/Healing/Teaching)</h2>
              <p className="small text-secondary mb-0">Available after data import.</p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="h5 mb-2">Donor propensity (recency)</h2>
      <p className="small text-secondary mb-2">
        Supporters with at least one donation, sorted by name. {DONOR_PAGE_SIZE} rows per page.
      </p>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-secondary small">Cohort median gap (days)</div>
              <div className="display-6">{cohortMedianGapDays ?? '—'}</div>
              <p className="small text-secondary mb-0 mt-2">
                Median days between consecutive gifts across all donors with at least two gifts.
              </p>
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
          Page {donorListPage} of {donorTotalPages} ({donorTotalCount} with donations)
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
      {donorTotalCount === 0 ? <p className="small text-secondary mb-0">No donation rows yet.</p> : null}
    </div>
  )
}
