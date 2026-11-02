// Executor de migrations: aplica, em ordem, os arquivos de supabase/migrations que ainda não rodaram.
//   npm run migrate              aplica as pendentes
//   npm run migrate status       lista aplicadas / pendentes
//   npm run migrate new <nome>   cria um novo arquivo numerado
import 'dotenv/config'
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')
const LOCK_ID = 727274 // trava para duas execuções simultâneas não aplicarem a mesma migration

const files = () => readdirSync(DIR).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()

function client() {
  const url = process.env.DATABASE_URL
  if (!url || url.includes('COLE_AQUI')) throw new Error('Defina DATABASE_URL no .env (Supabase → Connect → Session pooler)')
  const local = /localhost|127\.0\.0\.1/.test(url)
  return new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } })
}

async function withDb<T>(fn: (db: pg.Client) => Promise<T>) {
  const db = client()
  await db.connect()
  try {
    await db.query(`create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`)
    await db.query('alter table schema_migrations enable row level security')
    return await fn(db)
  } finally {
    await db.end()
  }
}

const applied = async (db: pg.Client) => new Set((await db.query('select name from schema_migrations')).rows.map((r) => r.name as string))

export async function runMigrations(log = console.log) {
  return withDb(async (db) => {
    await db.query('select pg_advisory_lock($1)', [LOCK_ID])
    try {
      const done = await applied(db)
      const pending = files().filter((f) => !done.has(f))
      if (!pending.length) return log('[migrations] banco atualizado, nada a aplicar')
      for (const f of pending) {
        const sql = readFileSync(join(DIR, f), 'utf8')
        try {
          await db.query('begin')
          await db.query(sql)
          await db.query('insert into schema_migrations (name) values ($1)', [f])
          await db.query('commit')
          log(`[migrations] ✓ ${f}`)
        } catch (e) {
          await db.query('rollback')
          throw new Error(`Falha na migration ${f}: ${(e as Error).message}. Nada desta migration foi aplicado.`)
        }
      }
    } finally {
      await db.query('select pg_advisory_unlock($1)', [LOCK_ID])
    }
  })
}

async function status() {
  await withDb(async (db) => {
    const done = await applied(db)
    for (const f of files()) console.log(done.has(f) ? '  ✓ aplicada ' : '  • pendente ', f)
  })
}

function create(name: string) {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
  if (!slug) throw new Error('Informe um nome: npm run migrate new adicionar_cupons')
  const last = files().at(-1)
  const next = String((last ? Number(last.slice(0, 4)) : 0) + 1).padStart(4, '0')
  const file = `${next}_${slug}.sql`
  writeFileSync(
    join(DIR, file),
    `-- ${next} - ${name}\n-- Use "if not exists" / "if exists" para a migration ser segura de rodar novamente.\n-- Nunca edite uma migration já aplicada: crie uma nova.\n\n`,
  )
  console.log(`Criada supabase/migrations/${file}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, ...rest] = process.argv.slice(2)
  const job = cmd === 'status' ? status() : cmd === 'new' ? Promise.resolve(create(rest.join(' '))) : runMigrations()
  job.catch((e) => {
    console.error(`\n[migrations] ${e.message}\n`)
    process.exit(1)
  })
}
