import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function fixture(t) {
  const temp = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(temp, 'bao-cloudflare-build-'));
  t.after(async () => {
    const relative = path.relative(temp, root);
    assert.ok(relative.startsWith('bao-cloudflare-build-') && !relative.includes(path.sep), 'Cleanup must target only this test fixture.');
    await rm(root, { recursive: true, force: true });
  });
  async function put(relative, data = relative) {
    const filename = path.join(root, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, data);
  }
  const files = [
    'public/assets/css/Index.css',
    'public/assets/fonts/montserrat/Montserrat-Regular.ttf',
    'public/assets/fonts/montserrat/LICENSE.txt',
    'public/assets/fonts/montserrat/COPYRIGHT.txt',
    'public/assets/images/photo_header.png',
    'public/assets/images/light.svg',
    'public/assets/sound/123.mp3',
    'public/bootstrap_css/css/bootstrap.css',
    'public/robots.txt',
    'public/sitemap.xml',
    'public/google0e7611ae15e01a69.html',
    'dist/index.html',
    'dist/projects.html',
    'dist/certificates.html',
    'dist/admin.html',
    'dist/build-assets/index-fixture123.js',
    'dist/build-assets/index-fixture123.css',
  ];
  for (const file of files) await put(file);
  return { root, put };
}

test('Cloudflare package preserves React .html pages and copies only trusted asset classes and metadata', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  const { root, put } = await fixture(t);
  const excluded = [
    '.env', 'server.js', 'src/routes/user.js', 'public/index.html', 'public/admin.html',
    'public/assets/javascript/publications.js', 'public/bootstrap_css/js/bootstrap.js',
    'public/assets/images/not-an-image.js', 'public/assets/css/Index.css.map',
    'public/bootstrap_css/css/bootstrap.css.map', 'public/assets/fonts/private.json',
    'public/assets/images/.credentials.png', 'public/assets/images/.private/secret.png',
  ];
  for (const file of excluded) await put(file, 'source-only-sensitive-fixture');
  const result = await packageCloudflareAssets(root);
  assert.ok(result.files.includes('assets/images/photo_header.png'));
  assert.ok(result.files.includes('assets/fonts/montserrat/LICENSE.txt'));
  assert.ok(result.files.includes('assets/fonts/montserrat/COPYRIGHT.txt'));
  assert.ok(result.files.includes('bootstrap_css/css/bootstrap.css'));
  assert.ok(result.files.includes('robots.txt'));
  assert.ok(result.files.includes('sitemap.xml'));
  assert.ok(result.files.includes('google0e7611ae15e01a69.html'));
  assert.equal(await readFile(path.join(root, 'dist/index.html'), 'utf8'), 'dist/index.html');
  assert.equal(await readFile(path.join(root, 'dist/admin.html'), 'utf8'), 'dist/admin.html');
  assert.ok(result.files.includes('projects.html') && result.files.includes('certificates.html'));
  assert.ok(!result.files.includes('_redirects'));
  assert.ok(!result.files.some(file => /(?:javascript|\.map$|\.env|\.json$|source\/|server\.js|bootstrap_css\/js|\.private|credentials)/.test(file)));
  for (const file of result.files) assert.ok(!(await readFile(path.join(root, 'dist', file), 'utf8')).includes('source-only-sensitive-fixture'));
});

test('Static headers protect all assets, forbid inline script and framing, and avoid caching private pages', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  const { root } = await fixture(t);
  await packageCloudflareAssets(root);
  const headers = await readFile(path.join(root, 'dist/_headers'), 'utf8');
  assert.match(headers, /\/\*\n  Content-Security-Policy:/);
  assert.match(headers, /script-src 'self'; script-src-attr 'none'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /connect-src 'self'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)/);
  for (const page of ['admin', 'login', 'user']) assert.ok(headers.includes(`/${page}.html\n  Cache-Control: private, no-store\n  X-Robots-Tag: noindex, nofollow`));
  assert.ok(headers.includes('/build-assets/*\n  Cache-Control: public, max-age=31536000, immutable'));
  assert.ok(headers.includes('/*.html\n  Cache-Control: no-cache'));
  assert.ok(headers.split('\n').every(line => line.length <= 2000));
});

test('Unexpected files in an existing output are rejected rather than published', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  const { root, put } = await fixture(t);
  await put('dist/.env', 'do-not-publish');
  await assert.rejects(packageCloudflareAssets(root), /Unexpected file in static output: \.env/);
  assert.equal(await readFile(path.join(root, 'dist/.env'), 'utf8'), 'do-not-publish');
});

test('A source directory junction cannot expose files outside the approved public assets', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  const { root, put } = await fixture(t);
  await put('private-files/secret.png', 'private-file');
  try {
    await symlink(path.join(root, 'private-files'), path.join(root, 'public/assets/images/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { t.skip('The filesystem does not permit test directory links.'); return; }
    throw error;
  }
  await assert.rejects(packageCloudflareAssets(root), /Symbolic links are not allowed/);
  assert.equal(await readFile(path.join(root, 'private-files/secret.png'), 'utf8'), 'private-file');
});

test('A linked output directory is rejected before any files are copied', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  const { root, put } = await fixture(t);
  await put('outside-output/retained.txt', 'unchanged');
  try {
    await symlink(path.join(root, 'outside-output'), path.join(root, 'dist/assets'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { t.skip('The filesystem does not permit test directory links.'); return; }
    throw error;
  }
  await assert.rejects(packageCloudflareAssets(root), /Symbolic links are not allowed/);
  assert.deepEqual(await readdir(path.join(root, 'outside-output')), ['retained.txt']);
});
