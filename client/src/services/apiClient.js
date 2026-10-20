const API_ROOT = '/api';
let accessToken = localStorage.getItem('shaha-token') || '';
let unauthorizedHandler = () => {};

export function setAccessToken(token) {
  accessToken = token || '';
  if (accessToken) localStorage.setItem('shaha-token', accessToken);
  else localStorage.removeItem('shaha-token');
}

export function clearAccessToken() {
  accessToken = '';
  localStorage.removeItem('shaha-token');
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler || (() => {});
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const isForm = body instanceof FormData;
  const headers = {};

  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Could not connect to the API.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && auth) unauthorizedHandler();
    throw new Error(payload.message || payload.error || 'Request failed.');
  }

  if (payload && Object.hasOwn(payload, 'data') && Object.hasOwn(payload, 'statusCode')) {
    return payload.data;
  }
  return payload;
}

export const apiClient = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => request(path, { ...options, body, method: 'POST' }),
  patch: (path, body, options = {}) => request(path, { ...options, body, method: 'PATCH' }),
};
