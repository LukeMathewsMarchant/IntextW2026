import { useEffect, useState } from 'react'
import { fetchJson, type AuthMe } from '../api/client'

type Summary = {
  count: number
  totalEstimated: number
  lastDonationDate?: string
  daysSinceLastDonation?: number | null
}

type DonationHistoryRow = {
  donationDate: string
  amount: number
  notes?: string | null
}

type DonateResponse = {
  donationId: number
  message?: string
}

export function DonorDashboard() {
  const [me, setMe] = useState<AuthMe | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [monthlyAmount, setMonthlyAmount] = useState(25)
  const [notes, setNotes] = useState('')
  const [isSubmittingDonation, setIsSubmittingDonation] = useState(false)
  const [donationMsg, setDonationMsg] = useState<string | null>(null)
  const [history, setHistory] = useState<DonationHistoryRow[]>([])

  useEffect(() => {
    fetchJson<AuthMe>('/api/auth/me')
      .then(setMe)
      .catch(() => setErr('Could not load session'))
  }, [])

  useEffect(() => {
    if (!me?.isAuthenticated || !me.roles.includes('Donor')) return
    fetchJson<Summary>('/api/donor/summary')
      .then(setSummary)
      .catch((e: Error) => setErr(e.message))

    fetchJson<DonationHistoryRow[]>('/api/donor/history')
      .then(setHistory)
      .catch((e: Error) => setErr(e.message))
  }, [me])

  async function submitDonation() {
    if (!me?.isAuthenticated || !me.roles.includes('Donor')) return
    if (monthlyAmount <= 0) {
      setErr('Please enter an amount greater than zero.')
      return
    }

    setIsSubmittingDonation(true)
    setDonationMsg(null)
    setErr(null)
    try {
      const donateResult = await fetchJson<DonateResponse>('/api/donor/donate', {
        method: 'POST',
        body: JSON.stringify({
          amount: monthlyAmount,
          notes: notes.trim() || null,
          isRecurring: false,
        }),
      })
      const refreshed = await fetchJson<Summary>('/api/donor/summary')
      const refreshedHistory = await fetchJson<DonationHistoryRow[]>('/api/donor/history')
      setSummary(refreshed)
      setHistory(refreshedHistory)
      setDonationMsg(donateResult.message ?? 'Donation recorded successfully.')
      setNotes('')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not submit donation.')
    } finally {
      setIsSubmittingDonation(false)
    }
  }

  return (
    <div>
      <div className="lh-dash-header">
        <div>
          <h1 className="lh-dash-title h3 mb-1">Your giving</h1>
          <p className="lh-dash-sub mb-0">Track your donations and giving history.</p>
        </div>
      </div>

      {err ? <div className="alert alert-warning">{err}</div> : null}

      <div className="lh-kpi-row">
        <div className="lh-kpi-card lh-kpi-deep">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="small opacity-90">Total (USD)</div>
              <div className="lh-kpi-value mt-1">
                {summary
                  ? summary.totalEstimated.toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '—'}
              </div>
              <div className="lh-kpi-meta mt-1">From linked supporter record</div>
            </div>
            <span className="fs-4">&#36;</span>
          </div>
        </div>
        <div className="lh-kpi-card">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="lh-kpi-label small">Gifts recorded</div>
              <div className="lh-kpi-value lh-kpi-value-strong mt-1">{summary?.count ?? '—'}</div>
              <div className="lh-kpi-meta text-success small mt-1">All time</div>
            </div>
            <span className="text-primary fs-4">&#9829;</span>
          </div>
        </div>
        <div className="lh-kpi-card">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="lh-kpi-label small">Days since last gift</div>
              <div className="lh-kpi-value lh-kpi-value-strong mt-1">{summary?.daysSinceLastDonation ?? '—'}</div>
              <div className="lh-kpi-meta text-warning small mt-1">Recency signal</div>
            </div>
            <span className="text-secondary fs-4">&#9201;</span>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-7">
          <div className="lh-chart-card h-100">
            <div className="fw-semibold mb-2">Donate from dashboard</div>
            <p className="text-secondary small mb-3">Submit a donation directly from your donor dashboard.</p>
            <div className="row g-3 align-items-end">
              <div className="col-sm-6">
                <label className="form-label small text-secondary mb-1" htmlFor="monthlyAmount">
                  Donation amount (USD)
                </label>
                <input
                  id="monthlyAmount"
                  className="form-control"
                  type="number"
                  min={1}
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(Number(e.target.value || 0))}
                />
              </div>
              <div className="col-12">
                <label className="form-label small text-secondary mb-1" htmlFor="donationNotes">
                  Notes (optional)
                </label>
                <textarea
                  id="donationNotes"
                  className="form-control"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="col-12">
                <button type="button" className="btn btn-primary lh-btn-pill" onClick={submitDonation} disabled={isSubmittingDonation}>
                  {isSubmittingDonation ? 'Submitting...' : 'Submit donation'}
                </button>
              </div>
            </div>
            {donationMsg ? <div className="alert alert-success mt-3 mb-0 py-2">{donationMsg}</div> : null}
          </div>
        </div>
        <div className="col-lg-5">
          <div className="lh-chart-card h-100">
            <div className="fw-semibold mb-2">Donation History</div>
            {history.length === 0 ? (
              <p className="small text-secondary mb-0">No donations recorded yet.</p>
            ) : (
              <div className="table-responsive overflow-auto" style={{ maxHeight: 320 }}>
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-end">Amount (USD)</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, idx) => (
                      <tr key={`${row.donationDate}-${idx}`}>
                        <td className="text-nowrap">{row.donationDate}</td>
                        <td className="text-end">{row.amount.toFixed(2)}</td>
                        <td>{row.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {!summary && me?.isAuthenticated && me.roles.includes('Donor') ? (
        <p className="text-muted small mt-2 mb-0">Link your account to a supporter ID at registration to load personalized totals.</p>
      ) : null}
    </div>
  )
}
