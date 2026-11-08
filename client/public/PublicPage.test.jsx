import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SiteProvider } from '../components/SiteContext.jsx';
import { Header, PublicLayout } from '../components/Layout.jsx';
import PublicPage from './PublicPage.jsx';
import { CertificateList, ProjectList, safeImageUrl, Timeline } from './ContentData.jsx';
import { getLanguage } from '../lib/locales.js';
import { getPage } from '../metadata.js';
import { renderPage } from '../entry-server.jsx';
import App from '../App.jsx';

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
  };
}

function renderSite(children, language = 'en') { return render(<SiteProvider initialLanguage={language}>{children}</SiteProvider>); }

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'en';
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  // Unexpected network calls fail visibly rather than reaching a real service/database.
  vi.stubGlobal('fetch', vi.fn(async path => {
    throw new Error(`Unexpected request in isolated frontend test: ${path}`);
  }));
});

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('link[data-test-theme]').forEach(link => link.remove());
  vi.unstubAllGlobals();
});

describe('Untrusted public content', () => {
  it('renders stored project titles and descriptions as text without creating injected elements', async () => {
    const title = '<img src=x onerror="window.__xss = true">';
    const description = '<script>window.__xss = true</script><a href="javascript:alert(1)">Click</a>';
    fetch.mockResolvedValue(jsonResponse([{ _id: 'project-one', titleEn: title, titleUa: 'Проєкт', descriptionEn: description, descriptionUa: 'Опис', imageUrl: 'javascript:alert(1)' }]));
    const { container } = renderSite(<ProjectList />);

    expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(description)).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror], a[href^="javascript:"]')).toBeNull();
    expect(fetch.mock.calls[0][0]).toBe('/api/projects');
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
  });

  it('renders certificate descriptions as text and rejects an external image', async () => {
    const description = '<svg onload="alert(1)">Certificate</svg>';
    fetch.mockResolvedValue(jsonResponse([{ _id: 'certificate-one', date: '2025', descriptionEn: description, imageUrl: 'https://attacker.example/pixel.png' }]));
    const { container } = renderSite(<CertificateList />);

    expect(await screen.findByText(description)).toBeTruthy();
    expect(container.querySelector('svg, img')).toBeNull();
  });

  it('labels Russian-page database originals honestly and falls back per field without translating stored data', async () => {
    fetch.mockImplementation(async path => jsonResponse(path === '/api/projects' ? [{
      _id: 'bilingual-project', titleUa: 'Український проєкт', titleEn: 'English project',
      descriptionUa: ' ', descriptionEn: '<img src=x onerror="alert(1)">Original description',
      imageUrl: '/api/projects/image/original.png',
    }] : path === '/api/certificates' ? [{
      _id: 'bilingual-certificate', descriptionUa: 'Сертифікат університету', descriptionEn: 'University certificate', date: '2026',
    }] : [{ _id: 'bilingual-experience', year: '2026', descriptionEn: 'Original experience' }]));
    const { container } = renderSite(<><ProjectList /><CertificateList /><Timeline type="experience" /></>, 'ru');

    expect((await screen.findByRole('heading', { name: 'Український проєкт' })).lang).toBe('uk');
    expect((await screen.findByText('<img src=x onerror="alert(1)">Original description')).lang).toBe('en');
    expect((await screen.findByText('Сертифікат університету')).lang).toBe('uk');
    expect((await screen.findByText('Original experience')).lang).toBe('en');
    expect(screen.queryByText('English project')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(screen.getByRole('img', { name: 'Український проєкт' }).lang).toBe('uk');
    expect(screen.getAllByText(/Записи представлены на языке оригинала/)).toHaveLength(3);
    expect(document.documentElement.lang).toBe('ru');
  });

  it('keeps experience content safe and declares the language of its selected original', async () => {
    const description = '<iframe srcdoc="<script>alert(1)</script>"></iframe>';
    fetch.mockResolvedValue(jsonResponse([{ _id: 'experience-one', year: '2020–2025', descriptionEn: description, descriptionUa: 'Досвід в університеті' }]));
    const children = <><Header page="experience" /><Timeline type="experience" /></>;
    const { container, rerender } = renderSite(children);

    expect(await screen.findByText(description)).toBeTruthy();
    expect(container.querySelector('iframe, script')).toBeNull();
    expect(screen.getByText(description).lang).toBe('en');
    rerender(<SiteProvider initialLanguage="ua">{children}</SiteProvider>);
    expect((await screen.findByText('Досвід в університеті')).lang).toBe('uk');
    expect(screen.queryByText(description)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload="alert(1)"/>',
    '//attacker.example/image.png',
    'https://attacker.example/image.png',
    '/api/projects/image/../../user/users',
    '/api/projects/image/%2e%2e',
    '/api/projects/image/%2E',
    '/api/projects/image/%252e%252e',
    '/api/projects/image/%2e%2e%2fuser',
    '/api/projects/image/image%5c..%5cuser',
    '/api/projects/image/image%00.png',
    '/api/projects/image/image%0a.png',
    '/api/projects/image/image.png?request=other',
    '/api/projects/image/image.png#fragment',
    '/api/projects/image/%zz',
    '/api/certificates/image/another-resource.png',
  ])('rejects image URL %s', url => {
    expect(safeImageUrl(url, 'projects')).toBeUndefined();
  });

  it('preserves safe existing GridFS filenames including spaces and Ukrainian text', () => {
    for (const name of ['17-photo.png', '17-Сертифікат фото.jpg', '17-photo%20one.webp']) {
      expect(safeImageUrl(`/api/projects/image/${name}`, 'projects')).toBe(`/api/projects/image/${name}`);
    }
    expect(safeImageUrl('/api/unknown/image/test.png', 'unknown')).toBeUndefined();
  });

  it('allows recovery after a failed content request', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse([{ _id: 'retry-project', titleEn: 'Recovered project', descriptionEn: 'Loaded successfully.' }]));
    renderSite(<ProjectList />);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    expect(await screen.findByRole('heading', { name: 'Recovered project' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

describe('Site preferences and navigation', () => {
  it.each([
    ['/', 'en', 'Biloshchytskyi Andrii', 'English', '/'],
    ['/uk/index.html', 'uk', 'Білощицький Андрій', 'Українська', '/uk/index.html'],
    ['/ru/index.html', 'ru', 'Белощицкий Андрей', 'Русский', '/ru/index.html'],
  ])('renders the URL language for %s and exposes crawlable alternatives', (pathname, code, name, current, home) => {
    localStorage.setItem('language', 'ua');
    const { container } = renderSite(<PublicLayout page="index"><PublicPage page="index" /></PublicLayout>, getLanguage(pathname));
    expect(screen.getByRole('heading', { name, exact: true })).toBeTruthy();
    expect(document.documentElement.lang).toBe(code);
    expect(screen.getByRole('link', { name: current, exact: true }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'English', exact: true }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Українська', exact: true }).getAttribute('href')).toBe('/uk/index.html');
    expect(screen.getByRole('link', { name: 'Русский', exact: true }).getAttribute('href')).toBe('/ru/index.html');
    expect(screen.getByRole('link', { name: 'BAO', exact: true }).getAttribute('href')).toBe(home);
    const prefix = code === 'en' ? '' : `/${code}`;
    for (const section of ['experience', 'certificates', 'activity', 'projects']) {
      expect(container.querySelector(`.block-5 a[href="${prefix}/${section}.html"]`)).not.toBeNull();
      expect(container.querySelector(`footer a[href="${prefix}/${section}.html"]`)).not.toBeNull();
    }
    expect(localStorage.getItem('language')).toBe('ua');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps all three language links on the current page, including FAQs', () => {
    renderSite(<PublicLayout page="FAQs"><PublicPage page="FAQs" /></PublicLayout>, 'ru');
    const alternatives = [['English', '/FAQs.html', 'en'], ['Українська', '/uk/FAQs.html', 'uk'], ['Русский', '/ru/FAQs.html', 'ru']];
    for (const [label, href, lang] of alternatives) {
      const link = screen.getByRole('link', { name: label, exact: true });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.hreflang).toBe(lang);
    }
    expect(screen.getByRole('button', { name: 'Где я сейчас работаю?' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Войти', exact: true }).getAttribute('href')).toBe('/login.html');
  });

  it('prerenders all public locale routes with their translated name and navigation without fetching', () => {
    for (const [prefix, family] of [['', 'Biloshchytskyi'], ['/uk', 'Білощицьк'], ['/ru', 'Белощицк']]) {
      for (const page of ['index', 'experience', 'activity', 'certificates', 'projects', 'publications', 'FAQs']) {
        const pathname = `${prefix}/${page}.html`;
        const markup = renderPage(getPage(pathname), getLanguage(pathname));
        const document = new DOMParser().parseFromString(markup, 'text/html');
        expect(document.querySelector('main h1').textContent).toContain(family);
        expect(document.querySelectorAll('.language-switcher a')).toHaveLength(3);
        expect(document.querySelector('a.to_exp').getAttribute('href')).toBe(`${prefix}/experience.html`);
      }
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('prerenders private pages in English with EN/UA controls and no localized account links', () => {
    localStorage.setItem('language', 'ua');
    const markup = renderPage('login', 'ru');
    const document = new DOMParser().parseFromString(markup, 'text/html');
    expect(document.querySelectorAll('.language-switcher input[type="radio"]')).toHaveLength(2);
    expect(document.querySelector('#lang-en').checked).toBe(true);
    expect(document.querySelector('#lang-ua').checked).toBe(false);
    expect(document.querySelector('.language-switcher a')).toBeNull();
    expect(document.querySelector('a.to_home').getAttribute('href')).toBe('/');
    expect(document.body.textContent).toContain('Sign in');
    expect(document.querySelector('a[href^="/ru/"]')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['login', 'admin', 'user'])('restores and persists the account EN/UA preference on %s without changing its URL', async page => {
    const user = page === 'login' ? null : { _id: 'isolated-user', username: 'isolated-user', role: page === 'admin' ? 'admin' : 'user' };
    fetch.mockImplementation(async path => jsonResponse(path === '/api/user/session' ? { user, csrfToken: 'isolated-token' } : []));
    localStorage.setItem('language', 'ua');
    const pathname = window.location.pathname;
    const { unmount } = render(<App page={page} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Українська' }).checked).toBe(true));
    if (user) await screen.findByRole('button', { name: 'Вийти', exact: true });
    expect(document.documentElement.lang).toBe('uk');
    expect(screen.getAllByRole('link', { name: 'Головна', exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Русский', exact: true })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
    fireEvent.click(screen.getByRole('radio', { name: 'Українська' }));
    expect(document.documentElement.lang).toBe('uk');
    expect(localStorage.getItem('language')).toBe('ua');
    expect(window.location.pathname).toBe(pathname);
    expect(screen.getByRole('link', { name: user ? page === 'admin' ? 'Адміністрування' : user.username : 'Увійти', exact: true }).getAttribute('href')).toBe(`/${page}.html`);

    unmount();
    render(<App page={page} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Українська' }).checked).toBe(true));
    if (user) await screen.findByRole('button', { name: 'Вийти', exact: true });
    expect(document.documentElement.lang).toBe('uk');
  });

  it('switches only the theme stylesheets and persists the selection', async () => {
    for (const scheme of ['light', 'dark']) {
      const link = document.createElement('link');
      link.id = `theme-${scheme}`;
      link.rel = 'stylesheet';
      link.dataset.theme = scheme;
      link.dataset.testTheme = 'true';
      link.media = `(prefers-color-scheme: ${scheme})`;
      document.head.appendChild(link);
    }
    renderSite(<Header />);

    fireEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));
    await waitFor(() => expect(document.getElementById('theme-dark').media).toBe('all'));
    expect(document.getElementById('theme-light').media).toBe('not all');
    expect(localStorage.getItem('color-scheme')).toBe('dark');

    fireEvent.click(screen.getByRole('radio', { name: 'Light theme' }));
    await waitFor(() => expect(document.getElementById('theme-light').media).toBe('all'));
    expect(document.getElementById('theme-dark').media).toBe('not all');
    expect(localStorage.getItem('color-scheme')).toBe('light');
  });

  it('makes the collapsible navigation state observable and closes it when Contact is selected', () => {
    renderSite(<Header />);
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    const controlled = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(controlled.classList.contains('show')).toBe(false);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(controlled.classList.contains('show')).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Contact', exact: true }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(controlled.classList.contains('show')).toBe(false);
  });

  it('opens and closes FAQ answers with correctly linked expanded semantics', () => {
    renderSite(<PublicPage page="FAQs" />);
    const first = screen.getByRole('button', { name: 'Where I work now?' });
    const second = screen.getByRole('button', { name: 'How to contact me?' });
    const firstAnswer = document.getElementById(first.getAttribute('aria-controls'));
    expect(first.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(firstAnswer.classList.contains('show')).toBe(true);
    expect(within(firstAnswer).getByText(/Vice-Rector for Science and Innovation/)).toBeTruthy();
    fireEvent.click(second);
    expect(second.getAttribute('aria-expanded')).toBe('true');
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(firstAnswer.classList.contains('show')).toBe(false);
    fireEvent.click(second);
    expect(second.getAttribute('aria-expanded')).toBe('false');
  });
});
