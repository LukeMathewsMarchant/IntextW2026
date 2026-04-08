import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { fetchJson, type AuthMe } from '../api/client'

type RequireRoleProps = {
  role: string
  children: ReactElement
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const [me, setMe] = useState<AuthMe | null>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    fetchJson<AuthMe>('/api/auth/me')
      .then((data) => setMe(data))
      .catch(() => setMe({ isAuthenticated: false, roles: [] }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-secondary small mb-0">Checking your access…</p>
  }

  if (!me?.isAuthenticated) {
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (!me.roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
