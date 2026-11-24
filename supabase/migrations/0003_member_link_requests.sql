-- Invited members are linked to an auth user only after the Owner confirms the request,
-- because the shared Supabase Auth may not verify email ownership.
alter table universe_store.members add column if not exists pending_user_id uuid references auth.users(id) on delete set null;
alter table universe_store.members add column if not exists pending_requested_at timestamptz;
