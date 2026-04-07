import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

type TwoFactorStatus = {
  enabled: boolean
  email?: string
}

export function SecuritySettings() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refreshStatus() {
    const s = await fetchJson<TwoFactorStatus>('/api/auth/2fa/status')
    setStatus(s)
  }

  useEffect(() => {
    refreshStatus().catch((e: Error) => setError(e.message))
  }, [])

  async function enableTwoFactor() {
    setError('')
    setBusy(true)
    try {
      await fetchJson('/api/auth/2fa/enable', { method: 'POST' })
      await refreshStatus()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to enable 2FA.')
    } finally {
      setBusy(false)
    }
  }

  async function disableTwoFactor() {
    setError('')
    setBusy(true)
    try {
      await fetchJson('/api/auth/2fa/disable', { method: 'POST' })
      await refreshStatus()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to disable 2FA.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto" style={{ maxWidth: '760px' }}>
      <h1 className="h3 mb-3">Security</h1>
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h2 className="h5">Two-factor authentication (optional)</h2>
          <p className="text-secondary mb-3">
            Turn on 2FA only if you want extra account security. A 6-digit code will be sent to your email when you sign in.
          </p>

          {status ? (
            <div className="mb-3 small">
              <div><strong>Status:</strong> {status.enabled ? 'Enabled' : 'Disabled'}</div>
              <div><strong>Email:</strong> {status.email ?? 'Not set'}</div>
            </div>
          ) : null}

          {error ? <div className="alert alert-danger">{error}</div> : null}

          {!status?.enabled ? (
            <button type="button" className="btn btn-success lh-btn-pill" onClick={enableTwoFactor} disabled={busy}>
              {busy ? 'Enabling...' : 'Enable email 2FA'}
            </button>
          ) : (
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline-danger lh-btn-pill" onClick={disableTwoFactor} disabled={busy}>
                Disable 2FA
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
