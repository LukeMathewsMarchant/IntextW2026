import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'
import { ConfirmModal } from '../components/ConfirmModal'

type Supporter = {
  supporterId?: number
  displayName?: string
  firstName?: string
  lastName?: string
  email?: string
  supporterType?: string
  status?: string
}

type Donation = {
  donationId?: number
  supporterId?: number
  donationType?: string | number
  amount?: number
  estimatedValue?: number
  createdAt?: string
  donationDate?: string
}

type Allocation = {
  allocationId?: number
  donationId?: number
  safehouseId?: number
  programArea?: string
  amountAllocated?: number
}

const emptySupporter = { displayName: '', firstName: '', lastName: '', email: '', supporterType: 'MonetaryDonor', status: 'Active' }
const emptyDonation = { supporterId: '', amount: '', donationType: 'Monetary' }

const donationTypeLabelMap: Record<number, string> = {
  0: 'Monetary',
  1: 'In-kind',
  2: 'Time',
  3: 'Skills',
  4: 'Social media',
}

const donationTypeValueMap: Record<string, number> = {
  Monetary: 0,
  InKind: 1,
  Time: 2,
  Skills: 3,
  SocialMedia: 4,
}

function donationTypeLabel(value: string | number | undefined) {
  if (typeof value === 'number') return donationTypeLabelMap[value] ?? `Type ${value}`
  if (!value) return '—'
  if (value === 'InKind') return 'In-kind'
  if (value === 'SocialMedia') return 'Social media'
  return value
}

function formatContributionAmount(d: Donation) {
  const label = donationTypeLabel(d.donationType)
  const raw = Number(d.estimatedValue ?? d.amount ?? 0)
  const value = Number.isFinite(raw) ? raw : 0
  if (label === 'Monetary') return `$${value.toLocaleString()}`
  if (label === 'Time') return `${value.toLocaleString()} hours`
  if (label === 'In-kind') return value > 0 ? `In-kind (est. $${value.toLocaleString()})` : 'In-kind contribution'
  if (label === 'Skills') return value > 0 ? `Skills (est. $${value.toLocaleString()})` : 'Skills contribution'
  if (label === 'Social media') return value > 0 ? `Social media (est. $${value.toLocaleString()})` : 'Social media contribution'
  return value.toLocaleString()
}

function formatAllocationAmount(amountAllocated: number | undefined, donationType: string | number | undefined) {
  const label = donationTypeLabel(donationType)
  const raw = Number(amountAllocated ?? 0)
  const value = Number.isFinite(raw) ? raw : 0
  if (label === 'Monetary') return `$${value.toLocaleString()}`
  if (label === 'Time') return `${value.toLocaleString()} hours`
  if (label === 'In-kind') return value > 0 ? `In-kind (est. $${value.toLocaleString()})` : 'In-kind allocation'
  if (label === 'Skills') return value > 0 ? `Skills (est. $${value.toLocaleString()})` : 'Skills allocation'
  if (label === 'Social media') return value > 0 ? `Social media (est. $${value.toLocaleString()})` : 'Social media allocation'
  return value.toLocaleString()
}

export function AdminDonorsContributions() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [supporterFilter, setSupporterFilter] = useState('')
  const [contributionFilter, setContributionFilter] = useState('')
  const [safehouseFilter, setSafehouseFilter] = useState('')
  const [programAreaFilter, setProgramAreaFilter] = useState('')
  const [supporterForm, setSupporterForm] = useState(emptySupporter)
  const [donationForm, setDonationForm] = useState(emptyDonation)
  const [editingSupporterId, setEditingSupporterId] = useState<number | null>(null)
  const [editingSupporterName, setEditingSupporterName] = useState('')
  const [editingSupporterEmail, setEditingSupporterEmail] = useState('')
  const [editingDonationId, setEditingDonationId] = useState<number | null>(null)
  const [editingDonationAmount, setEditingDonationAmount] = useState('')
  const [viewMode, setViewMode] = useState<'supporters' | 'contributions'>('supporters')
  const [showSupporterModal, setShowSupporterModal] = useState(false)
  const [showDonationModal, setShowDonationModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'supporter' | 'donation'; id: number } | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      setErr(null)
      const [s, d, a] = await Promise.all([
        fetchJson<Supporter[]>('/api/admin/data/supporters'),
        fetchJson<Donation[]>('/api/admin/data/donations'),
        fetchJson<Allocation[]>('/api/admin/data/donation_allocations'),
      ])
      setSupporters(Array.isArray(s) ? s : [])
      setDonations(Array.isArray(d) ? d : [])
      setAllocations(Array.isArray(a) ? a : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load donors and contributions.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredSupporters = useMemo(
    () =>
      supporters.filter((s) => {
        const q = supporterFilter.trim().toLowerCase()
        const hay = `${s.displayName ?? ''} ${s.email ?? ''} ${s.firstName ?? ''} ${s.lastName ?? ''}`.toLowerCase()
        return !q || hay.includes(q)
      }),
    [supporterFilter, supporters],
  )

  const filteredDonations = useMemo(
    () =>
      donations.filter((d) => {
        if (!contributionFilter) return true
        return donationTypeLabel(d.donationType) === donationTypeLabel(contributionFilter)
      }),
    [contributionFilter, donations],
  )

  const filteredAllocations = useMemo(
    () =>
      allocations.filter((a) => {
        const safehouseOk = !safehouseFilter || String(a.safehouseId ?? '') === safehouseFilter
        const programOk = !programAreaFilter || (a.programArea ?? '').toLowerCase().includes(programAreaFilter.trim().toLowerCase())
        return safehouseOk && programOk
      }),
    [allocations, programAreaFilter, safehouseFilter],
  )

  const supporterById = useMemo(() => {
    return new Map<number, Supporter>(
      supporters
        .filter((s): s is Supporter & { supporterId: number } => typeof s.supporterId === 'number')
        .map((s) => [s.supporterId, s]),
    )
  }, [supporters])

  const donationStatsBySupporter = useMemo(() => {
    const stats = new Map<number, { total: number; lastDate: string | null }>()
    donations.forEach((d) => {
      if (!d.supporterId) return
      const prev = stats.get(d.supporterId) ?? { total: 0, lastDate: null }
      const value = Number(d.estimatedValue ?? d.amount ?? 0)
      const date = d.donationDate ?? (d.createdAt ? String(d.createdAt).slice(0, 10) : null)
      stats.set(d.supporterId, {
        total: prev.total + (Number.isFinite(value) ? value : 0),
        lastDate: prev.lastDate && date ? (prev.lastDate > date ? prev.lastDate : date) : (prev.lastDate ?? date),
      })
    })
    return stats
  }, [donations])

  function supporterName(supporterId: number | undefined) {
    if (!supporterId) return '—'
    const s = supporterById.get(supporterId)
    if (!s) return `#${supporterId}`
    const full = (s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()).trim()
    return full || `#${supporterId}`
  }

  async function createSupporter() {
    try {
      setBusy(true)
      setErr(null)
      await fetchJson('/api/admin/data/supporters', {
        method: 'POST',
        body: JSON.stringify({
          displayName: supporterForm.displayName,
          firstName: supporterForm.firstName,
          lastName: supporterForm.lastName,
          email: supporterForm.email,
        }),
      })
      setSupporterForm(emptySupporter)
      setShowSupporterModal(false)
      setSuccessMsg('Supporter created successfully.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create supporter.')
    } finally {
      setBusy(false)
    }
  }

  async function saveSupporterEdit(supporterId: number | undefined) {
    if (!supporterId) return
    const existing = supporters.find((s) => s.supporterId === supporterId)
    if (!existing) return
    const name = editingSupporterName.trim()
    if (!name) {
      setErr('Supporter name is required.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      await fetchJson(`/api/admin/data/supporters/${supporterId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...existing,
          displayName: name,
          email: editingSupporterEmail.trim() || null,
        }),
      })
      setEditingSupporterId(null)
      setEditingSupporterName('')
      setEditingSupporterEmail('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update supporter.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSupporter(supporterId: number | undefined) {
    if (!supporterId) return
    try {
      setBusy(true)
      setErr(null)
      await fetchJson<void>(`/api/admin/data/supporters/${supporterId}`, { method: 'DELETE' })
      if (editingSupporterId === supporterId) {
        setEditingSupporterId(null)
        setEditingSupporterName('')
        setEditingSupporterEmail('')
      }
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete supporter. Remove dependent donations first if this donor has activity.')
    } finally {
      setBusy(false)
    }
  }

  async function createDonation() {
    const sid = Number(donationForm.supporterId)
    const amt = Number(donationForm.amount)
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(amt) || amt <= 0) {
      setErr('Supporter ID and amount are required for donation create.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      const donationTypeValue = donationTypeValueMap[String(donationForm.donationType)] ?? 0
      await fetchJson('/api/admin/data/donations', {
        method: 'POST',
        body: JSON.stringify({
          supporterId: sid,
          donationType: donationTypeValue,
          amount: amt,
          estimatedValue: amt,
          donationDate: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          currencyCode: 'USD',
          channelSource: 0,
          impactUnit: 0,
          isRecurring: false,
        }),
      })
      setDonationForm(emptyDonation)
      setShowDonationModal(false)
      setSuccessMsg('Contribution added successfully.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create donation.')
    } finally {
      setBusy(false)
    }
  }

  async function saveDonationEdit(donationId: number | undefined) {
    if (!donationId) return
    const existing = donations.find((d) => d.donationId === donationId)
    const amt = Number(editingDonationAmount)
    if (!existing || !Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid amount before saving.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      await fetchJson(`/api/admin/data/donations/${donationId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...existing,
          amount: amt,
          estimatedValue: amt,
        }),
      })
      setEditingDonationId(null)
      setEditingDonationAmount('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update donation.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteDonation(donationId: number | undefined) {
    if (!donationId) return
    try {
      setBusy(true)
      setErr(null)
      await fetchJson<void>(`/api/admin/data/donations/${donationId}`, { method: 'DELETE' })
      if (editingDonationId === donationId) {
        setEditingDonationId(null)
        setEditingDonationAmount('')
      }
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete donation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="h3 mb-2">Donors & Contributions</h1>
      <p className="text-secondary mb-3">Supporters on this page are donor profiles. You can add/edit/delete supporters, add/edit/delete donations, and view allocations with safehouse/program labels.</p>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      <div className="card border-0 shadow-sm h-100">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <h2 className="h5 mb-0">{viewMode === 'supporters' ? 'Supporters' : 'Contributions and allocations'}</h2>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowSupporterModal(true)}>
                Add supporter
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowDonationModal(true)}>
                Add contribution
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setViewMode((m) => (m === 'supporters' ? 'contributions' : 'supporters'))}
              >
                {viewMode === 'supporters' ? 'View Contributions' : 'View Supporters'}
              </button>
            </div>
          </div>

          {viewMode === 'supporters' ? (
            <>
              <div className="row g-2 mb-2">
                <div className="col-md-8">
                  <input className="form-control form-control-sm" placeholder="Search name/email" value={supporterFilter} onChange={(e) => setSupporterFilter(e.target.value)} />
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Total donated</th><th>Last donation</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredSupporters.slice(0, 100).map((s) => (
                      <tr key={s.supporterId ?? `${s.email}-${s.displayName}`}>
                        <td>{s.supporterId ?? '—'}</td>
                        <td>
                          {editingSupporterId === s.supporterId ? (
                            <input className="form-control form-control-sm" value={editingSupporterName} onChange={(e) => setEditingSupporterName(e.target.value)} />
                          ) : (
                            (s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()) || '—'
                          )}
                        </td>
                        <td>
                          {editingSupporterId === s.supporterId ? (
                            <input className="form-control form-control-sm" value={editingSupporterEmail} onChange={(e) => setEditingSupporterEmail(e.target.value)} />
                          ) : (
                            s.email ?? '—'
                          )}
                        </td>
                        <td>{s.supporterId ? (donationStatsBySupporter.get(s.supporterId)?.total ?? 0).toLocaleString() : '0'}</td>
                        <td>{s.supporterId ? (donationStatsBySupporter.get(s.supporterId)?.lastDate ?? '—') : '—'}</td>
                        <td>
                          <div className="d-flex gap-1">
                            {editingSupporterId === s.supporterId ? (
                              <>
                                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveSupporterEdit(s.supporterId)}>
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingSupporterId(null)
                                    setEditingSupporterName('')
                                    setEditingSupporterEmail('')
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={busy}
                                onClick={() => {
                                  setEditingSupporterId(s.supporterId ?? null)
                                  setEditingSupporterName((s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()) || '')
                                  setEditingSupporterEmail(s.email ?? '')
                                }}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              disabled={busy}
                              onClick={() => {
                                if (typeof s.supporterId === 'number') {
                                  setPendingDelete({ kind: 'supporter', id: s.supporterId })
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredSupporters.length === 0 ? <p className="small text-secondary mb-0">No supporter rows yet. Add one above.</p> : null}
            </>
          ) : (
            <>
              <div className="row g-2 mb-2">
                <div className="col-md-6">
                  <select className="form-select form-select-sm" value={contributionFilter} onChange={(e) => setContributionFilter(e.target.value)}>
                    <option value="">All contribution types</option>
                    <option value="Monetary">Monetary</option>
                    <option value="InKind">In-kind</option>
                    <option value="Time">Time</option>
                    <option value="Skills">Skills</option>
                    <option value="SocialMedia">Social media</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Safehouse" value={safehouseFilter} onChange={(e) => setSafehouseFilter(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Program area" value={programAreaFilter} onChange={(e) => setProgramAreaFilter(e.target.value)} />
                </div>
              </div>
              <div className="table-responsive mb-2">
                <table className="table table-sm">
                  <thead><tr><th>Donation</th><th>Donor</th><th>Type</th><th>Amount</th><th>Created</th><th>Manage</th></tr></thead>
                  <tbody>
                    {filteredDonations.slice(0, 100).map((d) => (
                      <tr key={d.donationId ?? `${d.supporterId}-${d.createdAt}`}>
                        <td>{d.donationId ?? '—'}</td>
                        <td>{supporterName(d.supporterId)}</td>
                        <td>{donationTypeLabel(d.donationType)}</td>
                        <td>
                          {editingDonationId === d.donationId ? (
                            <input
                              className="form-control form-control-sm"
                              style={{ maxWidth: 120 }}
                              type="number"
                              min={1}
                              value={editingDonationAmount}
                              onChange={(e) => setEditingDonationAmount(e.target.value)}
                            />
                          ) : (
                            formatContributionAmount(d)
                          )}
                        </td>
                        <td>{d.createdAt ? String(d.createdAt).slice(0, 10) : '—'}</td>
                        <td>
                          <div className="d-flex gap-1">
                            {editingDonationId === d.donationId ? (
                              <>
                                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveDonationEdit(d.donationId)}>
                                  Save
                                </button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => { setEditingDonationId(null); setEditingDonationAmount('') }}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={busy}
                                onClick={() => {
                                  setEditingDonationId(d.donationId ?? null)
                                  setEditingDonationAmount(String(d.estimatedValue ?? d.amount ?? ''))
                                }}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              disabled={busy}
                              onClick={() => {
                                if (typeof d.donationId === 'number') {
                                  setPendingDelete({ kind: 'donation', id: d.donationId })
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small text-secondary mb-1">Allocation snapshot (safehouse/program mapping):</p>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead><tr><th>Allocation</th><th>Donation</th><th>Donor</th><th>Type</th><th>Safehouse</th><th>Program area</th><th>Amount</th></tr></thead>
                  <tbody>
                    {filteredAllocations.slice(0, 80).map((a) => (
                      <tr key={a.allocationId ?? `${a.donationId}-${a.safehouseId}`}>
                        {(() => {
                          const donation = donations.find((d) => d.donationId === a.donationId)
                          return (
                            <>
                        <td>{a.allocationId ?? '—'}</td>
                        <td>{a.donationId ?? '—'}</td>
                        <td>{supporterName(donation?.supporterId)}</td>
                        <td>{donationTypeLabel(donation?.donationType)}</td>
                        <td>{a.safehouseId ?? '—'}</td>
                        <td>{a.programArea ?? '—'}</td>
                        <td>{formatAllocationAmount(a.amountAllocated, donation?.donationType)}</td>
                            </>
                          )
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {showSupporterModal ? (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1050 }}>
          <div className="card border-0 shadow-sm" style={{ width: 'min(680px, 92vw)' }}>
            <div className="card-body">
              <h3 className="h5 mb-3">Add supporter</h3>
              <div className="row g-2">
                <div className="col-md-6">
                  <input className="form-control" placeholder="Display name" value={supporterForm.displayName} onChange={(e) => setSupporterForm((p) => ({ ...p, displayName: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <input className="form-control" placeholder="Email" value={supporterForm.email} onChange={(e) => setSupporterForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <input className="form-control" placeholder="First name" value={supporterForm.firstName} onChange={(e) => setSupporterForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <input className="form-control" placeholder="Last name" value={supporterForm.lastName} onChange={(e) => setSupporterForm((p) => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createSupporter}>
                  Create supporter
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setShowSupporterModal(false)
                    setSupporterForm(emptySupporter)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showDonationModal ? (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1050 }}>
          <div className="card border-0 shadow-sm" style={{ width: 'min(680px, 92vw)' }}>
            <div className="card-body">
              <h3 className="h5 mb-3">Add contribution</h3>
              <div className="row g-2">
                <div className="col-md-4">
                  <input className="form-control" placeholder="Supporter ID" value={donationForm.supporterId} onChange={(e) => setDonationForm((p) => ({ ...p, supporterId: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <input className="form-control" type="number" min={1} placeholder="Amount" value={donationForm.amount} onChange={(e) => setDonationForm((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <select className="form-select" value={donationForm.donationType} onChange={(e) => setDonationForm((p) => ({ ...p, donationType: e.target.value }))}>
                    <option value="Monetary">Monetary</option>
                    <option value="InKind">In-kind</option>
                    <option value="Time">Time</option>
                    <option value="Skills">Skills</option>
                    <option value="SocialMedia">Social media</option>
                  </select>
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createDonation}>
                  Add contribution
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setShowDonationModal(false)
                    setDonationForm(emptyDonation)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDelete ? (
        <ConfirmModal
          title="Confirm delete"
          message="Are you sure you want to delete this record?"
          confirmLabel="Yes, delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const item = pendingDelete
            setPendingDelete(null)
            if (item.kind === 'supporter') {
              void deleteSupporter(item.id)
            } else {
              void deleteDonation(item.id)
            }
          }}
        />
      ) : null}
    </div>
  )
}
