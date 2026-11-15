// lib/api.js against a real SQLite database (node:sqlite) standing in for D1.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle, validate } from '../lib/api.js';
import { BUILDINGS } from '../public/js/buildings.js';

const SCHEMA = readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8');
const COORD = 'coordinator-secret-1';
const PHOTO = 'photographer-secret-1';

/** The slice of the D1 API that lib/api.js uses. */
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return {
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...a) { args = a; return stmt; },
        async all() { return { results: db.prepare(sql).all(...args).map(r => ({ ...r })) }; },
        async run() {
          const r = db.prepare(sql).run(...args);
          return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } };
        }
      };
      return stmt;
    }
  };
}

let env;
beforeEach(() => { env = { DB: fakeD1(), COORDINATOR_PASSWORD: COORD, PHOTOGRAPHER_PASSWORD: PHOTO }; });

async function call(method, path, { key, body } = {}) {
  const headers = {};
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await handle(new Request(`https://x.test/api/${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }), env);
  return { status: res.status, data: await res.json() };
}

const sample = { activity: 'Graduation', day: '2026-11-16', start_time: '10:30', building: BUILDINGS[0], notes: 'Main hall' };
const list = () => call('GET', 'requests?from=2026-11-16&to=2026-11-22');

describe('who can do what', () => {
  it('/me names the role, rejects a wrong password', async () => {
    assert.deepEqual((await call('GET', 'me', { key: COORD })).data, { role: 'coordinator' });
    assert.deepEqual((await call('GET', 'me', { key: PHOTO })).data, { role: 'photographer' });
    assert.equal((await call('GET', 'me', { key: 'nope' })).status, 401);
    assert.equal((await call('GET', 'me')).status, 401);
  });

  it('a role whose password is under 12 characters is switched off', async () => {
    env.PHOTOGRAPHER_PASSWORD = 'short';
    assert.equal((await call('GET', 'me', { key: 'short' })).status, 401);
  });

  it('anyone can read; nobody without a password can write', async () => {
    assert.equal((await call('POST', 'requests', { key: COORD, body: sample })).status, 201);
    const { status, data } = await list();
    assert.equal(status, 200);
    assert.equal(data.length, 1);
    assert.equal((await call('POST', 'requests', { body: sample })).status, 401);
    assert.equal((await call('POST', `requests/${data[0].id}/done`, { body: { done: true } })).status, 401);
    assert.equal((await call('DELETE', `requests/${data[0].id}`)).status, 401);
  });

  it('the photographer can only mark done and undo', async () => {
    const { data: { id } } = await call('POST', 'requests', { key: COORD, body: sample });
    assert.equal((await call('POST', 'requests', { key: PHOTO, body: sample })).status, 403);
    assert.equal((await call('PUT', `requests/${id}`, { key: PHOTO, body: sample })).status, 403);
    assert.equal((await call('DELETE', `requests/${id}`, { key: PHOTO })).status, 403);

    assert.equal((await call('POST', `requests/${id}/done`, { key: PHOTO, body: { done: true } })).status, 200);
    assert.ok((await list()).data[0].done_at);
    await call('POST', `requests/${id}/done`, { key: PHOTO, body: { done: false } });
    assert.equal((await list()).data[0].done_at, null);
  });

  it('the coordinator can add, edit and delete', async () => {
    const { data: { id } } = await call('POST', 'requests', { key: COORD, body: sample });
    assert.equal((await call('PUT', `requests/${id}`, { key: COORD, body: { ...sample, notes: 'Bring the drone' } })).status, 200);
    assert.equal((await list()).data[0].notes, 'Bring the drone');
    assert.equal((await call('DELETE', `requests/${id}`, { key: COORD })).status, 200);
    assert.equal((await list()).data.length, 0);
    assert.equal((await call('DELETE', `requests/${id}`, { key: COORD })).status, 404);
  });
});

describe('input checks', () => {
  it('validate accepts a good request and trims it', () => {
    const [problem, r] = validate({ ...sample, activity: '  Graduation ', start_time: '' });
    assert.equal(problem, null);
    assert.equal(r.activity, 'Graduation');
    assert.equal(r.start_time, null);
  });

  it('validate names the first bad field', () => {
    assert.equal(validate({ ...sample, activity: ' ' })[0], 'activity');
    assert.equal(validate({ ...sample, day: '2026-02-30' })[0], 'day');
    assert.equal(validate({ ...sample, day: '16/11/2026' })[0], 'day');
    assert.equal(validate({ ...sample, start_time: '25:00' })[0], 'start_time');
    assert.equal(validate({ ...sample, building: 'Somewhere else' })[0], 'building');
    assert.equal(validate({ ...sample, notes: 'x'.repeat(2001) })[0], 'notes');
    assert.equal(validate(null)[0], 'activity');
  });

  it('bad JSON, bad ids and bad ranges are refused, not crashed on', async () => {
    const res = await handle(new Request('https://x.test/api/requests', {
      method: 'POST', headers: { authorization: `Bearer ${COORD}` }, body: '{oops'
    }), env);
    assert.equal(res.status, 400);
    assert.equal((await call('PUT', 'requests/abc', { key: COORD, body: sample })).status, 404);
    assert.equal((await call('GET', 'requests?from=yesterday&to=2026-11-22')).status, 400);
    assert.equal((await call('GET', 'nothing-here')).status, 404);
  });
});
