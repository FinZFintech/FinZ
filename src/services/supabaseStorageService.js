/**
 * Supabase Storage adapter.
 *
 * Free-tier alternative to Firebase Storage while Blaze is still being
 * evaluated. Uses the Supabase Storage REST API directly — no
 * @supabase/supabase-js package dependency, so no bundle bloat.
 *
 * Bucket policy expected (set in Supabase dashboard → Storage → kyc):
 *   - EITHER: "Public bucket" flag ON (read-only public URLs,
 *     uploads still require the anon key; simplest for testing)
 *   - OR: bucket stays private, add RLS policies:
 *         INSERT for role 'anon' with check (bucket_id = 'kyc')
 *         SELECT for role 'anon' with check (bucket_id = 'kyc')
 *     In that case every URL we return needs a short-lived signed URL;
 *     swap the publicUrl() call below for createSignedUrl().
 *
 * See scripts/README-supabase-kyc-bucket.md for the SQL.
 */

const SUPABASE_URL = 'https://hcpmfdpnxrwrnhimwsuw.supabase.co';
// Publishable key — safe to ship in client code. Bucket RLS enforces
// per-row access; this key alone can't bypass those policies.
const SUPABASE_KEY = 'sb_publishable_LYP-8UErcF6ll4UBgCfUUw_tp8f9JCy';
const BUCKET = 'kyc';

// Cache the "storage reachable?" check — lets the caller short-circuit
// when the bucket is misconfigured (403 / 404) without spamming the
// console on every KYC image. Flag persists across sessions via
// localStorage so reloading doesn't re-probe.
const BLOCKED_FLAG_KEY = 'finz_supabase_storage_blocked_v1';
let supabaseBlocked = (() => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(BLOCKED_FLAG_KEY) === '1'; }
  catch (_) { return false; }
})();

function markBlocked() {
  supabaseBlocked = true;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(BLOCKED_FLAG_KEY, '1'); }
  catch (_) { /* ignore */ }
}

/** Clear the persisted "blocked" flag after you've fixed the RLS / bucket policy. */
export function resetSupabaseBlockedFlag() {
  supabaseBlocked = false;
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(BLOCKED_FLAG_KEY); }
  catch (_) { /* ignore */ }
}

/**
 * Upload a base64-encoded image to Supabase Storage at
 *   kyc/applications/<appId>/images/<filename>
 *
 * Returns the public URL on success, null on any failure (so the
 * calling code can fall back to placeholders without crashing).
 */
export async function uploadImage(appId, filename, base64Data, contentType = 'image/jpeg') {
  if (supabaseBlocked) return null;
  if (!appId || !filename || !base64Data) return null;

  // Strip the `data:image/...;base64,` prefix if present, then decode.
  const clean = String(base64Data).replace(/^data:[^;]+;base64,/i, '');
  if (clean.length < 100) return null;

  let bytes;
  try {
    const binary = atob(clean);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch (err) {
    console.log('[supabaseStorage] base64 decode failed:', err?.message);
    return null;
  }

  const path = `applications/${appId}/images/${filename}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        'Content-Type': contentType,
        // Overwrite the object if a previous attempt partially uploaded
        // it — same app can re-submit KYC and the image path is
        // deterministic (sequence-based).
        'x-upsert': 'true',
      },
      body: bytes,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const is4xx = response.status >= 400 && response.status < 500;
      if (is4xx) {
        markBlocked();
        console.warn(
          `[supabaseStorage] Upload rejected (HTTP ${response.status}). ` +
          `Check the 'kyc' bucket exists and its RLS policies allow anon INSERT. ` +
          `Body: ${body.slice(0, 200)}`,
        );
      } else {
        console.log('[supabaseStorage] Upload failed:', response.status, body.slice(0, 200));
      }
      return null;
    }

    // Public URL for the uploaded object. Works when the bucket's
    // "Public bucket" flag is on OR the kyc bucket has a SELECT RLS
    // policy for role 'anon'. If you move to signed URLs later,
    // swap this for a POST to /storage/v1/object/sign/<bucket>/<path>.
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  } catch (err) {
    console.log('[supabaseStorage] Upload network error:', err?.message);
    return null;
  }
}

export const supabaseStorageService = { uploadImage };
