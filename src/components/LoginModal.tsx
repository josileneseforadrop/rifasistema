import { useCustomer } from '../context/CustomerContext'
import { IdentityForm, Sheet } from './Checkout'

/** "Entrar" do menu: identificação por CPF (cadastro se for novo). */
export default function LoginModal() {
  const { loginOpen, closeLogin, onLoginDone, setCustomer } = useCustomer()
  if (!loginOpen) return null
  return (
    <Sheet title="Entrar" onClose={closeLogin}>
      <IdentityForm
        submitLabel="Continuar"
        onIdentified={(c) => {
          setCustomer(c)
          const cb = onLoginDone
          closeLogin()
          cb?.(c)
        }}
      />
    </Sheet>
  )
}
