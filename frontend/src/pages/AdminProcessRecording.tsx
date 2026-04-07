import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'

type Resident = { residentId?: number; firstName?: string; lastName?: string }
type Recording = {
  recordingId?: number
  residentId?: number
  sessionDate?: string
  socialWorker?: string
  sessionType?: string
  emotionalState?: string
  summary?: string
  interventions?: string
  followUpActions?: string
}

const emptyForm = {
  residentId: '',
  sessionDate: new Date().toISOString().slice(0, 10),
  socialWorker: '',
  sessionType: 'Individual',
  emotionalState: '',
  summary: '',
  interventions: '',
  followUpActions: '',
}

export function AdminProcessRecording() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [selectedResidentId, setSelectedResidentId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    try {
      setErr(null)
      const [r, p] = await Promise.all([
        fetchJson<Resident[]>('/api/admin/data/residents'),
        fetchJson<Recording[]>('/api/admin/data/process_recordings'),
      ])
      setResidents(Array.isArray(r) ? r : [])
      setRecordings(Array.isArray(p) ? p : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load process recordings.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const timeline = useMemo(() => {
    const sid = Number(selectedResidentId)
    return recordings
      .filter((x) => (!sid ? true : x.residentId === sid))
      .sort((a, b) => String(b.sessionDate ?? '').localeCompare(String(a.sessionDate ?? '')))
  }, [recordings, selectedResidentId])

  async function createRecording() {
    const residentId = Number(form.residentId || selectedResidentId)
    if (!residentId || !form.sessionDate || !form.socialWorker.trim() || !form.summary.trim()) {
      setErr('Resident, date, social worker, and summary are required.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      await fetchJson('/api/admin/data/process_recordings', {
        method: 'POST',
        body: JSON.stringify({
          residentId,
          sessionDate: form.sessionDate,
          socialWorker: form.socialWorker.trim(),
          sessionType: form.sessionType,
          emotionalState: form.emotionalState || null,
          summary: form.summary.trim(),
          interventions: form.interventions || null,
          followUpActions: form.followUpActions || null,
        }),
      })
      setForm((p) => ({ ...emptyForm, residentId: p.residentId || selectedResidentId }))
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save recording.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="h3 mb-2">Process Recording</h1>
      <p className="text-secondary mb-3">Record counseling sessions and review resident healing history in chronological order.</p>
      {err ? <div className="alert alert-warning">{err}</div> : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-2">New session note</h2>
              <div className="row g-2">
                <div className="col-12">
                  <select
                    className="form-select form-select-sm"
                    value={form.residentId}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, residentId: e.target.value }))
                      setSelectedResidentId(e.target.value)
                    }}
                  >
                    <option value="">Select resident</option>
                    {residents.map((r) => (
                      <option key={r.residentId} value={r.residentId}>
                        {r.residentId} - {`${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" type="date" value={form.sessionDate} onChange={(e) => setForm((p) => ({ ...p, sessionDate: e.target.value }))} />
                </div>
                <div className="col-6">
                  <select className="form-select form-select-sm" value={form.sessionType} onChange={(e) => setForm((p) => ({ ...p, sessionType: e.target.value }))}>
                    <option value="Individual">Individual</option>
                    <option value="Group">Group</option>
                  </select>
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Social worker" value={form.socialWorker} onChange={(e) => setForm((p) => ({ ...p, socialWorker: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Observed emotional state" value={form.emotionalState} onChange={(e) => setForm((p) => ({ ...p, emotionalState: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" rows={3} placeholder="Narrative summary" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" rows={2} placeholder="Interventions applied" value={form.interventions} onChange={(e) => setForm((p) => ({ ...p, interventions: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" rows={2} placeholder="Follow-up actions" value={form.followUpActions} onChange={(e) => setForm((p) => ({ ...p, followUpActions: e.target.value }))} />
                </div>
                <div className="col-12">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createRecording}>
                    Save process note
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h2 className="h5 mb-0">Session history</h2>
                <select className="form-select form-select-sm" style={{ maxWidth: 260 }} value={selectedResidentId} onChange={(e) => setSelectedResidentId(e.target.value)}>
                  <option value="">All residents</option>
                  {residents.map((r) => (
                    <option key={r.residentId} value={r.residentId}>
                      {r.residentId} - {`${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="vstack gap-2">
                {timeline.slice(0, 100).map((row) => (
                  <div key={row.recordingId ?? `${row.residentId}-${row.sessionDate}-${row.socialWorker}`} className="border rounded p-2">
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <strong>{row.sessionDate ?? 'No date'} · {row.sessionType ?? 'Session'}</strong>
                      <span className="small text-secondary">Resident #{row.residentId ?? '—'} · {row.socialWorker ?? 'Unassigned'}</span>
                    </div>
                    <div className="small text-secondary mt-1"><strong>Emotional state:</strong> {row.emotionalState ?? '—'}</div>
                    <div className="small mt-1"><strong>Summary:</strong> {row.summary ?? '—'}</div>
                    <div className="small mt-1"><strong>Interventions:</strong> {row.interventions ?? '—'}</div>
                    <div className="small mt-1"><strong>Follow-up:</strong> {row.followUpActions ?? '—'}</div>
                  </div>
                ))}
                {timeline.length === 0 ? <p className="small text-secondary mb-0">No process recordings found for the selected resident filter.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
