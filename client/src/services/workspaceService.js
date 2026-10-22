import { apiClient } from './apiClient.js';

export function getDashboard(filters) {
  const query = new URLSearchParams(filters).toString();
  return apiClient.get(`/dashboard${query ? `?${query}` : ''}`);
}

export function getTeam() {
  return apiClient.get('/team');
}

export function getCallerDetails(callerId) {
  return apiClient.get(`/team/${encodeURIComponent(callerId)}`);
}

export function getSettlementRequests() {
  return apiClient.get('/settlements/requests');
}

export function getNotifications() {
  return apiClient.get('/notifications');
}

export function markNotificationRead(notificationId) {
  return apiClient.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
}
