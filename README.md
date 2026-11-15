# Photo requests

Replaces the office whiteboard. The coordinator takes photo requests by phone
and types them in; the photographer sees them on his phone and ticks them off;
anyone else can open the link and see the queue by day or week.

| Who | Signs in? | Can |
|---|---|---|
| Anyone with the link | No | See the queue |
| Photographer | Once per phone | See + mark done / undo |
| Coordinator | Once per phone | Add, edit, delete, mark done |

The rules are enforced by Postgres row-level security (`sql/schema.sql`), not
by the page. English and Arabic, weeks start on Monday.

**Stack:** static HTML/CSS/ES modules (no build), Supabase (Postgres, Auth,
Realtime) via `supabase-js` from jsDelivr, GitHub Pages. Pattern taken from
`where_is_haitham`.

## Setup

1. **Supabase project.** SQL editor → run `sql/schema.sql`.
2. **Turn off sign-ups.** Authentication → Sign In / Providers → disable
   "Allow new users to sign up".
3. **Create the two accounts.** Authentication → Users → Add user (email +
   password, auto-confirm). Then in the SQL editor:
   ```sql
   insert into public.staff (user_id, role)
   select id, 'coordinator'  from auth.users where email = 'coordinator@example.com'
   union all
   select id, 'photographer' from auth.users where email = 'photographer@example.com';
   ```
4. **Check the rules.** Run `sql/check.sql`. It rolls itself back and prints
   three `ok:` notices, or stops at the first `FAIL:`.
5. **Deploy.** Push to GitHub, add repository secrets `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (Project Settings → API; the *anon* key only), and set
   Settings → Pages → Source to "GitHub Actions".
6. **Install on phones.** Open the URL → Share / menu → *Add to Home Screen*.
   Coordinator and photographer tap *Staff sign-in* once.

## Local development

```sh
cp js/env.example.js js/env.js     # fill in URL + anon key
python -m http.server 8000          # then open http://localhost:8000
node --test tests/*.test.js # date / grouping / translation tests
python tools/generate-icons.py      # only if the icon changes
```

## Fast entry (coordinator)

The form sits at the top with the cursor in **Activity**. Previous activities
and locations auto-suggest. Date defaults to today (Today / Tomorrow / In 2
days buttons, or pick one); time is optional. **Enter saves**, clears the
form and puts the cursor back in Activity for the next call. Tap any request
to edit or delete it.

## Known limits

- Unfinished requests from past days are not carried forward; use ‹ to look back.
- No push notifications: the photographer's screen updates live while the app
  is open, and refreshes when he returns to it.
- Bump `VERSION` in `service-worker.js` when you add files to its `SHELL` list.
