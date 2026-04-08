import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchJson } from '../api/client'

type Point = { month: string; total: number }

export function DonorHistory() {
  const [data, setData] = useState<Point[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<Point[]>('/api/donor/donations')
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [])

  return (
    <div>
      <h1 className="h3 mb-3">Donation history</h1>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total" fill="var(--bs-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
