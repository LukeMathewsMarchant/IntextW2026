import { useEffect, useState } from 'react'

const CONSENT_KEY = 'cookie_consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const v = document.cookie.split('; ').find((r) => r.startsWith(`${CONSENT_KEY}=`))
      setVisible(!v)
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="lh-cookie-banner position-fixed bottom-0 start-0 end-0 p-3 shadow-lg"
      style={{ zIndex: 1080 }}
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="container d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <p className="mb-0 small">
          We use functional cookies to keep you signed in and remember your consent choice. By continuing you agree to our{' '}
          <a className="link-light" href="/privacy">
            Privacy
          </a>{' '}
          policy.
        </p>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={() => {
              document.cookie = `${CONSENT_KEY}=accepted; path=/; max-age=31536000; SameSite=Lax`
              setVisible(false)
            }}
          >
            Accept
          </button>
          <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setVisible(false)}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
