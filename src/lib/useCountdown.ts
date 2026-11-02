import { useEffect, useState } from 'react'

export function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!target) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [target])
  if (!target) return { ms: 0, label: '' }
  const ms = Math.max(0, new Date(target).getTime() - now)
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { ms, label: `${pad(h)}:${pad(m)}:${pad(sec)}` }
}
