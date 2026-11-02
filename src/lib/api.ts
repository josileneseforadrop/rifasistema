// Cliente da API do servidor (toda a lógica fica em /server; o navegador nunca acessa o banco).
const TOKEN_KEY = 'rifa_admin_token'

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)),
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Opts = { method?: string; body?: unknown; query?: Record<string, string | number | undefined | null> }

async function request<T>(path: string, opts: Opts = {}, admin = false): Promise<T> {
  const qs = opts.query
    ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString()
    : ''
  const headers: Record<string, string> = {}
  const isForm = opts.body instanceof FormData
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (admin) {
    const t = adminToken.get()
    if (t) headers.Authorization = `Bearer ${t}`
  }
  let res: Response
  try {
    res = await fetch(`/api${path}${qs}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor')
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (admin && res.status === 401) {
      adminToken.set(null)
      window.dispatchEvent(new Event('admin-logout'))
    }
    throw new ApiError(res.status, data?.error ?? `Erro ${res.status}`)
  }
  return data as T
}

export const api = <T = unknown>(path: string, opts?: Opts) => request<T>(path, opts, false)
export const adminApi = <T = unknown>(path: string, opts?: Opts) => request<T>(path, opts, true)

export function errorMessage(e: unknown): string {
  if (!e) return 'Erro desconhecido'
  if (typeof e === 'string') return e
  return (e as { message?: string }).message ?? 'Erro desconhecido'
}

export async function uploadImage(file: File, folder = 'uploads'): Promise<string> {
  const form = new FormData()
  form.append('folder', folder)
  form.append('file', file)
  const { url } = await adminApi<{ url: string }>('/admin/upload', { body: form })
  return url
}
