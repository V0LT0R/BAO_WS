import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';
export { pages, metadata, styles } from './metadata.js';
export function renderPage(page) { return renderToString(<App page={page} />); }
