import { readFile } from 'node:fs/promises';

/** Token tetap di server; penulisan harus dari origin aplikasi lokal yang sama. */
export default defineEventHandler(async (event): Promise<unknown> => {
  const url = getRequestURL(event);
  const remote = event.node.req.socket.remoteAddress;
  // Proxy internal Nuxt dev tidak selalu membawa socket.remoteAddress.
  // Server dev terikat 127.0.0.1; build produksi tetap menolak endpoint ini.
  if (!import.meta.dev || !['127.0.0.1', 'localhost'].includes(url.hostname) || (remote && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)))
    throw createError({ statusCode: 403, statusMessage: 'Pengujian hanya tersedia di localhost.' });
  const path = getRouterParam(event, 'path') ?? '';
  const method = event.method;
  const allowed = method === 'GET' && ['status', 'regions', 'institutions'].includes(path)
    || method === 'POST' && ['regions', 'institutions', 'institutions/sync'].includes(path)
    || method === 'PUT' && /^institutions\/[0-9a-f-]{36}$/.test(path);
  if (!allowed) throw createError({ statusCode: 404 });
  if (method !== 'GET' && (getHeader(event, 'origin') !== url.origin || !getHeader(event, 'content-type')?.startsWith('application/json')))
    throw createError({ statusCode: 403, statusMessage: 'Gunakan formulir pengujian lokal.' });
  let settings: { apiToken: string };
  try {
    settings = JSON.parse(await readFile(String(useRuntimeConfig(event).developmentConfigPath), 'utf8')) as { apiToken: string };
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Database development belum disiapkan.' });
  }
  try {
    const data: unknown = await $fetch<unknown>(`http://127.0.0.1:8000/api/v1/development/${path}`, {
      method: method as 'GET' | 'POST' | 'PUT', headers: { Accept: 'application/json', 'X-Dev-Token': settings.apiToken },
      body: method === 'GET' ? undefined : await readBody(event), timeout: 12000,
    });
    setHeader(event, 'Cache-Control', 'no-store');
    return data;
  } catch (reason: unknown) {
    const error = reason as { statusCode?: number; data?: { errors?: Record<string, string[]> } };
    const statusCode = [403, 404, 409, 422, 503].includes(error.statusCode ?? 0) ? error.statusCode! : 503;
    throw createError({ statusCode, statusMessage: statusCode === 422 ? 'Data belum valid.' : statusCode === 409 ? 'Identifier ganda atau versi berubah; muat ulang data.' : 'Layanan pengujian belum dapat diakses.',
      data: statusCode === 422 ? { errors: error.data?.errors ?? {} } : undefined });
  }
});
