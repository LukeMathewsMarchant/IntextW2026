import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchJson } from '../api/client'

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  type LoginResponse = {
    isAuthenticated?: boolean
    requiresTwoFactor?: boolean
    challengeId?: string
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await fetchJson<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (result?.requiresTwoFactor) {
        setRequiresTwoFactor(true)
        setChallengeId(result.challengeId ?? '')
        setSubmitting(false)
        return
      }
      const returnUrl = searchParams.get('returnUrl') || '/'
      navigate(returnUrl, { replace: true })
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed.')
      setSubmitting(false)
    }
  }

  async function onSubmitTwoFactor(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await fetchJson('/api/auth/login-2fa', {
        method: 'POST',
        body: JSON.stringify({ code: twoFactorCode.trim(), challengeId, rememberMachine: true }),
      })
      const returnUrl = searchParams.get('returnUrl') || '/'
      navigate(returnUrl, { replace: true })
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '2FA verification failed.')
      setSubmitting(false)
    }
  }

  async function resendTwoFactorCode() {
    setError('')
    try {
      await fetchJson('/api/auth/2fa/send-code', {
        method: 'POST',
        body: JSON.stringify({ challengeId }),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to resend code.')
    }
  }

  return (
    <section className="mx-auto" style={{ maxWidth: '560px' }}>
      <h1 className="h2 mb-3">Login</h1>
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          {!requiresTwoFactor ? (
            <form onSubmit={onSubmit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="email">Email</label>
                <input id="email" className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="password">Password</label>
                <input id="password" className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error ? <div className="alert alert-danger">{error}</div> : null}
              <button type="submit" className="btn btn-primary lh-btn-pill px-4" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmitTwoFactor}>
              <div className="mb-3">
                <label className="form-label" htmlFor="twoFactorCode">Email verification code</label>
                <input
                  id="twoFactorCode"
                  className="form-control"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  required
                />
                <div className="form-text">Enter the 6-digit code sent to your email.</div>
              </div>
              {error ? <div className="alert alert-danger">{error}</div> : null}
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary lh-btn-pill px-4" disabled={submitting}>
                  {submitting ? 'Verifying...' : 'Verify code'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary lh-btn-pill"
                  onClick={resendTwoFactorCode}
                  disabled={submitting}
                >
                  Resend code
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary lh-btn-pill"
                  onClick={() => {
                    setRequiresTwoFactor(false)
                    setTwoFactorCode('')
                    setChallengeId('')
                    setError('')
                  }}
                  disabled={submitting}
                >
                  Back
                </button>
              </div>
            </form>
          )}
          <p className="mt-3 mb-0 text-secondary">
            Need an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </section>
  )
}
