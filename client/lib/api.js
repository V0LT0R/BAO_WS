let csrfToken = null;
let sessionRequest = null;

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function getSession({ refresh = false } = {}) {
  if (!sessionRequest || refresh) {
    sessionRequest = request('/api/user/session').finally(() => { sessionRequest = null; });
  }
  return sessionRequest;
}

async function request(path, options = {}) {
  if (!path.startsWith('/api/') || path.startsWith('//')) throw new Error('Invalid API path');
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  let body = options.body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken) await getSession();
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(path, {
    ...options, method, headers, body, credentials: 'same-origin',
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : null;
  if (data?.csrfToken) csrfToken = data.csrfToken;
  if (!response.ok) {
    if (response.status === 401) csrfToken = null;
    throw new ApiError(data?.message || data?.error || 'The request could not be completed. Please try again.', response.status, data?.errors);
  }
  if (path === '/api/user/logout') csrfToken = null;
  return data;
}

export function api(path, options) { return request(path, options); }

export function safeImageUrl(value, resource) {
  if (typeof value !== 'string') return undefined;
  const prefix = `/api/${resource}/image/`;
  if (!['projects', 'certificates'].includes(resource) || !value.startsWith(prefix)) return undefined;
  const filename = value.slice(prefix.length);
  let decoded;
  try { decoded = decodeURIComponent(filename); } catch { return undefined; }
  if (!decoded || decoded.length > 240 || /[\\/?#%\u0000-\u001f\u007f]/.test(decoded) || ['.', '..'].includes(decoded)) return undefined;
  return value;
}
