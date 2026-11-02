import type { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'
import InstallBanner from './InstallBanner'
import LoginModal from './LoginModal'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <InstallBanner />
      <LoginModal />
    </>
  )
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <main className="page">
      <div className="panel">{children}</div>
    </main>
  )
}

export function SectionTitle({ emoji, title, subtitle }: { emoji?: string; title: string; subtitle?: string | null }) {
  return (
    <div className="section-title">
      {emoji && <span className="emoji">{emoji}</span>}
      <h2>{title}</h2>
      {subtitle && <small>{subtitle}</small>}
    </div>
  )
}

export const Spinner = () => <div className="spinner" />
