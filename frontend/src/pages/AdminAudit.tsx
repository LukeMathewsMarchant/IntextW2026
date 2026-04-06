import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

type Row = {
  id: string
  userId: string
  action: string
  entityType: string
  entityKey?: string
  timestamp: string
}

export function AdminAudit() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<Row[]>('/api/admin/audit?take=200')
      .then(setRows)
      .catch((e: Error) => setErr(e.message))
  }, [])

  return (
    <div>
      <h1 className="h3 mb-3">Audit log</h1>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      <div className="table-responsive">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Key</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-nowrap small">{r.timestamp}</td>
                <td className="small">{r.userId}</td>
                <td>{r.action}</td>
                <td>{r.entityType}</td>
                <td className="small">{r.entityKey}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
