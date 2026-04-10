// Thin fetch wrapper for cookie-auth JSON APIs on the .NET origin (VITE_API_URL in dev).
function getApiBaseUrl() {
  const baseUrlRaw = import.meta.env.VITE_API_URL || ''
  return baseUrlRaw.endsWith('/') ? baseUrlRaw.slice(0, -1) : baseUrlRaw
}

export function toApiUrl(path: string) {
  const baseUrl = getApiBaseUrl()
  return path.startsWith('/') ? `${baseUrl}${path}` : path
}

/** Pull a user-facing message from API error JSON (ASP.NET `{ error }`, ProblemDetails, or validation `errors`). */
function parseApiErrorMessage(text: string, fallback: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return trimmed || fallback
  try {
    const j = JSON.parse(trimmed) as Record<string, unknown>
    if (typeof j.error === 'string' && j.error) return j.error
    if (typeof j.message === 'string' && j.message) return j.message
    if (typeof j.detail === 'string' && j.detail) return j.detail
    if (typeof j.title === 'string' && j.title) return j.title
    if (j.errors && typeof j.errors === 'object' && j.errors !== null) {
      const errs = j.errors as Record<string, string[] | string>
      for (const v of Object.values(errs)) {
        if (Array.isArray(v) && v[0]) return v[0]
        if (typeof v === 'string' && v) return v
      }
    }
  } catch {
    /* not JSON */
  }
  return trimmed || fallback
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const finalUrl = url.startsWith('/') ? `${baseUrl}${url}` : url
  const res = await fetch(finalUrl, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    const message = parseApiErrorMessage(text, res.statusText || 'Request failed')
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export type AuthMe = {
  isAuthenticated: boolean
  name?: string
  roles: string[]
}
