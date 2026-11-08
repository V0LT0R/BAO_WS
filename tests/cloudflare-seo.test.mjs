import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { languages, languageCode, pagePath, publicPages, privatePages } from '../client/lib/locales.js';
import { getPage } from '../client/metadata.js';
import { renderHead, renderRobots, renderSitemap, safeJson, websiteOrigin } from '../client/seo.js';

const origin = 'https://bao-cv.com';

test('every public language URL identifies itself and reciprocally links all language variants', () => {
  const canonicals = new Set();
  const titles = new Set();
  for (const language of languages) for (const page of publicPages) {
    const dom = new JSDOM(`<html><head>${renderHead(page, language, origin)}</head><body></body></html>`);
    const doc = dom.window.document;
    const canonical = doc.querySelector('link[rel="canonical"]').href;
    assert.equal(canonical, new URL(pagePath(page, language), origin).href);
    canonicals.add(canonical);
    titles.add(doc.title);
    assert.ok(doc.querySelector('meta[name="description"]').content.length > 50);
    assert.ok(!doc.querySelector('meta[name="robots"]').content.includes('noindex'));
    const alternatives = [...doc.querySelectorAll('link[rel="alternate"]')];
    assert.deepEqual(alternatives.map(link => link.hreflang), ['en', 'uk', 'ru', 'x-default']);
    for (const locale of languages) assert.equal(alternatives.find(link => link.hreflang === languageCode(locale)).href, new URL(pagePath(page, locale), origin).href);
    assert.equal(doc.querySelector('meta[property="og:url"]').content, canonical);
    assert.equal(getPage(new URL(canonical).pathname), page);
    const data = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
    const person = data['@graph'].find(node => node['@type'] === 'Person');
    assert.equal(person['@id'], `${origin}/#person`);
    assert.ok(person.alternateName.includes('Белощицкий Андрей'));
    assert.ok(person.alternateName.includes('Білощицький Андрій'));
    assert.ok(person.sameAs.includes('https://orcid.org/0000-0001-9548-1959'));
    const webpage = data['@graph'].find(node => node['@id'] === `${canonical}#webpage`);
    assert.equal(webpage.inLanguage, languageCode(language));
    if (page === 'index') {
      assert.equal(webpage['@type'], 'ProfilePage');
      assert.equal(webpage.mainEntity['@id'], person['@id']);
    }
    dom.window.close();
  }
  assert.equal(canonicals.size, 21);
  assert.equal(titles.size, 21);
});

test('private pages stay out of search and have no public profile or language alternatives', () => {
  for (const page of privatePages) {
    const doc = new JSDOM(`<head>${renderHead(page, 'en', origin)}</head>`).window.document;
    assert.equal(doc.querySelector('meta[name="robots"]').content, 'noindex, nofollow');
    assert.equal(doc.querySelector('link[rel="alternate"]'), null);
    assert.equal(doc.querySelector('script[type="application/ld+json"]'), null);
    assert.equal(pagePath(page, 'ru'), `/${page}.html`);
    doc.defaultView.close();
  }
});

test('generated sitemap contains exactly the indexable canonical pages including FAQs', () => {
  const doc = new JSDOM(renderSitemap(origin), { contentType: 'text/xml' }).window.document;
  const urls = [...doc.querySelectorAll('loc')].map(item => item.textContent);
  assert.equal(urls.length, 21);
  assert.equal(new Set(urls).size, 21);
  assert.ok(urls.includes(`${origin}/ru/experience.html`));
  assert.ok(urls.includes(`${origin}/uk/FAQs.html`));
  assert.ok(!urls.some(url => /(?:admin|login|user|api|workers\.dev)/.test(url)));
  doc.defaultView.close();
});

test('robots lets search rendering read public data and images but still blocks account APIs', () => {
  const robots = renderRobots(origin);
  const rules = [...robots.matchAll(/^(Allow|Disallow): (.+)$/gm)].map(([, action, pattern]) => ({ action, pattern }));
  function allowed(path) {
    const matching = rules.filter(({ pattern }) => pattern.endsWith('$') ? path === pattern.slice(0, -1) : path.startsWith(pattern));
    matching.sort((a, b) => b.pattern.replace(/\$$/, '').length - a.pattern.replace(/\$$/, '').length || (a.action === 'Allow' ? -1 : 1));
    return !matching.length || matching[0].action === 'Allow';
  }
  for (const path of ['/api/experience', '/api/activities', '/api/projects', '/api/certificates', '/api/publications/orcid', '/api/publications/scopus', '/api/projects/image/example.png', '/api/certificates/image/example.webp', '/build-assets/main.js', '/ru/index.html', '/login.html']) assert.ok(allowed(path), path);
  for (const path of ['/api/user/session', '/api/user/login', '/api/health', '/api/projects/private', '/api/unknown']) assert.ok(!allowed(path), path);
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
});

test('structured JSON cannot close its data script and build origin cannot include a path or credentials', () => {
  const value = { name: '</script><script>alert(1)</script>&\u2028\u2029' };
  const encoded = safeJson(value);
  assert.ok(!/[<>&\u2028\u2029]/.test(encoded));
  assert.deepEqual(JSON.parse(encoded), value);
  for (const value of ['javascript:alert(1)', 'https://name:secret@example.com', 'https://example.com/path', 'https://example.com/?test=1', 'https://example.com/#fragment']) assert.throws(() => websiteOrigin(value));
  assert.equal(websiteOrigin('https://bao-cv.com/'), origin);
});
