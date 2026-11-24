# Setup, launch & maintenance guide

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Where | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | yes | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | yes | anon key; RLS + column grants limit it to published data |
| `NEXT_PUBLIC_SITE_URL` | public | yes | canonical URL, e.g. `https://the-universe-store.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | yes | never prefix with `NEXT_PUBLIC_` |
| `ADMIN_SETUP_TOKEN` | server | for first owner | ≥24 random chars; delete after setup |
| `APP_ENCRYPTION_KEY` | server | recommended | `openssl rand -base64 32`; encrypts AI keys pasted in the admin |
| `RATE_LIMIT_SALT` | server | recommended | random string for hashing IPs used only in rate limits |
| `CRON_SECRET` | server | for daily automations | Vercel sends it as `Authorization: Bearer …` |
| `DARAX_API_KEY`, `DARAX_API_BASE_URL`, `DARAX_MODEL` | server | optional | OpenAI-compatible endpoint |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | server | optional | default model `gemini-3.5-flash` |
| `GROQ_API_KEY`, `GROQ_MODEL` | server | optional | default `openai/gpt-oss-20b` |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | server | optional | default `openrouter/free` (free-model router) |

AI keys can alternatively be pasted in **Admin → Integrations** (Owner only); they are stored encrypted. An env var always wins over a stored key. After changing env vars, redeploy.

## 2. Database
Run, in order, in the Supabase SQL editor (or via the Management API):
`supabase/migrations/0001_universe_store_schema.sql`, `0002_outbound_flags.sql`, `0003_member_link_requests.sql`, `0004_aliexpress_tracking_id.sql`, then optionally `supabase/seed.sql` (starter categories + clearly-labelled demo items).
Then add `universe_store` to **Project Settings → API → Exposed schemas** (keep existing schemas).
Everything lives in the `universe_store` schema, so the project can be shared with other apps without touching their tables.

**Shared-project note:** this deployment shares the Supabase project *darax-jamb-prep* (free-tier limit of 2 active projects). Auth users are shared; store-admin access comes **only** from `universe_store.members`. Invited people must sign in once and then be confirmed by the Owner (Settings → Team), because the shared Auth does not verify email ownership.

## 3. First Owner (admin onboarding)
1. Open `https://<site>/hq-autopilot-4x9/setup`.
2. Enter the `ADMIN_SETUP_TOKEN`, your email and a strong password (≥12 chars, upper, lower, number). If the email already exists in the shared login system, use that account's existing password.
3. You land in Universe Autopilot as Owner. The setup page locks itself once an Owner exists. Remove `ADMIN_SETUP_TOKEN` from Vercel afterwards.
4. Sign-in: `/hq-autopilot-4x9/login` (rate-limited; sessions expire and refresh via Supabase; use **Sign out** on shared devices).

## 4. Affiliate-link setup (Jumia / JForce)
1. Get the affiliate account approved by Jumia (the account holder must meet the programme's age/terms requirements).
2. For each product, generate the tracking link **inside the affiliate dashboard** and paste it into the product's *Affiliate tracking URL*.
3. Use **Affiliate Links → Test a URL's format** (format only — not proof).
4. Open the link yourself, confirm it lands on the right product and appears in your affiliate dashboard, then tick the confirmation and **Mark verified**. Only then does the store show “View on Jumia”.
5. Replacing a URL resets it to unverified. “Mark broken” / “Disable” hide the button immediately. Visitors can report broken links from every product page.
Never scrape Jumia, never build tracking links by hand, and do not imply Jumia endorses the store.

## 4b. Affiliate-link setup (AliExpress)
Same workflow as Jumia — the store supports both retailers, and the owner-verification rule is identical (no link is ever auto-verified).
1. Your AliExpress Affiliate account must be approved first (https://portals.aliexpress.com — approval mail arrives at the registered email).
2. **Tracking ID — already live: `default`.** The account's only tracking ID is `default` (verified in the AliExpress portal, Account → Tracking ID, 24 Nov 2026; created 2026/11/24, marked Default). The store ships with `default` as the value — migration `0004` seeds it, and the app falls back to it when the setting is missing — so the format tester checks against it immediately. If the ID ever changes, update it in Admin → Settings → **AliExpress tracking ID**. The ID is stored as a private site setting, never shown on the public site, and never put into a link by hand.
3. For each product, generate the tracking link **inside the AliExpress portal** (a full `aliexpress.com` item link with tracking parameters, or an `s.click.aliexpress.com` short link) and paste it into the product's *Affiliate tracking URL*. Set the product's retailer name to **AliExpress** so the button reads “View on AliExpress”.
4. Use **Affiliate Links → Test a URL's format**: it accepts Jumia and AliExpress hosts, and warns if an AliExpress link does not carry your tracking ID. Format only — not proof.
5. Open the link yourself, confirm it lands on the right product and appears in your AliExpress portal reports, then tick the confirmation and **Mark verified**. Only then does the store show “View on AliExpress”.
6. Replacing a URL resets it to unverified. “Mark broken” / “Disable” hide the button immediately.
Never scrape AliExpress, never build tracking links by hand, and do not imply AliExpress endorses the store.

## 5. Integration status guide
- **Connected** — the latest real test request succeeded. **Error** — the provider rejected the request (message shown). **Rate limited** — HTTP 429. **Not configured** — no key. Status is never assumed.
- Fallback: providers are tried once each in the priority order (default DARAX → Gemini → Groq → OpenRouter). Every attempt is in the AI run log with the reason.
- Social platforms: **manual publishing** (copy caption, copy link, export .txt, then “Mark Published (confirmed)”). Direct posting needs each platform's approved developer app and account authorisation and is not connected.
- Jumia: manual links (no public API assumed). Email: not configured (messages go to Admin → Messages).

## 6. Launch checklist
1. Affiliate account approved; real products added with issued links; links verified.
2. Products and guides approved and published by the Owner.
3. Settings: public contact email, social links, disclosure text checked against programme terms.
4. **Settings → Demo data → Remove all demo data.**
5. Optional: custom domain in Vercel → update `NEXT_PUBLIC_SITE_URL` and add the domain to Supabase Auth → URL configuration → Redirect URLs.
6. Submit `https://<site>/sitemap.xml` in Google Search Console.

## 7. Maintenance
- Weekly: run *Flag stale prices & links* and *Find incomplete products* (Automations), re-check prices, re-verify links, clear Messages.
- Backups: Admin → Import/Export (CSV/JSON). Full copy: `pg_dump --schema=universe_store "$DATABASE_URL" > backup.sql`. Restore = run migrations, then import CSV (rows arrive as drafts) or `psql < backup.sql`.
- Free-tier limits: Supabase free (500 MB DB, projects pause after ~7 days of no activity — open the site/admin weekly or upgrade later); Vercel Hobby (non-commercial terms; 1 cron per day; function duration limits); Groq/Gemini/OpenRouter free quotas (rate limits show as “Rate limited”).
- Security: rotate `SUPABASE_SERVICE_ROLE_KEY` and AI keys if exposed; keep `.env*` out of git (see `.gitignore`).
