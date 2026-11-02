import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config()
// na função do Vercel o .env fica ao lado do código
if (typeof __dirname !== 'undefined') dotenv.config({ path: join(__dirname, '.env') })

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.includes('COLE_AQUI')) {
    const msg = `[config] Defina ${name} no arquivo .env (ou em Environment Variables no Vercel)`
    if (process.env.VERCEL) throw new Error(msg) // função serverless: responde com erro em vez de encerrar
    console.error(`\n${msg}\n`)
    process.exit(1)
  }
  return v
}

export const env = {
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  JWT_SECRET: required('JWT_SECRET'),
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? '',
  PUBLIC_URL: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  PORT: Number(process.env.PORT ?? 3001),
  STORAGE_BUCKET: process.env.STORAGE_BUCKET ?? 'media',
  CRON_SECRET: process.env.CRON_SECRET ?? '',
}
