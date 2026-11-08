const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const OWNED_MEDIA = 'bao-worker-v1';
const definitions = Object.freeze({
  experience: { fields: { year: 80, descriptionEn: 20000, descriptionUa: 20000 } },
  activities: { fields: { year: 80, descriptionEn: 20000, descriptionUa: 20000 } },
  projects: { fields: { titleEn: 500, titleUa: 500, descriptionEn: 20000, descriptionUa: 20000 }, images: true },
  certificates: { fields: { date: 80, descriptionEn: 20000, descriptionUa: 20000 }, images: true, imageRequired: true },
});

export class ContentHttpError extends Error {
  constructor(status, message) { super(message); this.name = 'ContentHttpError'; this.status = status; }
}

const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const rejectImage = () => { throw new ContentHttpError(415, 'Use a valid, non-animated JPEG, PNG or WebP image.'); };
const fourCC = (bytes, offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
const uint24 = (bytes, offset) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
const safeFilename = value => typeof value === 'string' && value.length > 0 && value.length <= 240 && value !== '.' && value !== '..' && !/[\\/\u0000-\u001f\u007f]/u.test(value);

function dimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS) throw new ContentHttpError(415, 'Image dimensions must not exceed 20 megapixels.');
  return { width, height };
}

function pngInfo(bytes, view) {
  let position = 8;
  let size;
  let imageData = 0;
  let ended = false;
  let chunks = 0;
  while (position + 12 <= bytes.length) {
    if (++chunks > 4096) rejectImage();
    const length = view.getUint32(position);
    const type = fourCC(bytes, position + 4);
    const start = position + 8;
    const next = start + length + 4;
    if (next > bytes.length || !/^[A-Za-z]{4}$/.test(type)) rejectImage();
    if (!size && type !== 'IHDR') rejectImage();
    if (type === 'IHDR') {
      if (size || position !== 8 || length !== 13) rejectImage();
      size = dimensions(view.getUint32(start), view.getUint32(start + 4));
      const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!validDepths[bytes[start + 9]]?.includes(bytes[start + 8]) || bytes[start + 10] !== 0 || bytes[start + 11] !== 0 || bytes[start + 12] > 1) rejectImage();
    } else if (['acTL', 'fcTL', 'fdAT'].includes(type)) rejectImage();
    else if (type === 'IDAT') imageData += length;
    else if (type === 'IEND') {
      if (length !== 0 || next !== bytes.length || imageData < 6) rejectImage();
      ended = true;
      break;
    } else if (type[0] === type[0].toUpperCase() && type !== 'PLTE') rejectImage();
    position = next;
  }
  if (!size || !ended) rejectImage();
  return { ...size, contentType: 'image/png', extension: 'png' };
}

function jpegInfo(bytes, view) {
  let position = 2;
  let size;
  let scan = false;
  let entropyBytes = 0;
  let segments = 0;
  let escapedMarkers = 0;
  while (position < bytes.length) {
    if (++segments > 4096) rejectImage();
    if (bytes[position] !== 0xff) rejectImage();
    while (bytes[position] === 0xff) position += 1;
    if (position >= bytes.length) rejectImage();
    const marker = bytes[position++];
    if (marker === 0xd9) {
      if (!size || !scan || !entropyBytes || position !== bytes.length) rejectImage();
      return { ...size, contentType: 'image/jpeg', extension: 'jpg' };
    }
    if ([0x00, 0xd8, 0x01].includes(marker) || (marker >= 0xd0 && marker <= 0xd7) || position + 2 > bytes.length) rejectImage();
    const length = view.getUint16(position);
    if (length < 2 || position + length > bytes.length) rejectImage();
    if ([0xc0, 0xc2].includes(marker)) {
      if (size || length < 11 || bytes[position + 2] !== 8) rejectImage();
      size = dimensions(view.getUint16(position + 5), view.getUint16(position + 3));
      const components = bytes[position + 7];
      if (![1, 3, 4].includes(components) || length !== 8 + 3 * components) rejectImage();
    } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) rejectImage();
    if (marker === 0xda) {
      if (!size || length < 8 || length !== 6 + 2 * bytes[position + 2]) rejectImage();
      scan = true;
      position += length;
      while (position < bytes.length) {
        // Native typed-array search avoids a JS loop over every compressed byte.
        const markerAt = bytes.indexOf(0xff, position);
        if (markerAt < 0) rejectImage();
        entropyBytes += markerAt - position;
        position = markerAt;
        if (bytes[position + 1] === 0x00 || (bytes[position + 1] >= 0xd0 && bytes[position + 1] <= 0xd7)) {
          if (++escapedMarkers > 65536) rejectImage();
          entropyBytes += 1; position += 2; continue;
        }
        break;
      }
    } else position += length;
  }
  rejectImage();
}

function webpInfo(bytes, view) {
  if (view.getUint32(4, true) + 8 !== bytes.length) rejectImage();
  let position = 12;
  let canvas;
  let size;
  let chunks = 0;
  while (position + 8 <= bytes.length) {
    if (++chunks > 4096) rejectImage();
    const type = fourCC(bytes, position);
    const length = view.getUint32(position + 4, true);
    const start = position + 8;
    const next = start + length + (length % 2);
    if (next > bytes.length || (length % 2 && bytes[next - 1] !== 0)) rejectImage();
    if (type === 'VP8X') {
      if (position !== 12 || canvas || length !== 10 || (bytes[start] & 0xc3) || bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) rejectImage();
      canvas = dimensions(uint24(bytes, start + 4) + 1, uint24(bytes, start + 7) + 1);
    } else if (type === 'VP8 ') {
      if (size || length < 11 || (bytes[start] & 1) || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) rejectImage();
      size = dimensions(view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff);
    } else if (type === 'VP8L') {
      if (size || length < 6 || bytes[start] !== 0x2f || (bytes[start + 4] & 0xe0)) rejectImage();
      const packed = view.getUint32(start + 1, true);
      size = dimensions((packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1);
    } else if (!['ALPH', 'ICCP', 'EXIF', 'XMP '].includes(type)) rejectImage();
    position = next;
  }
  if (!size || position !== bytes.length || (canvas && (canvas.width !== size.width || canvas.height !== size.height))) rejectImage();
  return { ...size, contentType: 'image/webp', extension: 'webp' };
}

/** Structural raster validation, not a pixel decoder. No SVG/HTML is accepted;
 * all served bytes retain a fixed raster MIME type, nosniff and sandbox CSP. */
export function inspectRaster(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new ContentHttpError(413, 'Images must be no larger than 5 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 33 && bytes[0] === 0x89 && fourCC(bytes, 1) === 'PNG\r' && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return pngInfo(bytes, view);
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegInfo(bytes, view);
  if (bytes.length >= 20 && fourCC(bytes, 0) === 'RIFF' && fourCC(bytes, 8) === 'WEBP') return webpInfo(bytes, view);
  rejectImage();
}

async function readBounded(request, limit) {
  const advertised = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(advertised) && advertised > limit) throw new ContentHttpError(413, 'The request is too large.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ContentHttpError(413, 'The request is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

async function parseBody(request, definition) {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.toLowerCase().startsWith('multipart/form-data;')) {
    if (!definition.images) throw new ContentHttpError(415, 'Send JSON for this content type.');
    const bytes = await readBounded(request, MAX_IMAGE_BYTES + 200 * 1024);
    let form;
    try { form = await new Request('https://body.invalid/', { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes }).formData(); }
    catch { throw new ContentHttpError(400, 'Invalid upload form.'); }
    const body = Object.create(null);
    let file;
    for (const [key, value] of form.entries()) {
      if (Object.hasOwn(body, key) || (key === 'image' && file)) throw new ContentHttpError(400, 'Duplicate request fields are not allowed.');
      if (key === 'image') {
        if (!(value instanceof Blob) || value.size === 0) throw new ContentHttpError(400, 'Choose one image file.');
        if (value.size > MAX_IMAGE_BYTES) throw new ContentHttpError(413, 'Images must be no larger than 5 MB.');
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(value.type)) rejectImage();
        const bytes = new Uint8Array(await value.arrayBuffer());
        const info = inspectRaster(bytes);
        if (info.contentType !== value.type) rejectImage();
        file = { bytes, ...info };
      } else {
        if (typeof value !== 'string') throw new ContentHttpError(400, 'Unexpected uploaded file.');
        body[key] = value;
      }
    }
    return { body, file };
  }
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) throw new ContentHttpError(415, 'Send JSON or a supported image upload form.');
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(request, 100 * 1024))); }
  catch (error) { if (error instanceof ContentHttpError) throw error; throw new ContentHttpError(400, 'Invalid JSON request.'); }
  return { body };
}

function readFields(body, definition, partial) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ContentHttpError(400, 'Send an object with the expected fields.');
  const allowed = Object.keys(definition.fields);
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new ContentHttpError(400, 'Unexpected request fields.');
  const data = {};
  for (const [key, maximum] of Object.entries(definition.fields)) {
    if (body[key] === undefined && partial) continue;
    if (typeof body[key] !== 'string') throw new ContentHttpError(400, `${key} must be text.`);
    const value = body[key].trim();
    if (!value || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new ContentHttpError(400, `${key} must contain 1–${maximum} characters.`);
    data[key] = value;
  }
  return data;
}

function serialize(row) {
  return { ...JSON.parse(row.payload), _id: row.id, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() };
}

async function putImage(env, kind, id, file) {
  if (!env.MEDIA) throw new ContentHttpError(503, 'Image storage is not configured.');
  const filename = `${crypto.randomUUID()}.${file.extension}`;
  const key = `${kind}/${filename}`;
  // A new cryptographically random immutable key is allocated for every upload.
  // Neither a client filename nor an old image URL can select the destination.
  await env.MEDIA.put(key, file.bytes, { metadata: { contentType: file.contentType, width: file.width, height: file.height, ownerRecordId: id, owned: OWNED_MEDIA } });
  return { key, url: `/api/${kind}/image/${filename}` };
}

async function rollbackImage(env, image) {
  if (!image) return;
  try {
    // A database response can fail after committing. Verify that the new key is
    // unreferenced, and retain it if that verification itself is unavailable.
    const linked = await env.DB.prepare("SELECT id FROM content WHERE json_extract(payload, '$.imageUrl') = ? LIMIT 1").bind(image.url).first();
    if (!linked) await env.MEDIA.delete(image.key);
  } catch { /* An unreferenced immutable object is safe to retain for later cleanup. */ }
}

async function cleanOldImage(env, kind, id, url) {
  const prefix = `/api/${kind}/image/`;
  if (!env.MEDIA || typeof url !== 'string' || !url.startsWith(prefix)) return;
  let filename;
  try { filename = decodeURIComponent(url.slice(prefix.length)); } catch { return; }
  if (!safeFilename(filename)) return;
  try {
    const linked = await env.DB.prepare("SELECT id FROM content WHERE json_extract(payload, '$.imageUrl') = ? LIMIT 1").bind(url).first();
    if (linked) return;
    const key = `${kind}/${filename}`;
    const stored = await env.MEDIA.getWithMetadata(key, { type: 'arrayBuffer' });
    if (stored.metadata?.owned !== OWNED_MEDIA || stored.metadata?.ownerRecordId !== id) return;
    await env.MEDIA.delete(key);
  } catch { /* Cleanup is best-effort and must never roll back a committed record. */ }
}

async function serveImage(request, env, kind, rawName) {
  let filename;
  try { filename = decodeURIComponent(rawName); } catch { throw new ContentHttpError(400, 'Invalid image name.'); }
  if (!safeFilename(filename)) throw new ContentHttpError(400, 'Invalid image name.');
  if (!env.MEDIA) throw new ContentHttpError(503, 'Image storage is not configured.');
  const stored = await env.MEDIA.getWithMetadata(`${kind}/${filename}`, { type: 'arrayBuffer' });
  if (!stored.value) throw new ContentHttpError(404, 'Image not found. It may take a short time for a new upload to propagate.');
  const info = inspectRaster(stored.value);
  return new Response(request.method === 'HEAD' ? null : stored.value, { headers: {
    'Content-Type': info.contentType, 'Content-Length': String(stored.value.byteLength),
    'Content-Disposition': `inline; filename="image.${info.extension}"`, 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'public, max-age=3600',
    'Cross-Origin-Resource-Policy': 'same-origin',
  } });
}

/** Returns null outside content routes. Authentication and CSRF are supplied by
 * the Worker router; this handler independently requires admin for every write. */
export async function handleContent(request, env, ctx, { user = null } = {}) {
  const match = /^\/api\/(experience|activities|projects|certificates)(?:\/(.*))?\/?$/.exec(new URL(request.url).pathname);
  if (!match) return null;
  const kind = match[1];
  const definition = definitions[kind];
  const rawSuffix = (match[2] || '').replace(/\/$/, '');
  const suffix = /^[a-f\d]{24}$/i.test(rawSuffix) ? rawSuffix.toLowerCase() : rawSuffix;
  const reading = ['GET', 'HEAD'].includes(request.method);
  if (!reading) {
    if (!['POST', 'PUT', 'DELETE'].includes(request.method)) return json({ message: 'Method not allowed.' }, 405);
    if (!user) throw new ContentHttpError(401, 'Sign in to continue.');
    if (user.role !== 'admin') throw new ContentHttpError(403, 'Administrator access is required.');
  }
  if (definition.images && suffix.startsWith('image/')) {
    if (!reading) return json({ message: 'Method not allowed.' }, 405);
    return serveImage(request, env, kind, suffix.slice(6));
  }
  if (suffix && !/^[a-f\d]{24}$/i.test(suffix)) throw new ContentHttpError(400, 'Invalid record ID.');
  if (!env.DB) throw new ContentHttpError(503, 'Content storage is not configured.');
  if (reading) {
    if (!suffix) {
      const order = ['experience', 'activities'].includes(kind) ? "json_extract(payload, '$.year') DESC, id DESC" : 'created_at DESC, id DESC';
      const { results } = await env.DB.prepare(`SELECT id, payload, created_at, updated_at, version FROM content WHERE kind = ? ORDER BY ${order} LIMIT 1000`).bind(kind).all();
      const response = json(results.map(serialize));
      return request.method === 'HEAD' ? new Response(null, response) : response;
    }
    const row = await env.DB.prepare('SELECT id, payload, created_at, updated_at, version FROM content WHERE id = ? AND kind = ?').bind(suffix, kind).first();
    if (!row) throw new ContentHttpError(404, 'Record not found.');
    const response = json(serialize(row));
    return request.method === 'HEAD' ? new Response(null, response) : response;
  }
  if (request.method === 'POST' && suffix || request.method !== 'POST' && !suffix) return json({ message: 'Method not allowed.' }, 405);
  if (request.method === 'POST') {
    const { body, file } = await parseBody(request, definition);
    const data = readFields(body, definition, false);
    if (definition.imageRequired && !file) throw new ContentHttpError(400, 'An image is required.');
    const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('');
    const timestamp = Date.now();
    let image;
    let committed = false;
    try {
      if (file) image = await putImage(env, kind, id, file);
      if (definition.images) data.imageUrl = image?.url || null;
      await env.DB.prepare('INSERT INTO content (id, kind, payload, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, 1)').bind(id, kind, JSON.stringify(data), timestamp, timestamp).run();
      committed = true;
      return json(serialize({ id, payload: JSON.stringify(data), created_at: timestamp, updated_at: timestamp }), 201);
    } catch (error) { if (!committed) await rollbackImage(env, image); throw error; }
  }
  const previous = await env.DB.prepare('SELECT id, payload, created_at, updated_at, version FROM content WHERE id = ? AND kind = ?').bind(suffix, kind).first();
  if (!previous) throw new ContentHttpError(404, 'Record not found.');
  const previousData = JSON.parse(previous.payload);
  if (request.method === 'DELETE') {
    const deleted = await env.DB.prepare('DELETE FROM content WHERE id = ? AND kind = ? AND version = ? RETURNING id').bind(suffix, kind, previous.version).first();
    if (!deleted) throw new ContentHttpError(409, 'Record changed. Refresh and try again.');
    await cleanOldImage(env, kind, suffix, previousData.imageUrl);
    return json({ message: 'Record deleted.' });
  }
  const { body, file } = await parseBody(request, definition);
  const patch = readFields(body, definition, true);
  if (!Object.keys(patch).length && !file) throw new ContentHttpError(400, 'Provide a field or image to update.');
  let image;
  let committed = false;
  try {
    if (file) image = await putImage(env, kind, suffix, file);
    const data = { ...previousData, ...patch, ...(image ? { imageUrl: image.url } : {}) };
    const updated = await env.DB.prepare('UPDATE content SET payload = ?, updated_at = ?, version = version + 1 WHERE id = ? AND kind = ? AND version = ? RETURNING id, payload, created_at, updated_at, version').bind(JSON.stringify(data), Date.now(), suffix, kind, previous.version).first();
    if (!updated) throw new ContentHttpError(409, 'Record changed. Refresh and try again.');
    committed = true;
    if (image) await cleanOldImage(env, kind, suffix, previousData.imageUrl);
    return json(serialize(updated));
  } catch (error) { if (!committed) await rollbackImage(env, image); throw error; }
}

export { MAX_IMAGE_BYTES };
