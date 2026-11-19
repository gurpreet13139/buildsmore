import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';
import { storage } from './services/storage';
import { InitialAppData } from './utils/seo';

/**
 * Server-side renders the complete BUILDsmore application HTML for any route
 * using React Router StaticRouter and live server-side portfolio, collection,
 * location, trophy, and blog data.
 */
export function render(url: string, initialData: InitialAppData): string {
  storage.hydrateRuntimeSnapshot(initialData);
  const location = url && url.startsWith('/') ? url : `/${url || ''}`;
  return renderToString(
    <StaticRouter location={location}>
      <App initialPath={location} initialData={initialData} />
    </StaticRouter>
  );
}
