export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'include' })

  if (!res.ok) {
    let body: any = null
    try { body = await res.json() } catch {}
    const err: any = new Error(body?.message || res.statusText)
    err.status = res.status
    err.body = body
    throw err
  }

  return res.json()
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (!res.ok) {
    let payload: any = null
    try { payload = await res.json() } catch {}
    const err: any = new Error(payload?.message || res.statusText)
    err.status = res.status
    err.body = payload
    throw err
  }

  return res.json()
}
