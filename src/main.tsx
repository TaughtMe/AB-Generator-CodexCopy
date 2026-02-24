import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdatePrompt } from './components/pwa/UpdatePrompt'
import { loadGoogleFont } from './utils/googleFonts'
import { useSettingsStore } from './store/settingsStore'

// Aktive Schriftart beim App-Start laden (Google Font CDN)
const currentFont = useSettingsStore.getState().fontFamily;
if (currentFont) loadGoogleFont(currentFont);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <UpdatePrompt />
    </ErrorBoundary>
  </StrictMode>,
)
