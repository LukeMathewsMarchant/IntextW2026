import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ConfirmModal } from '../components/ConfirmModal'
import { fetchJson } from '../api/client'

export function AdminCrud() {
  const { entity } = useParams()
  const [rows, setRows] = useState<unknown[]>([])
  const [raw, setRaw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string } | null>(null)

  const url = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_URL || ''
    return `${baseUrl}/api/admin/data/${encodeURIComponent(entity ?? '')}`
  }, [entity])

  useEffect(() => {
    if (!entity) return
    fetchJson<unknown[]>(url)
      .then((data) => {
        setRows(Array.isArray(data) ? data : [])
        setRaw(JSON.stringify(data, null, 2))
      })
      .catch((e: Error) => setErr(e.message))
  }, [entity, url])

  return (
    <div>
      <h1 className="h4 mb-2">Admin CRUD</h1>
      <p className="text-secondary small mb-3">
        Entity: <code>{entity}</code> — destructive actions require confirmation.
      </p>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      <div className="mb-3">
        <label className="form-label">JSON payload (edit + POST to create)</label>
        <textarea className="form-control font-monospace small" rows={10} value={raw} onChange={(e) => setRaw(e.target.value)} />
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={async () => {
            try {
              await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: raw })
              const data = await fetchJson<unknown[]>(url)
              setRows(Array.isArray(data) ? data : [])
              setRaw(JSON.stringify(data, null, 2))
            } catch (e: unknown) {
              setErr(e instanceof Error ? e.message : 'Error')
            }
          }}
        >
          Create (POST)
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>Row</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r, i) => (
              <tr key={i}>
                <td>
                  <pre className="small mb-0 text-wrap">{JSON.stringify(r)}</pre>
                </td>
                <td className="text-end">
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setPendingDelete({ id: String(i) })}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pendingDelete ? (
        <ConfirmModal
          title="Delete row?"
          message="This calls the admin API delete endpoint for the selected synthetic id in this scaffold. Wire real keys in production."
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  )
}
