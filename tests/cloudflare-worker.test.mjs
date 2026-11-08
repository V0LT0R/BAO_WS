import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import bcrypt from 'bcryptjs';

let mf, db;
const origin = 'https://bao.test';
const adminId = '0123456789abcdef00000001';
const regularId = '0123456789abcdef00000002';
const password = 'Isolated-test-password-2026';
let clientCounter = 0;
before(async () => {
  const result = await build({ entryPoints: ['cloudflare/worker.mjs'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, logLevel: 'silent' });
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: result.outputFiles[0].text, compatibilityDate: '2026-11-01', bindings: { PUBLIC_ORIGIN: origin }, d1Databases: ['DB'], kvNamespaces: ['MEDIA'], durableObjects: { AUTH: { className: 'AuthService', useSQLite: true }, CONTENT_WRITER: { className: 'ContentWriter', useSQLite: true } }, serviceBindings: { ASSETS: () => new Response('static asset', { headers: { 'Content-Type': 'text/html' } }) } }));
  db = await mf.getD1Database('DB');
  const schema = await readFile('cloudflare/migrations/0001_initial.sql', 'utf8');
  for (const sql of schema.split(';').filter(value => value.trim())) await db.prepare(sql).run();
  const hash = await bcrypt.hash(password, 4);
  await db.batch([
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, 0)').bind(adminId, 'admin', hash, 'admin'),
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, 0)').bind(regularId, 'regular', hash, 'user'),
  ]);
});
after(async () => { await mf?.dispose(); });

function client() {
  const ip = `192.0.2.${++clientCounter}`;
  let cookie = '', csrf = '';
  return {
    get cookie() { return cookie; }, get csrf() { return csrf; },
    async send(path, { method = 'GET', body, headers = {}, csrf: includeCsrf = true } = {}) {
      const multipart = body instanceof FormData ? new Request(origin, { method: 'POST', body }) : null;
      const response = await mf.dispatchFetch(origin + path, { method, headers: { 'CF-Connecting-IP': ip, Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(includeCsrf && csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body ? { 'Content-Type': multipart ? multipart.headers.get('Content-Type') : 'application/json' } : {}), ...headers }, body: multipart ? await multipart.arrayBuffer() : body === undefined ? undefined : JSON.stringify(body) });
      const setCookie = response.headers.get('Set-Cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const json = response.headers.get('Content-Type')?.includes('application/json') ? await response.clone().json() : null;
      if (json && 'csrfToken' in json) csrf = json.csrfToken || '';
      return { response, json };
    },
    async login(username = 'admin', secret = password) {
      assert.equal((await this.send('/api/user/session')).response.status, 200);
      const result = await this.send('/api/user/login', { method: 'POST', body: { username, password: secret } });
      assert.equal(result.response.status, 200, JSON.stringify(result.json));
      return result;
    },
  };
}
const fields = { year: '2026', descriptionEn: 'English text', descriptionUa: 'Український текст' };

test('Worker health, secure cookie/session rotation and hashed server-side session IDs', async () => {
  const c = client();
  assert.equal((await c.send('/api/health')).json.platform, 'cloudflare');
  const guest = await c.send('/api/user/session');
  const oldCookie = c.cookie;
  const oldCsrf = c.csrf;
  assert.match(guest.response.headers.get('Set-Cookie'), /__Host-bao\.sid=.*; Path=\/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure/);
  const logged = await c.login();
  assert.equal(logged.json.user.role, 'admin');
  assert.notEqual(c.cookie, oldCookie);
  assert.notEqual(c.csrf, oldCsrf);
  assert.equal(logged.json.user.password, undefined);
  const rawToken = c.cookie.split('=')[1];
  assert.equal(await db.prepare('SELECT idhash FROM sessions WHERE idhash=?').bind(rawToken).first(), null);
  const invalidated = await c.send('/api/user/session', { headers: { Cookie: oldCookie } });
  assert.equal(invalidated.json.user, null);
});

test('content writes reject anonymous, regular-user and cross-site requests', async () => {
  const guest = client();
  assert.equal((await guest.send('/api/experience', { method: 'POST', body: fields })).response.status, 401);
  const member = client(); await member.login('regular');
  assert.equal((await member.send('/api/experience', { method: 'POST', body: fields })).response.status, 403);
  const admin = client(); await admin.login();
  assert.equal((await admin.send('/api/experience', { method: 'POST', body: fields, csrf: false })).response.status, 403);
  assert.equal((await admin.send('/api/experience', { method: 'POST', body: fields, headers: { Origin: 'https://attacker.example' } })).response.status, 403);
  assert.equal((await admin.send('/api/experience', { method: 'POST', body: fields, headers: { 'Sec-Fetch-Site': 'cross-site' } })).response.status, 403);
});

test('all bilingual content resources retain CRUD behavior in real D1', async () => {
  const admin = client(); await admin.login();
  for (const kind of ['experience', 'activities', 'projects']) {
    const body = kind === 'projects' ? { titleEn: 'Project', titleUa: 'Проєкт', descriptionEn: 'Description', descriptionUa: 'Опис' } : fields;
    const created = await admin.send(`/api/${kind}`, { method: 'POST', body });
    assert.equal(created.response.status, 201, JSON.stringify(created.json));
    const id = created.json._id;
    assert.match(id, /^[a-f0-9]{24}$/);
    const changed = await admin.send(`/api/${kind}/${id}`, { method: 'PUT', body: { descriptionEn: '<script>plain text</script>' } });
    assert.equal(changed.response.status, 200);
    assert.equal(changed.json.descriptionEn, '<script>plain text</script>');
    const list = await client().send(`/api/${kind}`);
    assert.ok(list.json.some(row => row._id === id));
    assert.equal((await admin.send(`/api/${kind}/${id}`, { method: 'DELETE' })).response.status, 200);
    assert.equal((await client().send(`/api/${kind}/${id}`)).response.status, 404);
  }
});

test('certificate upload reaches real KV, survives text-only edit and deletes safely', async () => {
  const admin = client(); await admin.login();
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWMwDFtgGLaAAYUCAEYUButIT2duAAAAAElFTkSuQmCC', 'base64');
  const form = new FormData();
  for (const [field, value] of Object.entries({ date: '2026', descriptionEn: 'Certificate', descriptionUa: 'Сертифікат' })) form.set(field, value);
  form.set('image', new Blob([bytes], { type: 'image/png' }), 'certificate.png');
  const created = await admin.send('/api/certificates', { method: 'POST', body: form });
  assert.equal(created.response.status, 201, JSON.stringify(created.json));
  const image = await admin.send(created.json.imageUrl);
  assert.equal(image.response.status, 200);
  assert.equal(image.response.headers.get('Content-Type'), 'image/png');
  assert.match(image.response.headers.get('Content-Security-Policy'), /sandbox/);
  assert.deepEqual(Buffer.from(await image.response.arrayBuffer()), bytes);
  const changed = await admin.send(`/api/certificates/${created.json._id}`, { method: 'PUT', body: { descriptionEn: 'Updated' } });
  assert.equal(changed.json.imageUrl, created.json.imageUrl);
  assert.equal((await admin.send(`/api/certificates/${created.json._id}`, { method: 'DELETE' })).response.status, 200);
  const kv = await mf.getKVNamespace('MEDIA');
  assert.equal(await kv.get(decodeURIComponent(created.json.imageUrl.replace('/api/', '').replace('/image/', '/'))), null);
});

test('user administration retains role isolation, validation and revokes other sessions after password change', async () => {
  const admin = client(); await admin.login();
  const register = body => admin.send('/api/user/register', { method: 'POST', body });
  assert.equal((await register({ username: 'invalid', password: '😀'.repeat(6) })).response.status, 400);
  assert.equal((await register({ username: 'invalid', password: 'a'.repeat(12) + '\n' })).response.status, 400);
  const created = await register({ username: 'new.user', password, role: 'user' });
  assert.equal(created.response.status, 201);
  const id = created.json.user._id;
  const first = client(); await first.login('new.user');
  const second = client(); await second.login('new.user');
  assert.equal((await first.send('/api/user/users')).response.status, 403);
  assert.equal((await first.send(`/api/user/${adminId}`)).response.status, 403);
  const changed = await first.send(`/api/user/${id}`, { method: 'PUT', body: { currentPassword: password, newPassword: 'Changed-long-password-2026' } });
  assert.equal(changed.response.status, 200);
  assert.equal((await second.send('/api/user/session')).json.user, null);
  assert.equal((await first.send('/api/user/session')).json.user._id, id);
  assert.equal((await admin.send(`/api/user/${id}`, { method: 'DELETE' })).response.status, 200);
  assert.equal((await first.send('/api/user/session')).json.user, null);
  assert.equal((await admin.send(`/api/user/${adminId}`, { method: 'DELETE' })).response.status, 409);
});

test('persistent Durable Object rate limit stops repeated invalid login attempts', async () => {
  const c = client(); await c.send('/api/user/session');
  for (let i = 0; i < 10; i++) {
    const result = await c.send('/api/user/login', { method: 'POST', body: { username: 'regular', password: 'incorrect' } });
    assert.equal(result.response.status, 401);
  }
  assert.equal((await c.send('/api/user/login', { method: 'POST', body: { username: 'regular', password } })).response.status, 429);
});
