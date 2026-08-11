import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { reloadOnVitePreloadError } from './utils/chunkRecovery';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

window.addEventListener('vite:preloadError', reloadOnVitePreloadError);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter basename={import.meta.env.BASE_URL}>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
