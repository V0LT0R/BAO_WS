import { metadata, styles } from './metadata.js';
import { languages, languageCode, pagePath, publicPages } from './lib/locales.js';

export function websiteOrigin(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be a website origin.');
  }
  return url.origin;
}

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const safeJson = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

const names = { en: 'Andrii Biloshchytskyi', ua: 'Білощицький Андрій', ru: 'Белощицкий Андрей' };
const jobs = { en: 'Vice-Rector for Science and Innovation', ua: 'Проректор з науки та інновацій', ru: 'Проректор по науке и инновациям' };
const homeLabels = { en: 'Home', ua: 'Головна', ru: 'Главная' };
const ogLocales = { en: 'en_US', ua: 'uk_UA', ru: 'ru_RU' };
const alternateNames = [
  'Andrii Biloshchytskyi', 'Biloshchytskyi Andrii',
  'Білощицький Андрій', 'Андрій Білощицький', 'Білощицький Андрій Олександрович',
  'Белощицкий Андрей', 'Андрей Белощицкий', 'Белощицкий Андрей Александрович',
];

export function structuredData(page, language, origin) {
  if (!publicPages.includes(page)) return null;
  const site = websiteOrigin(origin);
  const url = new URL(pagePath(page, language), site).href;
  const meta = metadata(page, language);
  const person = {
    '@type': 'Person', '@id': `${site}/#person`, name: names[language],
    alternateName: alternateNames, url: new URL(pagePath('index', language), site).href,
    image: `${site}/assets/images/photo_header.png`, jobTitle: jobs[language],
    worksFor: { '@type': 'CollegeOrUniversity', name: 'Astana IT University', url: 'https://astanait.edu.kz/' },
    sameAs: [
      'https://orcid.org/0000-0001-9548-1959',
      'https://www.scopus.com/authid/detail.uri?authorId=57190487952',
      'https://scholar.google.com.ua/citations?user=C0rTbd4AAAAJ&hl=uk',
    ],
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      person,
      { '@type': 'WebSite', '@id': `${site}/#website`, url: `${site}/`, name: 'BAO — Andrii Biloshchytskyi', inLanguage: ['en', 'uk', 'ru'], publisher: { '@id': person['@id'] } },
      {
        '@type': page === 'index' ? 'ProfilePage' : page === 'FAQs' ? 'WebPage' : 'CollectionPage',
        '@id': `${url}#webpage`, url, name: meta.title, description: meta.description,
        inLanguage: languageCode(language), isPartOf: { '@id': `${site}/#website` },
        ...(page === 'index' ? { mainEntity: { '@id': person['@id'] } } : { about: { '@id': person['@id'] }, breadcrumb: { '@id': `${url}#breadcrumb` } }),
      },
      ...(page === 'index' ? [] : [{
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: homeLabels[language], item: new URL(pagePath('index', language), site).href },
          { '@type': 'ListItem', position: 2, name: meta.title, item: url },
        ],
      }]),
    ],
  };
}

export function renderHead(page, language = 'en', origin = 'https://bao-cv.com') {
  const site = websiteOrigin(origin);
  const meta = metadata(page, language);
  const canonical = new URL(pagePath(page, language), site).href;
  const image = `${site}/assets/images/photo_header.png`;
  const data = structuredData(page, language, site);
  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta name="robots" content="${meta.private ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">`,
    ...(!meta.private ? [
      ...languages.map(locale => `<link rel="alternate" hreflang="${languageCode(locale)}" href="${escapeHtml(new URL(pagePath(page, locale), site).href)}">`),
      `<link rel="alternate" hreflang="x-default" href="${escapeHtml(new URL(pagePath(page, 'en'), site).href)}">`,
    ] : []),
    `<meta property="og:type" content="${page === 'index' ? 'profile' : 'website'}">`,
    `<meta property="og:site_name" content="BAO — Andrii Biloshchytskyi">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:locale" content="${ogLocales[language]}">`,
    ...(!meta.private ? languages.filter(locale => locale !== language).map(locale => `<meta property="og:locale:alternate" content="${ogLocales[locale]}">`) : []),
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(names[language])}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    ...(data ? [`<script type="application/ld+json">${safeJson(data)}</script>`] : []),
    ...styles(page).map(style => `<link rel="stylesheet" id="${style.id}" href="${style.href}"${style.media ? ` media="${style.media}"` : ''}>`),
  ].join('\n    ');
}

export function renderSitemap(origin) {
  const site = websiteOrigin(origin);
  const urls = languages.flatMap(language => publicPages.map(page => new URL(pagePath(page, language), site).href));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export function renderRobots(origin) {
  return `User-agent: *
Disallow: /api/
Allow: /api/experience$
Allow: /api/activities$
Allow: /api/projects$
Allow: /api/certificates$
Allow: /api/projects/image/
Allow: /api/certificates/image/
Allow: /api/publications/orcid$
Allow: /api/publications/scopus$

# Account pages use noindex; crawlers must be able to read that directive.
# Authentication and authorization are enforced by the API, not robots.txt.
Sitemap: ${websiteOrigin(origin)}/sitemap.xml
`;
}
