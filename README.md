# BAO — academic profile

React 19 + Vite academic website with two supported runtime targets: the owner's Cloudflare Workers account (D1, KV and SQLite Durable Objects), and the original Express 5 / MongoDB runtime retained for local work and migration. The existing `.html` URLs, assets, Bootstrap styling, English/Ukrainian content and light/dark themes are retained.

**Cloudflare deployment:** follow the [Russian migration and deployment guide](docs/CLOUDFLARE.md) for account setup, local checks, existing content/admin migration, the first `workers.dev` deployment, GitHub builds and the final `bao-cv.com` DNS switch. Start with `npm run build:cloudflare`. The steps below describe the retained Node.js/MongoDB runtime unless stated otherwise.

## Local setup

Use Node.js 24.15 or a newer 24.x release. Install with `npm ci`, copy `.env.example` to `.env` only when creating a new configuration, then set a local MongoDB URI and a fresh random `SESSION_SECRET` (at least 32 bytes). Existing `.env` files are not migrated or overwritten automatically. The old `JWT_SECRET` is no longer used.

```sh
npm run build
npm start
```

Open `http://localhost:5000`. The backend serves the built React pages and existing static assets. A missing build or invalid configuration prevents startup with a clear error. It connects to MongoDB once, before accepting requests.

To develop the frontend with hot reload, run `npm run dev:server` and `npm run dev` in separate terminals. Use `PUBLIC_ORIGIN=http://localhost:5173` and open that exact origin; Vite proxies `/api` and the retained assets to port 5000. Build/start mode uses `PUBLIC_ORIGIN=http://localhost:5000`.

If MongoDB Atlas SRV lookup fails on a local network, `DNS_SERVERS=1.1.1.1,8.8.8.8` overrides DNS only for this Node process. It does not change system settings.

## Isolated preview and tests

```sh
npm run build
npm run preview:isolated
npm test
npm run test:client
npm audit
```

The isolated preview does **not** load `.env`. It creates a disposable loopback MongoDB and a random `preview-admin` account; temporary credentials are printed in its terminal. All preview data disappears when the process stops. `BAO_PREVIEW_CONTENT_FILE` may point to a local JSON file containing public experience/activity/project text; users and remote uploaded images are never imported. This is a preview, not a persistent editing environment.

The server tests also use a separate disposable MongoDB, including real GridFS operations. They cover authorization, CSRF, session rotation/revocation, account isolation, validation, injection attempts, upload checks, rollback, rate limiting and legacy compatibility. Client tests cover safe rendering, forms, language/theme state, navigation and FAQ behavior. The first isolated run may download the official MongoDB test binary. No test loads the deployed database configuration.

`npm run check` runs backend tests, frontend tests and the production build. React prerendering includes public static content and metadata; database-backed lists load through the API after hydration. Builds do not connect to MongoDB or embed environment secrets.

## Admin access and content

Existing bcrypt password hashes and administrator roles remain compatible. Old JWT sessions are intentionally invalidated; sign in again at `/login.html`.

Only administrators can add, edit or delete experience, activities, projects and certificates or create accounts. A regular user can view/change only their own credentials. Public registration is disabled. The server determines the role from the account record, never from browser storage.

Projects support optional images. Certificates require an image on creation; editing without a new file retains the old one. Uploads accept JPEG, PNG or WebP up to 5 MB. Files are decoded, checked for size/pixel limits, stripped of metadata and re-encoded as WebP with random filenames. Original GridFS bucket names and old image URLs are supported; unsafe old file contents are not served. Removing/replacing an image cleans up only files created by this version, so old shared media are not automatically deleted.

Changing account credentials requires the current password and invalidates other sessions. Administrator accounts cannot be deleted through the UI/API; this prevents accidental lockout and concurrent last-administrator deletion. Deliberate administrator deprovisioning remains an operator task.

Bootstrap a new administrator only in an explicitly selected database:

```sh
npm run admin:create -- --confirm-database bao_local
```

The CLI asks for the username and a hidden password; no default credentials are embedded. It refuses existing usernames. A remote database additionally requires `--allow-remote`. Do not run this command against production as a test.

## Deploying the retained Node.js runtime to the existing service

This repository does not publish itself or modify the GitHub repository. Before a deliberate deployment, back up the MongoDB database and GridFS and verify restore access. Preserve the existing database name, collections and media. No destructive data migration is required.

For Render or a similar single reverse-proxy deployment:

- Build command: `npm ci && npm run build` (include development dependencies in the build stage).
- Start command: `npm start`.
- Node: 24.x, at least 24.15.
- `NODE_ENV=production`, `HOST=0.0.0.0`, the platform's assigned `PORT`.
- `PUBLIC_ORIGIN=https://bao-cv.com`; `TRUST_PROXY=1` only behind exactly one trusted reverse proxy.
- Existing `MONGODB_URI` and a new strong `SESSION_SECRET` in the host's secret settings.
- `SITE_URL=https://bao-cv.com` for canonical build URLs.
- Health check: `/api/health`.

Production cookies use the `__Host-` prefix, `Secure`, `HttpOnly` and `SameSite=Lax`. Requests that change data require a session-bound CSRF token and pass origin checks. Frontend and API should use the same origin. Avoid broad CORS settings or wildcard proxy trust. Restrict MongoDB credentials/network access and enable backups in the hosting provider.

The server uses a persistent MongoDB session store. Request rate counters are process-local; use a shared rate-limit store before running multiple instances. Public HTML is revalidated; fingerprinted JS/CSS bundles are cached immutably. Unknown routes return 404. Private pages are marked `noindex`, and legacy source scripts, configuration and arbitrary uploads are not exposed.

## Publications and previously exposed secrets

ORCID and Scopus integrations are fixed-host server proxies with timeouts, bounded responses, caching and safe links. ORCID requires no key. Scopus is optional: set a **replacement** `SCOPUS_API_KEY` only in the server environment. Without it, the website shows a link to the author's official Scopus profile.

The old client code exposed a Scopus API key. Removing that code cannot revoke a key already published or present in Git history: the owner must revoke/rotate it in Elsevier before enabling Scopus again. The former local administrator bootstrap script also embedded credentials; it has been replaced by a safe entry point. If that password was used for a real account, change it through the account owner and review access. Do not copy either old secret into the new configuration.

## Structure

- `client/public/`: public React pages, translations and metadata.
- `client/components/`: shared navigation, footer and theme/language state.
- `client/admin/`: login, own profile and content administration.
- `client/lib/api.js`: same-origin requests and CSRF handling.
- `app.js`, `src/`: Express application, validation, authorization, data and image handling.
- `server.js`: validated configuration, connection lifecycle and startup.
- `scripts/build.mjs`: Vite build and static React prerendering.
- `scripts/build-cloudflare.mjs`, `wrangler.jsonc`, `cloudflare/`: Cloudflare static packaging, Worker API, D1 schema and Durable Objects.
- `docs/CLOUDFLARE.md`: migration and deployment instructions for the owner's Cloudflare account.
- `scripts/create-admin.js`: explicit administrator bootstrap.
- `tests/`, `client/**/*.test.*`: isolated server and client regression tests.
- `public/`: retained images, fonts, CSS and search-engine files; no legacy application scripts.

The security review addresses the issues found in source code and automated/local browser checks. It does not certify production infrastructure, historical database integrity, external account settings or the absence of every possible vulnerability. The live deployment remains unchanged until the update is explicitly deployed.

Framework references: [React hydration](https://react.dev/reference/react-dom/client/hydrateRoot), [Vite builds](https://vite.dev/guide/build), [Express security](https://expressjs.com/en/advanced/best-practice-security.html).
