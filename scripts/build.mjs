import { build, createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const configFile = path.join(root, 'vite.config.mjs');
const origin = process.env.SITE_URL || 'https://bao-cv.com';
const site = new URL(origin);
if (!['https:', 'http:'].includes(site.protocol) || site.username || site.password || site.pathname !== '/') throw new Error('SITE_URL must be a website origin.');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
await build({ configFile });
const template = await readFile(path.join(root, 'dist/index.html'), 'utf8');
const renderer = await createServer({ configFile, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { renderPage, pages, metadata, styles } = await renderer.ssrLoadModule('/entry-server.jsx');
  for (const page of pages) {
    const meta = metadata(page);
    const canonical = new URL(page === 'index' ? '/' : `/${page}.html`, site).href;
    const head = [
      `<title>${escape(meta.title)}</title>`,
      `<meta name="description" content="${escape(meta.description)}">`,
      `<link rel="canonical" href="${escape(canonical)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${escape(meta.title)}">`,
      `<meta property="og:description" content="${escape(meta.description)}">`,
      `<meta property="og:url" content="${escape(canonical)}">`,
      `<meta property="og:image" content="${escape(new URL('/assets/images/favicon.png', site).href)}">`,
      ...(meta.private ? ['<meta name="robots" content="noindex, nofollow">'] : []),
      ...styles(page).map(style => `<link rel="stylesheet" id="${style.id}" href="${style.href}"${style.media ? ` media="${style.media}"` : ''}>`),
    ].join('\n    ');
    await writeFile(path.join(root, 'dist', `${page}.html`), template.replace('<!--site-head-->', head).replace('<!--site-content-->', () => renderPage(page)));
  }
  console.log(`Prerendered ${pages.length} pages. No database or secrets are used during the build.`);
} finally { await renderer.close(); }
