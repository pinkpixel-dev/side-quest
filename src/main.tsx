import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { App } from './app/App';
import { GemmaProvider } from './app/gemma';

// Ask the browser not to evict the cached model or the collection.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GemmaProvider>
      <App />
    </GemmaProvider>
  </StrictMode>,
);
