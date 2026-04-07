import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { fetchJson, toApiUrl, type AuthMe } from '../api/client'

const THEME_KEY = 'lh-theme'

function navLinkClass(active: boolean) {
  return active ? 'nav-link active' : 'nav-link'
}

export function AppNav() {
  const [me, setMe] = useState<AuthMe>({ isAuthenticated: false, roles: [] })
  const loginUrl = toApiUrl('/Account/Login')

  function applyTheme(theme: 'light' | 'dark') {
    document.documentElement.setAttribute('data-bs-theme', theme)
  }

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') {
      applyTheme(stored)
      return
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    fetchJson<AuthMe>('/api/auth/me')
      .then(setMe)
      .catch(() => setMe({ isAuthenticated: false, roles: [] }))
  }, [])

  function toggleTheme() {
    const current = (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) ?? 'light'
    const next = current === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
  }

  return (
    <header className="lh-nav sticky-top">
      <nav className="navbar navbar-expand-lg navbar-light lh-navbar-shell w-100">
        <div className="container-fluid px-0 d-flex align-items-stretch flex-wrap">
          <Link className="lh-brand-ribbon navbar-brand lh-brand d-flex align-items-center text-decoration-none m-0 py-0" to="/">
            <span className="lh-brand-logo-frame">
              <img src="/img/Logo.png" alt="Light on a Hill Foundation" className="lh-brand-logo" />
            </span>
            <span className="lh-brand-wordmark text-body">Light on a Hill Foundation</span>
          </Link>
          <div className="lh-navbar-trail d-flex flex-grow-1 flex-wrap align-items-center min-w-0 ps-2 pe-3">
            <button
              className="navbar-toggler ms-auto my-2"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#viteMainNav"
              aria-controls="viteMainNav"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon" />
            </button>
            <div className="collapse navbar-collapse flex-grow-1" id="viteMainNav">
              <ul className="navbar-nav mx-lg-auto mb-2 mb-lg-0 align-items-lg-center">
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/" end>
                    Home
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/impact">
                    Impact
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/about">
                    About
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/contact">
                    Contact
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/privacy">
                    Privacy
                  </NavLink>
                </li>
                {me.isAuthenticated && me.roles.includes('Donor') ? (
                  <li className="nav-item">
                    <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/Donor">
                      Dashboard
                    </NavLink>
                  </li>
                ) : null}
                {me.isAuthenticated && me.roles.includes('Admin') ? (
                  <li className="nav-item">
                    <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/Admin">
                      Dashboard
                    </NavLink>
                  </li>
                ) : null}
              </ul>
              <div className="d-flex flex-wrap align-items-center gap-2 ms-lg-2">
                <button
                  type="button"
                  className="btn btn-link lh-theme-toggle"
                  title="Toggle theme"
                  aria-label="Toggle dark mode"
                  onClick={toggleTheme}
                >
                  &#9789;
                </button>
                {!me.isAuthenticated ? (
                  <a className="btn btn-sm lh-btn-ghost lh-btn-pill" href={loginUrl}>
                    Login
                  </a>
                ) : null}
                <Link className="btn btn-primary lh-btn-pill lh-btn-donate d-inline-flex align-items-center gap-2" to="/donate">
                  <span aria-hidden="true">&#9829;</span> Donate
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
