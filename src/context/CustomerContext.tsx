import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Customer } from '../lib/types'

interface Ctx {
  customer: Customer | null
  setCustomer: (c: Customer | null) => void
  affiliateCode: string | null
  loginOpen: boolean
  openLogin: (onDone?: (c: Customer) => void) => void
  closeLogin: () => void
  onLoginDone: ((c: Customer) => void) | null
}
const CustomerContext = createContext<Ctx>(null as unknown as Ctx)
export const useCustomer = () => useContext(CustomerContext)

const KEY = 'rifa_customer'
const UTM_KEY = 'rifa_utm'
const UTM_PARAMS = ['src', 'sck', 'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term']

/** Parâmetros de rastreamento (UTMs) da URL de entrada, enviados com o pedido para a Utmify. */
export function getTracking(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(UTM_KEY) ?? '{}')
  } catch {
    return {}
  }
}
const REF_KEY = 'rifa_ref'

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<Customer | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null')
    } catch {
      return null
    }
  })
  const [affiliateCode, setAffiliateCode] = useState<string | null>(() => localStorage.getItem(REF_KEY))
  const [loginOpen, setLoginOpen] = useState(false)
  const [onLoginDone, setOnLoginDone] = useState<((c: Customer) => void) | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const utm = Object.fromEntries(UTM_PARAMS.map((k) => [k, params.get(k)]).filter(([, v]) => v))
    // nova campanha de tráfego substitui a anterior (último clique)
    if (Object.keys(utm).length) localStorage.setItem(UTM_KEY, JSON.stringify(utm))
    const ref = params.get('ref')
    if (ref) {
      localStorage.setItem(REF_KEY, ref.toUpperCase())
      setAffiliateCode(ref.toUpperCase())
    }
  }, [])

  const setCustomer = (c: Customer | null) => {
    if (c) localStorage.setItem(KEY, JSON.stringify(c))
    else localStorage.removeItem(KEY)
    setCustomerState(c)
  }

  return (
    <CustomerContext.Provider
      value={{
        customer,
        setCustomer,
        affiliateCode,
        loginOpen,
        onLoginDone,
        openLogin: (cb) => {
          setOnLoginDone(() => cb ?? null)
          setLoginOpen(true)
        },
        closeLogin: () => {
          setLoginOpen(false)
          setOnLoginDone(null)
        },
      }}
    >
      {children}
    </CustomerContext.Provider>
  )
}
