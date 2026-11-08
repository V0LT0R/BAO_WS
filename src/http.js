'use strict';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
function objectBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Send an object with the expected fields.');
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new HttpError(400, 'Unexpected request fields.');
  return body;
}
function text(value, field, { min = 1, max = 20000, optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(clean)) throw new HttpError(400, `${field} must contain ${min}–${max} characters.`);
  return clean;
}
function username(value) {
  const clean = text(value, 'username', { min: 3, max: 64 });
  if (!/^[\p{L}\p{N}_.@-]+$/u.test(clean)) throw new HttpError(400, 'Username may contain letters, numbers, dots, underscores, hyphens and @.');
  return clean;
}
function password(value, field = 'password', creating = true) {
  if (typeof value !== 'string' || Array.from(value).length < (creating ? 12 : 1) || Buffer.byteLength(value, 'utf8') > 72 || (creating ? /[\u0000-\u001f\u007f]/u : /[\u0000]/u).test(value)) throw new HttpError(400, `${field} must contain ${creating ? 'at least 12 characters and at most 72 UTF-8 bytes' : '1–72 UTF-8 bytes'}.`);
  return value;
}
function validId(req, res, next) { if (!/^[a-f\d]{24}$/i.test(req.params.id)) return next(new HttpError(400, 'Invalid record ID.')); next(); }
function safeUser(user) { return { _id: String(user._id), username: user.username, role: user.role === 'admin' ? 'admin' : 'user' }; }
module.exports = { HttpError, asyncRoute, objectBody, text, username, password, validId, safeUser };
