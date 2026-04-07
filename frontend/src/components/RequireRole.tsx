import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchJson, type AuthMe } from '../api/client'

type RequireRoleProps = {
  role: string
  children: ReactElement
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const [me, setMe] = useState<AuthMe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJson<AuthMe>('/api/auth/me')
      .then((data) => setMe(data))
      .catch(() => setMe({ isAuthenticated: false, roles: [] }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  if (!me?.isAuthenticated || !me.roles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return children
}
