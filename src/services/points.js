import { useAuthStore } from '../stores/auth';
import { API_BASE_URL } from '../utils/apiBase';

const API_V1 = `${API_BASE_URL}/api/v1`;

const getHeaders = (contentType) => {
  const authStore = useAuthStore();
  const headers = {};
  if (authStore.token) {
    headers.Authorization = `Bearer ${authStore.token}`;
  }
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
};

const buildUrl = (path, params = {}) => {
  const url = new URL(`${API_V1}${path}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString().replace(window.location.origin, API_BASE_URL);
};

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || data.message || fallbackMessage);
  }
  return data.data;
};

export async function listPoints(params = {}) {
  const response = await fetch(buildUrl('/points', params), {
    headers: getHeaders()
  });
  return parseResponse(response, '获取点位列表失败');
}

export async function createPoint(payload) {
  const response = await fetch(buildUrl('/points'), {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify(payload)
  });
  return parseResponse(response, '创建点位失败');
}

export async function updatePoint(id, payload) {
  const response = await fetch(buildUrl(`/points/${id}`), {
    method: 'PUT',
    headers: getHeaders('application/json'),
    body: JSON.stringify(payload)
  });
  return parseResponse(response, '更新点位失败');
}

export async function deletePoint(id) {
  const response = await fetch(buildUrl(`/points/${id}`), {
    method: 'DELETE',
    headers: getHeaders()
  });
  return parseResponse(response, '删除点位失败');
}

export async function getPointStreamUrl(id) {
  const response = await fetch(buildUrl(`/points/${id}/stream-url`), {
    headers: getHeaders()
  });
  return parseResponse(response, '获取点位接入地址失败');
}

export async function queryLatestPoints(params = {}) {
  const response = await fetch(buildUrl('/points/query/latest', params), {
    headers: getHeaders()
  });
  return parseResponse(response, '获取点位最新值失败');
}

export default {
  createPoint,
  deletePoint,
  getPointStreamUrl,
  listPoints,
  queryLatestPoints,
  updatePoint
};
