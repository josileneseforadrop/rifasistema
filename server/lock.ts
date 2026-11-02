// Fila por chave: garante que operações da mesma campanha rodem uma de cada vez
// (contadores de vendidos/reservados consistentes). Rode o servidor em UMA instância.
const queues = new Map<string, Promise<unknown>>()

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  const tail = run.catch(() => undefined)
  queues.set(key, tail)
  tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key)
  })
  return run
}
