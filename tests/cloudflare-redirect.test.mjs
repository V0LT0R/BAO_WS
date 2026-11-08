import test from 'node:test';
import assert from 'node:assert/strict';
import redirectWorker from '../cloudflare/redirect-worker.mjs';

test('www redirects permanently to HTTPS canonical origin and preserves exact paths and query parameters', async () => {
  for (const protocol of ['http:', 'https:']) {
    for (const pathname of ['/', '/index.html', '/certificates.html', '/assets/images/Cert%20One.png']) {
      const search = '?q=a%20b&q=x%2Fy&empty=&return=%2Fadmin.html';
      const response = redirectWorker.fetch(new Request(`${protocol}//www.bao-cv.com${pathname}${search}`));
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('Location'), `https://bao-cv.com${pathname}${search}`);
      assert.equal(await response.text(), '');
    }
  }
});

test('redirect keeps the canonical host when the path resembles another origin', () => {
  for (const pathname of ['//attacker.example/index.html', '/%2F%2Fattacker.example', '/%5C%5Cattacker.example']) {
    const response = redirectWorker.fetch(new Request(`https://www.bao-cv.com${pathname}?next=https%3A%2F%2Fattacker.example`));
    const location = new URL(response.headers.get('Location'));
    assert.equal(response.status, 308);
    assert.equal(location.origin, 'https://bao-cv.com');
    assert.equal(location.pathname, pathname);
    assert.equal(location.search, '?next=https%3A%2F%2Fattacker.example');
  }
});

test('canonical and unrelated hosts do not loop or become an open redirect', () => {
  for (const host of ['bao-cv.com', 'attacker.example', 'www.bao-cv.com.attacker.example', 'bao-cv-redirect.example.workers.dev']) {
    const response = redirectWorker.fetch(new Request(`https://${host}/index.html`));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Location'), null);
  }
});

test('308 applies to API POST without rewriting its method or target path', () => {
  const response = redirectWorker.fetch(new Request('https://www.bao-cv.com/api/user/login?next=%2Fadmin.html', { method: 'POST', body: 'example' }));
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), 'https://bao-cv.com/api/user/login?next=%2Fadmin.html');
});
