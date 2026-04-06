import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

type Pred = { score0To1: number; explanation: string }

export function DonorInsights() {
  const [p, setP] = useState<Pred | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<Pred>('/api/donor/prediction')
      .then(setP)
      .catch((e: Error) => setErr(e.message))
  }, [])

  return (
    <div>
      <h1 className="h3 mb-3">Insights</h1>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      {p ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="text-secondary small">Heuristic engagement score (0–1)</div>
            <div className="display-6">{p.score0To1}</div>
            <p className="text-secondary mt-2 mb-0">{p.explanation}</p>
          </div>
        </div>
      ) : (
        <p className="text-muted">Loading…</p>
      )}
    </div>
  )
}
