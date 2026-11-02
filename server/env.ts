import 'dotenv/config'

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.includes('COLE_AQUI')) {
    console.error(`\n[config] Defina ${name} no arquivo .env\n`)
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
}
