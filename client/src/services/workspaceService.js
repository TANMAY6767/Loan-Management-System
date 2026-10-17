import { apiClient } from './apiClient.js';

export function getDashboard() {
  return apiClient.get('/dashboard');
}

export function getTeam() {
  return apiClient.get('/team');
}
