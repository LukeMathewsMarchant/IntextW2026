import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchJson } from '../api/client'

type Row = {
  supporterId: number
  displayName: string
  lastDonation: string
  cohortMedianGapDays: number
}

export function AdminAnalytics() {
  const [rows, setRows] = useState<Row[]>([])
  const [monthly, setMonthly] = useState<Array<{ month: string; total: number }>>([])
  const [safehouseCounts, setSafehouseCounts] = useState<Array<{ safehouseId: string; residents: number }>>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchJson<Row[]>('/api/admin/analytics/donor-propensity'),
      fetchJson<Array<{ donationDate?: string; estimatedValue?: number; amount?: number }>>('/api/admin/data/donations'),
      fetchJson<Array<{ safehouseId?: number }>>('/api/admin/data/residents'),
    ])
      .then(([r, donations, residents]) => {
        setRows(r)
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

      <h2 className="h5 mb-2">Donor propensity (recency heuristic)</h2>
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
