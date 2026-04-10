import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchJson } from '../api/client'

export function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await fetchJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          confirmPassword,
          supporterId: null,
        }),
      })
      navigate('/', { replace: true })
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto" style={{ maxWidth: '560px' }}>
      <h1 className="h2 mb-3">Create account</h1>
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <p className="text-secondary small">New accounts are assigned the donor role by default.</p>
          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="form-control"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
              />
              <div className="form-text">Use at least 12 characters (same rule as the server).</div>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
              <input id="confirmPassword" className="form-control" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {error ? <div className="alert alert-danger">{error}</div> : null}
            <button type="submit" className="btn btn-primary lh-btn-pill px-4" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <p className="mt-3 mb-0 text-secondary">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </section>
  )
}
