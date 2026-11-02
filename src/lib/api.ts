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

/**
 * Envia o arquivo direto para o Supabase Storage com um link assinado gerado pelo servidor
 * (não passa pela API: funciona no Vercel, que limita cada requisição a ~4,5 MB).
 */
export async function uploadImage(file: File, folder = 'uploads'): Promise<string> {
  const { signedUrl, publicUrl } = await adminApi<{ signedUrl: string; publicUrl: string }>('/admin/upload-url', {
    body: { folder, name: file.name, type: file.type, size: file.size },
  })
  const form = new FormData()
  form.append('cacheControl', '31536000')
  form.append('', file)
  let res: Response
  try {
    res = await fetch(signedUrl, { method: 'PUT', body: form, headers: { 'x-upsert': 'false' } })
  } catch {
    throw new ApiError(0, 'Falha de conexão ao enviar o arquivo')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const msg = String(data?.message ?? data?.error ?? '')
    if (res.status === 413 || /exceeded|too large|maximum/i.test(msg))
      throw new ApiError(413, 'O Supabase recusou o arquivo por tamanho. No plano gratuito o limite é 50 MB por arquivo — comprima o vídeo ou aumente o limite em Storage → Settings.')
    throw new ApiError(res.status, msg || `Erro ${res.status} ao enviar o arquivo`)
  }
  return publicUrl
}
