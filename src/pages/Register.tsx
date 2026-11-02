import { useNavigate } from 'react-router-dom'
import { Panel, SectionTitle } from '../components/Layout'
import { IdentityForm } from '../components/Checkout'
import { useCustomer } from '../context/CustomerContext'

export default function Register() {
  const navigate = useNavigate()
  const { customer, setCustomer } = useCustomer()
  return (
    <Panel>
      <SectionTitle emoji="📝" title="Cadastro" />
      {customer ? (
        <div className="card">
          Você já está identificado como <b>{customer.name}</b>.
        </div>
      ) : (
        <IdentityForm
          submitLabel="Continuar"
          onIdentified={(c) => {
            setCustomer(c)
            navigate('/')
          }}
        />
      )}
    </Panel>
  )
}
