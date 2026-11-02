import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import { HttpError } from './http'

export const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Res<T> = { data: T | null; error: { message: string; code?: string } | null }

/** Lança erro se a consulta falhar e devolve os dados. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function must<T = any>(res: Res<unknown>, conflictMsg?: string): T {
  if (res.error) {
    if (res.error.code === '23505') throw new HttpError(409, conflictMsg ?? 'Registro duplicado')
    throw new HttpError(500, res.error.message)
  }
  return res.data as T
}

/** Busca todas as linhas de uma consulta paginando de 1000 em 1000. */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<Res<T[]>>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const rows = must<T[] | null>(await build(from, from + 999)) ?? []
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}
