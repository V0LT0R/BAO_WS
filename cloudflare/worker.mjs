import { AuthService, getIdentity, requireCsrf } from './auth.mjs';
import { handleContent } from './content.mjs';
import { handlePublications } from './publications.mjs';

export { AuthService };
const safeMethods = new Set(['GET', 'HEAD']);
const pages = new Set(['index', 'experience', 'activity', 'projects', 'certificates', 'publications', 'FAQs', 'login', 'admin', 'user']);
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
  if (new URL(request.url).protocol === 'https:') result.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return result;
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
          if (url.pathname === '/') url.pathname = '/index.html';
          else if (pages.has(url.pathname.slice(1))) url.pathname += '.html';
          response = await env.ASSETS.fetch(new Request(url, request));
        }
      }
      return secure(response, request);
    } catch (error) { return secure(failure(error), request); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()).run());
  },
};
