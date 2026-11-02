import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p,
})

export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.4}><path d="M7 6h14M3 6h1M7 12h14M3 12h1M7 18h14M3 18h1" /></svg>
)
export const IconClose = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} strokeWidth={2.4}><path d="M5 5l14 14M19 5L5 19" /></svg>
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M12 3 3 10.5V21h6v-6h6v6h6V10.5z" /></svg>
)
export const IconList = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 8h9M8 12h9M8 16h9M6 8h0M6 12h0M6 16h0" /></svg>
)
export const IconNews = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h10M7 11h10M7 15h3v3H7zM13 15h4M13 18h4" /></svg>
)
export const IconLogin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M10 17l5-5-5-5M15 12H3" /></svg>
)
export const IconRegister = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 8V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3M10 16l4-4-4-4M14 12H3" /></svg>
)
export const IconTrophy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></svg>
)
export const IconAward = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="5" /><path d="M8.5 12 7 21l5-3 5 3-1.5-9" /></svg>
)
export const IconTerms = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M14 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l4 4v4M8 8h5M8 12h3M8 16h2" /><circle cx="17" cy="15" r="2.5" /><path d="M15.5 17 15 21l2-1 2 1-.5-4" /></svg>
)
export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
)
export const IconCart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 4h2l2.5 11h11L21 7H7M10 9.5l2 2 3.5-3.5" /><circle cx="9" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></svg>
)
export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} width={32} height={32}><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>
)
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} width={32} height={32}><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></svg>
)
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} width={30} height={30}><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" /></svg>
)
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} width={30} height={30}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M12 7v8M9 12l3 3 3-3" /></svg>
)
export const IconArrow = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} strokeWidth={2.4}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} width={16} height={16}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
)
export const IconWhats = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} width={20} height={20}><path d="M3 21l1.6-4.6A9 9 0 1 1 8 19.6z" /><path d="M9 9.5c.3 2 2.5 4.3 4.6 4.6l1.1-1.1 2 .9c-.2 1.3-1.3 2-2.6 1.8C11 15 9 13 8.4 10.2 8.2 8.9 9 7.8 10.2 7.6l.9 2z" /></svg>
)
export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
)
