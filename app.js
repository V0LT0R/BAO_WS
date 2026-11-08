'use strict';
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const fs = require('node:fs');
const path = require('node:path');
const { HttpError } = require('./src/http');
const { authentication, csrfProtection } = require('./src/security');
const { createUserRouter } = require('./src/routes/user');
const { createExperienceRouter } = require('./src/routes/experience');
const { createActivityRouter } = require('./src/routes/activity');
const { createProjectRouter } = require('./src/routes/project');
const { createCertificateRouter } = require('./src/routes/certificate');
const { createPublicationsRouter } = require('./src/routes/publications');

function defaultModels() {
  return { User: require('./src/models/Authorization'), Experience: require('./src/models/Experince'), Activity: require('./src/models/Activity'), Project: require('./src/models/Project'), Certificate: require('./src/models/Certificate') };
}

function createApp({ config, models = defaultModels(), imageStore, sessionStore, logger = console, rateLimits = {} }) {
  if (!config?.sessionSecret || !sessionStore || !imageStore) throw new Error('createApp requires validated config, sessionStore and imageStore.');
  const app = express();
  const cookieName = config.production ? '__Host-bao.sid' : 'bao.sid';
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"], fontSrc: ["'self'"], objectSrc: ["'none'"],
      baseUri: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"],
      upgradeInsecureRequests: config.production ? [] : null
    } },
    strictTransportSecurity: config.production ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' }
  }));
  app.use((req, res, next) => { res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'); next(); });
  const limiter = (windowMs, limit, message) => rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res) => res.status(429).json({ message }) });
  const globalLimiter = limiter(60000, rateLimits.global || 300, 'Too many requests. Please wait a minute.');
  const loginLimiter = limiter(15 * 60000, rateLimits.login || 10, 'Too many sign-in attempts. Please try again later.');
  const uploadLimiter = limiter(15 * 60000, rateLimits.upload || 30, 'Too many uploads. Please try again later.');
  const imageReadLimiter = limiter(60000, rateLimits.images || 120, 'Too many image requests. Please wait a minute.');
  app.use('/api', (req, res, next) => {
    const sendJson = res.json;
    res.json = function apiJson(body) {
      this.set('X-Robots-Tag', 'noindex');
      return sendJson.call(this, body);
    };
    next();
  });
  app.use('/api', globalLimiter);
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api', session({
    name: cookieName, secret: config.sessionSecret, store: sessionStore,
    resave: false, saveUninitialized: false, rolling: false,
    cookie: { path: '/', httpOnly: true, secure: config.production, sameSite: 'lax', maxAge: 60 * 60 * 1000 }
  }));
  app.use('/api', express.json({ limit: '100kb', strict: true, type: 'application/json' }));
  const auth = authentication(models.User);
  app.use('/api', auth.loadUser, csrfProtection(config.publicOrigin));
  app.use('/api/user', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, createUserRouter({ User: models.User, ...auth, loginLimiter, cookieName, production: config.production }));
  app.use('/api/experience', createExperienceRouter({ Model: models.Experience, ...auth }));
  app.use('/api/activities', createActivityRouter({ Model: models.Activity, ...auth }));
  const imageOptions = { ...auth, imageStore, uploadLimiter, imageReadLimiter, logger };
  app.use('/api/projects', createProjectRouter({ ...imageOptions, Model: models.Project }));
  app.use('/api/certificates', createCertificateRouter({ ...imageOptions, Model: models.Certificate }));
  app.use('/api/publications', createPublicationsRouter({ scopusApiKey: config.scopusApiKey }));
  app.use('/api', (req, res, next) => next(new HttpError(404, 'API endpoint not found.')));

  const publicDir = path.join(__dirname, 'public');
  // Serve trusted source assets selectively. Legacy executable HTML and JavaScript,
  // configuration and arbitrary uploaded files never form a fallback.
  for (const relative of ['assets/images', 'assets/fonts', 'assets/sound', 'assets/css', 'bootstrap_css/css']) {
    app.use(`/${relative}`, express.static(path.join(publicDir, relative), { dotfiles: 'deny', index: false, fallthrough: true, maxAge: '1d' }));
  }
  const distDir = config.distDir || path.join(__dirname, 'dist');
  app.use('/build-assets', express.static(path.join(distDir, 'build-assets'), { dotfiles: 'deny', index: false, immutable: true, maxAge: '1y' }));
  for (const file of ['robots.txt', 'sitemap.xml']) {
    app.get(`/${file}`, (req, res, next) => res.sendFile(path.join(distDir, file), error => error && next(error)));
  }
  app.get('/google0e7611ae15e01a69.html', (req, res, next) => res.sendFile(path.join(publicDir, 'google0e7611ae15e01a69.html'), error => error && next(error)));
  const publicPages = ['index', 'experience', 'activity', 'projects', 'certificates', 'publications', 'FAQs'];
  const privatePages = ['login', 'admin', 'user'];
  const pageRoutes = [
    ...[...publicPages, ...privatePages].map(page => ({ page, prefix: '', private: privatePages.includes(page) })),
    ...['uk', 'ru'].flatMap(language => publicPages.map(page => ({ page, prefix: `/${language}`, private: false }))),
  ];
  for (const { page, prefix, private: privatePage } of pageRoutes) {
    const routes = [`${prefix}/${page}.html`, `${prefix}/${page}`];
    if (page === 'index') routes.push(prefix || '/', ...(prefix ? [`${prefix}/`] : []));
    app.get(routes, (req, res, next) => {
      const filename = path.join(distDir, prefix.slice(1), `${page}.html`);
      if (!fs.existsSync(filename)) return next(new HttpError(503, 'The website build is missing. Run npm run build before starting the server.'));
      res.set('Cache-Control', privatePage ? 'private, no-store' : 'no-cache');
      if (privatePage) res.set('X-Robots-Tag', 'noindex, nofollow');
      res.sendFile(filename, error => error && next(error));
    });
  }
  app.use((req, res, next) => next(new HttpError(404, 'Page not found.')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = 500;
    let message = 'The request could not be completed. Please try again.';
    if (error instanceof HttpError) { status = error.status; message = error.message; }
    else if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'The request is too large. Images must be no larger than 5 MB.'; }
    else if (error.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON request.'; }
    else if (error.name === 'MulterError') { status = 400; message = 'Unexpected upload fields or too many files.'; }
    else if (error.code === 11000) { status = 409; message = 'This value is already in use.'; }
    else if (['ValidationError', 'StrictModeError', 'CastError'].includes(error.name)) { status = 400; message = 'One or more fields are invalid.'; }
    else if (error.status === 404) { status = 404; message = 'File not found.'; }
    if (status === 500) logger.error('Request failed.', { name: error.name || 'Error' });
    res.status(status).json({ message });
  });
  return app;
}
module.exports = { createApp, defaultModels };
