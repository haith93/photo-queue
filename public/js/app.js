import { api, getKey, setKey } from './api.js';
import { t, apply, toggleLang, locale } from './i18n.js';
import { todayKey, addDays, range, groupByDay } from './queue.js';
import { BUILDINGS } from './buildings.js';

const REFRESH_MS = 30_000;
const $ = sel => document.querySelector(sel);
const form = $('#entry');
const field = name => form.elements[name];

const state = { view: 'day', today: todayKey(), anchor: todayKey(), role: null, rows: [], editing: null };
let loadTicket = 0;

/** Tiny element builder. User text only ever goes in as text nodes. */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter(k => k != null && k !== false && k !== ''));
  return el;
}

function say(text, isError = false) {
  const msg = $('#msg');
  msg.textContent = text;
  msg.classList.toggle('error', isError);
}

/** Shows the error; a rejected password (changed on the server) signs this phone out. */
function oops(err) {
  say(err.message, true);
  if (err.status === 401 && getKey()) {
    setKey(null);
    refreshRole();
  }
}

const fmtDay = (key, long) => new Intl.DateTimeFormat(locale(), {
  weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short', timeZone: 'UTC'
}).format(new Date(`${key}T00:00:00Z`));

const fmtTime = s => new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  .format(new Date(`1970-01-01T${s}Z`));

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

async function load() {
  const ticket = ++loadTicket;
  const { from, to } = range(state.view, state.anchor);
  try {
    const rows = await api(`requests?from=${from}&to=${to}`);
    if (ticket !== loadTicket) return;          // a newer load started meanwhile
    state.rows = rows;
    if ($('#msg').classList.contains('error')) say('');
    render();
  } catch (err) {
    if (ticket === loadTicket) say(err.message, true);
  }
}

function render() {
  const { from, to } = range(state.view, state.anchor);
  $('#range-label').textContent = state.view === 'day' ? fmtDay(from, true) : `${fmtDay(from)} – ${fmtDay(to)}`;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view));

  $('#queue').replaceChildren(...groupByDay(state.rows, from, to).map(({ day, items }) =>
    h('section', { className: day === state.today ? 'day today' : 'day' },
      state.view === 'week' && h('h2', {}, fmtDay(day, true)),
      items.length
        ? h('ul', {}, items.map(row))
        : h('p', { className: 'empty' }, t('empty')))));
}

function row(r) {
  const done = Boolean(r.done_at);
  const body = [
    h('span', { className: 'time' }, r.start_time ? fmtTime(r.start_time) : t('anyTime')),
    h('strong', { className: 'activity' }, r.activity),
    h('span', { className: 'loc' }, r.building),
    h('span', { className: 'notes' }, r.notes)
  ];
  return h('li', { className: done ? 'req done' : 'req' },
    state.role
      ? h('input', { type: 'checkbox', checked: done, 'aria-label': `${t('markDone')}: ${r.activity}`,
                     onchange: e => setDone(r.id, e.target) })
      : done && h('span', { className: 'badge' }, t('done')),
    state.role === 'coordinator'
      ? h('button', { type: 'button', className: 'body', onclick: () => edit(r) }, body)
      : h('div', { className: 'body' }, body));
}

async function setDone(id, box) {
  box.disabled = true;
  try {
    await api(`requests/${id}/done`, { method: 'POST', body: { done: box.checked } });
  } catch (err) {
    box.checked = !box.checked;
    oops(err);
  }
  box.disabled = false;
  load();
}

/* ------------------------------------------------------------------ */
/* Coordinator entry form                                              */
/* ------------------------------------------------------------------ */

field('building').append(...BUILDINGS.map(b => h('option', { value: b }, b)));

function setDate(key) {
  field('day').value = key;
  form.querySelectorAll('[data-offset]').forEach(b =>
    b.setAttribute('aria-pressed', addDays(state.today, Number(b.dataset.offset)) === key));
}

function resetForm() {
  form.reset();
  state.editing = null;
  setDate(state.today);
  form.classList.remove('editing');
  $('#save').dataset.i18n = 'add';
  $('#delete').hidden = $('#cancel-edit').hidden = true;
  apply(form);
}

function edit(r) {
  state.editing = r.id;
  field('activity').value = r.activity;
  setDate(r.day);
  field('start_time').value = r.start_time ?? '';
  field('building').value = r.building;     // blank if the building was since removed from the list
  field('notes').value = r.notes;
  form.classList.add('editing');
  $('#save').dataset.i18n = 'saveChanges';
  $('#delete').hidden = $('#cancel-edit').hidden = false;
  apply(form);
  form.scrollIntoView({ block: 'start' });
  field('activity').focus();
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const rec = {
    activity: field('activity').value.trim(),
    day: field('day').value,
    start_time: field('start_time').value || null,
    building: field('building').value,
    notes: field('notes').value.trim()
  };
  if (!rec.activity) return field('activity').focus();

  $('#save').disabled = true;
  try {
    await (state.editing
      ? api(`requests/${state.editing}`, { method: 'PUT', body: rec })
      : api('requests', { method: 'POST', body: rec }));
  } catch (err) {
    return oops(err);                       // the form keeps what was typed
  } finally {
    $('#save').disabled = false;
  }
  say(t('saved'));
  const { from, to } = range(state.view, state.anchor);
  if (rec.day < from || rec.day > to) state.anchor = rec.day;   // show where it landed
  resetForm();
  field('activity').focus();
  load();
});

form.querySelectorAll('[data-offset]').forEach(b =>
  b.addEventListener('click', () => setDate(addDays(state.today, Number(b.dataset.offset)))));
field('day').addEventListener('change', () => setDate(field('day').value));
$('#cancel-edit').addEventListener('click', resetForm);
$('#delete').addEventListener('click', async () => {
  if (!state.editing || !confirm(t('confirmDelete'))) return;
  try {
    await api(`requests/${state.editing}`, { method: 'DELETE' });
  } catch (err) {
    return oops(err);
  }
  say(t('deleted'));
  resetForm();
  load();
});

/* ------------------------------------------------------------------ */
/* Sign-in: one password per role                                      */
/* ------------------------------------------------------------------ */

async function refreshRole() {
  state.role = null;
  if (getKey()) {
    try {
      state.role = (await api('me')).role;
    } catch (err) {
      say(err.message, true);
      if (err.status === 401) setKey(null);   // keep the key on network errors, retry next time
    }
  }
  $('#who').dataset.i18n = state.role ? `role.${state.role}` : '';
  $('#who').textContent = state.role ? t(`role.${state.role}`) : '';
  $('#signin-open').hidden = Boolean(state.role);
  $('#signout').hidden = !state.role;
  form.hidden = state.role !== 'coordinator';
  if (state.role === 'coordinator' && !state.editing) resetForm();
  render();
}

const dialog = $('#signin');
$('#signin-open').addEventListener('click', () => dialog.showModal());
$('#signin-cancel').addEventListener('click', () => dialog.close());
$('#signin-form').addEventListener('submit', async e => {
  e.preventDefault();
  const key = e.target.elements.password.value;
  try {
    await api('me', { key });
  } catch (err) {
    return say(err.message, true);
  }
  setKey(key);
  e.target.reset();
  dialog.close();
  say('');
  await refreshRole();
  if (state.role === 'coordinator') field('activity').focus();
});
$('#signout').addEventListener('click', () => {
  setKey(null);
  refreshRole();
});

/* ------------------------------------------------------------------ */
/* Navigation, language, lifecycle                                     */
/* ------------------------------------------------------------------ */

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  state.view = b.dataset.view;
  load();
}));
const step = dir => { state.anchor = addDays(state.anchor, dir * (state.view === 'week' ? 7 : 1)); load(); };
$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
$('#today').addEventListener('click', () => { state.anchor = state.today; load(); });
$('#lang').addEventListener('click', () => { toggleLang(); render(); });

// Phones suspend the page overnight: on return, catch up with the date and the data.
function resume() {
  const now = todayKey();
  if (now !== state.today) {
    if (state.anchor === state.today) state.anchor = now;
    state.today = now;
    if (state.role === 'coordinator' && !state.editing) setDate(now);
  }
  load();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume(); });
addEventListener('online', resume);
// shortcut: polls every 30 s instead of live push; fine for one office, revisit if it feels slow.
setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');

apply();
render();
load();
refreshRole();
