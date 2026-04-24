# Supabase Storage setup for KYC images

The app writes KYC / selfie blobs to Supabase Storage in the `kyc` bucket.
Configured via `src/config/firebase.js → STORAGE_PROVIDER = 'supabase'`
and `src/services/supabaseStorageService.js` (project URL + publishable
key are baked in).

You need ONE of the two policies below for uploads to succeed. Option A
is fine for testing — simpler, no SQL. Option B is the production-ish
setup — private bucket + RLS policies.

## Option A — make the bucket public (simplest, OK for testing)

1. Supabase dashboard → **Storage** → `kyc` bucket → ⚙️ → **Edit bucket**
2. Toggle **Public bucket** ON → Save.

That's it. The app uploads with the publishable key (writes require auth)
and every object is readable by public URL. KYC images are sensitive,
so prefer Option B before inviting real customers.

## Option B — keep the bucket private, allow anon INSERT + SELECT

Bucket policies aren't settable from the UI anymore — run this SQL
from the dashboard SQL Editor.

```sql
-- Allow anonymous uploads to the kyc bucket
CREATE POLICY "Anon can upload to kyc"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'kyc');

-- Allow anonymous reads of kyc objects (staff dashboards pull public URLs)
CREATE POLICY "Anon can read kyc"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'kyc');

-- Optional: let the anon role overwrite its own uploads (retry flow)
CREATE POLICY "Anon can upsert kyc"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'kyc')
WITH CHECK (bucket_id = 'kyc');
```

With these policies the bucket can stay "not public" in the dashboard —
the policies grant the specific grants the client needs and nothing
else. For genuinely private reads you'd switch to signed URLs; the
adapter has a TODO comment where that swap belongs.

## Clearing the "blocked" flag after fixing policies

If the adapter hits a 403 / 404 during a session it latches a flag in
`localStorage` to avoid repeated failures. After you apply the policy
above, clear it so uploads resume:

- DevTools → Application → Local Storage → delete
  `finz_supabase_storage_blocked_v1`, then reload.
- Or from the console:
  ```js
  localStorage.removeItem('finz_supabase_storage_blocked_v1')
  ```

## Switching providers later

In `src/config/firebase.js` flip:
```js
export const STORAGE_PROVIDER = 'firebase'; // or 'supabase' | 'none'
```
`uploadImageToStorage` dispatches to the chosen adapter; all the
upstream code (staff detail, bot, AsyncStorage stripping) stays
identical. When you eventually upgrade to Firebase Blaze, flip this
plus `STORAGE_UPLOADS_ENABLED` and everything routes back to Cloud
Storage without touching a screen.
