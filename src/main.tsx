import React, { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'
import { ErrorFallback } from './components/ui/ErrorFallback'
import { LoadingScreen } from './components/ui/LoadingScreen'
import { UpdatePrompt } from './components/pwa/UpdatePrompt'
import { loadGoogleFont } from './utils/googleFonts'
import { useSettingsStore } from './store/settingsStore'

const App = React.lazy(() => import('./App'))

// Aktive Schriftart beim App-Start laden (Google Font CDN)
const currentFont = useSettingsStore.getState().fontFamily;
if (currentFont) loadGoogleFont(currentFont);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <Suspense fallback={<LoadingScreen />}>
        <App />
        <UpdatePrompt />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
