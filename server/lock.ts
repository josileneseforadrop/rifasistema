// Trava por chave (ex.: id da campanha): operações da mesma campanha rodam uma de cada vez,
// mantendo os contadores de vendidos/reservados corretos.
//  1) fila em memória: evita disputa dentro da mesma instância
//  2) linha na tabela "locks": vale entre instâncias (Vercel cria várias cópias da função)
import { randomUUID } from 'crypto'
import { db } from './db'
import { HttpError } from './http'

const queues = new Map<string, Promise<unknown>>()
const TTL_MS = 60_000 // trava esquecida (instância caiu) expira sozinha
const WAIT_MS = 25_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function acquire(key: string) {
  const token = randomUUID()
  const start = Date.now()
  for (;;) {
    const { error } = await db.from('locks').insert({ key, token, expires_at: new Date(Date.now() + TTL_MS).toISOString() })
    if (!error) return token
    if (error.code !== '23505') {
      // tabela ainda não criada (migration 0008 pendente): segue só com a fila em memória
      if (/locks/.test(error.message) && /does not exist|schema cache|not find/i.test(error.message)) return null
      throw new HttpError(500, error.message)
    }
    await db.from('locks').delete().eq('key', key).lt('expires_at', new Date().toISOString())
    if (Date.now() - start > WAIT_MS) throw new HttpError(503, 'Muitas compras ao mesmo tempo. Tente novamente em alguns segundos.')
    await sleep(40 + Math.random() * 80)
  }
}

async function release(key: string, token: string | null) {
  if (token) await db.from('locks').delete().eq('key', key).eq('token', token)
}

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve()
  // "prev" nunca rejeita (é sempre o .catch da operação anterior)
  const run = prev.then(async () => {
    const token = await acquire(key)
    try {
      return await fn()
    } finally {
      await release(key, token).catch(() => undefined)
    }
  })
  const tail = run.catch(() => undefined)
  queues.set(key, tail)
  tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key)
  })
  return run
}
