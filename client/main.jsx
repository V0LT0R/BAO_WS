import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { getPage, metadata, styles } from './metadata.js';

const page = getPage(window.location.pathname);
for (const style of styles(page)) {
  if (document.getElementById(style.id)) continue;
  const link = document.createElement('link');
  Object.assign(link, { rel: 'stylesheet', ...style });
  document.head.append(link);
}
document.title = metadata(page).title;
const root = document.getElementById('root');
if (root.querySelector('nav')) hydrateRoot(root, <App page={page} />);
else createRoot(root).render(<App page={page} />);
