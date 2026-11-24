# THE UNIVERSE STORE — *Everything Worth Discovering.*

Affiliate-first product-discovery storefront with a private owner workspace, **Universe Autopilot**.
Visitors discover products here and buy on the retailer's site (AliExpress) through owner-verified affiliate links.
There is no checkout, payment, stock or shipping in this app — by design.

**Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Postgres + Auth + RLS, free tier) · Vercel (Hobby, free).
No paid dependencies. Styling is plain CSS (no UI framework) for speed on entry-level Android phones.

## What's inside

| Area | Routes / files |
|---|---|
| Public store | `/`, `/discover` (search, filters, sort), `/categories`, `/categories/[slug]`, `/p/[slug]`, `/guides`, `/guides/[slug]`, `/deals`, `/about`, `/contact`, `/affiliate-disclosure`, `/privacy`, `/terms`, custom 404 |
| Outbound tracking | `/go/[slug]` — redirects only to an **owner-verified** primary link, logs a first-party click (no cookies, no IP stored) |
| Analytics beacon | `POST /api/event` — cookie-less page/product/category/guide/search events |
| Admin (Universe Autopilot) | `/hq-autopilot-4x9` (not linked anywhere, `noindex`, `no-store`) |
| Daily automations | `/api/cron/automations` (Vercel Cron, `CRON_SECRET`) |
| SEO | `sitemap.xml`, `robots.txt`, canonical URLs, Open Graph, breadcrumb + product JSON-LD with only real fields |
| DB schema | `supabase/migrations/*.sql`, `supabase/seed.sql` |
| AI adapters | `lib/ai/providers.ts` — DARAX API, Google Gemini, Groq, OpenRouter (priority + logged fallback) |

### Admin sections
Overview · Products (draft → pending → approved → published / rejected / archived, preview, audit trail) · Categories · Research Inbox · Content Studio · Guides & Collections · Social Campaigns (TikTok / Instagram / Facebook drafts, copy/export, “mark published (confirmed)”) · Approval Queue (side-by-side) · Publishing Calendar · Affiliate Links (format test, owner verification) · Analytics (date ranges, CSV) · Automations (run now / daily) · Integrations (real connection tests) · Import / Export (CSV/JSON) · Settings (brand, disclosure, regions, team & roles, demo data) · Activity Log · Messages.

Roles: **Owner** (everything; only role that approves/publishes), **Editor** (create/edit/submit), **Analyst** (read-only).

## Rules the code enforces
- Nothing becomes public without an Owner approval (products, guides, content drafts, social posts).
- Affiliate links are never auto-verified; the store shows a retailer button only after the Owner ticks “I opened this link and confirmed it”.
- Prices require a currency **and** a last-checked date and are never labelled live. Unknown fields are omitted or shown as “Not provided”.
- No fake ratings, reviews, testimonials, timers or scarcity. Deals need a verified note and an end date.
- Prohibited / age-restricted categories are blocked (`lib/safety.ts`); uncertain items are flagged for the Owner.
- AI drafts list source facts used, items needing human verification and missing facts; the provider and any fallback reason are logged.
- Secrets live only in server env vars (or AES-256-GCM-encrypted in `provider_secrets`, readable only with the service role).

See **docs/SETUP.md** for setup, environment variables, launch steps and maintenance.
