import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthError, getIdentity, hashSessionToken, publicOrigin, requireAdmin, requireCsrf } from '../cloudflare/auth.mjs';

const origin = 'https://bao-cv.com';
const csrf = 'a'.repeat(64);
const sessionToken = 'b'.repeat(64);

test('Cloudflare auth origins require HTTPS except explicit loopback development', () => {
  assert.equal(publicOrigin({ PUBLIC_ORIGIN: origin }), origin);
  assert.equal(publicOrigin({ PUBLIC_ORIGIN: 'http://localhost:8787' }), 'http://localhost:8787');
  for (const value of [undefined, 'http://bao-cv.com', 'https://user:pass@bao-cv.com', 'https://bao-cv.com/path', 'https://bao-cv.com?next=1', 'javascript:alert(1)']) {
    assert.throws(() => publicOrigin({ PUBLIC_ORIGIN: value }), error => error instanceof AuthError && error.status === 503);
  }
});

test('Cloudflare CSRF rejects missing tokens and cross-origin requests', () => {
  const env = { PUBLIC_ORIGIN: origin };
  const identity = { session: { csrf } };
  const req = (headers = {}, method = 'POST') => new Request(`${origin}/api/user/logout`, { method, headers });
  assert.doesNotThrow(() => requireCsrf(req({ 'X-CSRF-Token': csrf, Origin: origin }), env, identity));
  assert.doesNotThrow(() => requireCsrf(req({}, 'GET'), env, null));
  for (const headers of [{}, { 'X-CSRF-Token': 'c'.repeat(64) }, { 'X-CSRF-Token': csrf, Origin: 'https://evil.invalid' }, { 'X-CSRF-Token': csrf, 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.throws(() => requireCsrf(req(headers), env, identity), error => error.status === 403);
  }
  assert.throws(() => requireCsrf(req({ 'X-CSRF-Token': csrf }), env, null), error => error.status === 403);
});

test('Cloudflare role checks distinguish anonymous and ordinary accounts', () => {
  assert.throws(() => requireAdmin({ user: null }), error => error.status === 401);
  assert.throws(() => requireAdmin({ user: { role: 'user' } }), error => error.status === 403);
  assert.equal(requireAdmin({ user: { role: 'admin', _id: '123' } })._id, '123');
});

test('Cloudflare malformed or duplicate cookies do not issue database queries', async () => {
  const env = { PUBLIC_ORIGIN: origin, DB: { prepare() { throw new Error('Must not query'); } } };
  for (const cookie of ['', '__Host-bao.sid=not-a-token', 'bao.sid=' + sessionToken, `__Host-bao.sid=${sessionToken}; __Host-bao.sid=${sessionToken}`]) {
    assert.deepEqual(await getIdentity(new Request(origin, { headers: { Cookie: cookie } }), env), { user: null, session: null });
  }
});

test('Cloudflare identity hashes cookie tokens and exposes only public account fields', async () => {
  const idhash = await hashSessionToken(sessionToken);
  assert.match(idhash, /^[a-f0-9]{64}$/);
  assert.notEqual(idhash, sessionToken);
  let bound;
  const row = { idhash, userid: 'abc', csrf, expires_at: Date.now() + 50000, auth_version: 7, user_id: 'abc', username: 'name', role: 'admin', current_auth_version: 7 };
  const env = { PUBLIC_ORIGIN: origin, DB: { prepare(sql) {
    assert.ok(!sql.includes(sessionToken));
    return { bind(...values) { bound = values; return { first: async () => row }; } };
  } } };
  const identity = await getIdentity(new Request(origin, { headers: { Cookie: `__Host-bao.sid=${sessionToken}` } }), env);
  assert.equal(bound[0], idhash);
  assert.equal(typeof bound[1], 'number');
  assert.deepEqual(identity.user, { _id: 'abc', username: 'name', role: 'admin' });
  assert.equal(identity.session.csrf, csrf);
  row.current_auth_version = 8;
  assert.deepEqual(await getIdentity(new Request(origin, { headers: { Cookie: `__Host-bao.sid=${sessionToken}` } }), env), { user: null, session: null });
});
