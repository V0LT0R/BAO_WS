import bcrypt from 'bcryptjs';

// Password hashing is deliberately confined to this SQLite-backed Durable Object.
// Its CPU allowance differs from the public Worker: bcrypt is never executed by
// getIdentity() or by the 10 ms Free-plan content routes.
const SESSION_MS = 60 * 60 * 1000;
const MAX_JSON_BYTES = 16 * 1024;
const DUMMY_HASH = '$2b$12$0FxM0WqxtDucvTAYhYgNCOiMx4Qm0r1fnSAUsfYXkyNrhNCGEc2Se';
const encoder = new TextEncoder();

export class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function publicOrigin(env) {
  let url;
  try { url = new URL(env.PUBLIC_ORIGIN); } catch { throw new AuthError(503, 'The site origin is not configured.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new AuthError(503, 'The site origin is not configured.');
  }
  return url.origin;
}

function cookieName(env) { return publicOrigin(env).startsWith('https:') ? '__Host-bao.sid' : 'bao.sid'; }
function cookie(env, token = '', expired = false) {
  return `${cookieName(env)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expired ? 0 : SESSION_MS / 1000}${publicOrigin(env).startsWith('https:') ? '; Secure' : ''}`;
}

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashSessionToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function readCookie(request, env) {
  const header = request.headers.get('Cookie') || '';
  if (header.length > 8192) return null;
  const name = cookieName(env);
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function safeUser(user) { return { _id: user.id, username: user.username, role: user.role === 'admin' ? 'admin' : 'user' }; }

export async function getIdentity(request, env) {
  const token = readCookie(request, env);
  if (!token) return { user: null, session: null };
  const idhash = await hashSessionToken(token);
  const row = await env.DB.prepare(`
    SELECT s.idhash, s.userid, s.csrf, s.expires_at, s.auth_version,
           u.id AS user_id, u.username, u.role, u.auth_version AS current_auth_version
    FROM sessions AS s LEFT JOIN users AS u ON u.id = s.userid
    WHERE s.idhash = ? AND s.expires_at > ?
  `).bind(idhash, Date.now()).first();
  if (!row || (row.userid && (!row.user_id || row.auth_version !== row.current_auth_version))) {
    return { user: null, session: null };
  }
  return {
    user: row.user_id ? safeUser({ id: row.user_id, username: row.username, role: row.role }) : null,
    session: { idhash: row.idhash, userid: row.userid, csrf: row.csrf, expires_at: row.expires_at, auth_version: row.auth_version },
  };
}

export function requireUser(identity) {
  if (!identity?.user) throw new AuthError(401, 'Sign in to continue.');
  return identity.user;
}

export function requireAdmin(identity) {
  const user = requireUser(identity);
  if (user.role !== 'admin') throw new AuthError(403, 'Administrator access is required.');
  return user;
}

export function requireCsrf(request, env, identity) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || (origin && origin !== publicOrigin(env))) {
    throw new AuthError(403, 'This request must come from this website.');
  }
  const expected = identity?.session?.csrf;
  const supplied = request.headers.get('X-CSRF-Token');
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied)) {
    throw new AuthError(403, 'Refresh the page and try again.');
  }
  let difference = 0;
  for (let index = 0; index < 64; index += 1) difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  if (difference !== 0) throw new AuthError(403, 'Refresh the page and try again.');
}

async function jsonBody(request, allowed) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new AuthError(415, 'Send a JSON request.');
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new AuthError(413, 'The request is too large.');
  if (!request.body) throw new AuthError(400, 'Send an object with the expected fields.');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BYTES) { await reader.cancel(); throw new AuthError(413, 'The request is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new AuthError(400, 'Invalid JSON request.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) {
    throw new AuthError(400, 'Send an object with the expected fields.');
  }
  return body;
}

function username(value, creating = true) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) throw new AuthError(400, 'Invalid username.');
  if (!creating) return value;
  const clean = value.trim();
  if (!/^[\p{L}\p{N}_.@-]{3,64}$/u.test(clean)) throw new AuthError(400, 'Username must have 3–64 letters, numbers, dots, underscores, hyphens or @.');
  return clean;
}

function password(value, creating = true, label = 'Password') {
  if (typeof value !== 'string' || Array.from(value).length < (creating ? 12 : 1) || encoder.encode(value).byteLength > 72 || (creating ? /[\u0000-\u001f\u007f]/u.test(value) : value.includes('\0'))) {
    throw new AuthError(400, `${label} must contain ${creating ? 'at least 12 characters and at most 72 UTF-8 bytes' : '1–72 UTF-8 bytes'}.`);
  }
  return value;
}

function validId(id) {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new AuthError(400, 'Invalid account ID.');
  return id.toLowerCase();
}

async function comparePassword(secret, hash) {
  // Bound the cost if an imported record is corrupt; normal legacy bcrypt hashes
  // (including $2a$/$2b$/$2y$) remain directly usable without a password reset.
  const supported = typeof hash === 'string' && /^\$2[aby]\$(?:0[4-9]|1[0-6])\$[./A-Za-z0-9]{53}$/.test(hash);
  const valid = await bcrypt.compare(secret, supported ? hash : DUMMY_HASH);
  return supported && valid;
}

function response(data, status = 200, sessionCookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (sessionCookie) headers['Set-Cookie'] = sessionCookie;
  return new Response(JSON.stringify(data), { status, headers });
}

export class AuthService {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.lastCleanup = 0;
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS auth_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
  }

  limit(key, max, windowMs) {
    const now = Date.now();
    const row = this.ctx.storage.sql.exec(`
      INSERT INTO auth_rate_limits (key, count, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN auth_rate_limits.expires_at <= ? THEN 1 ELSE auth_rate_limits.count + 1 END,
        expires_at = CASE WHEN auth_rate_limits.expires_at <= ? THEN excluded.expires_at ELSE auth_rate_limits.expires_at END
      RETURNING count, expires_at
    `, key, now + windowMs, now, now).one();
    if (now - this.lastCleanup > 60000) {
      this.ctx.storage.sql.exec('DELETE FROM auth_rate_limits WHERE expires_at <= ?', now);
      this.lastCleanup = now;
    }
    if (row.count > max) throw new AuthError(429, 'Too many requests. Please try again later.');
  }

  async issueSession(identity, user) {
    const token = randomHex(32);
    const idhash = await hashSessionToken(token);
    const csrf = randomHex(32);
    const now = Date.now();
    const statements = [];
    if (identity.session) statements.push(this.env.DB.prepare('DELETE FROM sessions WHERE idhash = ?').bind(identity.session.idhash));
    statements.push(this.env.DB.prepare('INSERT INTO sessions (idhash, userid, csrf, expires_at, auth_version) VALUES (?, ?, ?, ?, ?)').bind(idhash, user?.id || null, csrf, now + SESSION_MS, user?.auth_version || 0));
    statements.push(this.env.DB.prepare('DELETE FROM sessions WHERE idhash IN (SELECT idhash FROM sessions WHERE expires_at <= ? LIMIT 250)').bind(now));
    await this.env.DB.batch(statements);
    return { token, csrf };
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/user/')) throw new AuthError(404, 'API endpoint not found.');
      publicOrigin(this.env);
      const ip = (request.headers.get('CF-Connecting-IP') || 'local').slice(0, 128);
      const ipKey = await hashSessionToken(ip);
      this.limit(`request:${ipKey}`, 300, 60000);
      const identity = await getIdentity(request, this.env);
      requireCsrf(request, this.env, identity);
      const route = url.pathname.slice('/api/user/'.length).replace(/\/$/, '');

      if (request.method === 'GET' && route === 'session') {
        if (identity.session) return response({ user: identity.user, csrfToken: identity.session.csrf });
        this.limit(`session:${ipKey}`, 30, 15 * 60000);
        const fresh = await this.issueSession(identity, null);
        return response({ user: null, csrfToken: fresh.csrf }, 200, cookie(this.env, fresh.token));
      }

      if (request.method === 'POST' && route === 'login') {
        this.limit(`login:${ipKey}`, 10, 15 * 60000);
        const body = await jsonBody(request, ['username', 'password']);
        const name = username(body.username, false);
        const secret = password(body.password, false);
        this.limit(`account:${await hashSessionToken(name)}`, 20, 15 * 60000);
        const user = await this.env.DB.prepare('SELECT id, username, password, role, auth_version FROM users WHERE username = ?').bind(name).first();
        if (!await comparePassword(secret, user?.password)) throw new AuthError(401, 'Invalid username or password.');
        // A password change during comparison must not establish a stale session.
        const current = await this.env.DB.prepare('SELECT id, username, role, auth_version FROM users WHERE id = ? AND password = ? AND auth_version = ?').bind(user.id, user.password, user.auth_version).first();
        if (!current) throw new AuthError(401, 'Invalid username or password.');
        const fresh = await this.issueSession(identity, current);
        return response({ user: safeUser(current), csrfToken: fresh.csrf }, 200, cookie(this.env, fresh.token));
      }

      if (request.method === 'POST' && route === 'logout') {
        if (identity.session) await this.env.DB.prepare('DELETE FROM sessions WHERE idhash = ?').bind(identity.session.idhash).run();
        return response({ user: null, csrfToken: null }, 200, cookie(this.env, '', true));
      }

      if (request.method === 'POST' && route === 'register') {
        requireAdmin(identity);
        this.limit(`register:${identity.user._id}`, 20, 60 * 60000);
        const body = await jsonBody(request, ['username', 'password', 'role']);
        const name = username(body.username);
        const secret = password(body.password);
        const role = body.role === undefined ? 'user' : body.role;
        if (!['user', 'admin'].includes(role)) throw new AuthError(400, 'Invalid account role.');
        const user = { id: randomHex(12), username: name, role, auth_version: 0 };
        const hash = await bcrypt.hash(secret, 12);
        await this.env.DB.prepare('INSERT INTO users (id, username, password, role, auth_version) VALUES (?, ?, ?, ?, 0)').bind(user.id, name, hash, role).run();
        return response({ user: safeUser(user) }, 201);
      }

      if (request.method === 'GET' && route === 'users') {
        requireAdmin(identity);
        const result = await this.env.DB.prepare('SELECT id, username, role FROM users ORDER BY username LIMIT 1000').all();
        return response(result.results.map(safeUser));
      }

      if (['GET', 'PUT', 'DELETE'].includes(request.method) && !route.includes('/')) {
        const own = requireUser(identity);
        const id = validId(route);
        if (request.method === 'GET') {
          if (own.role !== 'admin' && own._id !== id) throw new AuthError(403, 'You can only view your own account.');
          const user = await this.env.DB.prepare('SELECT id, username, role FROM users WHERE id = ?').bind(id).first();
          if (!user) throw new AuthError(404, 'Account not found.');
          return response(safeUser(user));
        }
        if (request.method === 'DELETE') {
          requireAdmin(identity);
          if (own._id === id) throw new AuthError(409, 'You cannot delete your own account.');
          const user = await this.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(id).first();
          if (!user) throw new AuthError(404, 'Account not found.');
          if (user.role === 'admin') throw new AuthError(409, 'Administrator accounts cannot be deleted through this API.');
          const deleted = await this.env.DB.prepare("DELETE FROM users WHERE id = ? AND role = 'user'").bind(id).run();
          if (!deleted.meta.changes) throw new AuthError(409, 'Account changed. Refresh and try again.');
          await this.env.DB.prepare('DELETE FROM sessions WHERE userid = ?').bind(id).run();
          return response({ message: 'Account deleted.' });
        }
        if (own._id !== id) throw new AuthError(403, 'You can only change your own account credentials.');
        this.limit(`credentials:${ipKey}`, 10, 15 * 60000);
        const body = await jsonBody(request, ['currentPassword', 'newPassword', 'username']);
        const oldPassword = password(body.currentPassword, false, 'Current password');
        if (body.username === undefined && body.newPassword === undefined) throw new AuthError(400, 'Provide a username or a new password.');
        const name = body.username === undefined || body.username === own.username ? own.username : username(body.username);
        const newPassword = body.newPassword === undefined ? null : password(body.newPassword, true, 'New password');
        const previous = await this.env.DB.prepare('SELECT id, username, password, role, auth_version FROM users WHERE id = ?').bind(id).first();
        if (!previous || !await comparePassword(oldPassword, previous.password)) throw new AuthError(401, 'Current password is incorrect.');
        const newHash = newPassword === null ? previous.password : await bcrypt.hash(newPassword, 12);
        const updated = await this.env.DB.prepare('UPDATE users SET username = ?, password = ?, auth_version = auth_version + 1 WHERE id = ? AND password = ? AND auth_version = ?').bind(name, newHash, id, previous.password, previous.auth_version).run();
        if (!updated.meta.changes) throw new AuthError(409, 'Account changed. Sign in again and retry.');
        const current = { ...previous, username: name, password: newHash, auth_version: previous.auth_version + 1 };
        const fresh = await this.issueSession(identity, current);
        return response({ user: safeUser(current), csrfToken: fresh.csrf }, 200, cookie(this.env, fresh.token));
      }
      throw new AuthError(404, 'API endpoint not found.');
    } catch (error) {
      if (error instanceof AuthError) return response({ message: error.message }, error.status);
      if (String(error?.message || '').includes('UNIQUE constraint failed: users.username')) return response({ message: 'This username is already taken.' }, 409);
      return response({ message: 'The request could not be completed. Please try again.' }, 500);
    }
  }
}
