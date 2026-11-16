/**
 * The whole server: a small JSON API over one D1 (SQLite) table.
 * Mounted at /api/* by functions/api/[[route]].js; tested in tests/api.test.js.
 *
 *   GET    /api/requests?from=YYYY-MM-DD&to=YYYY-MM-DD   anyone
 *   GET    /api/me                                        any password -> { role }
 *   POST   /api/requests/:id/done   { done: bool }        coordinator or photographer
 *   POST   /api/requests            { request }           coordinator
 *   PUT    /api/requests/:id        { request }           coordinator
 *   DELETE /api/requests/:id                              coordinator
 *
 * Passwords are Cloudflare secrets COORDINATOR_PASSWORD and PHOTOGRAPHER_PASSWORD,
 * sent by the browser as "Authorization: Bearer <password>".
 */

const MIN_PASSWORD = 12;
const COLUMNS = 'id, activity, day, start_time, building, notes, done_at, created_at';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const fail = (status, error) => json({ error }, status);

async function sameSecret(a, b) {
  // Compare fixed-length digests in constant time, so response timing leaks nothing.
  const enc = s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [x, y] = (await Promise.all([enc(a), enc(b)])).map(d => new Uint8Array(d));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function roleOf(request, env) {
  const key = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!key) return null;
  for (const [role, secret] of [['coordinator', env.COORDINATOR_PASSWORD], ['photographer', env.PHOTOGRAPHER_PASSWORD]]) {
    // A short password could be guessed, so a role with one is switched off rather than exposed.
    if (secret && secret.length >= MIN_PASSWORD && await sameSecret(key, secret)) return role;
  }
  return null;
}

const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
const isTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Returns [problem, null] or [null, cleanRecord]. */
export function validate(body) {
  const r = {
    activity: String(body?.activity ?? '').trim(),
    day: body?.day,
    start_time: body?.start_time || null,
    building: String(body?.building ?? '').trim(),
    notes: String(body?.notes ?? '').trim()
  };
  if (!r.activity || r.activity.length > 200) return ['activity', null];
  if (!isDay(r.day)) return ['day', null];
  if (r.start_time !== null && !isTime(r.start_time)) return ['start_time', null];
  if (!r.building || r.building.length > 200) return ['building', null];   // free text via "Other"
  if (r.notes.length > 2000) return ['notes', null];
  return [null, r];
}

export async function handle(request, env) {
  const url = new URL(request.url);
  const [resource, rawId, action, ...rest] = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = request.method;

  if (resource === 'me' && method === 'GET') {
    const role = await roleOf(request, env);
    return role ? json({ role }) : fail(401, 'wrong password');
  }
  if (resource !== 'requests' || rest.length) return fail(404, 'not found');

  if (!rawId && method === 'GET') {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!isDay(from) || !isDay(to)) return fail(400, 'from and to must be YYYY-MM-DD');
    const { results } = await env.DB.prepare(
      `select ${COLUMNS} from requests where day between ? and ? order by day`).bind(from, to).all();
    return json(results);
  }

  const role = await roleOf(request, env);
  if (!role) return fail(401, 'wrong password');

  const id = rawId === undefined ? null : Number(rawId);
  if (rawId !== undefined && !(Number.isInteger(id) && id > 0)) return fail(404, 'not found');

  let body = null;
  if (method === 'POST' || method === 'PUT') {
    try { body = await request.json(); } catch { return fail(400, 'body must be JSON'); }
  }

  if (id && action === 'done' && method === 'POST') {
    const { meta } = await env.DB.prepare(
      `update requests set done_at = case when ? then coalesce(done_at, datetime('now')) end where id = ?`)
      .bind(body?.done ? 1 : 0, id).run();
    return meta.changes ? json({ ok: true }) : fail(404, 'not found');
  }
  if (action) return fail(404, 'not found');
  if (role !== 'coordinator') return fail(403, 'coordinator only');

  if (method === 'DELETE' && id) {
    const { meta } = await env.DB.prepare('delete from requests where id = ?').bind(id).run();
    return meta.changes ? json({ ok: true }) : fail(404, 'not found');
  }
  if ((method === 'POST' && !id) || (method === 'PUT' && id)) {
    const [problem, r] = validate(body);
    if (problem) return fail(400, `invalid ${problem}`);
    if (method === 'POST') {
      const { meta } = await env.DB.prepare(
        'insert into requests (activity, day, start_time, building, notes) values (?, ?, ?, ?, ?)')
        .bind(r.activity, r.day, r.start_time, r.building, r.notes).run();
      return json({ id: meta.last_row_id }, 201);
    }
    const { meta } = await env.DB.prepare(
      'update requests set activity = ?, day = ?, start_time = ?, building = ?, notes = ? where id = ?')
      .bind(r.activity, r.day, r.start_time, r.building, r.notes, id).run();
    return meta.changes ? json({ ok: true }) : fail(404, 'not found');
  }
  return fail(405, 'method not allowed');
}
