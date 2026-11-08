const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createPublicationsRouter } = require('../src/routes/publications');

async function withServer(options, run) {
  const app = express();
  app.use('/api/publications', createPublicationsRouter(options));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/publications`;
  try {
    await run(async (path) => {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200);
      return response.json();
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('Scopus without a key provides a public profile and does not contact upstream', async () => {
  await withServer({ fetchImpl: () => { throw new Error('must not fetch'); } }, async (get) => {
    const body = await get('/scopus');
    assert.equal(body.available, false);
    assert.deepEqual(body.items, []);
    assert.match(body.profileUrl, /^https:\/\/www\.scopus\.com\/authid\/detail\.uri/);
  });
});

test('Scopus key stays in a header, request destination is fixed, and concurrent reads share cache', async () => {
  let calls = 0;
  const secret = 'unit-test-key-not-a-real-key';
  await withServer({
    scopusApiKey: secret,
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(new URL(url).origin, 'https://api.elsevier.com');
      assert.equal(new URL(url).searchParams.get('query'), 'AU-ID(57190487952)');
      assert.ok(!url.includes(secret));
      assert.equal(options.headers['X-ELS-APIKey'], secret);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return Response.json({ 'search-results': { entry: [
        { 'dc:title': 'Old work', 'prism:coverDate': '2020-01-01', eid: '2-s2.0-12345' },
        { 'dc:title': '<script>literal title</script>', 'prism:coverDate': '2025-01-01', eid: 'javascript:alert(1)' },
      ] } });
    },
  }, async (get) => {
    const [a, b] = await Promise.all([get('/scopus?url=https://attacker.invalid'), get('/scopus')]);
    const c = await get('/scopus');
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
    assert.deepEqual(b, c);
    assert.equal(a.available, true);
    assert.equal(a.items[0].year, '2025');
    assert.equal(a.items[0].url, a.profileUrl);
    assert.match(a.items[1].url, /^https:\/\/www\.scopus\.com\/record\/display\.uri\?eid=2-s2\.0-12345/);
    assert.ok(!JSON.stringify(a).includes(secret));
  });
});

test('Upstream errors are cached and cannot leak request secrets', async () => {
  let calls = 0;
  await withServer({ scopusApiKey: 'test-secret', fetchImpl: async () => {
    calls++;
    throw new Error('API key test-secret in upstream error');
  } }, async (get) => {
    const first = await get('/scopus');
    const second = await get('/scopus');
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.equal(first.available, false);
    assert.ok(!JSON.stringify(first).includes('test-secret'));
  });
});

test('Oversized streamed response is rejected even without a content-length header', async () => {
  await withServer({ fetchImpl: async () => new Response('x'.repeat(1024 * 1024 + 1)) }, async (get) => {
    const body = await get('/orcid');
    assert.equal(body.available, false);
    assert.deepEqual(body.items, []);
  });
});

test('ORCID normalizes missing fields and constructs only trusted DOI/profile URLs', async () => {
  await withServer({ fetchImpl: async (url, options) => {
    assert.equal(url, 'https://pub.orcid.org/v3.0/0000-0001-9548-1959/works');
    assert.equal(options.headers['X-ELS-APIKey'], undefined);
    return Response.json({ group: [
      { 'work-summary': [{ title: { title: { value: 'Valid work' } }, 'publication-date': { year: { value: '2024' } }, 'external-ids': { 'external-id': [{ 'external-id-type': 'doi', 'external-id-value': '10.1234/article(1)?unsafe#part' }] } }] },
      { 'work-summary': [{ title: { title: { value: 'Missing date' } }, 'external-ids': { 'external-id': [{ 'external-id-type': 'doi', 'external-id-value': 'javascript:alert(1)' }] } }] },
      null,
    ] });
  } }, async (get) => {
    const body = await get('/orcid');
    assert.equal(body.available, true);
    assert.equal(body.items.length, 2);
    assert.equal(body.items[0].year, '2024');
    assert.equal(new URL(body.items[0].url).origin, 'https://doi.org');
    assert.equal(new URL(body.items[0].url).hash, '');
    assert.equal(new URL(body.items[0].url).search, '');
    assert.equal(body.items[1].url, body.profileUrl);
  });
});

test('Scopus successful zero-result response is an available empty list', async () => {
  await withServer({ scopusApiKey: 'unit-test', fetchImpl: async () => Response.json({
    'search-results': { 'opensearch:totalResults': '0', entry: [{ error: 'Result set was empty' }] },
  }) }, async (get) => {
    const body = await get('/scopus');
    assert.equal(body.available, true);
    assert.deepEqual(body.items, []);
  });
});
