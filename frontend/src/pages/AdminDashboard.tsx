import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<{ activeSupporters: number; totalDonationValue: number; donationsLast90Days: number } | null>(null)
  const [residentCount, setResidentCount] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchJson<{ activeSupporters: number; totalDonationValue: number; donationsLast90Days: number }>('/api/admin/metrics/okr'),
      fetchJson<unknown[]>('/api/admin/data/residents'),
    ])
      .then(([m, residents]) => {
        setMetrics(m)
        setResidentCount(Array.isArray(residents) ? residents.length : 0)
      })
      .catch((e: Error) => setErr(e.message))
  }, [])

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
              <div className="small opacity-75">Total donations</div>
              <div className="lh-kpi-value mt-1">{metrics ? metrics.totalDonationValue.toLocaleString() : '—'}</div>
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
              <div className="lh-kpi-meta text-success small mt-1">Current active supporters</div>
            </div>
            <span className="text-primary fs-4">&#9829;</span>
          </div>
        </div>
        <div className="lh-kpi-card">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-secondary small">Active residents</div>
              <div className="lh-kpi-value lh-kpi-value-strong mt-1">{residentCount ?? '—'}</div>
              <div className="lh-kpi-meta text-danger small mt-1">Current resident records</div>
            </div>
            <span className="text-secondary fs-4">&#128101;</span>
          </div>
        </div>
        <div className="lh-kpi-card lh-kpi-success">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="small opacity-90">Donations (90 days)</div>
              <div className="lh-kpi-value mt-1">{metrics ? metrics.donationsLast90Days : '—'}</div>
              <div className="lh-kpi-meta mt-1">Live rolling count</div>
            </div>
            <span className="lh-kpi-icon fs-4">&#128200;</span>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="lh-chart-card h-100">
            <div className="fw-semibold mb-1">Donation trends</div>
            <div className="text-secondary small mb-3">Use Reports & Analytics for detailed trend charts.</div>
            <div className="lh-chart-placeholder">Trend visual summary available after data import expansion</div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="lh-chart-card h-100">
            <div className="fw-semibold mb-1">Program enrollment</div>
            <div className="text-secondary small mb-3">Residents per program and safehouse</div>
            <div className="lh-chart-placeholder" style={{ height: 200 }}>
              Available after data import
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <div className="lh-chart-card">
            <div className="fw-semibold mb-3">Recent activity</div>
            <ul className="list-unstyled mb-0 small">
              <li className="d-flex gap-2 py-2 border-bottom border-light-subtle">
                <span>&#128176;</span>
                <div>
                  <div className="fw-semibold">New donation received</div>
                  <div className="text-secondary">Batch import / online — 2 hours ago</div>
                </div>
              </li>
              <li className="d-flex gap-2 py-2 border-bottom border-light-subtle">
                <span>&#128221;</span>
                <div>
                  <div className="fw-semibold">Case note added</div>
                  <div className="text-secondary">Resident record updated — 5 hours ago</div>
                </div>
              </li>
              <li className="d-flex gap-2 py-2">
                <span>&#9888;</span>
                <div>
                  <div className="fw-semibold">At-risk donor flagged</div>
                  <div className="text-secondary">Heuristic churn rule — yesterday</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="lh-chart-card">
            <div className="fw-semibold mb-3">Quick actions</div>
            <div className="row g-2">
              <div className="col-6">
                <Link className="btn btn-primary w-100 lh-btn-pill btn-sm" to="/Admin/DonorsContributions">
                  Donors & contrib
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn btn-success w-100 lh-btn-pill btn-sm" to="/Admin/CaseloadInventory">
                  Caseload
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
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link className="btn btn-outline-primary btn-sm lh-btn-pill" to="/Admin/DonorsContributions">
          Donors & contributions
        </Link>
        <Link className="btn btn-outline-primary btn-sm lh-btn-pill" to="/Admin/CaseloadInventory">
          Caseload inventory
        </Link>
        <Link className="btn btn-outline-primary btn-sm lh-btn-pill" to="/Admin/ProcessRecording">
          Process recording
        </Link>
        <Link className="btn btn-outline-primary btn-sm lh-btn-pill" to="/Admin/HomeVisitationConferences">
          Home visitation & conferences
        </Link>
        <Link className="btn btn-outline-primary btn-sm lh-btn-pill" to="/Admin/Audit">
          Audit log
        </Link>
        <Link className="btn btn-outline-primary btn-sm lh-btn-pill" to="/Admin/Okr">
          OKR metrics
        </Link>
        <Link className="btn btn-outline-primary btn-sm lh-btn-pill" to="/Admin/Analytics">
          Donor analytics
        </Link>
      </div>

    </div>
  )
}
