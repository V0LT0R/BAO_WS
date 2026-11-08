export const languages = ['en', 'ua', 'ru'];
export const publicPages = ['index', 'experience', 'activity', 'certificates', 'projects', 'publications', 'FAQs'];
export const privatePages = ['login', 'admin', 'user'];

export function languageCode(language) {
  return language === 'ua' ? 'uk' : language === 'ru' ? 'ru' : 'en';
}

export function getLanguage(pathname = '/') {
  return /^\/uk(?:\/|$)/.test(pathname) ? 'ua' : /^\/ru(?:\/|$)/.test(pathname) ? 'ru' : 'en';
}

export function pagePath(page, language = 'en') {
  if (privatePages.includes(page)) return `/${page}.html`;
  if (!publicPages.includes(page)) page = 'index';
  if (language === 'ua' || language === 'ru') return `/${languageCode(language)}/${page}.html`;
  return page === 'index' ? '/' : `/${page}.html`;
}
