import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'
import { ConfirmModal } from '../components/ConfirmModal'

type Resident = { residentId?: number; firstName?: string; lastName?: string }
type Recording = {
  recordingId?: number
  residentId?: number
  sessionDate?: string
  socialWorker?: string
  sessionType?: string | number
  sessionDurationMinutes?: number
  emotionalStateObserved?: string | number
  emotionalStateEnd?: string | number
  sessionNarrative?: string
  interventionsApplied?: string
  followUpActions?: string
  progressNoted?: boolean
  concernsFlagged?: boolean
  referralMade?: boolean
}

const emotionalStateLabelMap: Record<number, string> = {
  0: 'Angry',
  1: 'Anxious',
  2: 'Calm',
  3: 'Distressed',
  4: 'Happy',
  5: 'Hopeful',
  6: 'Sad',
  7: 'Withdrawn',
}

const emotionalStateValueMap: Record<string, number> = {
  Angry: 0,
  Anxious: 1,
  Calm: 2,
  Distressed: 3,
  Happy: 4,
  Hopeful: 5,
  Sad: 6,
  Withdrawn: 7,
}

function emotionalStateLabel(value: string | number | undefined) {
  if (typeof value === 'number') return emotionalStateLabelMap[value] ?? `State ${value}`
  return value ?? ''
}

const sessionTypeLabelMap: Record<number, string> = {
  0: 'Individual',
  1: 'Group',
}

const sessionTypeValueMap: Record<string, number> = {
  Individual: 0,
  Group: 1,
}

function sessionTypeLabel(value: string | number | undefined) {
  if (typeof value === 'number') return sessionTypeLabelMap[value] ?? `Type ${value}`
  return value ?? ''
}

const emptyForm = {
  residentId: '',
  sessionDate: new Date().toISOString().slice(0, 10),
  socialWorker: '',
  sessionType: 'Individual',
  sessionDurationMinutes: '',
  emotionalStateObserved: '',
  emotionalStateEnd: '',
  sessionNarrative: '',
  interventionsApplied: '',
  followUpActions: '',
  progressNoted: false,
  concernsFlagged: false,
  referralMade: false,
}

export function AdminProcessRecording() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [selectedResidentId, setSelectedResidentId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<typeof emptyForm>(emptyForm)
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const residentIdExists = useMemo(() => {
    if (!selectedResidentId.trim()) return true
    const sid = Number(selectedResidentId)
    if (!sid) return false
    return residents.some((r) => r.residentId === sid)
  }, [residents, selectedResidentId])

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
    if (!residentIdExists) return []
    const sid = Number(selectedResidentId)
    return recordings
      .filter((x) => (!sid ? true : x.residentId === sid))
      .sort((a, b) => String(b.sessionDate ?? '').localeCompare(String(a.sessionDate ?? '')))
  }, [recordings, residentIdExists, selectedResidentId])

  async function createRecording() {
    const residentId = Number(form.residentId || selectedResidentId)
    if (!residentId || !form.sessionDate || !form.socialWorker.trim() || !form.sessionNarrative.trim()) {
      setErr('Resident, date, social worker, and narrative summary are required.')
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
          sessionType: sessionTypeValueMap[form.sessionType] ?? 0,
          sessionDurationMinutes: form.sessionDurationMinutes ? Number(form.sessionDurationMinutes) : null,
          emotionalStateObserved: form.emotionalStateObserved ? (emotionalStateValueMap[form.emotionalStateObserved] ?? null) : null,
          emotionalStateEnd: form.emotionalStateEnd ? (emotionalStateValueMap[form.emotionalStateEnd] ?? null) : null,
          sessionNarrative: form.sessionNarrative.trim(),
          interventionsApplied: form.interventionsApplied || null,
          followUpActions: form.followUpActions || null,
          progressNoted: Boolean(form.progressNoted),
          concernsFlagged: Boolean(form.concernsFlagged),
          referralMade: Boolean(form.referralMade),
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

  function beginEdit(row: Recording) {
    setEditingId(row.recordingId ?? null)
    setEditForm({
      residentId: String(row.residentId ?? ''),
      sessionDate: row.sessionDate ? String(row.sessionDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      socialWorker: row.socialWorker ?? '',
      sessionType: sessionTypeLabel(row.sessionType) || 'Individual',
      sessionDurationMinutes: row.sessionDurationMinutes != null ? String(row.sessionDurationMinutes) : '',
      emotionalStateObserved: emotionalStateLabel(row.emotionalStateObserved),
      emotionalStateEnd: emotionalStateLabel(row.emotionalStateEnd),
      sessionNarrative: row.sessionNarrative ?? '',
      interventionsApplied: row.interventionsApplied ?? '',
      followUpActions: row.followUpActions ?? '',
      progressNoted: Boolean(row.progressNoted),
      concernsFlagged: Boolean(row.concernsFlagged),
      referralMade: Boolean(row.referralMade),
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyForm)
  }

  async function saveEdit(row: Recording) {
    if (!row.recordingId) return
    const residentId = Number(editForm.residentId)
    if (!residentId || !editForm.sessionDate || !editForm.socialWorker.trim() || !editForm.sessionNarrative.trim()) {
      setErr('Resident, date, social worker, and narrative summary are required.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      await fetchJson(`/api/admin/data/process_recordings/${row.recordingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...row,
          residentId,
          sessionDate: editForm.sessionDate,
          socialWorker: editForm.socialWorker.trim(),
          sessionType: sessionTypeValueMap[editForm.sessionType] ?? 0,
          sessionDurationMinutes: editForm.sessionDurationMinutes ? Number(editForm.sessionDurationMinutes) : null,
          emotionalStateObserved: editForm.emotionalStateObserved ? (emotionalStateValueMap[editForm.emotionalStateObserved] ?? null) : null,
          emotionalStateEnd: editForm.emotionalStateEnd ? (emotionalStateValueMap[editForm.emotionalStateEnd] ?? null) : null,
          sessionNarrative: editForm.sessionNarrative.trim(),
          interventionsApplied: editForm.interventionsApplied || null,
          followUpActions: editForm.followUpActions || null,
          progressNoted: Boolean(editForm.progressNoted),
          concernsFlagged: Boolean(editForm.concernsFlagged),
          referralMade: Boolean(editForm.referralMade),
        }),
      })
      cancelEdit()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update recording.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteRecording(recordingId: number) {
    try {
      setBusy(true)
      setErr(null)
      await fetchJson<void>(`/api/admin/data/process_recordings/${recordingId}`, { method: 'DELETE' })
      if (editingId === recordingId) {
        cancelEdit()
      }
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete recording.')
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
                        {r.residentId ?? '—'}
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
                  <select className="form-select form-select-sm" value={form.emotionalStateObserved} onChange={(e) => setForm((p) => ({ ...p, emotionalStateObserved: e.target.value }))}>
                    <option value="">Observed emotional state</option>
                    {Object.values(emotionalStateLabelMap).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <select className="form-select form-select-sm" value={form.emotionalStateEnd} onChange={(e) => setForm((p) => ({ ...p, emotionalStateEnd: e.target.value }))}>
                    <option value="">Emotional state at end</option>
                    {Object.values(emotionalStateLabelMap).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" type="number" min={0} placeholder="Session minutes" value={form.sessionDurationMinutes} onChange={(e) => setForm((p) => ({ ...p, sessionDurationMinutes: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" rows={3} placeholder="Narrative summary" value={form.sessionNarrative} onChange={(e) => setForm((p) => ({ ...p, sessionNarrative: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" rows={2} placeholder="Interventions applied" value={form.interventionsApplied} onChange={(e) => setForm((p) => ({ ...p, interventionsApplied: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" rows={2} placeholder="Follow-up actions" value={form.followUpActions} onChange={(e) => setForm((p) => ({ ...p, followUpActions: e.target.value }))} />
                </div>
                <div className="col-12">
                  <div className="d-flex flex-wrap gap-3 small">
                    <label className="form-check-label d-flex align-items-center gap-2">
                      <input className="form-check-input mt-0" type="checkbox" checked={Boolean(form.progressNoted)} onChange={(e) => setForm((p) => ({ ...p, progressNoted: e.target.checked }))} />
                      Progress noted
                    </label>
                    <label className="form-check-label d-flex align-items-center gap-2">
                      <input className="form-check-input mt-0" type="checkbox" checked={Boolean(form.concernsFlagged)} onChange={(e) => setForm((p) => ({ ...p, concernsFlagged: e.target.checked }))} />
                      Concerns flagged
                    </label>
                    <label className="form-check-label d-flex align-items-center gap-2">
                      <input className="form-check-input mt-0" type="checkbox" checked={Boolean(form.referralMade)} onChange={(e) => setForm((p) => ({ ...p, referralMade: e.target.checked }))} />
                      Referral made
                    </label>
                  </div>
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
                <div style={{ maxWidth: 300, width: '100%' }}>
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Filter by Resident ID"
                    value={selectedResidentId}
                    onChange={(e) => setSelectedResidentId(e.target.value)}
                  />
                  {!residentIdExists ? (
                    <div className="small text-danger mt-1">That Resident ID does not exist. Enter a valid ID.</div>
                  ) : null}
                </div>
              </div>
              <div className="vstack gap-2">
                {timeline.slice(0, 100).map((row) => (
                  <div key={row.recordingId ?? `${row.residentId}-${row.sessionDate}-${row.socialWorker}`} className="border rounded p-2">
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <strong>{row.sessionDate ?? 'No date'} · {sessionTypeLabel(row.sessionType) || 'Session'}</strong>
                      <span className="small text-secondary">Resident #{row.residentId ?? '—'} · {row.socialWorker ?? 'Unassigned'}</span>
                    </div>
                    {editingId === row.recordingId ? (
                      <div className="row g-2 mt-1">
                        <div className="col-md-4">
                          <input className="form-control form-control-sm" type="date" value={editForm.sessionDate} onChange={(e) => setEditForm((p) => ({ ...p, sessionDate: e.target.value }))} />
                        </div>
                        <div className="col-md-4">
                          <input className="form-control form-control-sm" placeholder="Social worker" value={editForm.socialWorker} onChange={(e) => setEditForm((p) => ({ ...p, socialWorker: e.target.value }))} />
                        </div>
                        <div className="col-md-4">
                          <select className="form-select form-select-sm" value={editForm.sessionType} onChange={(e) => setEditForm((p) => ({ ...p, sessionType: e.target.value }))}>
                            <option value="Individual">Individual</option>
                            <option value="Group">Group</option>
                          </select>
                        </div>
                        <div className="col-md-4">
                          <input className="form-control form-control-sm" type="number" min={0} placeholder="Session minutes" value={editForm.sessionDurationMinutes} onChange={(e) => setEditForm((p) => ({ ...p, sessionDurationMinutes: e.target.value }))} />
                        </div>
                        <div className="col-md-4">
                          <select className="form-select form-select-sm" value={editForm.emotionalStateObserved} onChange={(e) => setEditForm((p) => ({ ...p, emotionalStateObserved: e.target.value }))}>
                            <option value="">Observed state</option>
                            {Object.values(emotionalStateLabelMap).map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <select className="form-select form-select-sm" value={editForm.emotionalStateEnd} onChange={(e) => setEditForm((p) => ({ ...p, emotionalStateEnd: e.target.value }))}>
                            <option value="">End state</option>
                            {Object.values(emotionalStateLabelMap).map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12">
                          <textarea className="form-control form-control-sm" rows={3} placeholder="Narrative summary" value={editForm.sessionNarrative} onChange={(e) => setEditForm((p) => ({ ...p, sessionNarrative: e.target.value }))} />
                        </div>
                        <div className="col-12">
                          <textarea className="form-control form-control-sm" rows={2} placeholder="Interventions applied" value={editForm.interventionsApplied} onChange={(e) => setEditForm((p) => ({ ...p, interventionsApplied: e.target.value }))} />
                        </div>
                        <div className="col-12">
                          <textarea className="form-control form-control-sm" rows={2} placeholder="Follow-up actions" value={editForm.followUpActions} onChange={(e) => setEditForm((p) => ({ ...p, followUpActions: e.target.value }))} />
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-3 small">
                          <label className="form-check-label d-flex align-items-center gap-2">
                            <input className="form-check-input mt-0" type="checkbox" checked={Boolean(editForm.progressNoted)} onChange={(e) => setEditForm((p) => ({ ...p, progressNoted: e.target.checked }))} />
                            Progress noted
                          </label>
                          <label className="form-check-label d-flex align-items-center gap-2">
                            <input className="form-check-input mt-0" type="checkbox" checked={Boolean(editForm.concernsFlagged)} onChange={(e) => setEditForm((p) => ({ ...p, concernsFlagged: e.target.checked }))} />
                            Concerns flagged
                          </label>
                          <label className="form-check-label d-flex align-items-center gap-2">
                            <input className="form-check-input mt-0" type="checkbox" checked={Boolean(editForm.referralMade)} onChange={(e) => setEditForm((p) => ({ ...p, referralMade: e.target.checked }))} />
                            Referral made
                          </label>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="small text-secondary mt-1">
                          <strong>Emotional state:</strong> {emotionalStateLabel(row.emotionalStateObserved) || '—'}{row.emotionalStateEnd != null ? ` -> ${emotionalStateLabel(row.emotionalStateEnd)}` : ''}
                          {typeof row.sessionDurationMinutes === 'number' ? ` · ${row.sessionDurationMinutes} min` : ''}
                        </div>
                        <div className="small mt-1"><strong>Summary:</strong> {row.sessionNarrative ?? '—'}</div>
                        <div className="small mt-1"><strong>Interventions:</strong> {row.interventionsApplied ?? '—'}</div>
                        <div className="small mt-1"><strong>Follow-up:</strong> {row.followUpActions ?? '—'}</div>
                        <div className="small text-secondary mt-1">
                          <strong>Flags:</strong> Progress {row.progressNoted ? 'Yes' : 'No'} · Concerns {row.concernsFlagged ? 'Yes' : 'No'} · Referral {row.referralMade ? 'Yes' : 'No'}
                        </div>
                      </>
                    )}
                    <div className="d-flex gap-1 mt-2">
                      {editingId === row.recordingId ? (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveEdit(row)}>
                            Save
                          </button>
                          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy || !row.recordingId} onClick={() => beginEdit(row)}>
                          Edit
                        </button>
                      )}
                      <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy || !row.recordingId} onClick={() => { if (row.recordingId) setPendingDelete(row.recordingId) }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {timeline.length === 0 ? <p className="small text-secondary mb-0">No process recordings found for the selected resident filter.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      {pendingDelete ? (
        <ConfirmModal
          title="Confirm delete"
          message="Are you sure you want to delete this record?"
          confirmLabel="Yes, delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete
            setPendingDelete(null)
            void deleteRecording(id)
          }}
        />
      ) : null}
    </div>
  )
}
