/** Talks to /api (lib/api.js). The staff password lives in this phone's storage. */
import { t } from './i18n.js';

const STORE = 'pq.key';

export function getKey() {
  try { return localStorage.getItem(STORE); } catch { return null; }
}
export function setKey(key) {
  try { key ? localStorage.setItem(STORE, key) : localStorage.removeItem(STORE); } catch { /* private mode */ }
}

/** Resolves with the JSON body, or throws an Error with a translated message and .status. */
export async function api(path, { method = 'GET', body, key = getKey() } = {}) {
  const headers = {};
  if (key) headers.authorization = `Bearer ${key}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw Object.assign(new Error(t(navigator.onLine ? 'err.network' : 'err.offline')), { status: 0 });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = { 401: 'err.login', 403: 'err.permission' }[res.status] ?? 'err.generic';
    throw Object.assign(new Error(t(key)), { status: res.status });
  }
  return data;
}
