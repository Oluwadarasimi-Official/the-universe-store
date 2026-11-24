-- 0004: AliExpress affiliate tracking ID (site setting, not public).
-- The account's only tracking ID is "default" (verified live in the
-- AliExpress Affiliate portal, Account → Tracking ID, 24 Nov 2026;
-- created 2026/11/24, marked Default). The app also falls back to
-- "default" when the setting is missing, so the format tester works
-- even before this migration is run. The Owner can change it in
-- Admin → Settings → AliExpress tracking ID. It is only used by the
-- Affiliate Links format tester to check that a pasted AliExpress link
-- carries the owner's tracking ID. Links are never built by hand and
-- are never auto-verified; the owner-verification rule is unchanged.
insert into universe_store.site_settings(key, value, is_public) values
  ('aliexpress_tracking_id', '"default"', false)
on conflict (key) do nothing;
