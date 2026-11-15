# Coverage requests · طلبات التغطية

Replaces the office whiteboard for photo and video coverage requests.

- **The coordinator** takes a request by phone and types it in: event, date,
  time, building, notes. Enter saves and the form is ready for the next call.
- **The photographer** sees the queue on his phone and ticks requests off.
- **Everyone else** opens the link and sees the queue by day or by week. No
  sign-in.

English and Arabic (button at the top). Weeks start on Monday.

| Who | Signs in? | Can |
|---|---|---|
| Anyone with the link | No | See the queue |
| Photographer | Once per phone, with the photographer password | See, mark done, undo |
| Coordinator | Once per phone, with the coordinator password | Add, edit, delete, mark done |

The server checks the password on every change, so hiding buttons is not the
only protection.

---

## How it is built

Everything runs on Cloudflare's free plan. The code lives on GitHub.

```
GitHub (code) ──push──▶ Cloudflare Pages ── builds and serves the site
                              │
                              ├── public/      the app (HTML, CSS, JS, icons)
                              ├── functions/   /api/* → lib/api.js (the server)
                              └── D1 database  one table: requests
```

| Folder / file | What it is |
|---|---|
| `public/` | Everything the browser downloads. |
| `public/js/buildings.js` | **The building dropdown list. Edit this one.** |
| `lib/api.js` | The server: reads and writes requests and checks passwords. |
| `functions/api/[[route]].js` | Connects Cloudflare to `lib/api.js`. |
| `sql/schema.sql` | Creates the database table. |
| `tests/` | Automatic checks: `node --test tests/*.test.js` |
| `tools/generate-icons.py` | Rebuilds the app icons if you change them. |

---

## Setup from A to Z

Takes about 20 minutes. You need the GitHub account that owns
`haith93/photo-queue` and an email address for Cloudflare.

### A. Put your building names in

1. Open `public/js/buildings.js` in any text editor.
2. Replace `Building 1`, `Building 2`, `Building 3` with the real names, one
   per line, each in quotes and followed by a comma, for example:
   ```js
   export const BUILDINGS = [
     'Main building',
     'مبنى المهنية',
     'Guest house'
   ];
   ```
3. Save the file.

You can change this list at any time later (see "Changing things").

### B. Put the code on GitHub

In a terminal, inside the `photo-queue` folder:

```sh
git remote add origin https://github.com/haith93/photo-queue.git
git add -A
git commit -m "Building names"
git push -u origin main
```

If `git remote add` says the remote already exists, skip that line. Refresh
`https://github.com/haith93/photo-queue`: you should see the folders `public`,
`functions`, `lib`, `sql`.

### C. Create a Cloudflare account

1. Go to <https://dash.cloudflare.com/sign-up>, sign up with your email and
   confirm it.
2. You land on the Cloudflare dashboard. No domain or credit card is needed.

### D. Create the database

1. In the left menu: **Storage & databases → D1 SQL database**.
2. Click **Create database**. Name: `photo-queue`. Leave the location on
   automatic. Click **Create**.
3. Open the new database and go to the **Console** tab.
4. Open `sql/schema.sql` from this project, copy **all** of it, paste it into
   the console box, and click **Execute**.
5. You should see a success message. Under the **Tables** tab you should see a
   table called `requests`.

### E. Create the website (Cloudflare Pages)

1. In the left menu: **Compute (Workers) → Workers & Pages**, then
   **Create application**.
2. Choose the **Pages** option. If you only see Workers, look for the link
   "Looking to deploy Pages? **Get started**". Then pick
   **Import an existing Git repository**.
3. Click **Connect GitHub**. GitHub asks which repositories Cloudflare may
   see: choose **Only select repositories → photo-queue → Install & Authorize**.
4. Select `photo-queue` and click **Begin setup**.
5. Fill in the build settings exactly like this:

   | Setting | Value |
   |---|---|
   | Project name | `photo-queue` (this becomes `photo-queue.pages.dev`; if taken, pick another and use it below) |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | *(leave empty)* |
   | Build output directory | `public` |

6. Click **Save and Deploy** and wait for "Success". The site exists now, but
   it can't reach the database or check passwords until steps F and G are done.

### F. Connect the database to the website

1. Open the project: **Workers & Pages → photo-queue → Settings → Bindings**.
2. Click **Add → D1 database**.
3. Variable name: `DB` (exactly that, capitals). D1 database: `photo-queue`.
4. Click **Save**.

### G. Set the two passwords

Choose two different passwords, **at least 12 characters each**. Shorter
passwords are refused by the server on purpose. A few unrelated words work
well, e.g. `blue-lamp-river-74`. Keep them somewhere safe, such as a password
manager.

1. Same project: **Settings → Variables and Secrets → Add**.
2. Type **Secret**. Name `COORDINATOR_PASSWORD`, value: the coordinator's
   password. Save.
3. Add another one: Type **Secret**. Name `PHOTOGRAPHER_PASSWORD`, value: the
   photographer's password. Save.
4. If the page asks which environment, choose **Production**.

### H. Redeploy so steps F and G take effect

Bindings and secrets only apply to new deployments.

1. **Deployments** tab, then the latest deployment's **⋯** menu → **Retry deployment**.
2. Wait for "Success".

### I. Test it

1. Open `https://photo-queue.pages.dev` (or the name you chose in E5).
2. You should see **Coverage requests** with today's date and "Nothing
   scheduled." A red message here means step F or H was missed.
3. Click **Staff sign-in**, enter the coordinator password. The entry form
   appears and "Coordinator" shows at the top.
4. Add a test request, tick it done, tap it, then **Delete**.
5. Open the same address in a private window: you should see the queue with
   no form and no tick boxes.

### J. Your own address (optional)

To use e.g. `photos.yourdomain.org` instead of `photo-queue.pages.dev`:
**project → Custom domains → Set up a custom domain** and follow the steps.

- If the domain is already on Cloudflare, it is automatic.
- If not, Cloudflare tells you which CNAME record to add at your domain
  provider.

### K. Install on the phones

Do this on the coordinator's and the photographer's phones, and anyone else
who wants an icon.

- **iPhone (Safari):** open the address → Share button → **Add to Home Screen**.
- **Android (Chrome):** open the address → ⋮ menu → **Install app** (or
  **Add to Home screen**).

Then open the app from the new icon. Coordinator and photographer tap
**Staff sign-in** once and enter their password. The phone remembers it.

---

## Daily use

**Coordinator, on the phone with a caller:**

1. Type the event. The cursor is already in that box.
2. Today is already selected. Otherwise tap **Tomorrow**, **In 2 days**, or pick
   a date.
3. Time is optional. Choose the building and add notes if needed.
4. Press **Enter** (or **Add request**). The form clears and is ready for the
   next call.

To change or remove a request, tap it, edit, then **Save changes** or **Delete**.

**Photographer:** tick the box when a job is done. Tick again to undo. The
queue refreshes every 30 seconds and whenever you come back to the app.

**Everyone:** **Day / Week** to switch view, **‹ ›** to move, **Today** to
come back.

---

## Changing things

| To… | Do this |
|---|---|
| Change the building list | Edit `public/js/buildings.js`, then `git commit -am "Buildings"` and `git push`. Cloudflare redeploys within a minute or two. |
| Change a password | Cloudflare → project → Settings → Variables and Secrets → edit the secret → then Retry deployment (step H). That person signs in again with the new password. |
| Sign a lost phone out | Change that role's password (above). The old one stops working everywhere. |
| See or fix data by hand | Cloudflare → D1 → photo-queue → Console, e.g. `select * from requests order by day desc limit 20;` |
| Undo a mistake in the data | D1 → photo-queue → **Time Travel** restores the database to an earlier moment (last 7 days on the free plan). |

Every push to `main` deploys automatically. GitHub also runs the tests (the
✔ or ✖ next to each commit). A ✖ does not stop the deploy, but it means
something is broken.

---

## Working on the code (optional)

Needs Node.js 22 or newer.

```sh
node --test tests/*.test.js          # all checks, no setup needed
```

To run the whole app locally against a local database:

1. Create a file `.dev.vars` in the project folder. It is git-ignored. Put in:
   ```
   COORDINATOR_PASSWORD=local-coordinator-pw
   PHOTOGRAPHER_PASSWORD=local-photographer-pw
   ```
2. Create a file `wrangler.toml`. **Don't commit it:** if it is on GitHub,
   Cloudflare uses it instead of your dashboard settings. Put in:
   ```toml
   name = "photo-queue"
   pages_build_output_dir = "public"
   compatibility_date = "2026-11-01"
   [[d1_databases]]
   binding = "DB"
   database_name = "photo-queue"
   database_id = "local"
   ```
3. Run:
   ```sh
   npx wrangler d1 execute photo-queue --local --file sql/schema.sql
   npx wrangler pages dev
   ```
4. Open <http://127.0.0.1:8788>.

If you add a file to `public/`, also add it to `SHELL` in
`public/service-worker.js` and change its `VERSION`, so installed phones pick
it up.

---

## Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| Red "Something went wrong" on the queue | The database is not connected, or the table is missing | Steps D4, F, H |
| "Wrong password" with the right password | Secret not set, set under another name, shorter than 12 characters, or no redeploy after setting it | Steps G, H |
| A change on GitHub does not appear | Cloudflare still deploying, or the phone has the old version | Check **Deployments**. Close and reopen the app. |
| The photographer doesn't see a new request yet | It refreshes every 30 s | Wait, or switch away and back to the app |

## Known limits

- Unfinished requests from past days don't move to today. Use **‹** to look back.
- No push notifications. The queue updates while the app is open.
- Anyone who has the link can read the queue, including notes.
