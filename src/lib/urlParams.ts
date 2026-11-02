// Mantém os parâmetros de rastreamento da URL de entrada (UTMs, src, sck, fbclid, xcod...) em TODAS as
// páginas do site — a Utmify e os pixels leem esses parâmetros da URL da página atual.
const KEY = 'rifa_url_params'
const TTL = 30 * 24 * 60 * 60 * 1000 // 30 dias
// parâmetros internos do sistema, que não devem ser repassados entre páginas
const INTERNAL = new Set(['acima', 'bonus', '__p'])

interface Saved {
  params: [string, string][]
  at: number
}

/** Guarda os parâmetros da URL atual (último clique vence: uma nova campanha substitui a anterior). */
export function captureUrlParams(search: string) {
  const incoming = [...new URLSearchParams(search)].filter(([k, v]) => !INTERNAL.has(k) && v !== '')
  if (!incoming.length) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ params: incoming, at: Date.now() } satisfies Saved))
  } catch {
    /* navegação privada sem storage: segue sem guardar */
  }
}

export function savedUrlParams(): [string, string][] {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    if (!s || Date.now() - s.at > TTL) return []
    return s.params
  } catch {
    return []
  }
}

/** Retorna a query string com os parâmetros guardados que estiverem faltando (ou null se nada falta). */
export function withSavedParams(search: string): string | null {
  const current = new URLSearchParams(search)
  let changed = false
  for (const [k, v] of savedUrlParams()) {
    if (!current.has(k)) {
      current.append(k, v)
      changed = true
    }
  }
  return changed ? `?${current.toString()}` : null
}
