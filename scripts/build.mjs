import { build, createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { languages, languageCode, publicPages, privatePages } from '../client/lib/locales.js';
import { renderHead, renderRobots, renderSitemap, websiteOrigin } from '../client/seo.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const configFile = path.join(root, 'vite.config.mjs');
const site = websiteOrigin(process.env.SITE_URL || 'https://bao-cv.com');
await build({ configFile });
const template = await readFile(path.join(root, 'dist/index.html'), 'utf8');
const renderer = await createServer({ configFile, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { renderPage } = await renderer.ssrLoadModule('/entry-server.jsx');
  const variants = [...languages.flatMap(language => publicPages.map(page => ({ page, language }))), ...privatePages.map(page => ({ page, language: 'en' }))];
  for (const { page, language } of variants) {
    const directory = path.join(root, 'dist', language === 'en' ? '' : languageCode(language));
    await mkdir(directory, { recursive: true });
    const html = template.replace('<html lang="en">', `<html lang="${languageCode(language)}">`)
      .replace('<!--site-head-->', () => renderHead(page, language, site))
      .replace('<!--site-content-->', () => renderPage(page, language));
    await writeFile(path.join(directory, `${page}.html`), html);
  }
  await writeFile(path.join(root, 'dist', 'sitemap.xml'), renderSitemap(site));
  await writeFile(path.join(root, 'dist', 'robots.txt'), renderRobots(site));
  console.log(`Prerendered ${variants.length} pages with localized metadata. No database or secrets are used during the build.`);
} finally { await renderer.close(); }
