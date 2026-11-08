const path = require('node:path');
const readline = require('node:readline');
const { Writable } = require('node:stream');

class CliError extends Error {}

function parseArguments(argv) {
  const options = { allowRemote: false, database: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--allow-remote') options.allowRemote = true;
    else if (argument === '--confirm-database' && !options.database) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new CliError('Provide a database name after --confirm-database.');
      options.database = value;
    } else {
      throw new CliError('Unsupported argument. Use --help. Credentials must not be passed as arguments.');
    }
  }
  return options;
}

function validateTarget(uri, options) {
  if (typeof uri !== 'string') throw new CliError('MONGODB_URI is required.');
  const match = /^(mongodb(?:\+srv)?):\/\/([^/?#]+)\/([^/?#]+)(?:\?[^#]*)?$/i.exec(uri);
  if (!match) throw new CliError('MONGODB_URI must explicitly name the database.');
  let database;
  try {
    database = decodeURIComponent(match[3]);
  } catch {
    throw new CliError('MONGODB_URI contains an invalid database name.');
  }
  if (!database || Buffer.byteLength(database, 'utf8') > 63 || /[\s/\\."$*<>:|?\u0000-\u001f\u007f]/u.test(database)) {
    throw new CliError('MONGODB_URI contains an unsupported database name.');
  }
  if (!options.database || options.database !== database) {
    throw new CliError('Pass --confirm-database with the exact database name from MONGODB_URI.');
  }
  const authority = match[2].slice(match[2].lastIndexOf('@') + 1);
  const hosts = authority.split(',');
  const loopback = match[1].toLowerCase() === 'mongodb' && hosts.every(host => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host));
  if (!loopback && !options.allowRemote) {
    throw new CliError('A remote database requires the explicit --allow-remote flag.');
  }
  return { database, remote: !loopback };
}

function validateCredentials(username, password) {
  if (typeof username !== 'string' || !/^[\p{L}\p{N}_.@-]{3,64}$/u.test(username)) {
    throw new CliError('Username must have 3–64 letters, digits, or _ . @ - characters.');
  }
  if (typeof password !== 'string' || Array.from(password).length < 12 || Buffer.byteLength(password, 'utf8') > 72 || /[\u0000-\u001f\u007f]/u.test(password)) {
    throw new CliError('Password must contain at least 12 characters and at most 72 UTF-8 bytes, without control characters.');
  }
}

function prompt(label, hidden = false) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.reject(new CliError('Run this command in an interactive terminal to enter credentials securely.'));
  }
  return new Promise((resolve, reject) => {
    // Readline still handles editing and backspace, while the output stream
    // suppresses all password echo. The secret never enters argv or a log.
    const output = new Writable({
      write(chunk, encoding, callback) {
        if (!hidden) process.stdout.write(chunk, encoding);
        callback();
      },
    });
    const input = readline.createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
    let answered = false;
    process.stdout.write(label);
    input.on('SIGINT', () => input.close());
    input.on('close', () => {
      if (!answered) {
        process.stdout.write('\n');
        reject(new CliError('Cancelled. No administrator was created.'));
      }
    });
    input.question('', answer => {
      answered = true;
      input.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function run(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write('Usage: node scripts/create-admin.js --confirm-database NAME [--allow-remote]\n\nCreates a new administrator in the explicitly confirmed database.\nUsername and password are entered interactively. Existing accounts are never overwritten.\n');
    return;
  }

  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  let config;
  try {
    config = require('../src/config').loadConfig(process.env);
  } catch {
    throw new CliError('Configuration is invalid. Check the documented environment variables.');
  }
  const target = validateTarget(config.mongoUri, options);
  process.stdout.write(`Target database: ${target.database}${target.remote ? ' (remote)' : ' (local)'}\n`);
  const username = (await prompt('New administrator username: ')).trim();
  let password = await prompt('New password (hidden): ', true);
  validateCredentials(username, password);
  let confirmation = await prompt('Repeat password (hidden): ', true);
  if (password !== confirmation) throw new CliError('Passwords do not match. No administrator was created.');

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(password, 12);
  password = '';
  confirmation = '';

  const mongoose = require('mongoose');
  const User = require('../src/models/Authorization');
  try {
    if (config.dnsServers.length) require('node:dns').setServers(config.dnsServers);
    await mongoose.connect(config.mongoUri, { dbName: target.database, serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
    if (await User.exists({ username })) throw new CliError('That username already exists. No account was changed.');
    // Bootstrap is an explicit database write. The same idempotent index is
    // verified at server startup to make concurrent account creation safe.
    await User.collection.createIndex({ username: 1 }, { unique: true });
    await User.create({ username, password: hash, role: 'admin', authVersion: 0 });
    process.stdout.write('Administrator created successfully.\n');
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (error?.code === 11000) throw new CliError('That username already exists. No account was changed.');
    throw new CliError('Could not create the administrator. Check database access and configuration.');
  } finally {
    await mongoose.disconnect();
  }
}

async function main(argv = process.argv.slice(2)) {
  try {
    await run(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof CliError ? error.message : 'Administrator creation failed.'}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { main, parseArguments, validateTarget, validateCredentials };
