export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const baseUrlRaw = import.meta.env.VITE_API_URL || ''
  const baseUrl = baseUrlRaw.endsWith('/') ? baseUrlRaw.slice(0, -1) : baseUrlRaw
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
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export type AuthMe = {
  isAuthenticated: boolean
  name?: string
  roles: string[]
}
