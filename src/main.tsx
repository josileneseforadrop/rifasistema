import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { SettingsProvider } from './context/SettingsContext'
import { CustomerProvider } from './context/CustomerContext'
import './styles.css'
import { loadCustomScripts } from './lib/customScripts'
import { reloadOnceForNewVersion } from './lib/lazyRetry'

loadCustomScripts()

// build novo publicado enquanto a página estava aberta: o Vite avisa e recarregamos uma vez
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  reloadOnceForNewVersion()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <CustomerProvider>
          <App />
        </CustomerProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
