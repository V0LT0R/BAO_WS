'use strict';
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { HttpError, asyncRoute } = require('./http');
const csrfToken = () => randomBytes(32).toString('hex');
const saveSession = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
const regenerateSession = req => new Promise((resolve, reject) => req.sessionStore.regenerate(req, error => error ? reject(error) : resolve()));
const destroySession = req => new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
function csrfProtection(publicOrigin) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('Sec-Fetch-Site') === 'cross-site' || (req.get('Origin') && req.get('Origin') !== publicOrigin)) return next(new HttpError(403, 'This request must come from this website.'));
    const expected = req.session?.csrfToken;
    const supplied = req.get('X-CSRF-Token');
    if (typeof expected !== 'string' || typeof supplied !== 'string' || !/^[a-f\d]{64}$/.test(supplied) || expected.length !== supplied.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return next(new HttpError(403, 'Refresh the page and try again.'));
    next();
  };
}
function authentication(User) {
  const loadUser = asyncRoute(async (req, res, next) => {
    req.user = null;
    if (req.session?.userId) {
      const user = await User.findById(req.session.userId).select('+authVersion');
      if (user && (user.authVersion || 0) === req.session.authVersion) req.user = user;
      else await regenerateSession(req);
    }
    next();
  });
  const requireUser = (req, res, next) => req.user ? next() : next(new HttpError(401, 'Sign in to continue.'));
  const requireAdmin = (req, res, next) => !req.user ? next(new HttpError(401, 'Sign in to continue.')) : req.user.role !== 'admin' ? next(new HttpError(403, 'Administrator access is required.')) : next();
  return { loadUser, requireUser, requireAdmin };
}
async function signInSession(req, user) {
  await regenerateSession(req);
  req.session.userId = String(user._id);
  req.session.authVersion = user.authVersion || 0;
  req.session.csrfToken = csrfToken();
  await saveSession(req);
}
module.exports = { csrfToken, csrfProtection, authentication, signInSession, saveSession, regenerateSession, destroySession };
