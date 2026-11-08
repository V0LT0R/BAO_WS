import { pageMeta } from './public/pageMeta.js';

export const pages = [...Object.keys(pageMeta), 'login', 'admin', 'user'];
export function getPage(pathname) {
  const value = pathname === '/' ? 'index' : pathname.replace(/^\//, '').replace(/\.html$/, '');
  return pages.includes(value) ? value : 'index';
}
export function metadata(page) {
  return pageMeta[page] || {
    title: `${page === 'login' ? 'Sign in' : page === 'admin' ? 'Administration' : 'My account'} — BAO`,
    description: 'Account access for the BAO website.',
    style: page === 'login' ? 'login' : 'admin',
    private: true,
  };
}
export function styles(page) {
  const { style } = metadata(page);
  const theme = style === 'admin' ? 'Experience' : style;
  return [
    { id: 'bootstrap-style', href: '/bootstrap_css/css/bootstrap.css' },
    { id: 'page-style', href: `/assets/css/${style}.css` },
    ...['light', 'dark'].map(scheme => ({
      id: `theme-${scheme}`, href: `/assets/css/${theme}${scheme === 'light' ? 'Light' : 'Dark'}.css`,
      media: `(prefers-color-scheme: ${scheme})`,
    })),
  ];
}
