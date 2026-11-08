import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const response = (data, status = 200) => ({ ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => data });

it('fetches CSRF before login, then uses the rotated token on writes and same-origin cookies', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ user: null, csrfToken: 'before-login' }))
    .mockResolvedValueOnce(response({ user: { role: 'admin' }, csrfToken: 'after-login' }))
    .mockResolvedValueOnce(response({ _id: 'item' }));
  vi.stubGlobal('fetch', fetch);
  const { api } = await import('./api.js');
  await api('/api/user/login', { method: 'POST', body: { username: 'admin', password: 'test-password' } });
  await api('/api/experience', { method: 'POST', body: { year: '2026' } });
  expect(fetch.mock.calls[1][1].headers.get('X-CSRF-Token')).toBe('before-login');
  expect(fetch.mock.calls[2][1].headers.get('X-CSRF-Token')).toBe('after-login');
  expect(fetch.mock.calls[2][1].credentials).toBe('same-origin');
});

it('rejects nonlocal API destinations before sending credentials', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const { api } = await import('./api.js');
  await expect(api('https://example.com/api/user')).rejects.toThrow('Invalid API path');
  await expect(api('//example.com/api/user')).rejects.toThrow('Invalid API path');
  expect(fetch).not.toHaveBeenCalled();
});

it('never treats an HTTP error as a successful save', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ message: 'Please sign in.' }, 401)));
  const { api } = await import('./api.js');
  await expect(api('/api/user/users')).rejects.toMatchObject({ status: 401, message: 'Please sign in.' });
});
