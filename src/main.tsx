import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { storage } from './services/storage';
import { readInitialAppDataFromDom } from './utils/seo';

const rootEl = document.getElementById('root')!;
const initialData = readInitialAppDataFromDom();

if (initialData) {
  storage.hydrateRuntimeSnapshot(initialData);
}

if (typeof window !== 'undefined') {
  const isHomeWithoutHash =
    (window.location.pathname === '/' || window.location.pathname === '') &&
    !window.location.hash;
  if (isHomeWithoutHash) {
    const navEntries =
      typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function'
        ? (performance.getEntriesByType('navigation') as PerformanceNavigationTiming[])
        : [];
    const navType = navEntries[0]?.type;
    if (!navType || navType === 'navigate' || navType === 'reload') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        if ('scrollRestoration' in window.history) {
          window.history.scrollRestoration = 'auto';
        }
      });
    }
  }
}

const appTree = (
  <BrowserRouter>
    <App initialData={initialData} />
  </BrowserRouter>
);

if (rootEl.hasChildNodes() && initialData) {
  hydrateRoot(rootEl, appTree);
} else {
  createRoot(rootEl).render(appTree);
}
