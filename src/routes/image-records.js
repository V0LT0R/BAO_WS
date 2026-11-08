'use strict';
const express = require('express');
const multer = require('multer');
const { HttpError, asyncRoute, validId } = require('../http');
const { readFields } = require('./records');
const { MAX_IMAGE_BYTES, sanitizeImage, safeFilename } = require('../images');

function createImageRecordsRouter({ Model, requireAdmin, uploadLimiter, imageReadLimiter, imageStore, logger, fields, bucket, apiPath, imageRequired }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: Object.keys(fields).length, fieldSize: 80000, parts: Object.keys(fields).length + 1 },
    fileFilter(req, file, callback) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new HttpError(415, 'Use a JPEG, PNG or WebP image.'));
      callback(null, true);
    }
  }).single('image');
  const cleanOldImage = async url => {
    const prefix = `${apiPath}/image/`;
    if (!url?.startsWith(prefix)) return;
    let filename;
    try { filename = decodeURIComponent(url.slice(prefix.length)); } catch { return; }
    try {
      if (!safeFilename(filename) || await Model.exists({ imageUrl: url })) return;
      await imageStore.removeOwned(bucket, filename);
    } catch { logger.warn('Image cleanup deferred.'); }
  };
  const rollbackImage = async image => {
    if (!image) return;
    try { await imageStore.removeNew(bucket, image.id); } catch { logger.warn('New image cleanup deferred.'); }
  };
  router.get('/', asyncRoute(async (req, res) => res.json(await Model.find().sort({ createdAt: -1 }).limit(1000).lean())));
  router.get('/image/:filename', imageReadLimiter, asyncRoute(async (req, res) => {
    if (!safeFilename(req.params.filename)) throw new HttpError(400, 'Invalid image name.');
    const buffer = await imageStore.read(bucket, req.params.filename);
    res.set({ 'Content-Type': 'image/webp', 'Content-Disposition': 'inline; filename="image.webp"', 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; sandbox", 'X-Content-Type-Options': 'nosniff' });
    res.send(buffer);
  }));
  router.get('/:id', validId, asyncRoute(async (req, res) => {
    const item = await Model.findById(req.params.id).lean();
    if (!item) throw new HttpError(404, 'Record not found.');
    res.json(item);
  }));
  router.post('/', requireAdmin, uploadLimiter, upload, asyncRoute(async (req, res) => {
    const data = readFields(req.body, fields);
    if (imageRequired && !req.file) throw new HttpError(400, 'An image is required.');
    let image;
    let committed = false;
    try {
      if (req.file) image = await imageStore.put(bucket, await sanitizeImage(req.file.buffer));
      const item = await Model.create({ ...data, imageUrl: image ? `${apiPath}/image/${image.filename}` : null });
      committed = true;
      res.status(201).json(item);
    } catch (error) { if (!committed) await rollbackImage(image); throw error; }
  }));
  router.put('/:id', requireAdmin, validId, uploadLimiter, upload, asyncRoute(async (req, res) => {
    const data = Object.keys(req.body || {}).length ? readFields(req.body, fields, true) : {};
    if (!Object.keys(data).length && !req.file) throw new HttpError(400, 'Provide a field or image to update.');
    const previous = await Model.findById(req.params.id).lean();
    if (!previous) throw new HttpError(404, 'Record not found.');
    let image;
    let committed = false;
    try {
      if (req.file) { image = await imageStore.put(bucket, await sanitizeImage(req.file.buffer)); data.imageUrl = `${apiPath}/image/${image.filename}`; }
      // Match the previous image to avoid overwriting a concurrent replacement.
      const item = await Model.findOneAndUpdate({ _id: previous._id, imageUrl: previous.imageUrl || null }, { $set: data }, { returnDocument: 'after', runValidators: true });
      if (!item) throw new HttpError(409, 'Record changed. Refresh and try again.');
      committed = true;
      if (image) await cleanOldImage(previous.imageUrl);
      res.json(item);
    } catch (error) { if (!committed) await rollbackImage(image); throw error; }
  }));
  router.delete('/:id', requireAdmin, validId, asyncRoute(async (req, res) => {
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) throw new HttpError(404, 'Record not found.');
    await cleanOldImage(item.imageUrl);
    res.json({ message: 'Record deleted.' });
  }));
  return router;
}
module.exports = { createImageRecordsRouter };
