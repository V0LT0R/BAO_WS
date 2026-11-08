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
    'public/google0e7611ae15e01a69.html',
    'dist/robots.txt',
    'dist/sitemap.xml',
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

test('Cloudflare package preserves generated metadata and copies only trusted assets and Google verification', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  const { root, put } = await fixture(t);
  const excluded = [
    '.env', 'server.js', 'src/routes/user.js', 'public/index.html', 'public/admin.html',
    'public/robots.txt', 'public/sitemap.xml',
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
  assert.equal(await readFile(path.join(root, 'dist/robots.txt'), 'utf8'), 'dist/robots.txt');
  assert.equal(await readFile(path.join(root, 'dist/sitemap.xml'), 'utf8'), 'dist/sitemap.xml');
  assert.equal(await readFile(path.join(root, 'dist/google0e7611ae15e01a69.html'), 'utf8'), 'public/google0e7611ae15e01a69.html');
  assert.ok(!result.copied.includes('robots.txt') && !result.copied.includes('sitemap.xml'));
  assert.ok(result.files.includes('projects.html') && result.files.includes('certificates.html'));
  assert.ok(!result.files.includes('_redirects'));
  assert.ok(!result.files.some(file => /(?:javascript|\.map$|\.env|\.json$|source\/|server\.js|bootstrap_css\/js|\.private|credentials)/.test(file)));
  for (const file of result.files) assert.ok(!(await readFile(path.join(root, 'dist', file), 'utf8')).includes('source-only-sensitive-fixture'));
});

test('All seven public pages are preserved at the English root and in Ukrainian and Russian folders', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  const { root, put } = await fixture(t);
  const pages = ['index', 'experience', 'activity', 'certificates', 'projects', 'publications', 'FAQs'];
  const localizedFiles = ['', 'uk/', 'ru/'].flatMap(locale => pages.map(page => `${locale}${page}.html`));
  const privateFiles = ['login.html', 'admin.html', 'user.html'];
  for (const file of [...localizedFiles, ...privateFiles]) await put(`dist/${file}`, `generated:${file}`);
  const result = await packageCloudflareAssets(root);
  for (const file of [...localizedFiles, ...privateFiles]) {
    assert.ok(result.files.includes(file), `Expected packaged page ${file}`);
    assert.equal(await readFile(path.join(root, 'dist', file), 'utf8'), `generated:${file}`);
  }
  assert.equal(result.files.filter(file => file.endsWith('.html') && !file.startsWith('google')).length, 24);
});

test('Localized private pages and arbitrary nested HTML fail closed', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  for (const file of [
    'uk/admin.html', 'uk/login.html', 'uk/user.html',
    'ru/admin.html', 'ru/login.html', 'ru/user.html',
    'uk/nested/index.html', 'ru/nested/projects.html', 'nested/index.html',
    'en/index.html', 'uk/unknown.html', 'assets/images/index.html',
  ]) {
    await t.test(file, async subtest => {
      const { root, put } = await fixture(subtest);
      await put(`dist/${file}`, 'must-not-publish');
      await assert.rejects(packageCloudflareAssets(root), error => {
        assert.ok(error.message.includes(`Unexpected file in static output: ${file}`));
        return true;
      });
      assert.equal(await readFile(path.join(root, 'dist', file), 'utf8'), 'must-not-publish');
    });
  }
});

test('Generated robots and sitemap must exist as plain build files before packaging begins', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  for (const file of ['robots.txt', 'sitemap.xml']) {
    await t.test(`missing ${file}`, async subtest => {
      const { root, put } = await fixture(subtest);
      await rm(path.join(root, 'dist', file));
      await put(`public/${file}`, 'legacy-metadata-is-not-a-fallback');
      await assert.rejects(packageCloudflareAssets(root), error => {
        assert.ok(error.message.includes(`missing generated metadata dist/${file}`));
        return true;
      });
      await assert.rejects(readFile(path.join(root, 'dist/_headers')), { code: 'ENOENT' });
    });
    await t.test(`directory ${file}`, async subtest => {
      const { root } = await fixture(subtest);
      await rm(path.join(root, 'dist', file));
      await mkdir(path.join(root, 'dist', file));
      await assert.rejects(packageCloudflareAssets(root), error => {
        assert.ok(error.message.includes(`Expected a regular generated metadata file: dist/${file}`));
        return true;
      });
    });
  }
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
  for (const locale of ['uk', 'ru']) {
    assert.ok(headers.includes(`/${locale}/\n  Cache-Control: no-cache`));
    assert.ok(headers.includes(`/${locale}/*.html\n  Cache-Control: no-cache`));
  }
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(headers));
  assert.ok(headers.split('\n').every(line => line.length <= 2000));
});

test('Source maps and unapproved build assets are rejected in existing output', async t => {
  const { packageCloudflareAssets } = await import('../scripts/build-cloudflare.mjs');
  for (const file of ['build-assets/index-fixture123.js.map', 'assets/css/Index.css.map', 'build-assets/unhashed.js']) {
    await t.test(file, async subtest => {
      const { root, put } = await fixture(subtest);
      await put(`dist/${file}`, 'must-not-publish');
      await assert.rejects(packageCloudflareAssets(root), /Unexpected file in static output/);
    });
  }
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
