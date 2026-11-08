import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Keep local auth/log/state files ignored, and never auto-load the legacy
// MongoDB .env into the Worker preview. Wrangler login uses browser OAuth.
const root = fileURLToPath(new URL('..', import.meta.url));
const child = spawn(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: path.join(root, '.wrangler', 'logs'),
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || path.join(root, '.cloudflare'),
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    WRANGLER_SEND_METRICS: 'false',
  },
  windowsHide: true,
});
child.on('error', () => { console.error('Could not start Wrangler. Run npm ci first.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
