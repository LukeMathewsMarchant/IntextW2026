import { useEffect, useState } from 'react'
import { fetchJson, type AuthMe } from '../api/client'

export function AppFooter() {
  const [me, setMe] = useState<AuthMe>({ isAuthenticated: false, roles: [] })

  useEffect(() => {
    fetchJson<AuthMe>('/api/auth/me')
      .then(setMe)
      .catch(() => setMe({ isAuthenticated: false, roles: [] }))
  }, [])

  const isAdmin = me.isAuthenticated && me.roles.includes('Admin')

  return (
    <footer className="lh-footer py-4 mt-auto small">
      <div className="container d-flex flex-wrap justify-content-between align-items-center gap-2 text-secondary">
        <span>&copy; {new Date().getUTCFullYear()} Light on a Hill Foundation</span>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <a className="text-secondary" href="/privacy">
            Privacy
          </a>
          <a className="text-secondary" href="/about">
            About
          </a>
          {isAdmin ? (
            <a className="text-secondary" href="/contact">
              Contact
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
