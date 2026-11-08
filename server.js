'use strict';
const fs = require('node:fs');
const dns = require('node:dns');
const mongoose = require('mongoose');
const { loadConfig } = require('./src/config');
const { createImageStore } = require('./src/images');
const { createApp } = require('./app');

async function start({ env = process.env, logger = console } = {}) {
  const config = loadConfig(env);
  if (!fs.existsSync(require('node:path').join(config.distDir, 'index.html'))) throw new Error('Build the client first with npm run build.');
  if (config.dnsServers.length) dns.setServers(config.dnsServers);
  mongoose.set('strictQuery', true);
  // A single MongoClient backs models, GridFS and sessions. No eager connection in routes.
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10, autoIndex: false });
  let server, app;
  try {
    // Without this index, concurrent account creation could bypass an existence check.
    await require('./src/models/Authorization').collection.createIndex({ username: 1 }, { unique: true });
    const MongoStoreModule = require('connect-mongo');
    const MongoStore = MongoStoreModule.default || MongoStoreModule;
    const store = MongoStore.create({ client: mongoose.connection.getClient(), dbName: mongoose.connection.name, collectionName: 'sessions', ttl: 3600, autoRemove: 'native', stringify: false });
    store.on('error', () => logger.error('Session store is unavailable.'));
    // A read waits for connect-mongo's TTL-index setup and fails startup cleanly.
    await new Promise((resolve, reject) => store.get('__startup_probe__', error => error ? reject(error) : resolve()));
    app = createApp({ config, sessionStore: store, imageStore: createImageStore(mongoose.connection), logger });
    server = await new Promise((resolve, reject) => {
      const candidate = app.listen(config.port, config.host, () => resolve(candidate));
      candidate.once('error', reject);
    });
  } catch (error) { await mongoose.disconnect(); throw error; }
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  logger.info(`Server running at ${config.publicOrigin}`);
  let closing;
  const close = () => {
    if (!closing) closing = (async () => {
      const timer = setTimeout(() => server.closeAllConnections(), 10000).unref();
      await new Promise(resolve => server.close(resolve));
      clearTimeout(timer);
      await mongoose.disconnect();
    })();
    return closing;
  };
  return { app, server, close };
}

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  start().then(({ close }) => {
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => close().then(() => process.exit(0), () => process.exit(1)));
  }).catch(error => {
    // Configuration messages are authored locally; driver errors can contain credentials.
    const safeConfig = /^(Set |NODE_ENV |PORT |HOST |TRUST_PROXY |PUBLIC_ORIGIN |DNS_SERVERS |Build the client)/.test(error.message);
    console.error(safeConfig ? error.message : 'Server startup failed. Check configuration and database availability.');
    mongoose.disconnect().finally(() => { process.exitCode = 1; });
  });
}
module.exports = { start };
