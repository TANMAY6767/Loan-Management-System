import { apiClient } from './apiClient.js';

export function getAccounts(query) {
  return apiClient.get(`/accounts?${query}`);
}

export function getAccount(loanNo) {
  return apiClient.get(`/accounts/${encodeURIComponent(loanNo)}`);
}

export function logCall(loanNo, call) {
  return apiClient.post(`/accounts/${encodeURIComponent(loanNo)}/calls`, call);
}

export function createPromise(loanNo, promise) {
  return apiClient.post(`/accounts/${encodeURIComponent(loanNo)}/promises`, promise);
}

export function recordPayment(loanNo, payment) {
  return apiClient.post(`/accounts/${encodeURIComponent(loanNo)}/payments`, payment);
}

export function allocateAccounts(loanNos, userId) {
  return apiClient.post('/allocations', { loanNos, userId });
}

export function importAccounts(file) {
  const form = new FormData();
  form.append('file', file);
  return apiClient.post('/accounts/import', form);
}
