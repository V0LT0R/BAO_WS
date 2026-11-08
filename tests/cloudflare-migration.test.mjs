import test from 'node:test';
import assert from 'node:assert/strict';
import { contentRecord, recordSql, userSql, sqlText } from '../scripts/migrate-cloudflare.mjs';
const id = '0123456789abcdef01234567';

test('migration preserves legacy identifiers, bilingual content and image filenames safely', () => {
  const row = contentRecord('projects', { _id: id, titleEn: "O'Brien", titleUa: 'Назва', descriptionEn: '<script>still plain text</script>', descriptionUa: 'Опис', imageUrl: '/api/projects/image/сертифікат 1.png' });
  assert.equal(row.id, id);
  assert.equal(row.payload.titleEn, "O'Brien");
  assert.match(row.payload.imageUrl, /%20/);
  const sql = recordSql(row);
  assert.match(sql, /O''Brien/);
  assert.equal(sqlText("x'); DROP TABLE users;--"), "'x''); DROP TABLE users;--'");
});

test('migration refuses unsafe image references, malformed records and unsupported hashes', () => {
  const source = { _id: id, date: '2026', descriptionEn: 'Test', descriptionUa: 'Тест', imageUrl: '/api/certificates/image/%2e%2e%2f.env' };
  assert.throws(() => contentRecord('certificates', source), /Unsafe/);
  assert.throws(() => contentRecord('certificates', { ...source, imageUrl: null }), /missing/);
  assert.throws(() => contentRecord('experience', { _id: id, year: {}, descriptionEn: 'x', descriptionUa: 'y' }), /Invalid/);
  assert.throws(() => userSql({ _id: id, username: 'admin', role: 'admin', password: 'plaintext' }), /unsupported/);
});

test('migration retains bcrypt hashes and legacy spaced usernames without resetting credentials', () => {
  const hash = '$2b$12$0FxM0WqxtDucvTAYhYgNCOiMx4Qm0r1fnSAUsfYXkyNrhNCGEc2Se';
  const sql = userSql({ _id: id, username: 'Legacy Admin', role: 'admin', password: hash, authVersion: 2 });
  assert.ok(sql.includes(hash));
  assert.ok(sql.includes("'Legacy Admin'"));
  assert.match(sql, /,2\);$/);
});
