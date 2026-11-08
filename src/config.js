'use strict';
const path = require('node:path');
const { isIP } = require('node:net');

function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test or production.');
  const production = nodeEnv === 'production';
  const mongoUri = env.MONGODB_URI;
  if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) throw new Error('Set MONGODB_URI to a MongoDB connection string.');
  const sessionSecret = env.SESSION_SECRET;
  if (typeof sessionSecret !== 'string' || Buffer.byteLength(sessionSecret) < 32) throw new Error('Set SESSION_SECRET to a random secret of at least 32 bytes.');
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const host = env.HOST || (production ? '0.0.0.0' : '127.0.0.1');
  if (!['127.0.0.1', 'localhost', '0.0.0.0', '::1', '::'].includes(host)) throw new Error('HOST must be an explicit loopback or listen-all address.');
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (![0, 1].includes(trustProxy)) throw new Error('TRUST_PROXY must be 0 or 1; use 1 only behind one trusted reverse proxy.');
  if (production && !env.PUBLIC_ORIGIN) throw new Error('Set PUBLIC_ORIGIN to the public HTTPS origin in production.');
  let origin;
  try { origin = new URL(env.PUBLIC_ORIGIN || `http://localhost:${port}`); } catch { throw new Error('PUBLIC_ORIGIN must be a valid origin.'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (production && origin.protocol !== 'https:')) throw new Error('PUBLIC_ORIGIN must contain only the scheme and host, using HTTPS in production.');
  const dnsServers = (env.DNS_SERVERS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (dnsServers.some(value => !isIP(value))) throw new Error('DNS_SERVERS must be a comma-separated list of IP addresses.');
  return Object.freeze({ nodeEnv, production, mongoUri, sessionSecret, port, host, trustProxy, dnsServers, publicOrigin: origin.origin, scopusApiKey: env.SCOPUS_API_KEY || '', distDir: path.resolve(__dirname, '..', 'dist') });
}
module.exports = { loadConfig };
