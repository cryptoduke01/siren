-- Supabase Storage: public bucket for profile avatars (POST /api/users/avatar).
-- Run in Supabase SQL editor. If policies fail (already exist), create the bucket from the Dashboard instead:
-- Storage → New bucket → name: avatars → Public.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Optional: Storage → avatars → Policies
-- - Allow public SELECT on objects in bucket `avatars`
-- - Allow INSERT/UPDATE for the service role (backend uses SUPABASE_SERVICE_ROLE_KEY; if upload still fails,
--   add policies for `storage.objects` with bucket_id = 'avatars' per Supabase docs.)
