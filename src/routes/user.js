'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { HttpError, asyncRoute, objectBody, username, password, validId, safeUser } = require('../http');
const { csrfToken, signInSession, saveSession, destroySession } = require('../security');
// A valid hash ensures unknown usernames still incur a password comparison.
const dummyHash = '$2b$12$0FxM0WqxtDucvTAYhYgNCOiMx4Qm0r1fnSAUsfYXkyNrhNCGEc2Se';

function createUserRouter({ User, requireUser, requireAdmin, loginLimiter, cookieName, production }) {
  const router = express.Router();
  router.get('/session', asyncRoute(async (req, res) => {
    if (!req.session.csrfToken) { req.session.csrfToken = csrfToken(); await saveSession(req); }
    res.json({ user: req.user ? safeUser(req.user) : null, csrfToken: req.session.csrfToken });
  }));
  router.post('/login', loginLimiter, asyncRoute(async (req, res) => {
    const body = objectBody(req.body, ['username', 'password']);
    // Historical accounts may use characters no longer allowed for new usernames.
    if (typeof body.username !== 'string' || body.username.length < 1 || body.username.length > 256 || /[\u0000-\u001f]/u.test(body.username)) throw new HttpError(400, 'Invalid username.');
    const name = body.username;
    const secret = password(body.password, 'password', false);
    const user = await User.findOne({ username: name }).select('+password +authVersion');
    const valid = await bcrypt.compare(secret, user?.password || dummyHash);
    if (!user || !valid) throw new HttpError(401, 'Invalid username or password.');
    await signInSession(req, user);
    res.json({ user: safeUser(user), csrfToken: req.session.csrfToken });
  }));
  router.post('/logout', asyncRoute(async (req, res) => {
    await destroySession(req);
    res.clearCookie(cookieName, { path: '/', httpOnly: true, secure: production, sameSite: 'lax' });
    res.json({ user: null, csrfToken: null });
  }));
  router.post('/register', requireAdmin, asyncRoute(async (req, res) => {
    const body = objectBody(req.body, ['username', 'password', 'role']);
    const name = username(body.username);
    const secret = password(body.password);
    const role = body.role === undefined ? 'user' : body.role;
    if (!['admin', 'user'].includes(role)) throw new HttpError(400, 'Invalid account role.');
    if (await User.exists({ username: name })) throw new HttpError(409, 'This username is already taken.');
    const user = await User.create({ username: name, password: await bcrypt.hash(secret, 12), role });
    res.status(201).json({ user: safeUser(user) });
  }));
  router.get('/users', requireAdmin, asyncRoute(async (req, res) => {
    const users = await User.find().select('_id username role').sort({ username: 1 }).limit(1000);
    res.json(users.map(safeUser));
  }));
  router.get('/:id', requireUser, validId, asyncRoute(async (req, res) => {
    if (req.user.role !== 'admin' && String(req.user._id) !== req.params.id) throw new HttpError(403, 'You can only view your own account.');
    const user = await User.findById(req.params.id).select('_id username role');
    if (!user) throw new HttpError(404, 'Account not found.');
    res.json(safeUser(user));
  }));
  router.put('/:id', requireUser, validId, loginLimiter, asyncRoute(async (req, res) => {
    if (String(req.user._id) !== req.params.id) throw new HttpError(403, 'You can only change your own account credentials.');
    const body = objectBody(req.body, ['currentPassword', 'newPassword', 'username']);
    const currentPassword = password(body.currentPassword, 'currentPassword', false);
    if (body.username === undefined && body.newPassword === undefined) throw new HttpError(400, 'Provide a username or a new password.');
    // Password changes must not force legacy usernames through new-name validation.
    const name = body.username === undefined || body.username === req.user.username ? undefined : username(body.username);
    const newPassword = body.newPassword === undefined ? undefined : password(body.newPassword, 'newPassword');
    const user = await User.findById(req.params.id).select('+password +authVersion');
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) throw new HttpError(401, 'Current password is incorrect.');
    if (name !== undefined && name !== user.username && await User.exists({ username: name })) throw new HttpError(409, 'This username is already taken.');
    const update = {};
    if (name !== undefined) update.username = name;
    if (newPassword !== undefined) update.password = await bcrypt.hash(newPassword, 12);
    // Version comparison prevents concurrent credential changes reusing stale authentication.
    const previousVersion = user.authVersion || 0;
    const versionFilter = previousVersion === 0 ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] } : { authVersion: previousVersion };
    const updated = await User.findOneAndUpdate({ _id: user._id, password: user.password, ...versionFilter }, { $set: update, $inc: { authVersion: 1 } }, { returnDocument: 'after', runValidators: true }).select('+authVersion');
    if (!updated) throw new HttpError(409, 'Account changed. Sign in again and retry.');
    await signInSession(req, updated);
    res.json({ user: safeUser(updated), csrfToken: req.session.csrfToken });
  }));
  router.delete('/:id', requireAdmin, validId, asyncRoute(async (req, res) => {
    if (String(req.user._id) === req.params.id) throw new HttpError(409, 'You cannot delete your own account.');
    // Excluding administrator deletion also protects against simultaneous last-admin requests.
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'Account not found.');
    if (user.role === 'admin') throw new HttpError(409, 'Administrator accounts cannot be deleted through this API.');
    const deleted = await User.findOneAndDelete({ _id: user._id, role: { $ne: 'admin' } });
    if (!deleted) throw new HttpError(409, 'Account changed. Refresh and try again.');
    res.json({ message: 'Account deleted.' });
  }));
  return router;
}
module.exports = { createUserRouter };
