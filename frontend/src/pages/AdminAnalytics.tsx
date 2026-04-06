import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

type Row = {
  supporterId: number
  displayName: string
  lastDonation: string
  cohortMedianGapDays: number
}

export function AdminAnalytics() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<Row[]>('/api/admin/analytics/donor-propensity')
      .then(setRows)
      .catch((e: Error) => setErr(e.message))
  }, [])

  return (
    <div>
      <h1 className="h3 mb-3">Donor propensity</h1>
      <p className="text-secondary">At-risk donors by recency (simple cohort gap).</p>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      <div className="table-responsive">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Supporter</th>
              <th>Last donation</th>
              <th>Median gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.supporterId}>
                <td>{r.displayName}</td>
                <td>{r.lastDonation}</td>
                <td>{r.cohortMedianGapDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
