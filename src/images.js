'use strict';
const { randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const sharp = require('sharp');
const mongoose = require('mongoose');
const { HttpError } = require('./http');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MARKER = 'bao-image-v1';
sharp.concurrency(2);
sharp.cache({ memory: 32, files: 0, items: 32 });
let processing = 0;
const waiting = [];
async function imageSlot() {
  if (processing >= 2) {
    if (waiting.length >= 8) throw new HttpError(429, 'Image processing is busy. Please try again shortly.');
    await new Promise(resolve => waiting.push(resolve));
  } else processing += 1;
}
function releaseImageSlot() {
  const next = waiting.shift();
  if (next) next();
  else processing -= 1;
}
const safeFilename = name => typeof name === 'string' && name.length > 0 && name.length <= 240 && !/[\\/\u0000-\u001f\u007f]/u.test(name) && name !== '.' && name !== '..';

async function sanitizeImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Images must be no larger than 5 MB.');
  await imageSlot();
  try {
    const options = { limitInputPixels: 20000000, failOn: 'warning', animated: false };
    const metadata = await sharp(buffer, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1) throw new HttpError(415, 'Use a single JPEG, PNG or WebP image.');
    const output = await sharp(buffer, options).rotate().webp({ quality: 88, effort: 4 }).toBuffer();
    if (output.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'The processed image is too large.');
    return output;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(415, 'The file is not a valid JPEG, PNG or WebP image.');
  } finally { releaseImageSlot(); }
}

function createImageStore(connection) {
  const bucketFor = name => {
    if (!['projectImages', 'certificateImages'].includes(name)) throw new Error('Unknown image bucket.');
    return new mongoose.mongo.GridFSBucket(connection.db, { bucketName: name });
  };
  return {
    async put(bucketName, buffer) {
      const bucket = bucketFor(bucketName);
      const filename = `${randomUUID()}.webp`;
      const stream = bucket.openUploadStream(filename, { metadata: { generatedBy: IMAGE_MARKER, contentType: 'image/webp' } });
      try { await pipeline(Readable.from(buffer), stream); }
      catch (error) { await stream.abort().catch(() => {}); throw error; }
      return { id: stream.id, filename };
    },
    async removeNew(bucketName, id) { await bucketFor(bucketName).delete(id); },
    async removeOwned(bucketName, filename) {
      if (!safeFilename(filename)) return;
      const file = await connection.db.collection(`${bucketName}.files`).findOne({ filename, 'metadata.generatedBy': IMAGE_MARKER });
      if (file) await bucketFor(bucketName).delete(file._id);
    },
    async read(bucketName, filename) {
      if (!safeFilename(filename)) throw new HttpError(400, 'Invalid image name.');
      const file = await connection.db.collection(`${bucketName}.files`).findOne({ filename });
      if (!file) throw new HttpError(404, 'Image not found.');
      if (!Number.isFinite(file.length) || file.length > MAX_IMAGE_BYTES || file.length <= 0) throw new HttpError(415, 'This stored file cannot be displayed safely.');
      const stream = bucketFor(bucketName).openDownloadStream(file._id);
      const chunks = [];
      let size = 0;
      try {
        for await (const chunk of stream) {
          size += chunk.length;
          if (size > MAX_IMAGE_BYTES) { stream.destroy(); throw new HttpError(413, 'Image is too large.'); }
          chunks.push(chunk);
        }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(404, 'Image is unavailable.');
      }
      // Legacy GridFS objects may contain arbitrary bytes. Decode and re-encode them
      // before sending anything; their historical URL and stored file stay unchanged.
      return sanitizeImage(Buffer.concat(chunks));
    }
  };
}
module.exports = { MAX_IMAGE_BYTES, safeFilename, sanitizeImage, createImageStore };
