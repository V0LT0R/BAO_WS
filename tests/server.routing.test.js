'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const session = require('express-session');
const request = require('supertest');
const { createApp } = require('../app');

const publicPages = ['index', 'experience', 'activity', 'certificates', 'projects', 'publications', 'FAQs'];
const privatePages = ['login', 'admin', 'user'];

async function fixture(t) {
  const tempRoot = path.resolve(os.tmpdir());
  const distDir = await fs.mkdtemp(path.join(tempRoot, 'bao-routing-test-'));
  t.after(async () => {
    const relative = path.relative(tempRoot, distDir);
    assert(relative.startsWith('bao-routing-test-') && !relative.includes(path.sep), 'Only this test fixture may be removed.');
    await fs.rm(distDir, { recursive: true, force: true });
  });
  for (const language of ['', 'uk', 'ru']) {
    await fs.mkdir(path.join(distDir, language), { recursive: true });
    for (const page of language ? publicPages : [...publicPages, ...privatePages]) {
      const relative = language ? `${language}/${page}.html` : `${page}.html`;
      await fs.writeFile(path.join(distDir, relative), `<main>${relative}</main>`);
    }
  }
  await fs.writeFile(path.join(distDir, 'robots.txt'), 'Generated multilingual robots');
  await fs.writeFile(path.join(distDir, 'sitemap.xml'), '<urlset>Generated multilingual sitemap</urlset>');
  const config = { sessionSecret: 'routing-test-secret-at-least-32-characters', production: false, publicOrigin: 'http://localhost:5000', distDir };
  const app = createApp({ config, models: {}, imageStore: { async read() { return Buffer.from('image-fixture'); } }, sessionStore: new session.MemoryStore(), logger: { warn() {}, error() {} } });
  return { app, distDir };
}

test('Express serves exact language HTML and known extensionless aliases', async t => {
  const { app } = await fixture(t);
  for (const prefix of ['', '/uk', '/ru']) for (const page of publicPages) {
    const relative = `${prefix.slice(1)}${prefix ? '/' : ''}${page}.html`;
    for (const suffix of ['', '.html']) {
      const response = await request(app).get(`${prefix}/${page}${suffix}`).expect(200);
      assert.equal(response.text, `<main>${relative}</main>`);
      assert.equal(response.headers['cache-control'], 'no-cache');
    }
  }
  for (const pathname of ['/uk', '/uk/', '/ru', '/ru/']) {
    const response = await request(app).get(pathname).expect(200);
    assert.equal(response.text, `<main>${pathname.includes('uk') ? 'uk' : 'ru'}/index.html</main>`);
  }
  assert.equal((await request(app).get('/').expect(200)).text, '<main>index.html</main>');
});

test('Express rejects localized private and arbitrary nested/source routes', async t => {
  const { app } = await fixture(t);
  for (const page of privatePages) {
    const response = await request(app).get(`/${page}.html`).expect(200);
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow');
    for (const language of ['uk', 'ru']) for (const suffix of ['', '.html']) await request(app).get(`/${language}/${page}${suffix}`).expect(404);
  }
  for (const pathname of ['/uk/unknown.html', '/ru/nested/index.html', '/en/projects.html', '/nested/index.html', '/server.js', '/.env', '/client/App.jsx']) await request(app).get(pathname).expect(404);
});

test('Express serves generated metadata and never substitutes English for a missing language page', async t => {
  const { app, distDir } = await fixture(t);
  assert.equal((await request(app).get('/robots.txt').expect(200)).text, 'Generated multilingual robots');
  assert.equal((await request(app).get('/sitemap.xml').expect(200)).text, '<urlset>Generated multilingual sitemap</urlset>');
  await fs.unlink(path.join(distDir, 'uk/projects.html'));
  const response = await request(app).get('/uk/projects.html').expect(503);
  assert(!response.text.includes('<main>index.html</main>'));
});

test('Express retains strict script CSP and marks only API JSON as noindex', async t => {
  const { app } = await fixture(t);
  const page = await request(app).get('/ru/publications.html').expect(200);
  assert.match(page.headers['content-security-policy'], /script-src 'self';script-src-attr 'none'/);
  assert.doesNotMatch(page.headers['content-security-policy'], /script-src[^;]*unsafe-inline/);
  assert.equal(page.headers['x-robots-tag'], undefined);
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.headers['x-robots-tag'], 'noindex');
  const missing = await request(app).get('/api/missing').expect(404);
  assert.equal(missing.headers['x-robots-tag'], 'noindex');
  const image = await request(app).get('/api/projects/image/fixture.webp').expect(200);
  assert.match(image.headers['content-type'], /image\/webp/);
  assert.equal(image.headers['x-robots-tag'], undefined);
});
