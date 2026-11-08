import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicationsHandler, handlePublications } from '../cloudflare/publications.mjs';

const request = (provider, options) => new Request(`https://profile.example/api/publications/${provider}`, options);
const json = response => response.json();
const orcidWork = (title, year = '2024', doi) => ({
  'work-summary': [{
    title: { title: { value: title } },
    'publication-date': { year: { value: year } },
    'external-ids': { 'external-id': doi ? [{ 'external-id-type': 'doi', 'external-id-value': doi }] : [] },
  }],
});

test('unmatched paths return null and non-read methods return 405 without upstream calls', async () => {
  const handler = createPublicationsHandler({ fetchImpl: () => { throw new Error('must not fetch'); } });
  assert.equal(typeof handlePublications, 'function');
  assert.equal(await handler(new Request('https://profile.example/api/unrelated')), null);
  assert.equal(await handler(request('unknown')), null);
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await handler(request('orcid', { method }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('Scopus without a usable key returns its public profile without contacting upstream', async () => {
  const handler = createPublicationsHandler({ fetchImpl: () => { throw new Error('must not fetch'); } });
  for (const env of [{}, { SCOPUS_API_KEY: '' }, { SCOPUS_API_KEY: 'bad\nheader' }, { SCOPUS_API_KEY: {} }]) {
    const body = await json(await handler(request('scopus'), env));
    assert.deepEqual(body, { available: false, items: [], profileUrl: 'https://www.scopus.com/authid/detail.uri?authorId=57190487952' });
  }
});

test('Scopus key stays in a header, destinations are fixed, and concurrent reads are deduplicated', async () => {
  let calls = 0;
  const secret = 'unit-test-key-not-a-real-key';
  const handler = createPublicationsHandler({ fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(new URL(url).origin, 'https://api.elsevier.com');
    assert.equal(new URL(url).searchParams.get('query'), 'AU-ID(57190487952)');
    assert.ok(!url.includes(secret));
    assert.equal(options.headers['X-ELS-APIKey'], secret);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ 'search-results': { entry: [
      { 'dc:title': 'Old work', 'prism:coverDate': '2020-01-01', eid: '2-s2.0-12345' },
      { 'dc:title': '<script>literal title</script>', 'prism:coverDate': '2025-01-01', eid: 'javascript:alert(1)' },
    ] } });
  } });
  const env = { SCOPUS_API_KEY: secret };
  const [first, second] = await Promise.all([
    handler(request('scopus?url=https://attacker.invalid'), env).then(json),
    handler(request('scopus'), env).then(json),
  ]);
  assert.deepEqual(first, second);
  assert.deepEqual(await json(await handler(request('scopus'), env)), first);
  assert.equal(calls, 1);
  assert.equal(first.available, true);
  assert.equal(first.items[0].year, '2025');
  assert.equal(first.items[0].url, first.profileUrl);
  assert.match(first.items[1].url, /^https:\/\/www\.scopus\.com\/record\/display\.uri\?eid=2-s2\.0-12345/);
  assert.ok(!JSON.stringify(first).includes(secret));
});

test('GET and HEAD use the same cached representation while HEAD returns no body', async () => {
  let calls = 0;
  const handler = createPublicationsHandler({ fetchImpl: async () => {
    calls += 1;
    return Response.json({ group: [orcidWork('Example')] });
  } });
  const first = await handler(request('orcid', { method: 'HEAD' }));
  assert.equal(first.status, 200);
  assert.equal(await first.text(), '');
  assert.equal(first.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(first.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(first.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal((await json(await handler(request('orcid')))).items.length, 1);
  assert.equal(calls, 1);
});

test('cache expires after ten minutes and secret rotation invalidates only Scopus data', async () => {
  let time = 1000;
  let calls = 0;
  const handler = createPublicationsHandler({ now: () => time, fetchImpl: async () => {
    calls += 1;
    return Response.json({ 'search-results': { entry: [] } });
  } });
  await handler(request('scopus'), { SCOPUS_API_KEY: 'first-key' });
  time += 600000 - 1;
  await handler(request('scopus'), { SCOPUS_API_KEY: 'first-key' });
  assert.equal(calls, 1);
  time += 1;
  await handler(request('scopus'), { SCOPUS_API_KEY: 'first-key' });
  assert.equal(calls, 2);
  await handler(request('scopus'), { SCOPUS_API_KEY: 'rotated-key' });
  assert.equal(calls, 3);
  assert.equal((await json(await handler(request('scopus')))).available, false);
  assert.equal(calls, 3);
});

test('upstream failures are cached and cannot disclose errors or credentials', async () => {
  let calls = 0;
  const handler = createPublicationsHandler({ fetchImpl: async () => {
    calls += 1;
    throw new Error('Private failure containing unit-test-secret');
  } });
  const first = await json(await handler(request('scopus'), { SCOPUS_API_KEY: 'unit-test-secret' }));
  const second = await json(await handler(request('scopus'), { SCOPUS_API_KEY: 'unit-test-secret' }));
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(first.available, false);
  assert.deepEqual(first.items, []);
  assert.ok(!JSON.stringify(first).includes('unit-test-secret'));
});

test('ORCID strips control characters and constructs only trusted DOI or profile URLs', async () => {
  const handler = createPublicationsHandler({ fetchImpl: async (url, options) => {
    assert.equal(url, 'https://pub.orcid.org/v3.0/0000-0001-9548-1959/works');
    assert.equal(options.headers['X-ELS-APIKey'], undefined);
    return Response.json({ group: [
      orcidWork('  Valid\nwork  ', '2024', '10.1234/article(1)?unsafe#part'),
      orcidWork('Unsafe URL', 'not-a-year', 'javascript:alert(1)'),
      orcidWork('Control in DOI', '2023', '10.1234/bad\u007fvalue'),
      null,
    ] });
  } });
  const body = await json(await handler(request('orcid')));
  assert.equal(body.available, true);
  assert.equal(body.items.length, 3);
  assert.equal(body.items[0].title, 'Valid work');
  const doi = new URL(body.items[0].url);
  assert.equal(doi.origin, 'https://doi.org');
  assert.equal(doi.search, '');
  assert.equal(doi.hash, '');
  assert.equal(body.items[1].url, body.profileUrl);
  assert.equal(body.items[2].year, '');
  assert.equal(body.items[2].url, body.profileUrl);
});

test('successful zero-result Scopus response remains an available empty list', async () => {
  const handler = createPublicationsHandler({ fetchImpl: async () => Response.json({
    'search-results': { 'opensearch:totalResults': '0', entry: [{ error: 'Result set was empty' }] },
  }) });
  const body = await json(await handler(request('scopus'), { SCOPUS_API_KEY: 'test-key' }));
  assert.equal(body.available, true);
  assert.deepEqual(body.items, []);
});

test('oversized declared and streamed bodies are rejected and cancelled', async () => {
  for (const declared of [true, false]) {
    let cancelled = false;
    let chunks = 0;
    const handler = createPublicationsHandler({ fetchImpl: async () => new Response(new ReadableStream({
      pull(controller) {
        chunks += 1;
        controller.enqueue(new Uint8Array(512 * 1024));
      },
      cancel() { cancelled = true; },
    }), { headers: declared ? { 'Content-Length': String(1024 * 1024 + 1) } : {} }) });
    const body = await json(await handler(request('orcid')));
    assert.equal(body.available, false);
    assert.deepEqual(body.items, []);
    assert.equal(cancelled, true);
    assert.ok(chunks <= 4);
  }
});

test('bad JSON, unexpected structures, and failed HTTP status never escape upstream details', async () => {
  const fixtures = [
    () => new Response('not JSON: private-value'),
    () => Response.json({ wrong: 'private-value' }),
    () => new Response('private-value', { status: 403 }),
    () => new Response(null),
    () => new Response(new Uint8Array([255, 255, 255])),
  ];
  for (const fixture of fixtures) {
    const handler = createPublicationsHandler({ fetchImpl: async () => fixture() });
    const body = await json(await handler(request('orcid')));
    assert.equal(body.available, false);
    assert.ok(!JSON.stringify(body).includes('private-value'));
  }
});

test('provider collections and individual titles have bounded output sizes', async () => {
  const handler = createPublicationsHandler({ fetchImpl: async url => url.includes('orcid')
    ? Response.json({ group: Array.from({ length: 505 }, (_, index) => orcidWork(`Work ${index}`)) })
    : Response.json({ 'search-results': { entry: Array.from({ length: 105 }, () => ({ 'dc:title': 'x'.repeat(2001) })) } })
  });
  assert.equal((await json(await handler(request('orcid')))).items.length, 500);
  const scopus = await json(await handler(request('scopus'), { SCOPUS_API_KEY: 'test-key' }));
  assert.equal(scopus.items.length, 100);
  assert.equal(scopus.items[0].title.length, 2000);
});

test('five-second deadline aborts a stalled body and returns a safe unavailable result', { timeout: 8000 }, async () => {
  let signal;
  let cancelled = false;
  const handler = createPublicationsHandler({ fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  } });
  const start = Date.now();
  const body = await json(await handler(request('orcid')));
  assert.equal(body.available, false);
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, true);
  assert.ok(Date.now() - start >= 4900);
});
