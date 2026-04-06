import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

type Okr = {
  activeSupporters: number
  totalDonationValue: number
  donationsLast90Days: number
  churnRisks: { supporterId: number; displayName: string; lastDonation: string; cohortMedianGapDays: number }[]
}

export function AdminOkr() {
  const [okr, setOkr] = useState<Okr | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<Okr>('/api/admin/metrics/okr')
      .then(setOkr)
      .catch((e: Error) => setErr(e.message))
  }, [])

  return (
    <div>
      <h1 className="h3 mb-3">OKR metrics</h1>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      {okr ? (
        <div className="row g-3">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Active supporters</div>
                <div className="display-6">{okr.activeSupporters}</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Total donation value (est.)</div>
                <div className="display-6">{okr.totalDonationValue}</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Donations (90d)</div>
                <div className="display-6">{okr.donationsLast90Days}</div>
              </div>
            </div>
          </div>
          <div className="col-12">
            <h2 className="h5">Churn risk (recency heuristic)</h2>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Supporter</th>
                    <th>Last gift</th>
                    <th>Cohort median gap (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {okr.churnRisks.map((c) => (
                    <tr key={c.supporterId}>
                      <td>{c.displayName}</td>
                      <td>{c.lastDonation}</td>
                      <td>{c.cohortMedianGapDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted">Loading…</p>
      )}
    </div>
  )
}
