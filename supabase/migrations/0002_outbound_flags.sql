-- Public-safe flags so the storefront can show a retailer button without exposing affiliate URLs.
alter table universe_store.products add column if not exists outbound_ready boolean not null default false;
alter table universe_store.products add column if not exists outbound_host text;
grant select (outbound_ready, outbound_host) on universe_store.products to anon, authenticated;

-- Keep products.outbound_* in sync with the primary affiliate link (only owner-verified links count).
create or replace function universe_store.sync_outbound() returns trigger
language plpgsql security definer set search_path = universe_store, pg_temp as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
declare l record;
begin
  select url, status into l from universe_store.affiliate_links where product_id = pid and is_primary limit 1;
  update universe_store.products set
    outbound_ready = coalesce(l.status = 'verified', false),
    outbound_host = case when l.status = 'verified' then substring(l.url from '^https?://(?:www\.)?([^/:?#]+)') else null end,
    affiliate_url = l.url
  where id = pid;
  return null;
end $$;
revoke all on function universe_store.sync_outbound() from public, anon, authenticated;
drop trigger if exists trg_sync_outbound on universe_store.affiliate_links;
create trigger trg_sync_outbound after insert or update or delete on universe_store.affiliate_links
  for each row execute function universe_store.sync_outbound();
