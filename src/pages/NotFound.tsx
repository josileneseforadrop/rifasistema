import { Link } from 'react-router-dom'
import { Panel } from '../components/Layout'

export default function NotFound() {
  return (
    <Panel>
      <div className="center" style={{ padding: 40 }}>
        <h2>Página não encontrada</h2>
        <Link to="/" className="btn">Voltar ao início</Link>
      </div>
    </Panel>
  )
}
