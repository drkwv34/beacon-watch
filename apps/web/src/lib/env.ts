import { loadWebConfig } from '../config';

export function apiBaseUrl(): string {
  return loadWebConfig().API_BASE_URL;
}
