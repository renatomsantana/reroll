import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './settings/SettingsContext'
import { ProfilesProvider } from './settings/ProfilesContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Os perfis ficam POR FORA: é o personagem aberto que decide quais cores o `SettingsProvider` carrega. */}
    <ProfilesProvider>
      <SettingsProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </SettingsProvider>
    </ProfilesProvider>
  </React.StrictMode>
)
