// Build para o Vercel (Build Output API v3):
//   .vercel/output/static            -> site React (dist)
//   .vercel/output/functions/api.func -> toda a API em uma função Node (com o .env junto)
//   .vercel/output/config.json       -> rotas (/api/* -> função, resto -> SPA) e cron
import { build } from 'esbuild'
import { execSync } from 'child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'

const OUT = '.vercel/output'
// versão do Node da função (o Vercel desativa versões antigas; troque aqui ou pela variável VERCEL_NODE_RUNTIME)
const RUNTIME = process.env.VERCEL_NODE_RUNTIME || 'nodejs24.x'
const FN = `${OUT}/functions/api.func`
const run = (cmd) => execSync(cmd, { stdio: 'inherit' })

rmSync(OUT, { recursive: true, force: true })

console.log('\n▶ verificando tipos')
run('npx tsc -b && npx tsc -p server')

console.log('\n▶ site (vite build)')
run('npx vite build')
mkdirSync(`${OUT}/static`, { recursive: true })
cpSync('dist', `${OUT}/static`, { recursive: true })

console.log('\n▶ API (função serverless)')
mkdirSync(FN, { recursive: true })
await build({
  entryPoints: ['server/vercel.ts'],
  outfile: `${FN}/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  legalComments: 'none',
  external: ['bufferutil', 'utf-8-validate', 'pg-native'],
  logLevel: 'warning',
})
writeFileSync(`${FN}/package.json`, JSON.stringify({ type: 'commonjs' }))
writeFileSync(
  `${FN}/.vc-config.json`,
  JSON.stringify({ runtime: RUNTIME, handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 60 }, null, 2),
)
if (existsSync('.env')) {
  copyFileSync('.env', `${FN}/.env`)
  console.log('  .env incluído na função')
} else console.log('  sem .env: use Project Settings → Environment Variables no Vercel')

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/api/(.*)$', dest: '/api?__p=$1' },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
      // plano Hobby do Vercel só permite cron diário; no Pro troque para "* * * * *"
      crons: [{ path: '/api/cron/expire', schedule: '0 3 * * *' }],
    },
    null,
    2,
  ),
)
console.log(`\n✔ build do Vercel pronto em .vercel/output (função em ${RUNTIME})`)
