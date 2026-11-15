import { sb, configured, withTimeout, errorMessage } from './supabase.js';
import { t, apply, toggleLang, locale } from './i18n.js';
import { todayKey, addDays, range, groupByDay, uniqueRecent } from './queue.js';

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

const fmtDay = (key, long) => new Intl.DateTimeFormat(locale(), {
  weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short', timeZone: 'UTC'
}).format(new Date(`${key}T00:00:00Z`));

const fmtTime = s => new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  .format(new Date(`1970-01-01T${s}Z`));

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

async function load() {
  if (!sb) return;
  const ticket = ++loadTicket;
  const { from, to } = range(state.view, state.anchor);
  const { data, error } = await sb.from('requests')
    .select('id, activity, day, start_time, location, notes, done_at, created_at')
    .gte('day', from).lte('day', to);
  if (ticket !== loadTicket) return;           // a newer load started meanwhile
  if (error) return say(errorMessage(error), true);
  state.rows = data;
  render();
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
  const canEdit = state.role === 'coordinator';
  const body = [
    h('span', { className: 'time' }, r.start_time ? fmtTime(r.start_time) : t('anyTime')),
    h('strong', { className: 'activity' }, r.activity),
    h('span', { className: 'loc' }, r.location),
    h('span', { className: 'notes' }, r.notes)
  ];
  return h('li', { className: done ? 'req done' : 'req' },
    state.role
      ? h('input', { type: 'checkbox', checked: done, 'aria-label': `${t('markDone')}: ${r.activity}`,
                     onchange: e => setDone(r.id, e.target) })
      : done && h('span', { className: 'badge' }, t('done')),
    canEdit
      ? h('button', { type: 'button', className: 'body', onclick: () => edit(r) }, body)
      : h('div', { className: 'body' }, body));
}

async function setDone(id, box) {
  box.disabled = true;
  const { error } = await sb.rpc('set_done', { p_id: id, p_done: box.checked });
  if (error) {
    box.checked = !box.checked;
    say(errorMessage(error), true);
  }
  box.disabled = false;
  load();
}

/* ------------------------------------------------------------------ */
/* Coordinator entry form                                              */
/* ------------------------------------------------------------------ */

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
  field('start_time').value = r.start_time?.slice(0, 5) ?? '';
  field('location').value = r.location;
  field('notes').value = r.notes;
  form.classList.add('editing');
  $('#save').dataset.i18n = 'saveChanges';
  $('#delete').hidden = $('#cancel-edit').hidden = false;
  apply(form);
  form.scrollIntoView({ block: 'start' });
  field('activity').focus();
}

async function loadSuggestions() {
  const { data } = await sb.from('requests').select('activity, location')
    .order('created_at', { ascending: false }).limit(300);
  if (!data) return;
  const fill = (id, values) => $(id).replaceChildren(...uniqueRecent(values).map(value => h('option', { value })));
  fill('#activities', data.map(r => r.activity));
  fill('#locations', data.map(r => r.location));
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const rec = {
    activity: field('activity').value.trim(),
    day: field('day').value,
    start_time: field('start_time').value || null,
    location: field('location').value.trim(),
    notes: field('notes').value.trim()
  };
  if (!rec.activity) return field('activity').focus();

  $('#save').disabled = true;
  const { error } = state.editing
    ? await sb.from('requests').update(rec).eq('id', state.editing)
    : await sb.from('requests').insert(rec);
  $('#save').disabled = false;
  if (error) return say(errorMessage(error), true);   // form keeps what was typed

  say(t('saved'));
  const { from, to } = range(state.view, state.anchor);
  if (rec.day < from || rec.day > to) state.anchor = rec.day;   // show where it landed
  resetForm();
  field('activity').focus();
  loadSuggestions();
  load();
});

form.querySelectorAll('[data-offset]').forEach(b =>
  b.addEventListener('click', () => setDate(addDays(state.today, Number(b.dataset.offset)))));
field('day').addEventListener('change', () => setDate(field('day').value));
$('#cancel-edit').addEventListener('click', resetForm);
$('#delete').addEventListener('click', async () => {
  if (!state.editing || !confirm(t('confirmDelete'))) return;
  const { error } = await sb.from('requests').delete().eq('id', state.editing);
  if (error) return say(errorMessage(error), true);
  say(t('deleted'));
  resetForm();
  load();
});

/* ------------------------------------------------------------------ */
/* Sign-in                                                             */
/* ------------------------------------------------------------------ */

async function refreshRole() {
  let session = null;
  try {
    ({ data: { session } } = await withTimeout(sb.auth.getSession()));
  } catch (err) {
    say(errorMessage(err), true);
  }
  state.role = null;
  if (session) {
    const { data, error } = await sb.from('staff').select('role').eq('user_id', session.user.id).maybeSingle();
    if (error) say(errorMessage(error), true);
    else if (!data) say(t('err.noRole'), true);
    state.role = data?.role ?? null;
  }
  $('#who').dataset.i18n = state.role ? `role.${state.role}` : '';
  $('#who').textContent = state.role ? t(`role.${state.role}`) : '';
  $('#signin-open').hidden = Boolean(session);
  $('#signout').hidden = !session;
  form.hidden = state.role !== 'coordinator';
  if (state.role === 'coordinator') {
    resetForm();
    loadSuggestions();
  }
  render();
}

const dialog = $('#signin');
$('#signin-open').addEventListener('click', () => dialog.showModal());
$('#signin-cancel').addEventListener('click', () => dialog.close());
$('#signin-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target.elements;
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  if (error) return say(errorMessage(error), true);
  e.target.reset();
  dialog.close();
  say('');
  await refreshRole();
  if (state.role === 'coordinator') field('activity').focus();
});
$('#signout').addEventListener('click', async () => {
  await sb.auth.signOut();
  await refreshRole();
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');

apply();
render();
if (!configured) {
  say(t('notConfigured'), true);
  $('#signin-open').hidden = true;
} else {
  sb.channel('requests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => load())
    .subscribe();
  load();
  refreshRole();
}
