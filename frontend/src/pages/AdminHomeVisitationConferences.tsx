import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'

type Visitation = {
  visitationId?: number
  residentId?: number
  visitDate?: string
  visitType?: string
  observations?: string
  familyCooperationLevel?: string
  safetyConcerns?: string
  followUpActions?: string
}

type Plan = {
  planId?: number
  residentId?: number
  reviewDate?: string
  notes?: string
}

const emptyVisit = {
  residentId: '',
  visitDate: new Date().toISOString().slice(0, 10),
  visitType: 'RoutineFollowUp',
  observations: '',
  familyCooperationLevel: '',
  safetyConcerns: '',
  followUpActions: '',
}

export function AdminHomeVisitationConferences() {
  const [visits, setVisits] = useState<Visitation[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [residentFilter, setResidentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [form, setForm] = useState(emptyVisit)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    try {
      setErr(null)
      const [v, p] = await Promise.all([
        fetchJson<Visitation[]>('/api/admin/data/home_visitations'),
        fetchJson<Plan[]>('/api/admin/data/intervention_plans'),
      ])
      setVisits(Array.isArray(v) ? v : [])
      setPlans(Array.isArray(p) ? p : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load visitations and conferences.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredVisits = useMemo(() => {
    return visits
      .filter((v) => {
        const residentOk = !residentFilter || String(v.residentId ?? '') === residentFilter
        const typeOk = !typeFilter || (v.visitType ?? '') === typeFilter
        return residentOk && typeOk
      })
      .sort((a, b) => String(b.visitDate ?? '').localeCompare(String(a.visitDate ?? '')))
  }, [residentFilter, typeFilter, visits])

  const now = new Date().toISOString().slice(0, 10)
  const upcomingConferences = useMemo(() => plans.filter((p) => (p.reviewDate ?? '') >= now).slice(0, 50), [now, plans])
  const pastConferences = useMemo(() => plans.filter((p) => (p.reviewDate ?? '') < now).slice(0, 50), [now, plans])

  async function createVisit() {
    const rid = Number(form.residentId)
    if (!rid || !form.visitDate) {
      setErr('Resident ID and visit date are required.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      await fetchJson('/api/admin/data/home_visitations', {
        method: 'POST',
        body: JSON.stringify({
          residentId: rid,
          visitDate: form.visitDate,
          visitType: form.visitType,
          observations: form.observations || null,
          familyCooperationLevel: form.familyCooperationLevel || null,
          safetyConcerns: form.safetyConcerns || null,
          followUpActions: form.followUpActions || null,
        }),
      })
      setForm(emptyVisit)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save visitation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="h3 mb-2">Home Visitation & Case Conferences</h1>
      <p className="text-secondary mb-3">Log field visits and review conference-like milestones using available planning records.</p>
      {err ? <div className="alert alert-warning">{err}</div> : null}

      <div className="row g-3 mb-3">
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-2">Log home/field visit</h2>
              <div className="row g-2">
                <div className="col-4">
                  <input className="form-control form-control-sm" placeholder="Resident ID" value={form.residentId} onChange={(e) => setForm((p) => ({ ...p, residentId: e.target.value }))} />
                </div>
                <div className="col-4">
                  <input className="form-control form-control-sm" type="date" value={form.visitDate} onChange={(e) => setForm((p) => ({ ...p, visitDate: e.target.value }))} />
                </div>
                <div className="col-4">
                  <select className="form-select form-select-sm" value={form.visitType} onChange={(e) => setForm((p) => ({ ...p, visitType: e.target.value }))}>
                    <option value="InitialAssessment">Initial assessment</option>
                    <option value="RoutineFollowUp">Routine follow-up</option>
                    <option value="ReintegrationAssessment">Reintegration assessment</option>
                    <option value="PostPlacementMonitoring">Post-placement monitoring</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" rows={2} placeholder="Home environment observations" value={form.observations} onChange={(e) => setForm((p) => ({ ...p, observations: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Family cooperation level" value={form.familyCooperationLevel} onChange={(e) => setForm((p) => ({ ...p, familyCooperationLevel: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Safety concerns" value={form.safetyConcerns} onChange={(e) => setForm((p) => ({ ...p, safetyConcerns: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" rows={2} placeholder="Follow-up actions" value={form.followUpActions} onChange={(e) => setForm((p) => ({ ...p, followUpActions: e.target.value }))} />
                </div>
                <div className="col-12">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createVisit}>
                    Save visitation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-2">Visitation history</h2>
              <div className="row g-2 mb-2">
                <div className="col-md-4">
                  <input className="form-control form-control-sm" placeholder="Resident ID filter" value={residentFilter} onChange={(e) => setResidentFilter(e.target.value)} />
                </div>
                <div className="col-md-8">
                  <select className="form-select form-select-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="">All visit types</option>
                    <option value="InitialAssessment">Initial assessment</option>
                    <option value="RoutineFollowUp">Routine follow-up</option>
                    <option value="ReintegrationAssessment">Reintegration assessment</option>
                    <option value="PostPlacementMonitoring">Post-placement monitoring</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>Date</th><th>Resident</th><th>Type</th><th>Safety</th><th>Follow-up</th></tr></thead>
                  <tbody>
                    {filteredVisits.slice(0, 120).map((v) => (
                      <tr key={v.visitationId ?? `${v.residentId}-${v.visitDate}-${v.visitType}`}>
                        <td>{v.visitDate ?? '—'}</td>
                        <td>{v.residentId ?? '—'}</td>
                        <td>{v.visitType ?? '—'}</td>
                        <td>{v.safetyConcerns ?? '—'}</td>
                        <td>{v.followUpActions ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredVisits.length === 0 ? <p className="small text-secondary mb-0">No visitation entries for current filters.</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-2">Upcoming case conferences</h2>
              <p className="small text-secondary">Derived from intervention plan review dates until dedicated conference data is imported.</p>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead><tr><th>Review date</th><th>Resident</th><th>Notes</th></tr></thead>
                  <tbody>
                    {upcomingConferences.map((c) => (
                      <tr key={c.planId ?? `${c.residentId}-${c.reviewDate}`}>
                        <td>{c.reviewDate ?? '—'}</td><td>{c.residentId ?? '—'}</td><td>{c.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {upcomingConferences.length === 0 ? <p className="small text-secondary mt-2 mb-0">No upcoming conferences in current data. Available after conference imports.</p> : null}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-2">Conference history</h2>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead><tr><th>Review date</th><th>Resident</th><th>Notes</th></tr></thead>
                  <tbody>
                    {pastConferences.map((c) => (
                      <tr key={c.planId ?? `${c.residentId}-${c.reviewDate}`}>
                        <td>{c.reviewDate ?? '—'}</td><td>{c.residentId ?? '—'}</td><td>{c.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pastConferences.length === 0 ? <p className="small text-secondary mt-2 mb-0">No conference history rows yet.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
