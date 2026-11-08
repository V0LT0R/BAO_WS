import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleContent, inspectRaster, ContentHttpError, MAX_IMAGE_BYTES } from '../cloudflare/content.mjs';

const administrator = { _id: '1234567890abcdef12345678', role: 'admin' };
const user = { _id: '1234567890abcdef12345679', role: 'user' };
const fixtures = {
  png: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWMwDFtgGLaAAYUCAEYUButIT2duAAAAAElFTkSuQmCC', 'base64'),
  jpeg: Buffer.from('/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAADAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCDAWIJ/9k=', 'base64'),
  webp: Buffer.from('UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJaACdLoAA5gA/vD6K/8zR+k30m78f8W0joVGgAA=', 'base64'),
};
const fields = { year: '2026', descriptionEn: 'English text', descriptionUa: 'Український текст' };

function environment() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE content (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1); CREATE INDEX content_kind_created ON content(kind, created_at);');
  const DB = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
    },
  };
  const files = new Map();
  const MEDIA = {
    async put(key, value, options = {}) { files.set(key, { value: Uint8Array.from(new Uint8Array(value)).buffer, metadata: options.metadata || null }); },
    async getWithMetadata(key) { return structuredClone(files.get(key) || { value: null, metadata: null }); },
    async delete(key) { files.delete(key); },
  };
  return { DB, MEDIA, sqlite, files };
}

function request(path, { method = 'GET', body, raw, headers = {} } = {}) {
  return new Request(`https://portfolio.example${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
}

function upload(path, { method = 'POST', type = 'image/png', bytes = fixtures.png, name = 'image.png', data = { date: '2026', descriptionEn: 'Certificate', descriptionUa: 'Сертифікат' } } = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) form.set(key, value);
  if (bytes) form.set('image', new Blob([bytes], { type }), name);
  return request(path, { method, raw: form });
}

const call = (req, env, user = administrator) => handleContent(req, env, {}, { user });
const rejectsStatus = (fn, status) => assert.rejects(fn, error => error instanceof ContentHttpError && error.status === status);

test('raster validation recognizes PNG, JPEG and WebP with actual dimensions', () => {
  for (const [format, bytes] of Object.entries(fixtures)) {
    const result = inspectRaster(bytes);
    assert.equal(result.width, 2);
    assert.equal(result.height, 3);
    assert.equal(result.contentType, `image/${format}`);
  }
});

test('raster validation rejects HTML, SVG, truncation, trailing polyglot data and oversized dimensions', () => {
  for (const bytes of [Buffer.from('<html><script>alert(1)</script></html>'), Buffer.from('<svg></svg>'), fixtures.png.subarray(0, 40), fixtures.jpeg.subarray(0, -1), Buffer.concat([fixtures.webp, Buffer.from('trailing')]), Buffer.concat([fixtures.png, Buffer.from('<script>')])]) assert.throws(() => inspectRaster(bytes), error => error.status === 415);
  const huge = Uint8Array.from(fixtures.png);
  new DataView(huge.buffer).setUint32(16, 20000000);
  assert.throws(() => inspectRaster(huge), error => error.status === 415);
  assert.throws(() => inspectRaster(new Uint8Array(MAX_IMAGE_BYTES + 1)), error => error.status === 413);
});

test('every content write independently requires an authenticated administrator', async () => {
  const env = environment();
  try {
    for (const kind of ['experience', 'activities', 'projects', 'certificates']) {
      for (const identity of [null, user]) {
        await rejectsStatus(() => call(request(`/api/${kind}`, { method: 'POST', body: fields }), env, identity), identity ? 403 : 401);
        await rejectsStatus(() => call(request(`/api/${kind}/${user._id}`, { method: 'PUT', body: fields }), env, identity), identity ? 403 : 401);
        await rejectsStatus(() => call(request(`/api/${kind}/${user._id}`, { method: 'DELETE' }), env, identity), identity ? 403 : 401);
      }
    }
    assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS count FROM content').get().count, 0);
  } finally { env.sqlite.close(); }
});

test('SQL-backed CRUD preserves endpoint shape and scopes IDs by content kind', async () => {
  const env = environment();
  try {
    const createdResponse = await call(request('/api/experience', { method: 'POST', body: fields }), env);
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.match(created._id, /^[a-f\d]{24}$/);
    assert.equal(created.descriptionUa, fields.descriptionUa);
    await rejectsStatus(() => call(request(`/api/activities/${created._id}`, { method: 'PUT', body: { year: '2000' } }), env), 404);
    await rejectsStatus(() => call(request(`/api/activities/${created._id}`, { method: 'DELETE' }), env), 404);
    const updated = await (await call(request(`/api/experience/${created._id}`, { method: 'PUT', body: { year: '2027' } }), env)).json();
    assert.equal(updated.year, '2027');
    assert.equal(updated.descriptionEn, fields.descriptionEn);
    const listed = await (await call(request('/api/experience'), env, null)).json();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]._id, created._id);
    assert.equal((await call(request(`/api/experience/${created._id}`, { method: 'DELETE' }), env)).status, 200);
    await rejectsStatus(() => call(request(`/api/experience/${created._id}`), env), 404);
  } finally { env.sqlite.close(); }
});

test('SQL injection stays literal text while object injection and unexpected fields are rejected', async () => {
  const env = environment();
  try {
    const literal = "'); DROP TABLE content; --";
    const response = await call(request('/api/experience', { method: 'POST', body: { ...fields, descriptionEn: literal } }), env);
    assert.equal((await response.json()).descriptionEn, literal);
    assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS count FROM content').get().count, 1);
    for (const body of [{ ...fields, year: { $gt: '' } }, { ...fields, role: 'admin' }, [fields], JSON.parse('{"__proto__":{"role":"admin"}}')]) await rejectsStatus(() => call(request('/api/experience', { method: 'POST', body }), env), 400);
    await rejectsStatus(() => call(request('/api/projects/not-an-id'), env), 400);
    await rejectsStatus(() => call(request('/api/experience', { method: 'POST', raw: '{bad', headers: { 'Content-Type': 'application/json' } }), env), 400);
    await rejectsStatus(() => call(request('/api/experience', { method: 'POST', body: { ...fields, descriptionEn: 'x'.repeat(110000) } }), env), 413);
  } finally { env.sqlite.close(); }
});

test('project uploads choose immutable random keys and serve safe MIME independently of filename', async () => {
  const env = environment();
  try {
    const createdResponse = await call(upload('/api/projects', { name: '../../evil.html', data: { titleEn: 'T'.repeat(210), titleUa: 'Проєкт', descriptionEn: 'Text', descriptionUa: 'Текст' } }), env);
    const created = await createdResponse.json();
    assert.equal(createdResponse.status, 201);
    assert.match(created.imageUrl, /^\/api\/projects\/image\/[a-f\d-]{36}\.png$/);
    const key = created.imageUrl.replace('/api/', '').replace('/image/', '/');
    assert.equal(env.files.get(key).metadata.ownerRecordId, created._id);
    const image = await call(request(created.imageUrl), env, null);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('Content-Type'), 'image/png');
    assert.equal(image.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(image.headers.get('Content-Security-Policy'), "default-src 'none'; sandbox");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), fixtures.png);
    await call(request(`/api/projects/${created._id}`, { method: 'DELETE' }), env);
    assert.equal(env.files.has(key), false);
  } finally { env.sqlite.close(); }
});

test('uploads reject spoofed MIME, unexpected files, missing certificates and duplicate fields', async () => {
  const env = environment();
  try {
    await rejectsStatus(() => call(upload('/api/certificates', { bytes: Buffer.from('<svg><script>bad</script></svg>') }), env), 415);
    await rejectsStatus(() => call(upload('/api/certificates', { type: 'image/jpeg' }), env), 415);
    await rejectsStatus(() => call(upload('/api/certificates', { bytes: new Uint8Array(MAX_IMAGE_BYTES + 1) }), env), 413);
    await rejectsStatus(() => call(upload('/api/certificates', { bytes: null }), env), 400);
    const form = new FormData();
    form.append('date', '2020'); form.append('date', '2021');
    await rejectsStatus(() => call(request('/api/certificates', { method: 'POST', raw: form }), env), 400);
    assert.equal(env.files.size, 0);
  } finally { env.sqlite.close(); }
});

test('legacy image URLs preserve Unicode names, cannot escape their kind, and never serve HTML', async () => {
  const env = environment();
  try {
    await env.MEDIA.put('certificates/Сертифікат 2020.png', fixtures.png);
    const response = await call(request('/api/certificates/image/' + encodeURIComponent('Сертифікат 2020.png')), env, null);
    assert.equal(response.status, 200);
    await rejectsStatus(() => call(request('/api/projects/image/' + encodeURIComponent('Сертифікат 2020.png')), env), 404);
    await rejectsStatus(() => call(request('/api/certificates/image/bad%2fname.png'), env), 400);
    await env.MEDIA.put('certificates/legacy.html', Buffer.from('<html>unsafe</html>'));
    await rejectsStatus(() => call(request('/api/certificates/image/legacy.html'), env), 415);
  } finally { env.sqlite.close(); }
});

test('record deletion preserves shared images and unowned migrated media', async () => {
  const env = environment();
  try {
    const created = await (await call(upload('/api/certificates'), env)).json();
    const key = created.imageUrl.replace('/api/', '').replace('/image/', '/');
    const otherId = '111111111111111111111111';
    env.sqlite.prepare('INSERT INTO content VALUES (?, ?, ?, ?, ?, 1)').run(otherId, 'certificates', JSON.stringify({ date: '2025', descriptionEn: 'Shared', descriptionUa: 'Спільне', imageUrl: created.imageUrl }), 1, 1);
    await call(request(`/api/certificates/${created._id}`, { method: 'DELETE' }), env);
    assert(env.files.has(key));
    await call(request(`/api/certificates/${otherId}`, { method: 'DELETE' }), env);
    assert(env.files.has(key), 'a different record never owns the same object');
    await env.MEDIA.put('projects/legacy.png', fixtures.png);
    env.sqlite.prepare('INSERT INTO content VALUES (?, ?, ?, ?, ?, 1)').run(otherId, 'projects', JSON.stringify({ titleEn: 'Old', titleUa: 'Старе', descriptionEn: 'Text', descriptionUa: 'Текст', imageUrl: '/api/projects/image/legacy.png' }), 1, 1);
    await call(request(`/api/projects/${otherId}`, { method: 'DELETE' }), env);
    assert(env.files.has('projects/legacy.png'));
  } finally { env.sqlite.close(); }
});

test('failed insert rolls back only the newly uploaded immutable key', async () => {
  const env = environment();
  try {
    await env.MEDIA.put('certificates/legacy.png', fixtures.png);
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = sql => sql.startsWith('INSERT INTO') ? { bind() { return this; }, async run() { throw new Error('simulated D1 failure'); } } : prepare(sql);
    await assert.rejects(() => call(upload('/api/certificates'), env), /simulated D1 failure/);
    assert.deepEqual([...env.files.keys()], ['certificates/legacy.png']);
  } finally { env.sqlite.close(); }
});

test('an ambiguous database response cannot delete media that was actually committed', async () => {
  const env = environment();
  try {
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = sql => {
      const statement = prepare(sql);
      if (sql.startsWith('INSERT INTO')) {
        const run = statement.run.bind(statement);
        statement.run = async () => { await run(); throw new Error('response lost after commit'); };
      }
      return statement;
    };
    await assert.rejects(() => call(upload('/api/certificates'), env), /response lost after commit/);
    const row = env.sqlite.prepare('SELECT payload FROM content').get();
    const imageUrl = JSON.parse(row.payload).imageUrl;
    assert(env.files.has(imageUrl.replace('/api/', '').replace('/image/', '/')));
  } finally { env.sqlite.close(); }
});

test('compare-and-swap conflict rolls back replacement without deleting original image', async () => {
  const env = environment();
  try {
    const created = await (await call(upload('/api/certificates'), env)).json();
    const originalKeys = [...env.files.keys()];
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = sql => {
      const query = prepare(sql);
      if (sql.startsWith('UPDATE content')) {
        const first = query.first.bind(query);
        query.first = async () => {
          env.sqlite.prepare('UPDATE content SET version = version + 1 WHERE id = ?').run(created._id);
          return first();
        };
      }
      return query;
    };
    await rejectsStatus(() => call(upload(`/api/certificates/${created._id}`, { method: 'PUT', data: {} }), env), 409);
    assert.deepEqual([...env.files.keys()], originalKeys);
    assert.equal(JSON.parse(env.sqlite.prepare('SELECT payload FROM content WHERE id = ?').get(created._id).payload).imageUrl, created.imageUrl);
  } finally { env.sqlite.close(); }
});

test('cleanup failure after commit preserves replacement and successful response', async () => {
  const env = environment();
  try {
    const created = await (await call(upload('/api/certificates'), env)).json();
    env.MEDIA.getWithMetadata = async () => { throw new Error('simulated cleanup read failure'); };
    const updatedResponse = await call(upload(`/api/certificates/${created._id}`, { method: 'PUT', data: {} }), env);
    assert.equal(updatedResponse.status, 200);
    const updated = await updatedResponse.json();
    assert.notEqual(updated.imageUrl, created.imageUrl);
    assert(env.files.has(updated.imageUrl.replace('/api/', '').replace('/image/', '/')));
  } finally { env.sqlite.close(); }
});

test('HEAD returns no body, unrelated routes return null and unsupported methods fail closed', async () => {
  const env = environment();
  try {
    assert.equal(await call(request('/api/user/session'), env), null);
    assert.equal((await call(request('/api/experience', { method: 'OPTIONS' }), env)).status, 405);
    const head = await call(request('/api/experience', { method: 'HEAD' }), env, null);
    assert.equal(await head.text(), '');
    assert.equal(head.status, 200);
  } finally { env.sqlite.close(); }
});
