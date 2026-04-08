import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

const DONOR_PAGE_SIZE = 50

type Okr = {
  activeSupporters: number
  totalDonationValue: number
  donationsLast90Days: number
  cohortMedianGapDays: number
  churnRisks: {
    supporterId: number
    displayName: string
    daysSinceLastGift: number
    averageDaysBetweenGifts: number | null
  }[]
  donorRecencyTotalCount: number
  donorRecencyPage: number
  donorRecencyPageSize: number
}

export function AdminOkr() {
  const [okr, setOkr] = useState<Okr | null>(null)
  const [donorPage, setDonorPage] = useState(1)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const requestedPage = donorPage
    const qs = new URLSearchParams({
      donorRecencyPage: String(requestedPage),
      donorRecencyPageSize: String(DONOR_PAGE_SIZE),
    })
    let cancelled = false
    fetchJson<Okr>(`/api/admin/metrics/okr?${qs}`)
      .then((data) => {
        if (cancelled) return
        setErr(null)
        setOkr(data)
        if (data.donorRecencyPage !== requestedPage) setDonorPage(data.donorRecencyPage)
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [donorPage])

  const donorTotalPages =
    okr && okr.donorRecencyPageSize > 0
      ? Math.max(1, Math.ceil(okr.donorRecencyTotalCount / okr.donorRecencyPageSize))
      : 1

  return (
    <div>
      <h1 className="h3 mb-3">OKR metrics</h1>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      {okr ? (
        <div className="row g-3">
          <div className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Active supporters</div>
                <div className="display-6">{okr.activeSupporters}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Total donation value (est.)</div>
                <div className="display-6">{okr.totalDonationValue}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Donations (90d)</div>
                <div className="display-6">{okr.donationsLast90Days}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Cohort median gap (days)</div>
                <div className="display-6">{okr.cohortMedianGapDays}</div>
                <p className="small text-secondary mb-0 mt-2">
                  Median days between consecutive gifts across all donors with at least two gifts.
                </p>
              </div>
            </div>
          </div>
          <div className="col-12">
            <h2 className="h5">Donors with gifts</h2>
            <p className="small text-secondary mb-2">
              Every supporter with at least one donation record, sorted by name. {DONOR_PAGE_SIZE} rows per page.
            </p>
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
                  {okr.churnRisks.map((c) => (
                    <tr key={c.supporterId}>
                      <td>{c.displayName}</td>
                      <td>{c.daysSinceLastGift}</td>
                      <td>
                        {c.averageDaysBetweenGifts != null
                          ? c.averageDaysBetweenGifts.toLocaleString(undefined, {
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
                Page {okr.donorRecencyPage} of {donorTotalPages} ({okr.donorRecencyTotalCount} with donations)
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={okr.donorRecencyPage <= 1}
                  onClick={() => setDonorPage(Math.max(1, okr.donorRecencyPage - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={okr.donorRecencyPage >= donorTotalPages}
                  onClick={() => setDonorPage(Math.min(donorTotalPages, okr.donorRecencyPage + 1))}
                >
                  Next
                </button>
              </div>
            </div>
            {okr.donorRecencyTotalCount === 0 ? (
              <p className="small text-secondary mb-0">No donation rows yet.</p>
            ) : null}
          </div>
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Resident education progress outcomes</div>
                <p className="mb-0 small">Available after data import.</p>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Resident health and reintegration success rate</div>
                <p className="mb-0 small">Available after data import.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted">Loading…</p>
      )}
    </div>
  )
}
