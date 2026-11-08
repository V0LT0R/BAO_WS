import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.mjs';
import { publicPages, privatePages } from '../client/lib/locales.js';

const origin = 'https://bao.test';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWMwDFtgGLaAAYUCAEYUButIT2duAAAAAElFTkSuQmCC', 'base64'));

function environment() {
  const assets = [];
  return {
    assets,
    ASSETS: { async fetch(request) { const url = new URL(request.url); assets.push(url.pathname + url.search); return new Response(url.pathname + url.search, { headers: { 'Content-Type': 'text/html' } }); } },
    DB: { prepare() { return { bind() { return this; }, async first() { return null; }, async all() { return { results: [] }; } }; } },
    MEDIA: { async getWithMetadata() { return { value: png.buffer, metadata: null }; } },
  };
}

test('Worker routes all three languages to their exact generated public HTML files', async () => {
  const env = environment();
  const cases = [['/', '/index.html'], ['/uk', '/uk/index.html'], ['/uk/', '/uk/index.html'], ['/ru', '/ru/index.html'], ['/ru/', '/ru/index.html']];
  for (const prefix of ['', '/uk', '/ru']) for (const page of publicPages) {
    cases.push([`${prefix}/${page}.html`, `${prefix}/${page}.html`], [`${prefix}/${page}`, `${prefix}/${page}.html`]);
  }
  for (const [input, expected] of cases) {
    const response = await worker.fetch(new Request(origin + input), env, {});
    assert.equal(response.status, 200, input);
    assert.equal(await response.text(), expected, input);
  }
  const query = await worker.fetch(new Request(`${origin}/uk/projects?source=test`), env, {});
  assert.equal(await query.text(), '/uk/projects.html?source=test');
});

test('Worker keeps private pages only at root and refuses unknown HTML and source paths before assets', async () => {
  const env = environment();
  for (const page of privatePages) for (const suffix of ['', '.html']) {
    const response = await worker.fetch(new Request(`${origin}/${page}${suffix}`), env, {});
    assert.equal(response.status, 200);
    assert.equal(await response.text(), `/${page}.html`);
  }
  const count = env.assets.length;
  const rejected = [
    ...['uk', 'ru'].flatMap(language => privatePages.flatMap(page => [`/${language}/${page}`, `/${language}/${page}.html`])),
    '/uk/unknown.html', '/ru/nested/index.html', '/en/projects.html', '/nested/index.html',
    '/server.js', '/.env', '/client/App.jsx', '/assets/javascript/legacy.js',
    '/build-assets/index-ABCDEF.js.map', '/assets/images/secret.html', '/assets/images/.private/photo.png',
    '/assets/images/%2eprivate/photo.png', '/assets/images/evil%5cphoto.png', '/robots.txt/more',
  ];
  for (const pathname of rejected) {
    const response = await worker.fetch(new Request(origin + pathname), env, {});
    assert.equal(response.status, 404, pathname);
  }
  assert.equal(env.assets.length, count, 'Rejected paths must not reach ASSETS.fetch.');
});

test('Worker permits generated metadata, verification and approved static asset types', async () => {
  const env = environment();
  for (const pathname of [
    '/robots.txt', '/sitemap.xml', '/google0e7611ae15e01a69.html',
    '/build-assets/index-fixture123.js', '/build-assets/index-fixture123.css',
    '/assets/images/Photo%20One.png', '/assets/fonts/montserrat/Montserrat-Regular.ttf',
    '/assets/fonts/montserrat/LICENSE.txt', '/assets/css/Index.css', '/assets/sound/123.mp3',
    '/bootstrap_css/css/bootstrap.css',
  ]) {
    const response = await worker.fetch(new Request(origin + pathname), env, {});
    assert.equal(response.status, 200, pathname);
    assert.equal(await response.text(), pathname);
  }
});

test('localized pages retain strict script CSP and HEAD/method behavior', async () => {
  const env = environment();
  const response = await worker.fetch(new Request(`${origin}/ru/publications.html`), env, {});
  const policy = response.headers.get('Content-Security-Policy');
  assert.match(policy, /(?:^|; )script-src 'self'; script-src-attr 'none';/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  const head = await worker.fetch(new Request(`${origin}/uk/experience.html`, { method: 'HEAD' }), env, {});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const count = env.assets.length;
  const post = await worker.fetch(new Request(`${origin}/uk/projects.html`, { method: 'POST' }), env, {});
  assert.equal(post.status, 405);
  assert.equal(env.assets.length, count);
});

test('API JSON is noindex while public API image responses remain indexable', async () => {
  const env = environment();
  for (const pathname of ['/api/health', '/api/projects', '/api/missing']) {
    const response = await worker.fetch(new Request(origin + pathname), env, {});
    assert.match(response.headers.get('Content-Type'), /application\/json/);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex', pathname);
  }
  const image = await worker.fetch(new Request(`${origin}/api/projects/image/fixture.png`), env, {});
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/png');
  assert.equal(image.headers.get('X-Robots-Tag'), null);
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);
});
