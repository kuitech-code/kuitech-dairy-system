import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA REGISTRATION COUPLING
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('🎉 PWA Successfully Registered! App installation enabled.', reg.scope))
      .catch(err => console.log('❌ PWA Registration failed: ', err));
  });
}
