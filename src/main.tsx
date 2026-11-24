import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p';
import '@fontsource/vt323';
import './styles/app.css';
import { App } from './ui/App';
import { SaveProvider } from './ui/store';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <SaveProvider>
    <App />
  </SaveProvider>,
);
