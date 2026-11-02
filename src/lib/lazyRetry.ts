import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'chunk_reload_at'

export const isChunkError = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|Loading chunk|ChunkLoadError|Failed to fetch/i.test(
    String((e as Error)?.message ?? e),
  )

/** Recarrega a página uma única vez por minuto (evita loop) quando o código novo não carrega. */
export function reloadOnceForNewVersion() {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  if (Date.now() - last < 60_000) return false
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  location.reload()
  return true
}

/**
 * React.lazy com nova tentativa: se o arquivo da página falhar (servidor reiniciado, build novo,
 * internet instável), tenta de novo e, se ainda falhar, recarrega a página uma vez.
 */
export function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const load = async () => {
    try {
      return await factory()
    } catch (e) {
      await new Promise((r) => setTimeout(r, 600))
      try {
        return await factory()
      } catch (e2) {
        if (isChunkError(e2) && reloadOnceForNewVersion()) return new Promise<never>(() => {}) // aguarda o reload
        throw e2 ?? e
      }
    }
  }
  const Comp = lazy(load)
  return Object.assign(Comp, { preload: load })
}
