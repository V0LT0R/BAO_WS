import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';
export { pages, metadata, styles } from './metadata.js';
export function renderPage(page, language = 'en') { return renderToString(<App page={page} initialLanguage={language} />); }
