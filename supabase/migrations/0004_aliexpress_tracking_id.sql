-- 0004: AliExpress affiliate tracking ID (site setting, not public).
-- The Owner pastes the ID from the AliExpress affiliate portal in
-- Admin → Settings → AliExpress tracking ID. It is only used by the
-- Affiliate Links format tester to check that a pasted AliExpress link
-- carries the owner's tracking ID. Links are never built by hand and
-- are never auto-verified; the owner-verification rule is unchanged.
insert into universe_store.site_settings(key, value, is_public) values
  ('aliexpress_tracking_id', 'null', false)
on conflict (key) do nothing;
