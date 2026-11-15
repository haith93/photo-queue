-- Coverage requests: the whole database. Safe to run more than once.
-- Paste into Cloudflare dashboard -> D1 -> photo-queue -> Console, then Execute.
-- day and start_time are wall-clock text ('2026-11-16', '14:30'), like the whiteboard.
create table if not exists requests (
  id         integer primary key autoincrement,
  activity   text not null,
  day        text not null,
  start_time text,
  building   text not null,
  notes      text not null default '',
  done_at    text,
  created_at text not null default (datetime('now'))
);
create index if not exists requests_day on requests (day);
