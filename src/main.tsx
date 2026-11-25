import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p';
import '@fontsource/vt323';
import './styles/app.css';
import { App } from './ui/App';
import { AuthProvider } from './ui/auth';
import { SaveProvider } from './ui/store';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <SaveProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </SaveProvider>,
);

// Offline support. Only registered in production builds, where hashed assets make caching safe.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is optional; the game works without it */
    });
  });
}
