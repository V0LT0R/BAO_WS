'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const request = require('supertest');
const sharp = require('sharp');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp, defaultModels } = require('../app');
const { loadConfig } = require('../src/config');
const { createImageStore } = require('../src/images');

let mongo, models, app, imageStore, adminId, userId, otherId;
const secret = 'test-password-long-enough';
const quiet = { error() {}, warn() {}, info() {} };
const config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/test', SESSION_SECRET: 'test-only-secret-of-at-least-32-bytes', PUBLIC_ORIGIN: 'http://localhost:5000' });
const record = { year: '2026', descriptionEn: 'English text', descriptionUa: 'Український текст' };

before(async () => {
  // Never load .env: all reads and writes are isolated in a disposable loopback database.
  mongo = await MongoMemoryServer.create({ instance: { dbName: 'bao_security_tests', ip: '127.0.0.1' } });
  await mongoose.connect(mongo.getUri(), { autoIndex: false });
  models = defaultModels();
  await models.User.collection.createIndex({ username: 1 }, { unique: true });
  const hash = await bcrypt.hash(secret, 4);
  const users = await models.User.create([
    { username: 'admin-test', password: hash, role: 'admin' },
    { username: 'user-test', password: hash, role: 'user' },
    { username: 'other-test', password: hash, role: 'user' }
  ]);
  [adminId, userId, otherId] = users.map(user => String(user._id));
  imageStore = createImageStore(mongoose.connection);
  app = createApp({ config, models, imageStore, sessionStore: new session.MemoryStore(), logger: quiet, rateLimits: { global: 10000, login: 1000, upload: 1000, images: 1000 } });
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

async function client(username) {
  const agent = request.agent(app);
  let response = await agent.get('/api/user/session').expect(200);
  let csrf = response.body.csrfToken;
  if (username) {
    response = await agent.post('/api/user/login').set('X-CSRF-Token', csrf).send({ username, password: secret }).expect(200);
    csrf = response.body.csrfToken;
  }
  return { agent, csrf, user: response.body.user };
}

test('configuration fails fast without secrets, HTTPS origin or valid settings', () => {
  assert.throws(() => loadConfig({}), /MONGODB_URI/);
  assert.throws(() => loadConfig({ MONGODB_URI: config.mongoUri }), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ MONGODB_URI: config.mongoUri, SESSION_SECRET: config.sessionSecret, NODE_ENV: 'production', PUBLIC_ORIGIN: 'http://example.com' }), /HTTPS/);
  assert.throws(() => loadConfig({ MONGODB_URI: config.mongoUri, SESSION_SECRET: config.sessionSecret, TRUST_PROXY: 'true' }), /TRUST_PROXY/);
});

test('sessions use secure browser boundaries and CSRF is required even for login', async () => {
  const response = await request(app).get('/api/user/session').expect(200);
  assert.equal(response.body.user, null);
  assert.match(response.body.csrfToken, /^[a-f\d]{64}$/);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.headers['content-security-policy'], /script-src 'self'/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  await request(app).post('/api/user/login').send({ username: 'admin-test', password: secret }).expect(403);
  const { agent, csrf } = await client();
  await agent.post('/api/user/login').set('X-CSRF-Token', csrf).set('Origin', 'https://evil.example').send({ username: 'admin-test', password: secret }).expect(403);
  await agent.post('/api/user/login').set('X-CSRF-Token', csrf).set('Sec-Fetch-Site', 'cross-site').send({ username: 'admin-test', password: secret }).expect(403);
});

test('login regenerates session ID and CSRF token; logout revokes server session', async () => {
  const agent = request.agent(app);
  const anonymous = await agent.get('/api/user/session').expect(200);
  const oldCookie = anonymous.headers['set-cookie'][0].split(';')[0];
  const login = await agent.post('/api/user/login').set('X-CSRF-Token', anonymous.body.csrfToken).send({ username: 'admin-test', password: secret }).expect(200);
  assert.notEqual(login.body.csrfToken, anonymous.body.csrfToken);
  assert.notEqual(login.headers['set-cookie'][0].split(';')[0], oldCookie);
  assert.deepEqual(Object.keys(login.body.user).sort(), ['_id', 'role', 'username']);
  const oldSession = await request(app).get('/api/user/session').set('Cookie', oldCookie).expect(200);
  assert.equal(oldSession.body.user, null);
  await agent.post('/api/user/logout').set('X-CSRF-Token', anonymous.body.csrfToken).send({}).expect(403);
  await agent.post('/api/user/logout').set('X-CSRF-Token', login.body.csrfToken).send({}).expect(200);
  const loggedOut = await agent.get('/api/user/session').expect(200);
  assert.equal(loggedOut.body.user, null);
});

test('anonymous and ordinary users cannot mutate public content', async () => {
  for (const name of [undefined, 'user-test']) {
    const { agent, csrf } = await client(name);
    for (const endpoint of ['/api/experience', '/api/activities', '/api/projects', '/api/certificates']) {
      await agent.post(endpoint).set('X-CSRF-Token', csrf).send(record).expect(name ? 403 : 401);
      await agent.put(`${endpoint}/${otherId}`).set('X-CSRF-Token', csrf).send(record).expect(name ? 403 : 401);
      await agent.delete(`${endpoint}/${otherId}`).set('X-CSRF-Token', csrf).expect(name ? 403 : 401);
    }
  }
});

test('account access is self/admin only and password hashes never leave the API', async () => {
  const user = await client('user-test');
  await user.agent.get('/api/user/users').expect(403);
  await user.agent.get(`/api/user/${otherId}`).expect(403);
  const own = await user.agent.get(`/api/user/${userId}`).expect(200);
  assert.deepEqual(Object.keys(own.body).sort(), ['_id', 'role', 'username']);
  await user.agent.put(`/api/user/${otherId}`).set('X-CSRF-Token', user.csrf).send({ currentPassword: secret, username: 'changed' }).expect(403);
  const admin = await client('admin-test');
  const users = await admin.agent.get('/api/user/users').expect(200);
  for (const item of users.body) assert.deepEqual(Object.keys(item).sort(), ['_id', 'role', 'username']);
});

test('NoSQL injection, mass assignment, invalid IDs and malformed JSON are rejected', async () => {
  const anon = await client();
  await anon.agent.post('/api/user/login').set('X-CSRF-Token', anon.csrf).send({ username: { $ne: null }, password: secret }).expect(400);
  const admin = await client('admin-test');
  await admin.agent.post('/api/experience').set('X-CSRF-Token', admin.csrf).send({ ...record, year: { $gt: '' } }).expect(400);
  await admin.agent.post('/api/experience').set('X-CSRF-Token', admin.csrf).send({ ...record, $set: { role: 'admin' } }).expect(400);
  await admin.agent.put('/api/experience/not-an-id').set('X-CSRF-Token', admin.csrf).send(record).expect(400);
  await admin.agent.post('/api/experience').set('X-CSRF-Token', admin.csrf).set('Content-Type', 'application/json').send('{bad').expect(400);
  await admin.agent.post('/api/experience').set('X-CSRF-Token', admin.csrf).send({ ...record, descriptionEn: 'a'.repeat(110000) }).expect(413);
});

test('administrator content CRUD validates fields and keeps legacy endpoint shapes', async () => {
  const admin = await client('admin-test');
  const created = await admin.agent.post('/api/experience').set('X-CSRF-Token', admin.csrf).send(record).expect(201);
  assert.equal(created.body.year, '2026');
  const updated = await admin.agent.put(`/api/experience/${created.body._id}`).set('X-CSRF-Token', admin.csrf).send({ year: '2027' }).expect(200);
  assert.equal(updated.body.descriptionEn, record.descriptionEn);
  assert.equal(updated.body.year, '2027');
  assert(Array.isArray((await request(app).get('/api/experience').expect(200)).body));
  await admin.agent.delete(`/api/experience/${created.body._id}`).set('X-CSRF-Token', admin.csrf).expect(200);
  await admin.agent.get(`/api/experience/${created.body._id}`).expect(404);
});

test('registration is admin-only and administrator/self deletion is forbidden', async () => {
  const user = await client('user-test');
  await user.agent.post('/api/user/register').set('X-CSRF-Token', user.csrf).send({ username: 'intruder', password: secret, role: 'admin' }).expect(403);
  const admin = await client('admin-test');
  await admin.agent.post('/api/user/register').set('X-CSRF-Token', admin.csrf).send({ username: 'weak-password', password: 'short', role: 'user' }).expect(400);
  const created = await admin.agent.post('/api/user/register').set('X-CSRF-Token', admin.csrf).send({ username: 'created-user', password: secret, role: 'user' }).expect(201);
  assert(!('password' in created.body.user));
  await admin.agent.delete(`/api/user/${adminId}`).set('X-CSRF-Token', admin.csrf).expect(409);
  await admin.agent.delete(`/api/user/${created.body.user._id}`).set('X-CSRF-Token', admin.csrf).expect(200);
});

test('password change rotates session and revokes every other existing session', async () => {
  const hash = await bcrypt.hash(secret, 4);
  const account = await models.User.create({ username: 'password-test', password: hash, role: 'user' });
  const first = await client('password-test');
  const second = await client('password-test');
  const response = await first.agent.put(`/api/user/${account._id}`).set('X-CSRF-Token', first.csrf).send({ currentPassword: secret, newPassword: 'the-new-password-1234' }).expect(200);
  assert.notEqual(response.body.csrfToken, first.csrf);
  assert.equal((await second.agent.get('/api/user/session').expect(200)).body.user, null);
  assert.equal((await first.agent.get('/api/user/session').expect(200)).body.user.username, 'password-test');
});

test('legacy username characters remain usable at login', async () => {
  await models.User.collection.insertOne({ username: 'Legacy User', password: await bcrypt.hash(secret, 4), role: 'user' });
  const legacy = await client('Legacy User');
  assert.equal(legacy.user.username, 'Legacy User');
});

test('legacy accounts without authVersion can change their password and revoke other sessions', async () => {
  const inserted = await models.User.collection.insertOne({ username: 'Old Account Name', password: await bcrypt.hash(secret, 4), role: 'user' });
  const first = await client('Old Account Name');
  const second = await client('Old Account Name');
  const response = await first.agent.put(`/api/user/${inserted.insertedId}`).set('X-CSRF-Token', first.csrf).send({ username: 'Old Account Name', currentPassword: secret, newPassword: 'a-new-legacy-password' }).expect(200);
  assert.equal(response.body.user.username, 'Old Account Name');
  assert.equal((await second.agent.get('/api/user/session').expect(200)).body.user, null);
});

test('legacy source/configuration paths are not served and absent builds fail clearly', async () => {
  for (const url of ['/.env', '/server.js', '/assets/javascript/publications.js', '/uploads/test.svg', '/unknown.html']) await request(app).get(url).expect(404);
  const unbuilt = createApp({ config: { ...config, distDir: path.join(__dirname, 'does-not-exist') }, models, imageStore, sessionStore: new session.MemoryStore(), logger: quiet });
  await request(unbuilt).get('/').expect(503);
  assert.equal((await request(app).get('/api/health').expect(200)).body.status, 'ok');
});

test('image upload decodes and re-encodes raster bytes and rejects MIME spoofing', async () => {
  const admin = await client('admin-test');
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#3156a0' } }).png().toBuffer();
  const upload = () => admin.agent.post('/api/certificates').set('X-CSRF-Token', admin.csrf).field('date', '2026').field('descriptionEn', 'Certificate').field('descriptionUa', 'Сертифікат');
  await upload().attach('image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), { filename: 'fake.png', contentType: 'image/png' }).expect(415);
  await upload().attach('image', png, { filename: 'fake.svg', contentType: 'image/svg+xml' }).expect(415);
  await upload().attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' }).expect(413);
  const created = await upload().attach('image', png, { filename: '../../unsafe-name.png', contentType: 'image/png' }).expect(201);
  assert.match(created.body.imageUrl, /^\/api\/certificates\/image\/[a-f\d-]{36}\.webp$/);
  const image = await request(app).get(created.body.imageUrl).expect(200);
  assert.match(image.headers['content-type'], /image\/webp/);
  assert.equal((await sharp(image.body).metadata()).format, 'webp');
  await admin.agent.delete(`/api/certificates/${created.body._id}`).set('X-CSRF-Token', admin.csrf).expect(200);
  await request(app).get(created.body.imageUrl).expect(404);
});

test('legacy GridFS URLs work for real images but arbitrary HTML is never served', async () => {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'projectImages' });
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
  const write = (name, bytes) => new Promise((resolve, reject) => { const stream = bucket.openUploadStream(name); stream.once('finish', () => resolve(stream.id)); stream.once('error', reject); stream.end(bytes); });
  const filename = 'old image Україна.png';
  const id = await write(filename, png);
  const response = await request(app).get(`/api/projects/image/${encodeURIComponent(filename)}`).expect(200);
  assert.match(response.headers['content-type'], /image\/webp/);
  assert(await mongoose.connection.db.collection('projectImages.files').findOne({ _id: id }));
  await write('legacy.html', Buffer.from('<html><script>alert(1)</script></html>'));
  await request(app).get('/api/projects/image/legacy.html').expect(415);
  await request(app).get('/api/projects/image/missing.png').expect(404);
  await request(app).get('/api/projects/image/bad%2Fname.png').expect(400);
});

test('upload rollback removes only the just-created file when persistence fails', async () => {
  const admin = await client('admin-test');
  const png = await sharp({ create: { width: 3, height: 3, channels: 3, background: '#000' } }).png().toBuffer();
  const beforeFiles = await mongoose.connection.db.collection('projectImages.files').countDocuments();
  const create = models.Project.create;
  models.Project.create = async () => { throw new Error('mongodb://secret@example/private'); };
  try {
    const response = await admin.agent.post('/api/projects').set('X-CSRF-Token', admin.csrf).field('titleEn', 'Test').field('titleUa', 'Тест').field('descriptionEn', 'Text').field('descriptionUa', 'Текст').attach('image', png, { filename: 'test.png', contentType: 'image/png' }).expect(500);
    assert(!response.text.includes('mongodb'));
    assert(!response.text.includes('secret'));
    assert.equal(await mongoose.connection.db.collection('projectImages.files').countDocuments(), beforeFiles);
  } finally { models.Project.create = create; }
});

test('request rate limiting is enforced', async () => {
  const limited = createApp({ config, models, imageStore, sessionStore: new session.MemoryStore(), logger: quiet, rateLimits: { global: 2 } });
  await request(limited).get('/api/health').expect(200);
  await request(limited).get('/api/health').expect(200);
  await request(limited).get('/api/health').expect(429);
});

test('production session cookie is Secure and persists through a real Mongo session store', async () => {
  const MongoStore = require('connect-mongo').default;
  const store = MongoStore.create({ client: mongoose.connection.getClient(), dbName: mongoose.connection.name, collectionName: 'test_sessions', stringify: false, ttl: 3600, autoRemove: 'native' });
  const production = createApp({ config: { ...config, production: true, trustProxy: 1, publicOrigin: 'https://example.test' }, models, imageStore, sessionStore: store, logger: quiet });
  const response = await request(production).get('/api/user/session').set('X-Forwarded-Proto', 'https').expect(200);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /^__Host-bao\.sid=/);
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; HttpOnly/);
  assert.match(cookie, /; SameSite=Lax/);
  assert.match(response.headers['strict-transport-security'], /max-age=/);
  const second = await request(production).get('/api/user/session').set('X-Forwarded-Proto', 'https').set('Cookie', cookie.split(';')[0]).expect(200);
  assert.equal(second.body.csrfToken, response.body.csrfToken);
  assert.equal(await mongoose.connection.db.collection('test_sessions').countDocuments(), 1);
});

test('deleting an ordinary account invalidates its existing sessions', async () => {
  const created = await models.User.create({ username: 'delete-session', password: await bcrypt.hash(secret, 4), role: 'user' });
  const user = await client('delete-session');
  const admin = await client('admin-test');
  await admin.agent.delete(`/api/user/${created._id}`).set('X-CSRF-Token', admin.csrf).expect(200);
  assert.equal((await user.agent.get('/api/user/session').expect(200)).body.user, null);
});

test('post-commit cleanup failure never deletes the newly linked uploaded image', async () => {
  const admin = await client('admin-test');
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123' } }).png().toBuffer();
  const original = await admin.agent.post('/api/projects').set('X-CSRF-Token', admin.csrf).field('titleEn', 'Test').field('titleUa', 'Тест').field('descriptionEn', 'Text').field('descriptionUa', 'Текст').attach('image', png, { filename: 'one.png', contentType: 'image/png' }).expect(201);
  const exists = models.Project.exists;
  models.Project.exists = async () => { throw new Error('Transient database read failure'); };
  try {
    const updated = await admin.agent.put(`/api/projects/${original.body._id}`).set('X-CSRF-Token', admin.csrf).attach('image', png, { filename: 'two.png', contentType: 'image/png' }).expect(200);
    assert.notEqual(updated.body.imageUrl, original.body.imageUrl);
    await request(app).get(updated.body.imageUrl).expect(200);
  } finally { models.Project.exists = exists; }
});
