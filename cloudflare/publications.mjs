const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ORCID_ID = '0000-0001-9548-1959';
const SCOPUS_AUTHOR_ID = '57190487952';
const ORCID_PROFILE = `https://orcid.org/${ORCID_ID}`;
const SCOPUS_PROFILE = `https://www.scopus.com/authid/detail.uri?authorId=${SCOPUS_AUTHOR_ID}`;

const PROVIDERS = {
  orcid: {
    url: `https://pub.orcid.org/v3.0/${ORCID_ID}/works`,
    profileUrl: ORCID_PROFILE,
    normalize: normalizeOrcid,
  },
  scopus: {
    url: `https://api.elsevier.com/content/search/scopus?query=AU-ID(${SCOPUS_AUTHOR_ID})&count=100&sort=-coverDate`,
    profileUrl: SCOPUS_PROFILE,
    normalize: normalizeScopus,
  },
};

function plainText(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function yearText(value) {
  return typeof value === 'string' && /^\d{4}(?:-|$)/.test(value) ? value.slice(0, 4) : '';
}

function cancelQuietly(body) {
  if (!body) return;
  try {
    Promise.resolve(body.cancel()).catch(() => {});
  } catch {
    // Cancellation is best effort; never relay an upstream error to the client.
  }
}

// The byte ceiling applies to the actual decoded HTTP body, even when upstream
// omits Content-Length or uses chunked transfer encoding.
async function boundedJson(response, signal) {
  const announcedSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(announcedSize) && announcedSize > MAX_RESPONSE_BYTES) {
    cancelQuietly(response.body);
    throw new Error('Publication response is too large');
  }
  if (!response.body || signal.aborted) {
    cancelQuietly(response.body);
    throw new Error('Publication response unavailable');
  }
  const reader = response.body.getReader();
  const onAbort = () => cancelQuietly(reader);
  signal.addEventListener('abort', onAbort, { once: true });
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error('Publication request timed out');
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        cancelQuietly(reader);
        throw new Error('Publication response is too large');
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

function normalizeScopus(data) {
  const results = data?.['search-results'];
  if (!results || !Array.isArray(results.entry)) throw new Error('Invalid Scopus response');
  if (results.entry.some(entry => entry && entry.error)) {
    if (String(results['opensearch:totalResults']) === '0') return [];
    throw new Error('Scopus response unavailable');
  }
  return results.entry.slice(0, 100).flatMap(entry => {
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
  return data.group.slice(0, 500).flatMap(group => {
    const summary = group?.['work-summary']?.[0];
    const title = plainText(summary?.title?.title?.value);
    if (!title) return [];
    const identifiers = summary?.['external-ids']?.['external-id'];
    const doi = Array.isArray(identifiers)
      ? identifiers.find(id => id?.['external-id-type'] === 'doi')?.['external-id-value']
      : null;
    // Never copy a provider-controlled URL or allow an arbitrary destination.
    const url = typeof doi === 'string' && /^10\.\d{4,9}\/[^\s\u0000-\u001f\u007f]{1,500}$/i.test(doi)
      ? `https://doi.org/${doi.split('/').map(encodeURIComponent).join('/')}`
      : ORCID_PROFILE;
    return [{ title, year: yearText(summary?.['publication-date']?.year?.value), url }];
  }).sort((a, b) => b.year.localeCompare(a.year));
}

function unavailable(provider) {
  return { available: false, items: [], profileUrl: provider.profileUrl };
}

async function requestProvider(provider, apiKey, fetchImpl) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Publication request timed out'));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(provider.url, {
          headers: { Accept: 'application/json', ...(apiKey ? { 'X-ELS-APIKey': apiKey } : {}) },
          signal: controller.signal,
          redirect: 'error',
        });
        if (!response.ok) {
          cancelQuietly(response.body);
          throw new Error('Publication provider unavailable');
        }
        return { available: true, items: provider.normalize(await boundedJson(response, controller.signal)), profileUrl: provider.profileUrl };
      })(),
      timeout,
    ]);
  } catch {
    // Upstream messages can contain credentials and are never logged or returned.
    return unavailable(provider);
  } finally {
    clearTimeout(timer);
  }
}

function jsonResponse(value, method, status = 200, headers = {}) {
  return new Response(method === 'HEAD' ? null : JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
      ...headers,
    },
  });
}

async function keyFingerprint(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

/**
 * Memory is bounded to two provider entries per handler. It is an optimization,
 * not persistent storage: another isolate or a restart performs its own fetch.
 * fetchImpl and now are injectable; importing this module makes no requests.
 */
export function createPublicationsHandler({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const entries = { orcid: null, scopus: null };

  return async function publications(request, env = {}, _ctx) {
    const match = /^\/api\/publications\/(orcid|scopus)\/?$/.exec(new URL(request.url).pathname);
    if (!match) return null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonResponse({ message: 'Method not allowed.' }, request.method, 405, { Allow: 'GET, HEAD' });
    }
    const name = match[1];
    const provider = PROVIDERS[name];
    // Reject malformed header values and disable Scopus without a configured key.
    const apiKey = name === 'scopus' && typeof env.SCOPUS_API_KEY === 'string' && /^[\x21-\x7e]{1,512}$/.test(env.SCOPUS_API_KEY)
      ? env.SCOPUS_API_KEY
      : '';
    if (name === 'scopus' && !apiKey) return jsonResponse(unavailable(provider), request.method);
    // A rotated secret invalidates this isolate's Scopus cache. The secret itself
    // is never used as a cache key, URL component, response field, or log value.
    const identity = apiKey ? await keyFingerprint(apiKey) : 'public';
    let entry = entries[name];
    if (!entry || entry.identity !== identity) {
      entry = { identity, result: null, expiresAt: 0, inFlight: null };
      entries[name] = entry;
    }
    if (entry.result && now() < entry.expiresAt) return jsonResponse(entry.result, request.method);
    if (!entry.inFlight) {
      entry.inFlight = requestProvider(provider, apiKey, fetchImpl).then(result => {
        entry.result = result;
        entry.expiresAt = now() + CACHE_TTL_MS;
        return result;
      }).finally(() => { entry.inFlight = null; });
    }
    return jsonResponse(await entry.inFlight, request.method);
  };
}

export const handlePublications = createPublicationsHandler();
