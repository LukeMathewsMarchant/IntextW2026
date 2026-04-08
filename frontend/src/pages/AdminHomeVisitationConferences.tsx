import { Fragment, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'

type Visitation = {
  visitationId?: number
  residentId?: number
  visitDate?: string
  socialWorker?: string
  visitType?: string | number
  locationVisited?: string
  familyMembersPresent?: string
  purpose?: string
  observations?: string
  familyCooperationLevel?: string | number
  safetyConcernsNoted?: boolean
  followUpNeeded?: boolean
  followUpNotes?: string
  visitOutcome?: string | number
}

type Plan = {
  planId?: number
  residentId?: number
  caseConferenceDate?: string
  planDescription?: string
  status?: string | number
  planCategory?: string | number
  targetDate?: string | null
  targetValue?: number | null
  servicesProvided?: string | null
  createdAt?: string
  updatedAt?: string
}

type ResidentLookup = {
  residentId?: number
  caseControlNo?: string
  internalCode?: string
  safehouseId?: number
  caseStatus?: string
}

const emptyVisit = {
  residentId: '',
  visitDate: new Date().toISOString().slice(0, 10),
  visitType: '1',
  observations: '',
  familyCooperationLevel: '',
  safetyConcernsNoted: false,
  followUpNeeded: false,
  followUpNotes: '',
}

const emptyConference = {
  residentId: '',
  planCategory: '0',
  status: '0',
  caseConferenceDate: new Date().toISOString().slice(0, 10),
  planDescription: '',
}

export function AdminHomeVisitationConferences() {
  function visitTypeLabel(value: string | number | undefined) {
    const idx = typeof value === 'number' ? value : Number(value)
    const labels = ['Initial Assessment', 'Routine Follow-Up', 'Reintegration Assessment', 'Post-Placement Monitoring', 'Emergency']
    return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? labels[idx] : (value ?? '—')
  }
  function planCategoryLabel(value: string | number | undefined) {
    const idx = typeof value === 'number' ? value : Number(value)
    const labels = ['Safety', 'Education', 'Physical Health']
    return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? labels[idx] : (value ?? '—')
  }
  function planStatusLabel(value: string | number | undefined) {
    const idx = typeof value === 'number' ? value : Number(value)
    const labels = ['Open', 'In Progress', 'On Hold', 'Achieved', 'Closed']
    return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? labels[idx] : (value ?? '—')
  }
  function cooperationLevelLabel(value: string | number | undefined) {
    const idx = typeof value === 'number' ? value : Number(value)
    const labels = ['Highly Cooperative', 'Cooperative', 'Neutral', 'Uncooperative']
    return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? labels[idx] : (value ?? '—')
  }
  function visitOutcomeLabel(value: string | number | undefined) {
    const idx = typeof value === 'number' ? value : Number(value)
    const labels = ['Favorable', 'Inconclusive', 'Needs Improvement', 'Unfavorable']
    return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? labels[idx] : (value ?? '—')
  }

  const [visits, setVisits] = useState<Visitation[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [residents, setResidents] = useState<ResidentLookup[]>([])
  const [residentFilter, setResidentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [residentLookupFilter, setResidentLookupFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'visitation' | 'conferences' | 'residentLookup'>('visitation')
  const [form, setForm] = useState(emptyVisit)
  const [conferenceForm, setConferenceForm] = useState(emptyConference)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null)
  const [editVisitForm, setEditVisitForm] = useState({
    residentId: '',
    visitDate: '',
    visitType: '1',
    observations: '',
    familyCooperationLevel: '',
    safetyConcernsNoted: false,
    followUpNeeded: false,
    followUpNotes: '',
    socialWorker: 'Admin',
    locationVisited: '',
    familyMembersPresent: '',
    purpose: '',
    visitOutcome: '',
  })
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null)
  const [editConferenceForm, setEditConferenceForm] = useState({
    residentId: '',
    planCategory: '0',
    status: '0',
    caseConferenceDate: '',
    planDescription: '',
  })

  async function load() {
    try {
      setErr(null)
      const [v, p, r] = await Promise.all([
        fetchJson<Visitation[]>('/api/admin/data/home_visitations'),
        fetchJson<Plan[]>('/api/admin/data/intervention_plans'),
        fetchJson<ResidentLookup[]>('/api/admin/data/residents'),
      ])
      setVisits(Array.isArray(v) ? v : [])
      setPlans(Array.isArray(p) ? p : [])
      setResidents(Array.isArray(r) ? r : [])
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
        const typeOk = !typeFilter || String(v.visitType ?? '') === typeFilter
        return residentOk && typeOk
      })
      .sort((a, b) => String(b.visitDate ?? '').localeCompare(String(a.visitDate ?? '')))
  }, [residentFilter, typeFilter, visits])

  const now = new Date().toISOString().slice(0, 10)
  const plansWithConferenceDate = useMemo(
    () => plans.filter((p) => Boolean(p.caseConferenceDate)),
    [plans],
  )
  const upcomingConferences = useMemo(
    () =>
      plansWithConferenceDate
        .filter((p) => (p.caseConferenceDate ?? '') >= now)
        .sort((a, b) => {
          const byDate = String(a.caseConferenceDate ?? '').localeCompare(String(b.caseConferenceDate ?? ''))
          if (byDate !== 0) return byDate
          return Number(b.planId ?? 0) - Number(a.planId ?? 0)
        }),
    [now, plansWithConferenceDate],
  )
  const pastConferences = useMemo(
    () =>
      plansWithConferenceDate
        .filter((p) => (p.caseConferenceDate ?? '') < now)
        .sort((a, b) => {
          const byDate = String(b.caseConferenceDate ?? '').localeCompare(String(a.caseConferenceDate ?? ''))
          if (byDate !== 0) return byDate
          return Number(b.planId ?? 0) - Number(a.planId ?? 0)
        }),
    [now, plansWithConferenceDate],
  )
  const filteredResidentLookup = useMemo(() => {
    const query = residentLookupFilter.trim().toLowerCase()
    return residents
      .filter((r) => {
        if (!query) return true
        const haystack = `${r.residentId ?? ''} ${r.caseControlNo ?? ''} ${r.internalCode ?? ''} ${r.safehouseId ?? ''} ${r.caseStatus ?? ''}`.toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 500)
  }, [residentLookupFilter, residents])

  async function createVisit() {
    const rid = Number(form.residentId)
    if (!rid || !form.visitDate) {
      setErr('Resident ID and visit date are required.')
      return
    }
    if (form.familyCooperationLevel === '') {
      setErr('Please choose a family cooperation level before saving.')
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
          visitType: Number(form.visitType),
          observations: form.observations || null,
          familyCooperationLevel: form.familyCooperationLevel === '' ? null : Number(form.familyCooperationLevel),
          safetyConcernsNoted: form.safetyConcernsNoted,
          followUpNeeded: form.followUpNeeded,
          followUpNotes: form.followUpNotes || null,
          socialWorker: 'Admin',
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

  async function createConference() {
    const rid = Number(conferenceForm.residentId)
    if (!rid) {
      setErr('Resident ID is required for case conference.')
      return
    }
    if (!conferenceForm.caseConferenceDate) {
      setErr('Case conference date is required.')
      return
    }

    try {
      setBusy(true)
      setErr(null)
      await fetchJson('/api/admin/data/intervention_plans', {
        method: 'POST',
        body: JSON.stringify({
          residentId: rid,
          planCategory: Number(conferenceForm.planCategory),
          status: Number(conferenceForm.status),
          caseConferenceDate: conferenceForm.caseConferenceDate,
          planDescription: conferenceForm.planDescription || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
      setConferenceForm(emptyConference)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save case conference.')
    } finally {
      setBusy(false)
    }
  }

  function startEditVisit(visit: Visitation) {
    if (editingVisitId === (visit.visitationId ?? null)) {
      setEditingVisitId(null)
      return
    }
    setErr(null)
    setEditingVisitId(visit.visitationId ?? null)
    setEditVisitForm({
      residentId: String(visit.residentId ?? ''),
      visitDate: visit.visitDate ?? '',
      visitType: String(visit.visitType ?? 1),
      observations: visit.observations ?? '',
      familyCooperationLevel: visit.familyCooperationLevel === undefined || visit.familyCooperationLevel === null ? '' : String(visit.familyCooperationLevel),
      safetyConcernsNoted: Boolean(visit.safetyConcernsNoted),
      followUpNeeded: Boolean(visit.followUpNeeded),
      followUpNotes: visit.followUpNotes ?? '',
      socialWorker: visit.socialWorker ?? 'Admin',
      locationVisited: visit.locationVisited ?? '',
      familyMembersPresent: visit.familyMembersPresent ?? '',
      purpose: visit.purpose ?? '',
      visitOutcome: visit.visitOutcome === undefined || visit.visitOutcome === null ? '' : String(visit.visitOutcome),
    })
  }

  function cancelEditVisit() {
    setEditingVisitId(null)
  }

  async function saveVisitEdit(original: Visitation) {
    const vid = Number(original.visitationId)
    const rid = Number(editVisitForm.residentId)
    if (!vid) {
      setErr('Cannot update visitation: missing visitation ID.')
      return
    }
    if (!rid || !editVisitForm.visitDate) {
      setErr('Resident ID and visit date are required.')
      return
    }
    if (editVisitForm.familyCooperationLevel === '') {
      setErr('Please choose a family cooperation level before saving.')
      return
    }

    try {
      setBusy(true)
      setErr(null)
      await fetchJson(`/api/admin/data/home_visitations/${vid}`, {
        method: 'PUT',
        body: JSON.stringify({
          visitationId: vid,
          residentId: rid,
          visitDate: editVisitForm.visitDate,
          socialWorker: editVisitForm.socialWorker || 'Admin',
          visitType: Number(editVisitForm.visitType),
          locationVisited: editVisitForm.locationVisited || null,
          familyMembersPresent: editVisitForm.familyMembersPresent || null,
          purpose: editVisitForm.purpose || null,
          observations: editVisitForm.observations || null,
          familyCooperationLevel: Number(editVisitForm.familyCooperationLevel),
          safetyConcernsNoted: editVisitForm.safetyConcernsNoted,
          followUpNeeded: editVisitForm.followUpNeeded,
          followUpNotes: editVisitForm.followUpNotes || null,
          visitOutcome: editVisitForm.visitOutcome === '' ? null : Number(editVisitForm.visitOutcome),
        }),
      })
      setEditingVisitId(null)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update visitation.')
    } finally {
      setBusy(false)
    }
  }

  function startEditConference(plan: Plan) {
    setErr(null)
    setEditingPlanId(plan.planId ?? null)
    setEditConferenceForm({
      residentId: String(plan.residentId ?? ''),
      planCategory: String(plan.planCategory ?? 0),
      status: String(plan.status ?? 0),
      caseConferenceDate: plan.caseConferenceDate ?? '',
      planDescription: plan.planDescription ?? '',
    })
  }

  function cancelEditConference() {
    setEditingPlanId(null)
  }

  async function saveConferenceEdit(original: Plan) {
    const pid = Number(original.planId)
    const rid = Number(editConferenceForm.residentId)
    if (!pid) {
      setErr('Cannot update case conference: missing plan ID.')
      return
    }
    if (!rid || !editConferenceForm.caseConferenceDate) {
      setErr('Resident ID and conference date are required.')
      return
    }

    try {
      setBusy(true)
      setErr(null)
      await fetchJson(`/api/admin/data/intervention_plans/${pid}`, {
        method: 'PUT',
        body: JSON.stringify({
          planId: pid,
          residentId: rid,
          planCategory: Number(editConferenceForm.planCategory),
          status: Number(editConferenceForm.status),
          caseConferenceDate: editConferenceForm.caseConferenceDate,
          planDescription: editConferenceForm.planDescription || null,
          targetDate: original.targetDate ?? null,
          targetValue: original.targetValue ?? null,
          servicesProvided: original.servicesProvided ?? null,
          createdAt: original.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
      setEditingPlanId(null)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update case conference.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="h3 mb-2">Home Visitation & Case Conferences</h1>
      <p className="text-secondary mb-3">Log field visits and review conference-like milestones using available planning records.</p>
      {err ? <div className="alert alert-warning">{err}</div> : null}

      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'visitation' ? 'active' : ''}`}
            onClick={() => setActiveTab('visitation')}
          >
            Visitation workflow
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'conferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('conferences')}
          >
            Case conferences
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'residentLookup' ? 'active' : ''}`}
            onClick={() => setActiveTab('residentLookup')}
          >
            Resident lookup (IDs)
          </button>
        </li>
      </ul>

      {activeTab === 'visitation' ? (
        <>
      <div className="row g-3 mb-3">
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-2">Log home/field visit</h2>
              <div className="row g-2">
                <div className="col-4">
                  <label className="form-label small mb-1" htmlFor="visit-resident-id">Resident ID</label>
                  <input
                    id="visit-resident-id"
                    className="form-control form-control-sm"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 101"
                    value={form.residentId}
                    onChange={(e) => setForm((p) => ({ ...p, residentId: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small mb-1" htmlFor="visit-date">Visit date</label>
                  <input id="visit-date" className="form-control form-control-sm" type="date" value={form.visitDate} onChange={(e) => setForm((p) => ({ ...p, visitDate: e.target.value }))} />
                </div>
                <div className="col-4">
                  <label className="form-label small mb-1" htmlFor="visit-type">Visit type</label>
                  <select id="visit-type" className="form-select form-select-sm" value={form.visitType} onChange={(e) => setForm((p) => ({ ...p, visitType: e.target.value }))}>
                    <option value="0">Initial assessment</option>
                    <option value="1">Routine follow-up</option>
                    <option value="2">Reintegration assessment</option>
                    <option value="3">Post-placement monitoring</option>
                    <option value="4">Emergency</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label small mb-1" htmlFor="visit-observations">Observations (text)</label>
                  <textarea id="visit-observations" className="form-control form-control-sm" rows={2} placeholder="Home environment observations" value={form.observations} onChange={(e) => setForm((p) => ({ ...p, observations: e.target.value }))} />
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1" htmlFor="visit-cooperation">Family cooperation level</label>
                  <select
                    id="visit-cooperation"
                    className="form-select form-select-sm"
                    value={form.familyCooperationLevel}
                    onChange={(e) => setForm((p) => ({ ...p, familyCooperationLevel: e.target.value }))}
                  >
                    <option value="">Family cooperation level</option>
                    <option value="0">Highly Cooperative</option>
                    <option value="1">Cooperative</option>
                    <option value="2">Neutral</option>
                    <option value="3">Uncooperative</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1" htmlFor="visit-safety">Safety concerns noted?</label>
                  <select
                    id="visit-safety"
                    className="form-select form-select-sm"
                    value={form.safetyConcernsNoted ? 'yes' : 'no'}
                    onChange={(e) => setForm((p) => ({ ...p, safetyConcernsNoted: e.target.value === 'yes' }))}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1" htmlFor="visit-followup-needed">Follow-up needed?</label>
                  <select
                    id="visit-followup-needed"
                    className="form-select form-select-sm"
                    value={form.followUpNeeded ? 'yes' : 'no'}
                    onChange={(e) => setForm((p) => ({ ...p, followUpNeeded: e.target.value === 'yes' }))}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label small mb-1" htmlFor="visit-followup-notes">Follow-up notes (text)</label>
                  <textarea id="visit-followup-notes" className="form-control form-control-sm" rows={2} placeholder="Required if follow-up is needed" value={form.followUpNotes} onChange={(e) => setForm((p) => ({ ...p, followUpNotes: e.target.value }))} />
                </div>
                <div className="col-12">
                  <p className="small text-secondary mb-2">Use numbers for Resident ID, pick dropdown values for enums, and use Yes/No for boolean fields.</p>
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
                    <option value="0">Initial assessment</option>
                    <option value="1">Routine follow-up</option>
                    <option value="2">Reintegration assessment</option>
                    <option value="3">Post-placement monitoring</option>
                    <option value="4">Emergency</option>
                  </select>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>Date</th><th>Resident</th><th>Type</th><th>Follow-up needed</th><th>Follow-up notes</th><th></th></tr></thead>
                  <tbody>
                    {filteredVisits.slice(0, 120).map((v) => (
                      <Fragment key={v.visitationId ?? `${v.residentId}-${v.visitDate}-${v.visitType}`}>
                        <tr>
                          <td>{v.visitDate ?? '—'}</td>
                          <td>{v.residentId ?? '—'}</td>
                          <td>{visitTypeLabel(v.visitType)}</td>
                          <td>{v.followUpNeeded ? 'Yes' : 'No'}</td>
                          <td>{v.followUpNotes ?? '—'}</td>
                          <td className="text-end">
                            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => startEditVisit(v)}>
                              Edit / view details
                            </button>
                          </td>
                        </tr>
                        {editingVisitId === v.visitationId ? (
                          <tr>
                            <td colSpan={6}>
                              <div className="border rounded p-2 bg-body-tertiary">
                                <div className="row g-2">
                                  <div className="col-md-2">
                                    <label className="form-label small mb-1">Resident ID</label>
                                    <input className="form-control form-control-sm" type="number" min={1} step={1} value={editVisitForm.residentId} onChange={(e) => setEditVisitForm((p) => ({ ...p, residentId: e.target.value }))} />
                                  </div>
                                  <div className="col-md-2">
                                    <label className="form-label small mb-1">Visit date</label>
                                    <input className="form-control form-control-sm" type="date" value={editVisitForm.visitDate} onChange={(e) => setEditVisitForm((p) => ({ ...p, visitDate: e.target.value }))} />
                                  </div>
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Visit type</label>
                                    <select className="form-select form-select-sm" value={editVisitForm.visitType} onChange={(e) => setEditVisitForm((p) => ({ ...p, visitType: e.target.value }))}>
                                      <option value="0">Initial assessment</option>
                                      <option value="1">Routine follow-up</option>
                                      <option value="2">Reintegration assessment</option>
                                      <option value="3">Post-placement monitoring</option>
                                      <option value="4">Emergency</option>
                                    </select>
                                  </div>
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Family cooperation level</label>
                                    <select className="form-select form-select-sm" value={editVisitForm.familyCooperationLevel} onChange={(e) => setEditVisitForm((p) => ({ ...p, familyCooperationLevel: e.target.value }))}>
                                      <option value="">Family cooperation level</option>
                                      <option value="0">Highly Cooperative</option>
                                      <option value="1">Cooperative</option>
                                      <option value="2">Neutral</option>
                                      <option value="3">Uncooperative</option>
                                    </select>
                                  </div>
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Safety concerns noted?</label>
                                    <select className="form-select form-select-sm" value={editVisitForm.safetyConcernsNoted ? 'yes' : 'no'} onChange={(e) => setEditVisitForm((p) => ({ ...p, safetyConcernsNoted: e.target.value === 'yes' }))}>
                                      <option value="no">No</option>
                                      <option value="yes">Yes</option>
                                    </select>
                                  </div>
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Follow-up needed?</label>
                                    <select className="form-select form-select-sm" value={editVisitForm.followUpNeeded ? 'yes' : 'no'} onChange={(e) => setEditVisitForm((p) => ({ ...p, followUpNeeded: e.target.value === 'yes' }))}>
                                      <option value="no">No</option>
                                      <option value="yes">Yes</option>
                                    </select>
                                  </div>
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Visit outcome</label>
                                    <select className="form-select form-select-sm" value={editVisitForm.visitOutcome} onChange={(e) => setEditVisitForm((p) => ({ ...p, visitOutcome: e.target.value }))}>
                                      <option value="">No outcome recorded</option>
                                      <option value="0">Favorable</option>
                                      <option value="1">Inconclusive</option>
                                      <option value="2">Needs Improvement</option>
                                      <option value="3">Unfavorable</option>
                                    </select>
                                  </div>
                                  <div className="col-md-6">
                                    <label className="form-label small mb-1">Social worker</label>
                                    <input className="form-control form-control-sm" value={editVisitForm.socialWorker} onChange={(e) => setEditVisitForm((p) => ({ ...p, socialWorker: e.target.value }))} />
                                  </div>
                                  <div className="col-md-6">
                                    <label className="form-label small mb-1">Location visited</label>
                                    <input className="form-control form-control-sm" value={editVisitForm.locationVisited} onChange={(e) => setEditVisitForm((p) => ({ ...p, locationVisited: e.target.value }))} />
                                  </div>
                                  <div className="col-md-6">
                                    <label className="form-label small mb-1">Family members present</label>
                                    <input className="form-control form-control-sm" value={editVisitForm.familyMembersPresent} onChange={(e) => setEditVisitForm((p) => ({ ...p, familyMembersPresent: e.target.value }))} />
                                  </div>
                                  <div className="col-md-6">
                                    <label className="form-label small mb-1">Purpose</label>
                                    <input className="form-control form-control-sm" value={editVisitForm.purpose} onChange={(e) => setEditVisitForm((p) => ({ ...p, purpose: e.target.value }))} />
                                  </div>
                                  <div className="col-12">
                                    <label className="form-label small mb-1">Observations</label>
                                    <textarea className="form-control form-control-sm" rows={2} value={editVisitForm.observations} onChange={(e) => setEditVisitForm((p) => ({ ...p, observations: e.target.value }))} />
                                  </div>
                                  <div className="col-12">
                                    <label className="form-label small mb-1">Follow-up notes</label>
                                    <textarea className="form-control form-control-sm" rows={2} value={editVisitForm.followUpNotes} onChange={(e) => setEditVisitForm((p) => ({ ...p, followUpNotes: e.target.value }))} />
                                  </div>
                                  <div className="col-12">
                                    <p className="small text-secondary mb-1">
                                      Current values: cooperation {cooperationLevelLabel(v.familyCooperationLevel)}, outcome {visitOutcomeLabel(v.visitOutcome)}.
                                    </p>
                                  </div>
                                  <div className="col-12 d-flex gap-2 justify-content-end">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={cancelEditVisit}>
                                      Cancel
                                    </button>
                                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveVisitEdit(v)}>
                                      Save changes
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredVisits.length === 0 ? <p className="small text-secondary mb-0">No visitation entries for current filters.</p> : null}
            </div>
          </div>
        </div>
      </div>
      </>
      ) : activeTab === 'conferences' ? (
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h2 className="h5 mb-2">Add case conference</h2>
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label small mb-1" htmlFor="conf-resident-id">Resident ID</label>
                  <input
                    id="conf-resident-id"
                    className="form-control form-control-sm"
                    type="number"
                    min={1}
                    step={1}
                    value={conferenceForm.residentId}
                    onChange={(e) => setConferenceForm((p) => ({ ...p, residentId: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small mb-1" htmlFor="conf-category">Plan category</label>
                  <select
                    id="conf-category"
                    className="form-select form-select-sm"
                    value={conferenceForm.planCategory}
                    onChange={(e) => setConferenceForm((p) => ({ ...p, planCategory: e.target.value }))}
                  >
                    <option value="0">Safety</option>
                    <option value="1">Education</option>
                    <option value="2">Physical Health</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small mb-1" htmlFor="conf-status">Status</label>
                  <select
                    id="conf-status"
                    className="form-select form-select-sm"
                    value={conferenceForm.status}
                    onChange={(e) => setConferenceForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="0">Open</option>
                    <option value="1">In Progress</option>
                    <option value="2">On Hold</option>
                    <option value="3">Achieved</option>
                    <option value="4">Closed</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small mb-1" htmlFor="conf-date">Conference date</label>
                  <input
                    id="conf-date"
                    className="form-control form-control-sm"
                    type="date"
                    value={conferenceForm.caseConferenceDate}
                    onChange={(e) => setConferenceForm((p) => ({ ...p, caseConferenceDate: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small mb-1" htmlFor="conf-plan-description">Plan summary</label>
                  <textarea
                    id="conf-plan-description"
                    className="form-control form-control-sm"
                    rows={2}
                    value={conferenceForm.planDescription}
                    onChange={(e) => setConferenceForm((p) => ({ ...p, planDescription: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createConference}>
                    Save case conference
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-2">Upcoming case conferences</h2>
              <p className="small text-secondary">Sourced from intervention plans with a case conference date.</p>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead><tr><th>Conference date</th><th>Resident</th><th>Plan category</th><th>Status</th><th>Plan summary</th><th></th></tr></thead>
                  <tbody>
                    {upcomingConferences.map((c) => (
                      <Fragment key={c.planId ?? `${c.residentId}-${c.caseConferenceDate}`}>
                        <tr>
                          <td>{c.caseConferenceDate ?? '—'}</td><td>{c.residentId ?? '—'}</td><td>{planCategoryLabel(c.planCategory)}</td><td>{planStatusLabel(c.status)}</td><td>{c.planDescription ?? '—'}</td>
                          <td className="text-end">
                            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => startEditConference(c)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                        {editingPlanId === c.planId ? (
                          <tr>
                            <td colSpan={6}>
                              <div className="border rounded p-2 bg-body-tertiary">
                                <div className="row g-2">
                                  <div className="col-md-2">
                                    <label className="form-label small mb-1">Resident ID</label>
                                    <input
                                      className="form-control form-control-sm"
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={editConferenceForm.residentId}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, residentId: e.target.value }))}
                                    />
                                  </div>
                                  <div className="col-md-3">
                                    <label className="form-label small mb-1">Plan category</label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={editConferenceForm.planCategory}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, planCategory: e.target.value }))}
                                    >
                                      <option value="0">Safety</option>
                                      <option value="1">Education</option>
                                      <option value="2">Physical Health</option>
                                    </select>
                                  </div>
                                  <div className="col-md-3">
                                    <label className="form-label small mb-1">Status</label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={editConferenceForm.status}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, status: e.target.value }))}
                                    >
                                      <option value="0">Open</option>
                                      <option value="1">In Progress</option>
                                      <option value="2">On Hold</option>
                                      <option value="3">Achieved</option>
                                      <option value="4">Closed</option>
                                    </select>
                                  </div>
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Conference date</label>
                                    <input
                                      className="form-control form-control-sm"
                                      type="date"
                                      value={editConferenceForm.caseConferenceDate}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, caseConferenceDate: e.target.value }))}
                                    />
                                  </div>
                                  <div className="col-12">
                                    <label className="form-label small mb-1">Plan summary</label>
                                    <textarea
                                      className="form-control form-control-sm"
                                      rows={2}
                                      value={editConferenceForm.planDescription}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, planDescription: e.target.value }))}
                                    />
                                  </div>
                                  <div className="col-12 d-flex gap-2 justify-content-end">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={cancelEditConference}>
                                      Cancel
                                    </button>
                                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveConferenceEdit(c)}>
                                      Save changes
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
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
                  <thead><tr><th>Conference date</th><th>Resident</th><th>Plan category</th><th>Status</th><th>Plan summary</th><th></th></tr></thead>
                  <tbody>
                    {pastConferences.map((c) => (
                      <Fragment key={c.planId ?? `${c.residentId}-${c.caseConferenceDate}`}>
                        <tr>
                          <td>{c.caseConferenceDate ?? '—'}</td><td>{c.residentId ?? '—'}</td><td>{planCategoryLabel(c.planCategory)}</td><td>{planStatusLabel(c.status)}</td><td>{c.planDescription ?? '—'}</td>
                          <td className="text-end">
                            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => startEditConference(c)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                        {editingPlanId === c.planId ? (
                          <tr>
                            <td colSpan={6}>
                              <div className="border rounded p-2 bg-body-tertiary">
                                <div className="row g-2">
                                  <div className="col-md-2">
                                    <label className="form-label small mb-1">Resident ID</label>
                                    <input
                                      className="form-control form-control-sm"
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={editConferenceForm.residentId}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, residentId: e.target.value }))}
                                    />
                                  </div>
                                  <div className="col-md-3">
                                    <label className="form-label small mb-1">Plan category</label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={editConferenceForm.planCategory}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, planCategory: e.target.value }))}
                                    >
                                      <option value="0">Safety</option>
                                      <option value="1">Education</option>
                                      <option value="2">Physical Health</option>
                                    </select>
                                  </div>
                                  <div className="col-md-3">
                                    <label className="form-label small mb-1">Status</label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={editConferenceForm.status}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, status: e.target.value }))}
                                    >
                                      <option value="0">Open</option>
                                      <option value="1">In Progress</option>
                                      <option value="2">On Hold</option>
                                      <option value="3">Achieved</option>
                                      <option value="4">Closed</option>
                                    </select>
                                  </div>
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Conference date</label>
                                    <input
                                      className="form-control form-control-sm"
                                      type="date"
                                      value={editConferenceForm.caseConferenceDate}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, caseConferenceDate: e.target.value }))}
                                    />
                                  </div>
                                  <div className="col-12">
                                    <label className="form-label small mb-1">Plan summary</label>
                                    <textarea
                                      className="form-control form-control-sm"
                                      rows={2}
                                      value={editConferenceForm.planDescription}
                                      onChange={(e) => setEditConferenceForm((p) => ({ ...p, planDescription: e.target.value }))}
                                    />
                                  </div>
                                  <div className="col-12 d-flex gap-2 justify-content-end">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={cancelEditConference}>
                                      Cancel
                                    </button>
                                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveConferenceEdit(c)}>
                                      Save changes
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {pastConferences.length === 0 ? <p className="small text-secondary mt-2 mb-0">No conference history rows yet.</p> : null}
            </div>
          </div>
        </div>
      </div>
      ) : (
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h2 className="h5 mb-2">Resident ID lookup</h2>
          <p className="small text-secondary">Search by resident ID, case control number, internal code, safehouse ID, or status.</p>
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <input
                className="form-control form-control-sm"
                placeholder="Search resident ID / case control / internal code..."
                value={residentLookupFilter}
                onChange={(e) => setResidentLookupFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Resident ID</th>
                  <th>Case control #</th>
                  <th>Internal code</th>
                  <th>Safehouse</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredResidentLookup.map((r) => (
                  <tr key={r.residentId ?? `${r.caseControlNo}-${r.internalCode}`}>
                    <td>{r.residentId ?? '—'}</td>
                    <td>{r.caseControlNo ?? '—'}</td>
                    <td>{r.internalCode ?? '—'}</td>
                    <td>{r.safehouseId ?? '—'}</td>
                    <td>{r.caseStatus ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredResidentLookup.length === 0 ? <p className="small text-secondary mt-2 mb-0">No residents match your search.</p> : null}
        </div>
      </div>
      )}
    </div>
  )
}
