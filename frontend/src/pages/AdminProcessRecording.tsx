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
      {err ? (
        <div className="alert alert-warning" role="alert">
          {err}
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <section className="card border-0 shadow-sm" aria-labelledby="pr-new-heading">
            <div className="card-body">
              <h2 id="pr-new-heading" className="h5 mb-2">
                New session note
              </h2>
              <div className="row g-2">
                <div className="col-12">
                  <label htmlFor="pr-new-resident" className="form-label small mb-1">
                    Resident
                  </label>
                  <select
                    id="pr-new-resident"
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
                  <label htmlFor="pr-new-session-date" className="form-label small mb-1">
                    Session date
                  </label>
                  <input
                    id="pr-new-session-date"
                    className="form-control form-control-sm"
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => setForm((p) => ({ ...p, sessionDate: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label htmlFor="pr-new-session-type" className="form-label small mb-1">
                    Session type
                  </label>
                  <select
                    id="pr-new-session-type"
                    className="form-select form-select-sm"
                    value={form.sessionType}
                    onChange={(e) => setForm((p) => ({ ...p, sessionType: e.target.value }))}
                  >
                    <option value="Individual">Individual</option>
                    <option value="Group">Group</option>
                  </select>
                </div>
                <div className="col-6">
                  <label htmlFor="pr-new-social-worker" className="form-label small mb-1">
                    Social worker
                  </label>
                  <input
                    id="pr-new-social-worker"
                    className="form-control form-control-sm"
                    autoComplete="name"
                    value={form.socialWorker}
                    onChange={(e) => setForm((p) => ({ ...p, socialWorker: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label htmlFor="pr-new-emotional-observed" className="form-label small mb-1">
                    Observed emotional state
                  </label>
                  <select
                    id="pr-new-emotional-observed"
                    className="form-select form-select-sm"
                    value={form.emotionalStateObserved}
                    onChange={(e) => setForm((p) => ({ ...p, emotionalStateObserved: e.target.value }))}
                  >
                    <option value="">Select state</option>
                    {Object.values(emotionalStateLabelMap).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label htmlFor="pr-new-emotional-end" className="form-label small mb-1">
                    Emotional state at end
                  </label>
                  <select
                    id="pr-new-emotional-end"
                    className="form-select form-select-sm"
                    value={form.emotionalStateEnd}
                    onChange={(e) => setForm((p) => ({ ...p, emotionalStateEnd: e.target.value }))}
                  >
                    <option value="">Select state</option>
                    {Object.values(emotionalStateLabelMap).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label htmlFor="pr-new-duration" className="form-label small mb-1">
                    Session minutes
                  </label>
                  <input
                    id="pr-new-duration"
                    className="form-control form-control-sm"
                    type="number"
                    min={0}
                    value={form.sessionDurationMinutes}
                    onChange={(e) => setForm((p) => ({ ...p, sessionDurationMinutes: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label htmlFor="pr-new-narrative" className="form-label small mb-1">
                    Narrative summary
                  </label>
                  <textarea
                    id="pr-new-narrative"
                    className="form-control form-control-sm"
                    rows={3}
                    value={form.sessionNarrative}
                    onChange={(e) => setForm((p) => ({ ...p, sessionNarrative: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label htmlFor="pr-new-interventions" className="form-label small mb-1">
                    Interventions applied
                  </label>
                  <textarea
                    id="pr-new-interventions"
                    className="form-control form-control-sm"
                    rows={2}
                    value={form.interventionsApplied}
                    onChange={(e) => setForm((p) => ({ ...p, interventionsApplied: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label htmlFor="pr-new-followup" className="form-label small mb-1">
                    Follow-up actions
                  </label>
                  <textarea
                    id="pr-new-followup"
                    className="form-control form-control-sm"
                    rows={2}
                    value={form.followUpActions}
                    onChange={(e) => setForm((p) => ({ ...p, followUpActions: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <fieldset className="border-0 p-0 m-0">
                    <legend className="form-label small mb-1">Session flags</legend>
                    <div className="d-flex flex-wrap gap-3 small">
                      <label className="form-check-label d-flex align-items-center gap-2">
                        <input
                          id="pr-new-progress"
                          className="form-check-input mt-0"
                          type="checkbox"
                          checked={Boolean(form.progressNoted)}
                          onChange={(e) => setForm((p) => ({ ...p, progressNoted: e.target.checked }))}
                        />
                        Progress noted
                      </label>
                      <label className="form-check-label d-flex align-items-center gap-2">
                        <input
                          id="pr-new-concerns"
                          className="form-check-input mt-0"
                          type="checkbox"
                          checked={Boolean(form.concernsFlagged)}
                          onChange={(e) => setForm((p) => ({ ...p, concernsFlagged: e.target.checked }))}
                        />
                        Concerns flagged
                      </label>
                      <label className="form-check-label d-flex align-items-center gap-2">
                        <input
                          id="pr-new-referral"
                          className="form-check-input mt-0"
                          type="checkbox"
                          checked={Boolean(form.referralMade)}
                          onChange={(e) => setForm((p) => ({ ...p, referralMade: e.target.checked }))}
                        />
                        Referral made
                      </label>
                    </div>
                  </fieldset>
                </div>
                <div className="col-12">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createRecording}>
                    Save process note
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="col-lg-7">
          <section className="card border-0 shadow-sm" aria-labelledby="pr-history-heading">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <h2 id="pr-history-heading" className="h5 mb-0">
                  Session history
                </h2>
                <div style={{ maxWidth: 300, width: '100%' }}>
                  <label htmlFor="pr-filter-resident-id" className="form-label small mb-1">
                    Filter by resident ID
                  </label>
                  <input
                    id="pr-filter-resident-id"
                    className="form-control form-control-sm"
                    type="number"
                    min={1}
                    step={1}
                    aria-describedby={!residentIdExists && selectedResidentId.trim() ? 'pr-filter-error' : undefined}
                    value={selectedResidentId}
                    onChange={(e) => setSelectedResidentId(e.target.value)}
                  />
                  {!residentIdExists && selectedResidentId.trim() ? (
                    <div id="pr-filter-error" className="small text-danger mt-1" role="status">
                      That Resident ID does not exist. Enter a valid ID.
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="vstack gap-2">
                {timeline.slice(0, 100).map((row) => {
                  const sessionKey = row.recordingId ?? `${row.residentId}-${row.sessionDate}-${row.socialWorker}`
                  const eid = String(row.recordingId != null ? row.recordingId : sessionKey).replace(/[^a-zA-Z0-9_-]/g, '_')
                  const sessionSummary = `${row.sessionDate ?? 'No date'}, resident ${row.residentId ?? '—'}`
                  return (
                  <article
                    key={sessionKey}
                    className="border rounded p-2"
                    aria-label={`Process recording ${sessionSummary}`}
                  >
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <strong>{row.sessionDate ?? 'No date'} · {sessionTypeLabel(row.sessionType) || 'Session'}</strong>
                      <span className="small text-secondary">Resident #{row.residentId ?? '—'} · {row.socialWorker ?? 'Unassigned'}</span>
                    </div>
                    {editingId === row.recordingId ? (
                      <div className="row g-2 mt-1">
                        <div className="col-md-4">
                          <label htmlFor={`pr-edit-${eid}-date`} className="form-label small mb-1">
                            Session date
                          </label>
                          <input
                            id={`pr-edit-${eid}-date`}
                            className="form-control form-control-sm"
                            type="date"
                            value={editForm.sessionDate}
                            onChange={(e) => setEditForm((p) => ({ ...p, sessionDate: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-4">
                          <label htmlFor={`pr-edit-${eid}-worker`} className="form-label small mb-1">
                            Social worker
                          </label>
                          <input
                            id={`pr-edit-${eid}-worker`}
                            className="form-control form-control-sm"
                            autoComplete="name"
                            value={editForm.socialWorker}
                            onChange={(e) => setEditForm((p) => ({ ...p, socialWorker: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-4">
                          <label htmlFor={`pr-edit-${eid}-type`} className="form-label small mb-1">
                            Session type
                          </label>
                          <select
                            id={`pr-edit-${eid}-type`}
                            className="form-select form-select-sm"
                            value={editForm.sessionType}
                            onChange={(e) => setEditForm((p) => ({ ...p, sessionType: e.target.value }))}
                          >
                            <option value="Individual">Individual</option>
                            <option value="Group">Group</option>
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label htmlFor={`pr-edit-${eid}-duration`} className="form-label small mb-1">
                            Session minutes
                          </label>
                          <input
                            id={`pr-edit-${eid}-duration`}
                            className="form-control form-control-sm"
                            type="number"
                            min={0}
                            value={editForm.sessionDurationMinutes}
                            onChange={(e) => setEditForm((p) => ({ ...p, sessionDurationMinutes: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-4">
                          <label htmlFor={`pr-edit-${eid}-emo1`} className="form-label small mb-1">
                            Observed state
                          </label>
                          <select
                            id={`pr-edit-${eid}-emo1`}
                            className="form-select form-select-sm"
                            value={editForm.emotionalStateObserved}
                            onChange={(e) => setEditForm((p) => ({ ...p, emotionalStateObserved: e.target.value }))}
                          >
                            <option value="">Select state</option>
                            {Object.values(emotionalStateLabelMap).map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label htmlFor={`pr-edit-${eid}-emo2`} className="form-label small mb-1">
                            End state
                          </label>
                          <select
                            id={`pr-edit-${eid}-emo2`}
                            className="form-select form-select-sm"
                            value={editForm.emotionalStateEnd}
                            onChange={(e) => setEditForm((p) => ({ ...p, emotionalStateEnd: e.target.value }))}
                          >
                            <option value="">Select state</option>
                            {Object.values(emotionalStateLabelMap).map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12">
                          <label htmlFor={`pr-edit-${eid}-narrative`} className="form-label small mb-1">
                            Narrative summary
                          </label>
                          <textarea
                            id={`pr-edit-${eid}-narrative`}
                            className="form-control form-control-sm"
                            rows={3}
                            value={editForm.sessionNarrative}
                            onChange={(e) => setEditForm((p) => ({ ...p, sessionNarrative: e.target.value }))}
                          />
                        </div>
                        <div className="col-12">
                          <label htmlFor={`pr-edit-${eid}-interventions`} className="form-label small mb-1">
                            Interventions applied
                          </label>
                          <textarea
                            id={`pr-edit-${eid}-interventions`}
                            className="form-control form-control-sm"
                            rows={2}
                            value={editForm.interventionsApplied}
                            onChange={(e) => setEditForm((p) => ({ ...p, interventionsApplied: e.target.value }))}
                          />
                        </div>
                        <div className="col-12">
                          <label htmlFor={`pr-edit-${eid}-followup`} className="form-label small mb-1">
                            Follow-up actions
                          </label>
                          <textarea
                            id={`pr-edit-${eid}-followup`}
                            className="form-control form-control-sm"
                            rows={2}
                            value={editForm.followUpActions}
                            onChange={(e) => setEditForm((p) => ({ ...p, followUpActions: e.target.value }))}
                          />
                        </div>
                        <div className="col-12">
                          <fieldset className="border-0 p-0 m-0">
                            <legend className="form-label small mb-1">Session flags</legend>
                            <div className="d-flex flex-wrap gap-3 small">
                              <label className="form-check-label d-flex align-items-center gap-2">
                                <input
                                  id={`pr-edit-${eid}-progress`}
                                  className="form-check-input mt-0"
                                  type="checkbox"
                                  checked={Boolean(editForm.progressNoted)}
                                  onChange={(e) => setEditForm((p) => ({ ...p, progressNoted: e.target.checked }))}
                                />
                                Progress noted
                              </label>
                              <label className="form-check-label d-flex align-items-center gap-2">
                                <input
                                  id={`pr-edit-${eid}-concerns`}
                                  className="form-check-input mt-0"
                                  type="checkbox"
                                  checked={Boolean(editForm.concernsFlagged)}
                                  onChange={(e) => setEditForm((p) => ({ ...p, concernsFlagged: e.target.checked }))}
                                />
                                Concerns flagged
                              </label>
                              <label className="form-check-label d-flex align-items-center gap-2">
                                <input
                                  id={`pr-edit-${eid}-referral`}
                                  className="form-check-input mt-0"
                                  type="checkbox"
                                  checked={Boolean(editForm.referralMade)}
                                  onChange={(e) => setEditForm((p) => ({ ...p, referralMade: e.target.checked }))}
                                />
                                Referral made
                              </label>
                            </div>
                          </fieldset>
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
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            aria-label={`Save edits to process recording ${sessionSummary}`}
                            onClick={() => saveEdit(row)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            disabled={busy}
                            aria-label="Cancel editing process recording"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={busy || !row.recordingId}
                          aria-label={`Edit process recording ${sessionSummary}`}
                          onClick={() => beginEdit(row)}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        disabled={busy || !row.recordingId}
                        aria-label={`Delete process recording ${sessionSummary}`}
                        onClick={() => {
                          if (row.recordingId) setPendingDelete(row.recordingId)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                )
              })}
                {timeline.length === 0 ? <p className="small text-secondary mb-0">No process recordings found for the selected resident filter.</p> : null}
              </div>
            </div>
          </section>
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
