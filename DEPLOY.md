# Deploying Zales — Vercel + Neon + RapidAPI (WhatsApp & Maps)

This is the current recommended setup: **no server to keep alive**. WhatsApp
goes through a third-party gateway (e.g. a RapidAPI WhatsApp listing) instead
of a self-hosted socket, and lead-finding goes through a RapidAPI Maps
scraper instead of Baileys/Google's own Places API — both reachable from
Zales' existing generic **HTTP Request** node. That means the whole app is
stateless and Vercel-compatible.

## 1. Database — Neon (free, no card)

1. https://neon.tech → sign up → create a project.
2. **Connection Details** → copy both:
   - **Pooled** (has `-pooler` in the hostname) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL`
3. Run the migrations once (Neon's SQL Editor, or `psql`):
   ```bash
   psql "<DIRECT connection string>" -f db/migrations/001_init.sql
   psql "<DIRECT connection string>" -f db/migrations/002_schedule_last_fired.sql
   psql "<DIRECT connection string>" -f db/migrations/003_users.sql
   psql "<DIRECT connection string>" -f db/migrations/004_updated_at_trigger.sql
   psql "<DIRECT connection string>" -f db/migrations/005_user_settings_profile.sql
   ```

## 2. Deploy to Vercel

1. Push this project to a GitHub repo.
2. https://vercel.com → **Add New → Project** → import the repo.
3. Add environment variables (Project Settings → Environment Variables):
   - `DATABASE_URL`, `DIRECT_URL` — from step 1
   - `AUTH_SECRET` — random string, e.g. `openssl rand -base64 32`
   - `API_KEY_SECRET` — random string used to encrypt saved API keys at
     rest (Account Settings). Generate with `openssl rand -base64 32` —
     don't skip this in production.
   - `WEBHOOK_VERIFY_TOKEN` — any random string (only needed if you use the
     Instagram/Facebook Messenger webhook)
   - `CRON_SECRET` — leave unset; Vercel injects this automatically for
     `vercel.json`'s cron entry
4. Deploy. You get a live `https://<project>.vercel.app` URL immediately.

## 3. Schedule triggers — important Vercel Hobby limitation

`vercel.json` already registers `/api/cron/tick`, but **Vercel's Hobby plan
only allows cron jobs to run once a day** (and even then, sometime within
that hour — not at an exact minute). That's fine if your workflows only need
a daily check-in, but **too coarse if you want things like "post at 8am AND
5pm"**.

**Fix (still free):** use an external cron caller to hit the same endpoint
more often — this is a completely normal, widely-used pattern, not a hack:

1. Sign up at https://cron-job.org (free) or similar.
2. Create a job that calls:
   ```
   https://<your-app>.vercel.app/api/cron/tick
   ```
   every 1–5 minutes.
3. If you set `CRON_SECRET` yourself, add a custom header on the cron
   caller: `Authorization: Bearer <your CRON_SECRET value>`.

You can keep the `vercel.json` cron too (harmless, just redundant) or delete
that entry — either way, the actual per-workflow schedule (each Schedule
node's own cron expression) is checked every time `/api/cron/tick` is hit,
by whichever caller.

## 4. WhatsApp — via RapidAPI (or any similar gateway)

1. Pick a WhatsApp gateway listing on RapidAPI (or Whapi.cloud/WasenderApi/
   etc — same idea). Scan your WhatsApp QR on their side to link your number.
2. **Sending**: use the built-in **HTTP Request** node, pointed at that
   provider's "send message" endpoint, with your `X-RapidAPI-Key` /
   `X-RapidAPI-Host` in the node's **Headers** field.
3. **Receiving**: in that provider's dashboard, set the webhook URL to:
   ```
   https://<your-app>.vercel.app/api/webhooks/gateway
   ```
   Then in Zales, drag the **"WhatsApp Gateway (3rd-party)"** trigger node,
   and fill in the field names that provider's webhook payload actually
   uses for the sender and message text (check their docs — paste an
   example payload to Claude if you want help figuring out the right
   field paths).

## 5. Lead-finding — via RapidAPI Maps scraper (or Google's official Places API)

Both work the same way as WhatsApp sending above: use the **HTTP Request**
node with the RapidAPI key/host headers pointed at whichever Maps-scraping
listing you've subscribed to. The dedicated **"Lead Finder (Google Places)"**
node is still there too if you'd rather use Google's official (legal,
metered) Places API instead — see the earlier conversation for the
trade-offs between the two.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Neon URLs
npm run dev
```
Open http://localhost:3000.

## Notes

- Neon's free tier auto-suspends its compute after inactivity — the first
  query after idling has a brief cold-start delay, fine for this use case.
- Use the **pooled** connection string for `DATABASE_URL` — Vercel functions
  are short-lived per-request, so without pooling you can exhaust Neon's
  connection limit under load.
- Prefer to self-host on a regular server instead of Vercel (Back4app/
  Render/your own VPS/Pterodactyl)? That still works — `Dockerfile` and
  `render.yaml` are both still here for that. You'd lose nothing except the
  "fully serverless" part; the RapidAPI-based WhatsApp/Maps setup above
  works identically either way.
