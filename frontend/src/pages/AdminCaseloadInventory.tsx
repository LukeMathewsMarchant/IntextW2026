import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'

type Resident = {
  residentId?: number
  firstName?: string
  lastName?: string
  safehouseId?: number
  caseCategory?: string
  caseSubcategory?: string
  caseStatus?: string
  assignedSocialWorker?: string
  notes?: string
}

const emptyResident = {
  firstName: '',
  lastName: '',
  safehouseId: '',
  caseCategory: '',
  caseSubcategory: '',
  caseStatus: '',
  assignedSocialWorker: '',
  notes: '',
}

export function AdminCaseloadInventory() {
  const [rows, setRows] = useState<Resident[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [safehouseFilter, setSafehouseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [form, setForm] = useState(emptyResident)

  async function load() {
    try {
      setErr(null)
      const data = await fetchJson<Resident[]>('/api/admin/data/residents')
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load residents.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return rows.filter((r) => {
      const hay = `${r.firstName ?? ''} ${r.lastName ?? ''} ${r.caseCategory ?? ''} ${r.caseSubcategory ?? ''} ${r.assignedSocialWorker ?? ''}`.toLowerCase()
      const safehouseOk = !safehouseFilter || String(r.safehouseId ?? '') === safehouseFilter
      const statusOk = !statusFilter || (r.caseStatus ?? '') === statusFilter
      const categoryOk = !categoryFilter || (r.caseCategory ?? '') === categoryFilter
      return (!query || hay.includes(query)) && safehouseOk && statusOk && categoryOk
    })
  }, [categoryFilter, q, rows, safehouseFilter, statusFilter])

  async function createResident() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErr('First and last name are required.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      await fetchJson('/api/admin/data/residents', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          safehouseId: Number(form.safehouseId) || null,
          caseCategory: form.caseCategory || null,
          caseSubcategory: form.caseSubcategory || null,
          caseStatus: form.caseStatus || null,
          assignedSocialWorker: form.assignedSocialWorker || null,
          notes: form.notes || null,
        }),
      })
      setForm(emptyResident)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create resident.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="h3 mb-2">Resident List</h1>
      <p className="text-secondary mb-3">Resident records with filtering for case status, safehouse, and category.</p>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-2">Add resident</h2>
              <div className="row g-2">
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="First name" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Last name" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Safehouse ID" value={form.safehouseId} onChange={(e) => setForm((p) => ({ ...p, safehouseId: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Status" value={form.caseStatus} onChange={(e) => setForm((p) => ({ ...p, caseStatus: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Case category" value={form.caseCategory} onChange={(e) => setForm((p) => ({ ...p, caseCategory: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control form-control-sm" placeholder="Subcategory" value={form.caseSubcategory} onChange={(e) => setForm((p) => ({ ...p, caseSubcategory: e.target.value }))} />
                </div>
                <div className="col-12">
                  <input className="form-control form-control-sm" placeholder="Assigned social worker" value={form.assignedSocialWorker} onChange={(e) => setForm((p) => ({ ...p, assignedSocialWorker: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control form-control-sm" placeholder="Notes" rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="col-12">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createResident}>
                    Save resident
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-2">Resident list</h2>
              <div className="row g-2 mb-2">
                <div className="col-md-4">
                  <input className="form-control form-control-sm" placeholder="Search resident/category/worker" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Safehouse ID" value={safehouseFilter} onChange={(e) => setSafehouseFilter(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <input className="form-control form-control-sm" placeholder="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} />
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>ID</th><th>Safehouse</th><th>Status</th><th>Category</th><th>Social worker</th></tr></thead>
                  <tbody>
                    {filtered.slice(0, 150).map((r) => (
                      <tr key={r.residentId ?? `${r.firstName}-${r.lastName}-${r.safehouseId}`}>
                        <td>{r.residentId ?? '—'}</td>
                        <td>{r.safehouseId ?? '—'}</td>
                        <td>{r.caseStatus ?? '—'}</td>
                        <td>{r.caseCategory ?? '—'} {r.caseSubcategory ? `/${r.caseSubcategory}` : ''}</td>
                        <td>{r.assignedSocialWorker ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 ? <p className="small text-secondary mb-0">No residents match current filters.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
