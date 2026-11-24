-- THE UNIVERSE STORE — schema migration 0001
-- Everything lives in its own schema `universe_store` so it can share a Supabase
-- project with other apps without touching their tables, functions or policies.
-- Idempotent where practical. RLS is enabled on every table.

create schema if not exists universe_store;

grant usage on schema universe_store to anon, authenticated, service_role;

-- ---------------------------------------------------------------- helpers
create or replace function universe_store.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- roles & members
create table if not exists universe_store.roles (
  key text primary key check (key in ('owner','editor','analyst')),
  description text not null
);
insert into universe_store.roles (key, description) values
  ('owner','Owner/Admin: full control, settings, team, publishing'),
  ('editor','Editor: products, content, campaigns; can submit for approval'),
  ('analyst','Analyst: read-only dashboards and analytics')
on conflict (key) do nothing;

create table if not exists universe_store.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique check (email = lower(email)),
  role text not null references universe_store.roles(key),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists members_user_idx on universe_store.members(user_id);

-- ---------------------------------------------------------------- catalogue
create table if not exists universe_store.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  intro text,
  icon text,
  sort_order int not null default 100,
  visible boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists universe_store.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  short_description text,
  full_description text,
  category_id uuid references universe_store.categories(id) on delete set null,
  brand text,
  retailer_name text not null default 'Jumia',
  affiliate_url text,
  canonical_product_url text,
  displayed_price numeric(14,2) check (displayed_price is null or displayed_price >= 0),
  currency char(3),
  price_checked_at timestamptz,
  price_source text,
  availability_status text not null default 'unknown'
    check (availability_status in ('unknown','in_stock','limited','out_of_stock')),
  specifications jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  editorial_status text not null default 'draft'
    check (editorial_status in ('draft','pending','approved','published','rejected','archived')),
  featured_flag boolean not null default false,
  is_deal boolean not null default false,
  deal_note text,
  deal_verified_at timestamptz,
  deal_expires_at timestamptz,
  is_demo boolean not null default false,
  source_notes text,
  review_note text,
  created_by uuid,
  updated_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_status_idx on universe_store.products(editorial_status);
create index if not exists products_category_idx on universe_store.products(category_id);
create index if not exists products_created_idx on universe_store.products(created_at desc);
create unique index if not exists products_affiliate_url_uniq on universe_store.products(affiliate_url) where affiliate_url is not null;

create table if not exists universe_store.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references universe_store.products(id) on delete cascade,
  url text not null,
  alt_text text not null check (char_length(alt_text) >= 3),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on universe_store.product_images(product_id);

create table if not exists universe_store.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references universe_store.products(id) on delete cascade,
  label text not null default 'Primary',
  url text not null,
  retailer text not null default 'Jumia',
  is_primary boolean not null default true,
  status text not null default 'unverified'
    check (status in ('unverified','verified','disabled','broken')),
  verified_at timestamptz,
  verified_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_links_product_idx on universe_store.affiliate_links(product_id);
create unique index if not exists affiliate_links_one_primary on universe_store.affiliate_links(product_id) where is_primary;

create table if not exists universe_store.guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'guide' check (kind in ('guide','collection')),
  title text not null,
  excerpt text,
  body text,
  selection_criteria text,
  limitations text,
  product_ids uuid[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft','pending','approved','published','rejected','archived')),
  ai_assisted boolean not null default false,
  ai_provider text,
  is_demo boolean not null default false,
  created_by uuid,
  updated_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- workspace
create table if not exists universe_store.research_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('url','note','csv','image')),
  raw_input text not null,
  source_url text,
  image_url text,
  status text not null default 'new' check (status in ('new','processed','converted','dismissed')),
  ai_result jsonb,
  ai_provider text,
  product_id uuid references universe_store.products(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists universe_store.content_drafts (
  id uuid primary key default gen_random_uuid(),
  format text not null,
  tone text not null default 'informative',
  title text,
  body text not null,
  product_ids uuid[] not null default '{}',
  source_facts jsonb not null default '[]'::jsonb,
  needs_verification jsonb not null default '[]'::jsonb,
  missing_facts jsonb not null default '[]'::jsonb,
  ai_provider text,
  ai_model text,
  fallback_reason text,
  status text not null default 'draft'
    check (status in ('draft','needs_review','approved','rejected','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists universe_store.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  concept text,
  product_ids uuid[] not null default '{}',
  utm_campaign text,
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  start_date date,
  end_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists universe_store.social_accounts (
  channel text primary key check (channel in ('tiktok','instagram','facebook')),
  handle text,
  profile_url text,
  connection_status text not null default 'manual' check (connection_status in ('manual','not_connected')),
  notes text,
  updated_at timestamptz not null default now()
);
insert into universe_store.social_accounts(channel) values ('tiktok'),('instagram'),('facebook')
on conflict (channel) do nothing;

create table if not exists universe_store.social_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references universe_store.campaigns(id) on delete set null,
  channel text not null check (channel in ('tiktok','instagram','facebook')),
  post_type text not null default 'caption' check (post_type in ('caption','video_script','carousel','post')),
  caption text not null default '',
  script text,
  hashtags text,
  link_url text,
  disclosure text not null default '',
  media_notes text,
  product_ids uuid[] not null default '{}',
  scheduled_for timestamptz,
  status text not null default 'draft'
    check (status in ('draft','needs_review','approved','ready','published','failed','cancelled')),
  published_confirmed_at timestamptz,
  published_confirmed_by uuid,
  published_url text,
  ai_provider text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_posts_sched_idx on universe_store.social_posts(scheduled_for);

create table if not exists universe_store.approval_items (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('product','guide','content_draft','social_post')),
  entity_id uuid not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','changes_requested')),
  snapshot jsonb,
  submitted_by uuid,
  submitted_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  reviewer_notes text
);
create index if not exists approval_items_status_idx on universe_store.approval_items(status, submitted_at desc);

create table if not exists universe_store.automation_jobs (
  key text primary key,
  name text not null,
  description text not null,
  enabled boolean not null default false,
  last_run_at timestamptz,
  last_status text,
  updated_at timestamptz not null default now()
);
insert into universe_store.automation_jobs(key,name,description) values
  ('missing_fields','Find incomplete products','Flags products missing images, descriptions or affiliate URLs.'),
  ('stale_prices','Flag stale prices & links','Flags prices not checked in 14+ days and links never verified.'),
  ('review_reminder','Review reminder','Counts items waiting in the approval queue and drafts older than 3 days.'),
  ('weekly_summary','Weekly performance summary','Summarises the last 7 days of first-party views and outbound clicks.'),
  ('related_suggestions','Suggest related products','Suggests related products by shared category and tags (stored as suggestions only).')
on conflict (key) do nothing;

create table if not exists universe_store.automation_logs (
  id bigint generated always as identity primary key,
  job_key text not null references universe_store.automation_jobs(key) on delete cascade,
  status text not null check (status in ('running','success','error','cancelled')),
  summary text,
  details jsonb,
  error text,
  triggered_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ---------------------------------------------------------------- analytics
create table if not exists universe_store.click_events (
  id bigint generated always as identity primary key,
  product_id uuid references universe_store.products(id) on delete set null,
  link_id uuid references universe_store.affiliate_links(id) on delete set null,
  page_path text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  is_demo boolean not null default false,
  occurred_at timestamptz not null default now()
);
create index if not exists click_events_time_idx on universe_store.click_events(occurred_at desc);
create index if not exists click_events_product_idx on universe_store.click_events(product_id);

create table if not exists universe_store.page_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view','product_view','category_view','guide_view','search')),
  path text,
  product_id uuid,
  category_id uuid,
  guide_id uuid,
  search_term text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  is_demo boolean not null default false,
  occurred_at timestamptz not null default now()
);
create index if not exists page_events_time_idx on universe_store.page_events(occurred_at desc);

-- ---------------------------------------------------------------- settings, audit, ai
create table if not exists universe_store.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into universe_store.site_settings(key,value,is_public) values
  ('site_title','"THE UNIVERSE STORE"',true),
  ('tagline','"Everything Worth Discovering."',true),
  ('currency_display','"NGN"',true),
  ('supported_regions','["NG","International"]',true),
  ('default_locale','"en-NG"',true),
  ('affiliate_disclosure','"The Universe Store may earn a commission when you buy through qualifying links on this site, at no extra cost to you. Prices, stock, shipping, returns and purchase terms are set by the retailer and can change."',true),
  ('contact_email','null',true),
  ('social_links','{"tiktok":null,"instagram":null,"facebook":null}',true),
  ('ai_provider_priority','["darax","gemini","groq","openrouter"]',false),
  ('analytics_retention_days','365',false),
  ('automation_enabled','false',false)
on conflict (key) do nothing;

create table if not exists universe_store.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_time_idx on universe_store.audit_logs(created_at desc);

create table if not exists universe_store.ai_runs (
  id bigint generated always as identity primary key,
  provider text not null,
  model text,
  purpose text,
  status text not null check (status in ('success','error','rate_limited','skipped')),
  fallback_reason text,
  error text,
  latency_ms int,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- API keys pasted in the admin are stored AES-256-GCM encrypted with APP_ENCRYPTION_KEY
-- (server env). No grants to anon/authenticated at all.
create table if not exists universe_store.provider_secrets (
  provider text primary key check (provider in ('darax','gemini','groq','openrouter')),
  ciphertext text not null,
  base_url text,
  model text,
  last4 text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists universe_store.contact_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact','broken_link','incorrect_info')),
  name text,
  email text,
  message text not null check (char_length(message) between 5 and 4000),
  product_id uuid references universe_store.products(id) on delete set null,
  status text not null default 'new' check (status in ('new','read','resolved')),
  created_at timestamptz not null default now()
);

create table if not exists universe_store.rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

create or replace function universe_store.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = universe_store, pg_temp as $$
declare r universe_store.rate_limits;
begin
  insert into universe_store.rate_limits(key,count,window_start) values (p_key,0,now())
  on conflict (key) do nothing;
  select * into r from universe_store.rate_limits where key = p_key for update;
  if r.window_start < now() - make_interval(secs => p_window_seconds) then
    update universe_store.rate_limits set count = 1, window_start = now() where key = p_key;
    return true;
  end if;
  if r.count >= p_limit then return false; end if;
  update universe_store.rate_limits set count = count + 1 where key = p_key;
  return true;
end $$;
revoke all on function universe_store.hit_rate_limit(text,int,int) from public, anon, authenticated;
grant execute on function universe_store.hit_rate_limit(text,int,int) to service_role;

-- ---------------------------------------------------------------- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['members','categories','products','affiliate_links','guides','research_items',
    'content_drafts','campaigns','social_posts','social_accounts','automation_jobs','site_settings','provider_secrets']
  loop
    execute format('drop trigger if exists trg_touch on universe_store.%I', t);
    execute format('create trigger trg_touch before update on universe_store.%I for each row execute function universe_store.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RLS on every table
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'universe_store' loop
    execute format('alter table universe_store.%I enable row level security', t.tablename);
    execute format('alter table universe_store.%I force row level security', t.tablename);
  end loop;
end $$;

-- service_role (server only) gets full access; it bypasses RLS.
grant all on all tables in schema universe_store to service_role;
grant all on all sequences in schema universe_store to service_role;
alter default privileges in schema universe_store grant all on tables to service_role;
alter default privileges in schema universe_store grant all on sequences to service_role;

-- anon/authenticated: only public, published, non-sensitive columns.
revoke all on all tables in schema universe_store from anon, authenticated;
grant select on universe_store.categories to anon, authenticated;
grant select (id, slug, title, short_description, full_description, category_id, brand, retailer_name,
  displayed_price, currency, price_checked_at, price_source, availability_status, specifications, tags,
  editorial_status, featured_flag, is_deal, deal_note, deal_verified_at, deal_expires_at, is_demo,
  published_at, created_at, updated_at)
  on universe_store.products to anon, authenticated;
grant select on universe_store.product_images to anon, authenticated;
grant select (id, slug, kind, title, excerpt, body, selection_criteria, limitations, product_ids, status,
  ai_assisted, is_demo, published_at, created_at, updated_at)
  on universe_store.guides to anon, authenticated;
grant select (key, value, is_public) on universe_store.site_settings to anon, authenticated;
grant select (id, email, role, active, user_id) on universe_store.members to authenticated;

drop policy if exists "public read visible categories" on universe_store.categories;
create policy "public read visible categories" on universe_store.categories
  for select to anon, authenticated using (visible);

drop policy if exists "public read published products" on universe_store.products;
create policy "public read published products" on universe_store.products
  for select to anon, authenticated using (editorial_status = 'published');

drop policy if exists "public read images of published products" on universe_store.product_images;
create policy "public read images of published products" on universe_store.product_images
  for select to anon, authenticated using (exists (
    select 1 from universe_store.products p where p.id = product_id and p.editorial_status = 'published'));

drop policy if exists "public read published guides" on universe_store.guides;
create policy "public read published guides" on universe_store.guides
  for select to anon, authenticated using (status = 'published');

drop policy if exists "public read public settings" on universe_store.site_settings;
create policy "public read public settings" on universe_store.site_settings
  for select to anon, authenticated using (is_public);

drop policy if exists "members read own membership" on universe_store.members;
create policy "members read own membership" on universe_store.members
  for select to authenticated using (user_id = auth.uid());

-- Everything else (links, drafts, approvals, analytics, audit, secrets, messages) has NO
-- anon/authenticated policy: it is reachable only through server code using service_role
-- after an explicit role check.
