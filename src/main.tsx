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
