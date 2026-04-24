/**
 * Cloudinary Storage adapter (unsigned upload preset).
 *
 * Active while Firebase Blaze is being evaluated — free tier ships
 * 25 GB storage + 25 GB bandwidth/month, no card required. The
 * unsigned-preset flow is fully client-side: base64 → multipart
 * POST → hosted URL back. No backend, no new SDK dependency.
 *
 * Cloud name + preset are baked in because Cloudinary's unsigned
 * uploads are scoped to the preset anyway — leaking either in the
 * client bundle doesn't let someone upload to a different account.
 */

const CLOUDINARY_CLOUD_NAME = 'duqbtihqw';
const CLOUDINARY_UPLOAD_PRESET = 'finz_kyc_test';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Block the provider when the preset is clearly mis-configured so the
// first 4xx doesn't spam the console on every image on every reload.
// The flag is in-memory only for the current tab — a page reload
// (or opening the app the next day) retries so a transient misstep
// at preset-setup time doesn't leave all future KYCs silently
// un-stored. A persistent "hard block" signal requires MIN_FAILS
// consecutive 4xx failures within the same session.
const BLOCKED_FLAG_KEY = 'finz_cloudinary_storage_blocked_v2';
const BLOCKED_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_FAILS_BEFORE_HARD_BLOCK = 3;

let failCount = 0;
let cloudinaryBlocked = (() => {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(BLOCKED_FLAG_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    // Honour the hard-block only while it's fresh — past the TTL we
    // retry so a previously-bad preset can recover once fixed.
    if (parsed?.until && Date.now() < parsed.until) return true;
    localStorage.removeItem(BLOCKED_FLAG_KEY);
    return false;
  } catch (_) { return false; }
})();

function markBlocked() {
  failCount += 1;
  if (failCount < MIN_FAILS_BEFORE_HARD_BLOCK) return;
  cloudinaryBlocked = true;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        BLOCKED_FLAG_KEY,
        JSON.stringify({ until: Date.now() + BLOCKED_TTL_MS }),
      );
    }
  } catch (_) { /* ignore */ }
}

/** Clear the persisted blocked flag after you've fixed the preset / cloud name. */
export function resetCloudinaryBlockedFlag() {
  cloudinaryBlocked = false;
  failCount = 0;
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(BLOCKED_FLAG_KEY); }
  catch (_) { /* ignore */ }
}

/**
 * Cloudinary's `public_id` can't contain dots or slashes in the filename
 * part — the first piece is always treated as the folder path. We hand
 * over `public_id = applications/<appId>/images/<baseName>` and let
 * Cloudinary append the extension itself based on the uploaded bytes.
 */
function toPublicId(appId, filename) {
  const base = String(filename || '').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `applications/${appId}/images/${base}`;
}

/**
 * Upload a base64-encoded image to Cloudinary via the unsigned preset.
 * Returns the `secure_url` on success, null on any failure.
 */
export async function uploadImage(appId, filename, base64Data, contentType = 'image/jpeg') {
  if (cloudinaryBlocked) return null;
  if (!appId || !filename || !base64Data) return null;
  if (String(base64Data).length < 100) return null;

  // Eagerly drop the legacy v1 sticky-block flag — users who hit a
  // misconfigured preset early had v1 written to localStorage and it
  // never auto-cleared, silently blocking every upload even after
  // the preset was fixed. v2's blocked flag has a TTL instead.
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem('finz_cloudinary_storage_blocked_v1'); }
  catch (_) { /* ignore */ }

  // Cloudinary accepts either a data URI OR raw base64 — wrap raw
  // base64 into a data URI so we don't need FormData shenanigans.
  const dataUri = String(base64Data).startsWith('data:')
    ? base64Data
    : `data:${contentType};base64,${base64Data}`;

  const formData = new FormData();
  formData.append('file', dataUri);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('public_id', toPublicId(appId, filename));
  // Overwrite on retry — matches Supabase's x-upsert behaviour.
  formData.append('overwrite', 'true');

  try {
    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const is4xx = response.status >= 400 && response.status < 500;
      if (is4xx) {
        markBlocked();
        console.warn(
          `[cloudinaryStorage] Upload rejected (HTTP ${response.status}). ` +
          `Check the cloud name (${CLOUDINARY_CLOUD_NAME}) + upload preset ` +
          `(${CLOUDINARY_UPLOAD_PRESET}) are correct and the preset is Unsigned. ` +
          `Body: ${body.slice(0, 200)}`,
        );
      } else {
        console.log('[cloudinaryStorage] Upload failed:', response.status, body.slice(0, 200));
      }
      return null;
    }

    const json = await response.json().catch(() => null);
    const url = json?.secure_url || json?.url || null;
    if (!url) {
      console.log('[cloudinaryStorage] No URL in response:', json);
      return null;
    }
    // Reset the consecutive-failure counter — one success means the
    // preset / cloud name are fine, no need to hard-block after past
    // transient errors.
    failCount = 0;
    console.log('[cloudinaryStorage] Upload ok:', filename, '→', url.slice(0, 80) + '…');
    return url;
  } catch (err) {
    console.log('[cloudinaryStorage] Upload network error:', err?.message);
    return null;
  }
}

export const cloudinaryStorageService = { uploadImage };
