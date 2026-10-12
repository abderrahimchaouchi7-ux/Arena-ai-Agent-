import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Surface unhandled rejections in the console rather than failing silently.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[nur] unhandled rejection', event.reason);
});
