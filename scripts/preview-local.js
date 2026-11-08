'use strict';
// This preview NEVER reads .env or connects to the deployed database.
const { randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const database = await MongoMemoryServer.create({ instance: { dbName: 'bao_preview', ip: '127.0.0.1' } });
  const mongoUri = database.getUri();
  const password = randomBytes(24).toString('base64url');
  const { defaultModels } = require('../app');
  const models = defaultModels();
  let running;
  try {
    await mongoose.connect(mongoUri);
    await models.User.create({ username: 'preview-admin', password: await bcrypt.hash(password, 12), role: 'admin' });
    if (process.env.BAO_PREVIEW_CONTENT_FILE) {
      const snapshot = JSON.parse(await fs.readFile(process.env.BAO_PREVIEW_CONTENT_FILE, 'utf8'));
      for (const [key, model, fields] of [
        ['experience', models.Experience, ['year', 'descriptionEn', 'descriptionUa']],
        ['activities', models.Activity, ['year', 'descriptionEn', 'descriptionUa']],
        ['projects', models.Project, ['titleEn', 'titleUa', 'descriptionEn', 'descriptionUa']],
      ]) {
        if (!Array.isArray(snapshot[key])) continue;
        // Only public text is seeded; neither user records nor remote image references are copied.
        const rows = snapshot[key].map(row => Object.fromEntries(fields.map(field => [field, row[field]])));
        if (rows.length) await model.insertMany(rows);
      }
    }
    await mongoose.disconnect();
    const port = process.env.PORT || '5000';
    running = await require('../server').start({ env: {
      NODE_ENV: 'development', MONGODB_URI: mongoUri, SESSION_SECRET: randomBytes(48).toString('base64url'),
      PORT: port, HOST: '127.0.0.1', PUBLIC_ORIGIN: `http://localhost:${port}`,
    } });
    console.log('Isolated preview. All changes disappear when the preview stops.');
    console.log(JSON.stringify({ previewUsername: 'preview-admin', previewPassword: password }));
    const close = async () => { await running.close(); await database.stop(); process.exit(0); };
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { close().catch(() => process.exit(1)); });
  } catch (error) {
    if (running) await running.close();
    await mongoose.disconnect();
    await database.stop();
    throw error;
  }
}
if (require.main === module) main().catch(error => { console.error('Isolated preview failed:', error.message); process.exitCode = 1; });
