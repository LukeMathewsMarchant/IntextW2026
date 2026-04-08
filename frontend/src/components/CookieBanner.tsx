import { useEffect, useState } from 'react'

const CONSENT_KEY = 'cookie_consent'
const THEME_COOKIE_KEY = 'lh_theme'
const CONSENT_VALUE_ACCEPTED = 'accepted'
const CONSENT_VALUE_REJECTED = 'rejected'

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
      aria-modal="true"
      aria-labelledby="cookie-consent-heading"
    >
      <div className="container d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <div className="small">
          <h2 id="cookie-consent-heading" className="h6 text-white mb-1">
            Cookie consent
          </h2>
          <p className="mb-0">
            We use essential cookies for authentication/session behavior and optional preference cookies only after consent. Review our{' '}
            <a className="lh-cookie-banner-link" href="/privacy">
              Privacy
            </a>{' '}
            policy.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={() => {
              document.cookie = `${CONSENT_KEY}=${CONSENT_VALUE_ACCEPTED}; path=/; max-age=31536000; SameSite=Lax`
              localStorage.setItem('cookie_preferences_enabled', 'true')
              setVisible(false)
            }}
          >
            Accept optional cookies
          </button>
          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            onClick={() => {
              document.cookie = `${CONSENT_KEY}=${CONSENT_VALUE_REJECTED}; path=/; max-age=31536000; SameSite=Lax`
              document.cookie = `${THEME_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`
              localStorage.removeItem('lh-theme')
              localStorage.setItem('cookie_preferences_enabled', 'false')
              setVisible(false)
            }}
          >
            Reject optional cookies
          </button>
        </div>
      </div>
    </div>
  )
}
