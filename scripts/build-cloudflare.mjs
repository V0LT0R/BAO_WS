import { copyFile, lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const htmlPages = new Set(['index', 'experience', 'activity', 'projects', 'certificates', 'publications', 'FAQs', 'login', 'admin', 'user'].map(page => `${page}.html`));
const publicFiles = new Set(['robots.txt', 'sitemap.xml', 'google0e7611ae15e01a69.html']);
const assetDirectories = new Map([
  ['assets/css', new Set(['.css'])],
  ['assets/fonts', new Set(['.ttf', '.otf', '.woff', '.woff2'])],
  ['assets/images', new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico'])],
  ['assets/sound', new Set(['.mp3', '.ogg', '.wav', '.m4a'])],
  ['bootstrap_css/css', new Set(['.css'])],
]);

export const staticHeaders = `# Security policy for Cloudflare static assets; API responses set their own headers.
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Cross-Origin-Resource-Policy: same-origin
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-XSS-Protection: 0

/
  Cache-Control: no-cache

/*.html
  Cache-Control: no-cache

/admin.html
  Cache-Control: private, no-store
  X-Robots-Tag: noindex, nofollow

/login.html
  Cache-Control: private, no-store
  X-Robots-Tag: noindex, nofollow

/user.html
  Cache-Control: private, no-store
  X-Robots-Tag: noindex, nofollow

/build-assets/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=86400

/bootstrap_css/css/*
  Cache-Control: public, max-age=86400
`;

function normalized(relative) { return relative.split(path.sep).join('/'); }

function permittedAsset(relative) {
  if (relative.split('/').some(part => part.startsWith('.'))) return false;
  for (const [directory, extensions] of assetDirectories) {
    if (!relative.startsWith(`${directory}/`)) continue;
    const basename = path.posix.basename(relative);
    return extensions.has(path.posix.extname(relative).toLowerCase()) ||
      directory === 'assets/fonts' && ['LICENSE.txt', 'COPYRIGHT.txt'].includes(basename);
  }
  return false;
}

async function assertPlainPath(root, filename) {
  const relative = path.relative(root, filename);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new Error('Asset path must remain inside the build workspace.');
  let cursor = root;
  for (const segment of ['', ...relative.split(path.sep).filter(Boolean)]) {
    if (segment) cursor = path.join(cursor, segment);
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in static build paths: ${normalized(path.relative(root, cursor)) || '.'}`);
  }
}

async function inspectOutput(root) {
  const dist = path.join(root, 'dist');
  await assertPlainPath(root, dist);
  const files = [];
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      const relative = normalized(path.relative(dist, filename));
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in static output: ${relative}`);
      if (entry.isDirectory()) { await inspect(filename); continue; }
      if (!entry.isFile()) throw new Error(`Unsupported static output entry: ${relative}`);
      const permitted = htmlPages.has(relative) || publicFiles.has(relative) || relative === '_headers' ||
        /^build-assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{6,}\.(?:js|css)$/.test(relative) || permittedAsset(relative);
      if (!permitted) throw new Error(`Unexpected file in static output: ${relative}. Rebuild before packaging.`);
      files.push(relative);
    }
  }
  await inspect(dist);
  if (!files.includes('index.html')) throw new Error('React build is missing dist/index.html. Run the application build first.');
  return files;
}

/** Package only browser assets after the existing React build. Never copy the project or public root recursively. */
export async function packageCloudflareAssets(root = projectRoot) {
  root = path.resolve(root);
  const source = path.join(root, 'public');
  const target = path.join(root, 'dist');
  await inspectOutput(root);
  await assertPlainPath(root, source);
  const copied = [];

  async function copyDirectory(directory) {
    await assertPlainPath(root, path.join(source, directory));
    for (const entry of await readdir(path.join(source, directory), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const relative = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in source assets: ${relative}`);
      if (entry.isDirectory()) { await copyDirectory(relative); continue; }
      if (!entry.isFile() || !permittedAsset(relative)) continue;
      const destination = path.join(target, relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(source, relative), destination);
      copied.push(relative);
    }
  }

  for (const directory of assetDirectories.keys()) await copyDirectory(directory);
  for (const relative of publicFiles) {
    const filename = path.join(source, relative);
    await assertPlainPath(root, filename);
    if (!(await lstat(filename)).isFile()) throw new Error(`Expected a regular public metadata file: ${relative}`);
    await copyFile(filename, path.join(target, relative));
    copied.push(relative);
  }
  await writeFile(path.join(target, '_headers'), staticHeaders);
  const output = await inspectOutput(root);
  // No _redirects or directory-index aliases are emitted: .html URLs remain the deployed asset names.
  return { copied: copied.sort(), files: output.sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Vite empties this fixed workspace directory. Refuse a linked output before the build runs.
  await assertPlainPath(projectRoot, projectRoot);
  try { await assertPlainPath(projectRoot, path.join(projectRoot, 'dist')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // This is the same entry point used by npm run build; no database or secrets are loaded.
  await import('./build.mjs');
  const result = await packageCloudflareAssets();
  console.log(`Cloudflare asset package ready: ${result.files.length} files, including ${result.copied.length} source assets and metadata files.`);
}
