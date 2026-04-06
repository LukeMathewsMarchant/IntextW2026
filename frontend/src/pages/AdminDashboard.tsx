import { Link } from 'react-router-dom'

const entities = [
  'users',
  'safehouses',
  'supporters',
  'donations',
  'donation_allocations',
  'in_kind_donation_items',
  'partners',
  'partner_assignments',
  'residents',
  'education_records',
  'health_wellbeing_records',
  'intervention_plans',
  'home_visitations',
  'process_recordings',
  'incident_reports',
  'safehouse_monthly_metrics',
  'public_impact_snapshots',
]

export function AdminDashboard() {
  return (
    <div>
      <div className="lh-dash-header">
        <div>
          <h1 className="lh-dash-title h3 mb-1">Dashboard</h1>
          <p className="lh-dash-sub mb-0">Welcome back — here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="lh-search-pill small text-secondary d-none d-md-inline">&#128269; Search…</span>
          <span className="position-relative" title="Notifications">
            &#128276;
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.55rem' }}>
              3
            </span>
          </span>
          <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center" style={{ width: 36, height: 36, fontSize: '0.8rem' }}>
            AD
          </span>
        </div>
      </div>

      <div className="lh-kpi-row">
        <div className="lh-kpi-card lh-kpi-primary">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="small opacity-75">Total donations</div>
              <div className="lh-kpi-value mt-1">$127,400</div>
              <div className="lh-kpi-meta mt-1">+12.5% from last month</div>
            </div>
            <span className="lh-kpi-icon fs-4">&#36;</span>
          </div>
        </div>
        <div className="lh-kpi-card">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-secondary small">Active donors</div>
              <div className="lh-kpi-value text-dark mt-1">342</div>
              <div className="lh-kpi-meta text-success small mt-1">+8.2% from last month</div>
            </div>
            <span className="text-primary fs-4">&#9829;</span>
          </div>
        </div>
        <div className="lh-kpi-card">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-secondary small">Active residents</div>
              <div className="lh-kpi-value text-dark mt-1">47</div>
              <div className="lh-kpi-meta text-danger small mt-1">-2.1% from last month</div>
            </div>
            <span className="text-secondary fs-4">&#128101;</span>
          </div>
        </div>
        <div className="lh-kpi-card lh-kpi-success">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="small opacity-90">Donor retention</div>
              <div className="lh-kpi-value mt-1">78%</div>
              <div className="lh-kpi-meta mt-1">+5.3% from last month</div>
            </div>
            <span className="lh-kpi-icon fs-4">&#128200;</span>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="lh-chart-card h-100">
            <div className="fw-semibold mb-1">Donation trends</div>
            <div className="text-secondary small mb-3">Monthly totals (placeholder chart — wire to /api/admin metrics)</div>
            <div className="lh-chart-placeholder">Chart area (Recharts)</div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="lh-chart-card h-100">
            <div className="fw-semibold mb-1">Program enrollment</div>
            <div className="text-secondary small mb-3">Residents per program</div>
            <div className="lh-chart-placeholder" style={{ height: 200 }}>
              Bar chart placeholder
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
                <Link className="btn btn-primary w-100 lh-btn-pill btn-sm" to="/Admin/Crud/supporters">
                  Add donor
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn btn-success w-100 lh-btn-pill btn-sm" to="/Admin/Crud/residents">
                  Case note
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn lh-btn-ghost w-100 lh-btn-pill btn-sm" to="/Admin/Okr">
                  OKR report
                </Link>
              </div>
              <div className="col-6">
                <Link className="btn lh-btn-ghost w-100 lh-btn-pill btn-sm" to="/Admin/Audit">
                  Audit log
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
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

      <h2 className="h6 text-secondary text-uppercase mb-2">Data tables</h2>
      <div className="row g-2">
        {entities.map((e) => (
          <div className="col-md-4" key={e}>
            <Link className="btn lh-btn-ghost border w-100 text-start text-truncate lh-btn-pill py-2" to={`/Admin/Crud/${e}`}>
              {e}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
