const DEFAULT_API_PORT = '3001';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const isPrivateOrLocalHost = (host: string) => (
  host === 'localhost' ||
  host === '0.0.0.0' ||
  host.startsWith('127.') ||
  host.startsWith('10.') ||
  host.startsWith('192.168.') ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
);

export function resolveApiBaseUrl(configured = import.meta.env.VITE_API_URL || '') {
  const configuredValue = String(configured || '').trim();

  if (typeof window === 'undefined') {
    return trimTrailingSlash(configuredValue);
  }

  if (configuredValue) {
    const configuredUrl = new URL(configuredValue, window.location.origin);
    if (
      configuredUrl.hostname !== window.location.hostname &&
      isPrivateOrLocalHost(configuredUrl.hostname)
    ) {
      configuredUrl.hostname = window.location.hostname;
    }
    return trimTrailingSlash(configuredUrl.toString());
  }

  if (window.location.port && window.location.port !== DEFAULT_API_PORT) {
    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
  }

  return trimTrailingSlash(window.location.origin);
}

export const API_BASE_URL = resolveApiBaseUrl();
