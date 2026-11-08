import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const migrationRoot = path.join(root, '.migration');
const kinds = { experience: ['experiences', { year: 80, descriptionEn: 20000, descriptionUa: 20000 }], activities: ['activities', { year: 80, descriptionEn: 20000, descriptionUa: 20000 }], projects: ['projects', { titleEn: 500, titleUa: 500, descriptionEn: 20000, descriptionUa: 20000 }], certificates: ['certificates', { date: 80, descriptionEn: 20000, descriptionUa: 20000 }] };
export const sqlText = value => `'${String(value).replaceAll("'", "''")}'`;
const digest = value => createHash('sha256').update(value).digest('hex');
const validId = value => /^[a-f\d]{24}$/i.test(String(value));
class MigrationError extends Error {}
const fail = message => { throw new MigrationError(message); };

export function contentRecord(kind, row) {
  if (!kinds[kind] || !validId(row._id)) fail('Invalid source content record.');
  const payload = {};
  for (const [field, max] of Object.entries(kinds[kind][1])) {
    if (typeof row[field] !== 'string' || !row[field].trim() || row[field].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(row[field])) fail(`Invalid ${kind}.${field}; correct source data before migration.`);
    payload[field] = row[field];
  }
  if (['projects', 'certificates'].includes(kind)) {
    payload.imageUrl = row.imageUrl || null;
    if (payload.imageUrl !== null) {
      const prefix = `/api/${kind}/image/`;
      if (typeof payload.imageUrl !== 'string' || !payload.imageUrl.startsWith(prefix)) fail('Unexpected source image URL.');
      let name;
      try { name = decodeURIComponent(payload.imageUrl.slice(prefix.length)); } catch { fail('Invalid source image filename.'); }
      if (!name || name.length > 240 || /[\/\\?#%\u0000-\u001f\u007f]/u.test(name) || ['.', '..'].includes(name)) fail('Unsafe source image filename.');
      // Encode once, preserving the underlying GridFS filename and image route.
      payload.imageUrl = prefix + encodeURIComponent(name);
    }
    if (kind === 'certificates' && !payload.imageUrl) fail('A source certificate is missing its image.');
  }
  const sourceTime = row._id?.getTimestamp?.().valueOf() || 0;
  const created = Number(new Date(row.createdAt || sourceTime));
  const updated = Number(new Date(row.updatedAt || created));
  if (!Number.isFinite(created) || !Number.isFinite(updated)) fail('Invalid source timestamps.');
  return { id: String(row._id), kind, payload, created_at: created, updated_at: updated };
}

export function recordSql(row) {
  const statement = `INSERT INTO content (id,kind,payload,created_at,updated_at,version) VALUES (${sqlText(row.id)},${sqlText(row.kind)},${sqlText(JSON.stringify(row.payload))},${row.created_at},${row.updated_at},1);`;
  if (Buffer.byteLength(statement) > 99000) fail('A source record exceeds the D1 SQL import limit.');
  return statement;
}

export function userSql(row) {
  if (!validId(row._id) || typeof row.username !== 'string' || !row.username || row.username.length > 256 || /[\u0000-\u001f\u007f]/u.test(row.username) || !['admin', 'user'].includes(row.role) || !/^\$2[aby]\$(?:0[4-9]|1[0-6])\$[./A-Za-z0-9]{53}$/.test(row.password || '')) fail('A source user is invalid or uses an unsupported password hash.');
  const version = row.authVersion || 0;
  if (!Number.isSafeInteger(version) || version < 0) fail('Invalid account version.');
  return `INSERT INTO users (id,username,password,role,auth_version) VALUES (${sqlText(row._id)},${sqlText(row.username)},${sqlText(row.password)},${sqlText(row.role)},${version});`;
}

async function exportMongo(database) {
  require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  const uri = process.env.MONGODB_URI;
  if (process.env.DNS_SERVERS) require('node:dns').setServers(process.env.DNS_SERVERS.split(',').map(value => value.trim()));
  const { MongoClient, GridFSBucket } = require('mongoose').mongo;
  const { sanitizeImage } = require('../src/images.js');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, readPreference: 'primary' });
  // Older MongoDB URIs omitted the database path; MongoDB then uses "test".
  // Confirm that effective name explicitly without modifying the source URI.
  if (!database || client.options.dbName !== database) fail('Pass --confirm-database with the effective source database name (test when the legacy URI has no database path).');
  const output = path.join(migrationRoot, `export-${new Date().toISOString().replaceAll(':', '-')}`);
  await mkdir(output, { recursive: true });
  const files = [];
  const save = async (name, data) => { await writeFile(path.join(output, name), data, { mode: 0o600, flag: 'wx' }); files.push({ name, sha256: digest(data) }); };
  try {
    await client.connect();
    const db = client.db(database);
    const users = await db.collection('users').find({}, { projection: { _id: 1, username: 1, password: 1, role: 1, authVersion: 1 } }).toArray();
    if (!users.some(user => user.role === 'admin')) fail('No administrator found in the source database.');
    const statements = users.map(userSql);
    const counts = { users: users.length };
    const media = new Map();
    for (const [kind, [collection]] of Object.entries(kinds)) {
      const rows = await db.collection(collection).find({}).toArray();
      counts[kind] = rows.length;
      for (const source of rows) {
        const row = contentRecord(kind, source);
        statements.push(recordSql(row));
        if (!row.payload.imageUrl) continue;
        const filename = decodeURIComponent(row.payload.imageUrl.slice(`/api/${kind}/image/`.length));
        const key = `${kind}/${filename}`;
        if (media.has(key)) continue;
        const bucketName = kind === 'projects' ? 'projectImages' : 'certificateImages';
        const file = await db.collection(`${bucketName}.files`).findOne({ filename });
        if (!file || file.length <= 0 || file.length > 5 * 1024 * 1024) fail('A source image is missing or exceeds 5 MB. No import has been made.');
        const chunks = []; let size = 0;
        const stream = new GridFSBucket(db, { bucketName }).openDownloadStream(file._id);
        for await (const chunk of stream) { size += chunk.length; if (size > 5 * 1024 * 1024) { stream.destroy(); fail('Source image is too large.'); } chunks.push(chunk); }
        const safe = await sanitizeImage(Buffer.concat(chunks));
        const metadata = await require('sharp')(safe).metadata();
        media.set(key, { key, value: safe.toString('base64'), base64: true, metadata: { contentType: 'image/webp', width: metadata.width, height: metadata.height } });
      }
    }
    const totalBytes = [...media.values()].reduce((sum, item) => sum + Buffer.byteLength(item.value, 'base64'), 0);
    if (totalBytes > 900 * 1024 * 1024) fail('The media archive is too close to the 1 GB KV free allowance.');
    await save('data.sql', statements.join('\n') + '\n');
    let batch = [], bytes = 0, batchIndex = 0;
    for (const item of media.values()) {
      const itemBytes = Buffer.byteLength(JSON.stringify(item));
      if (bytes + itemBytes > 40 * 1024 * 1024 && batch.length) { await save(`media-${++batchIndex}.json`, JSON.stringify(batch)); batch = []; bytes = 0; }
      batch.push(item); bytes += itemBytes;
    }
    if (batch.length) await save(`media-${++batchIndex}.json`, JSON.stringify(batch));
    const manifest = { version: 1, exportedAt: new Date().toISOString(), counts, images: media.size, mediaBytes: totalBytes, files };
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ manifest: path.join(output, 'manifest.json'), counts, images: media.size, mediaBytes: totalBytes, sourceChanged: false }, null, 2));
  } finally { await client.close(); }
}

function wrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts/cloudflare.mjs'), ...args], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', data => { stdout += data; });
    // Imported SQL includes password hashes: never echo CLI diagnostics or SQL.
    child.stderr.resume();
    child.on('error', () => reject(new MigrationError('Wrangler could not start.')));
    child.on('exit', code => code === 0 ? resolve(stdout) : reject(new MigrationError('Cloudflare import command failed. Check authentication, resource IDs and migrations; source MongoDB was not changed.')));
  });
}

async function importArchive(manifestPath, target) {
  const resolved = await realpath(manifestPath);
  const archiveRoot = path.dirname(resolved);
  const safeRoot = await realpath(migrationRoot);
  const relative = path.relative(safeRoot, archiveRoot);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('Import archives must be inside the ignored .migration directory.');
  const manifest = JSON.parse(await readFile(resolved, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.some(file => file.name === 'data.sql')) fail('Invalid migration manifest.');
  const files = [];
  for (const entry of manifest.files) {
    if (!/^(data\.sql|media-\d+\.json)$/.test(entry.name)) fail('Invalid migration file name.');
    const filename = await realpath(path.join(archiveRoot, entry.name));
    if (path.dirname(filename) !== archiveRoot) fail('Migration files must remain within the archive directory.');
    if (digest(await readFile(filename)) !== entry.sha256) fail('The migration archive was modified after export. Export again.');
    files.push({ name: entry.name, filename });
  }
  const flags = [target];
  const output = await wrangler(['d1', 'execute', 'DB', ...flags, '--json', '--command', 'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM content) AS content;']);
  let counts;
  try { counts = JSON.parse(output)[0].results[0]; } catch { fail('Could not verify that the destination D1 database is empty.'); }
  if (counts.users || counts.content) fail('Destination D1 is not empty. Import is refused to protect existing edits.');
  const mediaFiles = files.filter(file => file.name.startsWith('media-'));
  if (mediaFiles.length) {
    let existingKeys;
    try { existingKeys = JSON.parse(await wrangler(['kv', 'key', 'list', '--binding', 'MEDIA', ...flags])); }
    catch { fail('Could not verify that the destination MEDIA namespace is empty.'); }
    if (!Array.isArray(existingKeys) || existingKeys.length) fail('Destination MEDIA is not empty. Import is refused to avoid overwriting files; inspect any earlier partial import before continuing.');
  }
  // Files are imported first; content is exposed only after all media succeeds.
  // A partial media import is deliberately not overwritten by a blind retry.
  for (const file of mediaFiles) await wrangler(['kv', 'bulk', 'put', file.filename, '--binding', 'MEDIA', ...flags]);
  await wrangler(['d1', 'execute', 'DB', ...flags, '--file', files.find(file => file.name === 'data.sql').filename, '--yes']);
  const verify = JSON.parse(await wrangler(['d1', 'execute', 'DB', ...flags, '--json', '--command', 'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM content) AS content;']))[0].results[0];
  const expectedContent = Object.entries(manifest.counts).filter(([key]) => key !== 'users').reduce((sum, [, count]) => sum + count, 0);
  if (verify.users !== manifest.counts.users || verify.content !== expectedContent) fail('Import count verification failed. Keep the old site active and inspect the destination.');
  console.log(JSON.stringify({ imported: true, target, users: verify.users, content: verify.content, images: manifest.images, sourceChanged: false }, null, 2));
}

async function main(args) {
  if (args.length === 3 && args[0] === 'export' && args[1] === '--confirm-database') return exportMongo(args[2]);
  if (args.length === 4 && args[0] === 'import' && args[1] === '--manifest' && ['--local', '--remote'].includes(args[3])) return importArchive(args[2], args[3]);
  console.log('Export (read only): node scripts/migrate-cloudflare.mjs export --confirm-database NAME\nImport into empty D1: node scripts/migrate-cloudflare.mjs import --manifest .migration/export-.../manifest.json --local|--remote\nThe archive contains password hashes. Keep .migration private; never commit or share it.');
  if (!args.includes('--help')) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => {
  // Network/driver errors may include connection details. Only our validation
  // messages are safe for display; driver diagnostics deliberately stay hidden.
  const code = /^[A-Z0-9_]+$/.test(String(error?.code)) ? ` (${error.code})` : '';
  console.error(error instanceof MigrationError ? error.message : `Migration failed${code}. Check source access and configuration; no MongoDB writes are performed.`);
  process.exitCode = 1;
});
