/**
 * Pure date and queue logic. No DOM, no network: tested in tests/queue.test.js.
 *
 * Days are 'YYYY-MM-DD' strings, the same shape Postgres `date` returns, and
 * all arithmetic is done at UTC midnight so DST never shifts a day.
 */

const pad = n => String(n).padStart(2, '0');

/** Today on this device's clock. */
export const todayKey = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `key`. */
export function weekStart(key) {
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay();   // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}

/** Inclusive first and last day shown for a view anchored on `key`. */
export function range(view, key) {
  const from = view === 'week' ? weekStart(key) : key;
  return { from, to: view === 'week' ? addDays(from, 6) : from };
}

// Untimed requests go after timed ones; ties keep the order they were taken.
const sortKey = r => (r.start_time ?? '99:99') + (r.created_at ?? '');

/** One entry per day in [from, to], even empty ones, each sorted by time. */
export function groupByDay(rows, from, to) {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ day: d, items: [] });
  const byDay = new Map(days.map(g => [g.day, g.items]));
  for (const r of rows) byDay.get(r.day)?.push(r);
  for (const g of days) g.items.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));
  return days;
}
