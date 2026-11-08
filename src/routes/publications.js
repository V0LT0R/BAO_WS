const express = require('express');

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ORCID_ID = '0000-0001-9548-1959';
const SCOPUS_AUTHOR_ID = '57190487952';
const ORCID_PROFILE = `https://orcid.org/${ORCID_ID}`;
const SCOPUS_PROFILE = `https://www.scopus.com/authid/detail.uri?authorId=${SCOPUS_AUTHOR_ID}`;

function plainText(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function yearText(value) {
  if (typeof value !== 'string') return '';
  return /^\d{4}(?:-|$)/.test(value) ? value.slice(0, 4) : '';
}

// Read incrementally so a compromised upstream cannot allocate an unbounded body.
async function boundedJson(response) {
  const announcedSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(announcedSize) && announcedSize > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error('Publication response is too large');
  }
  if (!response.body) throw new Error('Empty publication response');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Publication response is too large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
}

function normalizeScopus(data) {
  const results = data?.['search-results'];
  if (!results || !Array.isArray(results.entry)) throw new Error('Invalid Scopus response');
  if (results.entry.some((entry) => entry && entry.error)) {
    if (String(results['opensearch:totalResults']) === '0') return [];
    throw new Error('Scopus response unavailable');
  }
  return results.entry.slice(0, 100).flatMap((entry) => {
    const title = plainText(entry?.['dc:title']);
    if (!title) return [];
    const eid = typeof entry.eid === 'string' ? entry.eid : '';
    const url = /^2-s2\.0-\d{1,30}$/.test(eid)
      ? `https://www.scopus.com/record/display.uri?eid=${encodeURIComponent(eid)}&origin=resultslist`
      : SCOPUS_PROFILE;
    return [{ title, year: yearText(entry['prism:coverDate']), url }];
  }).sort((a, b) => b.year.localeCompare(a.year));
}

function normalizeOrcid(data) {
  if (!Array.isArray(data?.group)) throw new Error('Invalid ORCID response');
  return data.group.slice(0, 500).flatMap((group) => {
    const summary = group?.['work-summary']?.[0];
    const title = plainText(summary?.title?.title?.value);
    if (!title) return [];
    const identifiers = summary?.['external-ids']?.['external-id'];
    const doi = Array.isArray(identifiers)
      ? identifiers.find((id) => id?.['external-id-type'] === 'doi')?.['external-id-value']
      : null;
    // Never copy an arbitrary provider URL; construct a DOI URL or use the profile.
    const url = typeof doi === 'string' && /^10\.\d{4,9}\/[^\s\u0000-\u001f]{1,500}$/i.test(doi)
      ? `https://doi.org/${doi.split('/').map(encodeURIComponent).join('/')}`
      : ORCID_PROFILE;
    return [{ title, year: yearText(summary?.['publication-date']?.year?.value), url }];
  }).sort((a, b) => b.year.localeCompare(a.year));
}

function createCachedProvider({ url, profileUrl, headers, normalize, enabled = true, fetchImpl }) {
  let cached;
  let expiresAt = 0;
  let inFlight;
  const unavailable = () => ({ available: false, items: [], profileUrl });
  return async function getPublications() {
    if (!enabled) return unavailable();
    if (cached && Date.now() < expiresAt) return cached;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const response = await fetchImpl(url, {
          headers: { Accept: 'application/json', ...headers },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          redirect: 'error',
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error('Publication provider unavailable');
        }
        cached = { available: true, items: normalize(await boundedJson(response)), profileUrl };
      } catch {
        // Do not relay upstream errors: they can contain API keys or request details.
        cached = unavailable();
      }
      expiresAt = Date.now() + CACHE_TTL_MS;
      return cached;
    })();
    try {
      return await inFlight;
    } finally {
      inFlight = undefined;
    }
  };
}

function createPublicationsRouter({ scopusApiKey = '', fetchImpl = globalThis.fetch } = {}) {
  const router = express.Router();
  const providers = {
    orcid: createCachedProvider({
      url: `https://pub.orcid.org/v3.0/${ORCID_ID}/works`,
      profileUrl: ORCID_PROFILE,
      normalize: normalizeOrcid,
      fetchImpl,
    }),
    scopus: createCachedProvider({
      url: `https://api.elsevier.com/content/search/scopus?query=AU-ID(${SCOPUS_AUTHOR_ID})&count=100&sort=-coverDate`,
      profileUrl: SCOPUS_PROFILE,
      headers: { 'X-ELS-APIKey': scopusApiKey },
      normalize: normalizeScopus,
      enabled: typeof scopusApiKey === 'string' && scopusApiKey.length > 0,
      fetchImpl,
    }),
  };
  for (const [name, getPublications] of Object.entries(providers)) {
    router.get(`/${name}`, async (_req, res) => {
      const result = await getPublications();
      res.set('Cache-Control', 'public, max-age=300');
      res.json(result);
    });
  }
  return router;
}

module.exports = { createPublicationsRouter };
