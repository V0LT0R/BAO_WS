import { AuthService, getIdentity, requireCsrf } from './auth.mjs';
import { handleContent } from './content.mjs';
import { handlePublications } from './publications.mjs';
import { publicPages, privatePages } from '../client/lib/locales.js';

export { AuthService };
const safeMethods = new Set(['GET', 'HEAD']);
const pages = new Set([...publicPages, ...privatePages]);
const localizedPages = new Set(publicPages);
const metadataFiles = new Set(['/robots.txt', '/sitemap.xml', '/google0e7611ae15e01a69.html']);
const staticDirectories = new Map([
  ['assets/css', new Set(['css'])],
  ['assets/fonts', new Set(['ttf', 'otf', 'woff', 'woff2'])],
  ['assets/images', new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico'])],
  ['assets/sound', new Set(['mp3', 'ogg', 'wav', 'm4a'])],
  ['bootstrap_css/css', new Set(['css'])],
]);
const csp = "default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

function json(value, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } }); }
function secure(response, request) {
  const result = new Response(request.method === 'HEAD' ? null : response.body, response);
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('X-Frame-Options', 'DENY');
  result.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  result.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  result.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (!result.headers.has('Content-Security-Policy')) result.headers.set('Content-Security-Policy', csp);
  if (new URL(request.url).pathname.startsWith('/api/') && /^application\/json(?:\s*;|$)/i.test(result.headers.get('Content-Type') || '')) result.headers.set('X-Robots-Tag', 'noindex');
  if (new URL(request.url).protocol === 'https:') result.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return result;
}

function assetPath(pathname) {
  if (pathname === '/') return '/index.html';
  const rootPage = /^\/([^/]+?)(?:\.html)?$/.exec(pathname)?.[1];
  if (pages.has(rootPage)) return `/${rootPage}.html`;
  const localized = /^\/(uk|ru)(?:\/([^/]+?)(?:\.html)?)?\/?$/.exec(pathname);
  if (localized && localizedPages.has(localized[2] || 'index')) return `/${localized[1]}/${localized[2] || 'index'}.html`;
  if (metadataFiles.has(pathname)) return pathname;
  if (/^\/build-assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{6,}\.(?:js|css)$/.test(pathname)) return pathname;
  let decoded;
  try { decoded = decodeURIComponent(pathname).slice(1); } catch { return null; }
  if (decoded.split('/').some(part => !part || part.startsWith('.')) || /[\\\u0000-\u001f\u007f]/u.test(decoded)) return null;
  for (const [directory, extensions] of staticDirectories) {
    if (!decoded.startsWith(`${directory}/`)) continue;
    const basename = decoded.split('/').at(-1);
    const extension = basename.includes('.') ? basename.split('.').at(-1).toLowerCase() : '';
    if (extensions.has(extension) || directory === 'assets/fonts' && ['LICENSE.txt', 'COPYRIGHT.txt'].includes(basename)) return pathname;
  }
  return null;
}
function failure(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 503;
  if (status === 503) console.error('Worker request failed:', error?.name || 'Error');
  return json({ message: status === 503 ? 'The service is temporarily unavailable. Please try again.' : error.message }, status);
}

// CPU-intensive multipart validation runs in a SQLite Durable Object (available
// on Workers Free), while ordinary static assets bypass the Worker entirely.
export class ContentWriter {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    try {
      const identity = await getIdentity(request, this.env);
      if (!identity.user) return json({ message: 'Sign in to continue.' }, 401);
      if (identity.user.role !== 'admin') return json({ message: 'Administrator access required.' }, 403);
      await requireCsrf(request, this.env, identity);
      const key = `upload:${identity.user._id}`;
      const now = Date.now();
      const allowed = await this.state.storage.transaction(async storage => {
        const previous = await storage.get(key);
        const bucket = previous && previous.expires > now ? previous : { count: 0, expires: now + 15 * 60_000 };
        if (bucket.count >= 60) return false;
        await storage.put(key, { ...bucket, count: bucket.count + 1 });
        return true;
      });
      if (!allowed) return json({ message: 'Too many changes. Please try again later.' }, 429);
      return await handleContent(request, this.env, this.state, identity) || json({ message: 'API endpoint not found.' }, 404);
    } catch (error) { return failure(error); }
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      let response;
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/health' && safeMethods.has(request.method)) {
          await env.DB.prepare('SELECT id FROM users LIMIT 1').first();
          response = json({ status: 'ok', platform: 'cloudflare' });
        } else if (url.pathname.startsWith('/api/user/')) {
          response = await env.AUTH.getByName('accounts').fetch(request);
        } else if (!safeMethods.has(request.method)) {
          response = await env.CONTENT_WRITER.getByName('content').fetch(request);
        } else {
          response = await handleContent(request, env, ctx, { user: null }) || await handlePublications(request, env, ctx) || json({ message: 'API endpoint not found.' }, 404);
        }
      } else {
        if (!safeMethods.has(request.method)) response = json({ message: 'Method not allowed.' }, 405);
        else {
          const pathname = assetPath(url.pathname);
          if (!pathname) response = json({ message: 'Page not found.' }, 404);
          else {
            url.pathname = pathname;
            response = await env.ASSETS.fetch(new Request(url, request));
          }
        }
      }
      return secure(response, request);
    } catch (error) { return secure(failure(error), request); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()).run());
  },
};
