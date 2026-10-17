import { apiClient, clearAccessToken, setAccessToken } from './apiClient.js';

export async function login(username, password) {
  const result = await apiClient.post('/auth/login', { username, password }, { auth: false });
  setAccessToken(result.token);
  return result;
}

export async function getCurrentUser() {
  const result = await apiClient.get('/me');
  return result.user;
}

export function logout() {
  clearAccessToken();
  localStorage.removeItem('shaha-user');
}
