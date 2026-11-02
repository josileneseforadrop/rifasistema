export const onlyDigits = (s: unknown) => String(s ?? '').replace(/\D/g, '')

export const str = (v: unknown, max = 5000) => (v == null ? '' : String(v).trim().slice(0, max))
export const optStr = (v: unknown, max = 5000) => str(v, max) || null

export const firstName = (name: string) => name.trim().split(/\s+/)[0]

export function maskPhone(phone: string | null) {
  const d = onlyDigits(phone)
  return d.length >= 2 ? `(${d.slice(0, 2)}) ****-****` : null
}

export function randomCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ---- PIX copia e cola (BR Code estático com valor) ----
const field = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value

function crc16(payload: string) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const clean = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max).trim()

export function buildPixPayload(opts: { key: string; name: string; city: string; amount: number; txid?: string }) {
  const account = field('00', 'br.gov.bcb.pix') + field('01', opts.key.trim())
  const txid = (opts.txid ?? '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  let payload =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (opts.amount > 0 ? field('54', opts.amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', clean(opts.name || 'RECEBEDOR', 25) || 'RECEBEDOR') +
    field('60', clean(opts.city || 'SAO PAULO', 15) || 'SAO PAULO') +
    field('62', field('05', txid)) +
    '6304'
  payload += crc16(payload)
  return payload
}

export function isValidCpf(value: unknown) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

export const maskCpf = (cpf: string | null) => {
  const d = onlyDigits(cpf)
  return d.length === 11 ? `${d.slice(0, 3)}.***.***-**` : null
}

/** (47) 9****-**** */
export const maskPhoneFull = (phone: string | null) => {
  const d = onlyDigits(phone)
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 3)}****-****` : null
}

export function ageFrom(date: string) {
  const b = new Date(date + 'T12:00:00')
  const n = new Date()
  let age = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--
  return age
}
