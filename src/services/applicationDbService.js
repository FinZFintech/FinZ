import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured, STORAGE_UPLOADS_ENABLED, STORAGE_PROVIDER } from '../config/firebase';
import { uploadImage as supabaseUploadImage } from './supabaseStorageService';
import { uploadImage as cloudinaryUploadImage } from './cloudinaryStorageService';

// When Cloud Storage uploads are disabled (no Blaze plan, etc.) we must
// also strip base64 image blobs out of the Firestore payload — otherwise
// the application doc can blow past Firestore's 1 MB per-doc limit the
// moment a CKYC response comes in. Kept close to stripHeavyBlobs in
// LoanContext so we don't drift.
/**
 * Firestore documents can't store nested arrays — `[[a, b]]` raises
 * `Function setDoc() called with invalid data. Nested arrays are not
 * supported`, killing the whole save and leaving the dashboards stuck
 * on stale data. Walk the payload and convert any inner array to an
 * indexed object ({0: …, 1: …}) so the write succeeds. Read-side
 * consumers already use `(arr || [])[0]?.[0] || (arr || [])[0]` style
 * fallbacks, so the conversion is transparent for the few legacy
 * shapes that ever wanted nesting.
 */
function flattenNestedArraysForFirestore(value, depth = 0) {
  if (depth > 8) return value; // cap recursion
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (Array.isArray(v)) {
        // Convert inner array → indexed object so Firestore accepts it.
        const obj = {};
        v.forEach((inner, i) => { obj[i] = flattenNestedArraysForFirestore(inner, depth + 1); });
        return obj;
      }
      return flattenNestedArraysForFirestore(v, depth + 1);
    });
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = flattenNestedArraysForFirestore(v, depth + 1);
    }
    return out;
  }
  return value;
}

function stripImagesForFirestore(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  if (out.kycData) {
    const kyc = { ...out.kycData };
    if (Array.isArray(kyc.images)) {
      kyc.images = kyc.images.map((img) => {
        if (!img) return img;
        const out = { ...img };
        // Blank base64 `data` AND any `data:` URI on `uri`, since
        // img.uri = `data:${mime};base64,${img.data}` — keeping one
        // without the other still blows the 1 MB Firestore doc cap.
        // HTTP URIs and previously-uploaded placeholders pass through.
        if (typeof out.data === 'string'
            && !out.data.startsWith('http')
            && !out.data.startsWith('[')) {
          out.data = '[not-uploaded]';
        }
        if (typeof out.uri === 'string'
            && out.uri.startsWith('data:')) {
          out.uri = '[not-uploaded]';
        }
        return out;
      });
    }
    if (typeof kyc.photo === 'string' && kyc.photo.length > 1000 && !kyc.photo.startsWith('http')) {
      kyc.photo = '[not-uploaded]';
    }
    if (typeof kyc.signature === 'string' && kyc.signature.length > 1000 && !kyc.signature.startsWith('http')) {
      kyc.signature = '[not-uploaded]';
    }
    out.kycData = kyc;
  }
  if (out.selfieData) {
    const s = { ...out.selfieData };
    for (const k of ['image', 'selfieImage', 'liveImage']) {
      if (typeof s[k] === 'string' && s[k].length > 1000 && !s[k].startsWith('http')) {
        s[k] = '[not-uploaded]';
      }
    }
    out.selfieData = s;
  }
  // Higher-ed supporting documents (offer letters, fee break-ups, etc.)
  // share the same 1 MB cap risk: each PDF/image is megabytes when
  // base64-encoded. Mirror the kyc/selfie strip so a failed upload
  // doesn't blow the Firestore doc.
  if (Array.isArray(out.supportingDocuments)) {
    out.supportingDocuments = out.supportingDocuments.map((d) => {
      if (!d) return d;
      const sd = { ...d };
      if (typeof sd.data === 'string'
          && sd.data.length > 500
          && !sd.data.startsWith('http')
          && !sd.data.startsWith('[')) {
        sd.data = '[not-uploaded]';
      }
      if (typeof sd.uri === 'string' && sd.uri.startsWith('data:')) {
        sd.uri = sd.storageUrl || '[not-uploaded]';
      }
      return sd;
    });
  }
  return out;
}

const COLLECTION = 'applications';
const RAW_DATA_SUBCOLLECTION = 'rawData';

function getCollection() {
  if (!db) return null;
  return collection(db, COLLECTION);
}

// ─── Image upload to Firebase Storage ────────────────────────────────────────

/**
 * Upload a base64 image to Firebase Storage and return the download URL.
 * Path: applications/{appId}/images/{filename}
 */
// Once we've seen a CORS / preflight failure from Firebase Storage we
// know the bucket policy isn't set (see scripts/README-storage-cors.md).
// Keep uploading anyway so the first failure path still logs — but
// suppress the stacks after that so the console isn't spammed during
// KYC / selfie uploads and surface a single actionable message.
// Persisted to localStorage so a subsequent page load doesn't re-try
// and re-spam the console until the bucket policy is applied.
const STORAGE_CORS_FLAG_KEY = 'finz_storage_cors_blocked_v1';
let storageBlockedByCors = (() => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_CORS_FLAG_KEY) === '1'; }
  catch (_) { return false; }
})();

function markStorageBlockedByCors() {
  storageBlockedByCors = true;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_CORS_FLAG_KEY, '1'); }
  catch (_) { /* ignore */ }
}

/**
 * Clear the persisted CORS-blocked flag — call once the bucket policy
 * has been applied (`gsutil cors set scripts/storage-cors.json …`) so
 * uploads start being attempted again.
 */
export function resetStorageCorsFlag() {
  storageBlockedByCors = false;
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_CORS_FLAG_KEY); }
  catch (_) { /* ignore */ }
}

/**
 * Dispatches to whichever storage provider is configured in
 * src/config/firebase.js → STORAGE_PROVIDER. Returns a public URL on
 * success, null on any failure — callers treat null as "leave as
 * local / unstored placeholder" so the flow never blocks on storage.
 */
async function uploadImageToStorage(appId, filename, base64Data, contentType = 'image/jpeg') {
  if (!base64Data || base64Data.length < 100) return null;

  if (STORAGE_PROVIDER === 'cloudinary') {
    // Cloudinary unsigned upload preset — fully client-side, base64 in,
    // secure_url back. Adapter handles its own errors + blocked flag.
    return cloudinaryUploadImage(appId, filename, base64Data, contentType);
  }

  if (STORAGE_PROVIDER === 'supabase') {
    // Supabase Storage — adapter handles its own errors + RLS flag.
    return supabaseUploadImage(appId, filename, base64Data, contentType);
  }

  if (STORAGE_PROVIDER === 'firebase') {
    if (!STORAGE_UPLOADS_ENABLED) return null;
    if (!storage) return null;
    if (storageBlockedByCors) return null;
    try {
      const storageRef = ref(storage, `applications/${appId}/images/${filename}`);
      const isDataUri = base64Data.startsWith('data:');
      if (isDataUri) {
        await uploadString(storageRef, base64Data, 'data_url');
      } else {
        await uploadString(storageRef, base64Data, 'base64', { contentType });
      }
      return await getDownloadURL(storageRef);
    } catch (err) {
      const msg = err?.message || '';
      const isCors = err?.code === 'storage/unknown'
        || /preflight|CORS|cors|ERR_FAILED/i.test(msg)
        || (err?.serverResponse === undefined && err?.status === undefined);
      if (isCors) {
        const first = !storageBlockedByCors;
        markStorageBlockedByCors();
        if (first) {
          console.warn(
            '[applicationDb] Firebase Storage uploads blocked by CORS. ' +
            'Apply the bucket policy with:\n' +
            '  gsutil cors set scripts/storage-cors.json gs://finz-2e9dc.firebasestorage.app\n' +
            'See scripts/README-storage-cors.md. Continuing without image uploads — ' +
            'call resetStorageCorsFlag() from applicationDbService after applying the policy.',
          );
        }
      } else {
        console.log('[applicationDb] Image upload failed:', filename, msg);
      }
      return null;
    }
  }

  // STORAGE_PROVIDER === 'none'
  return null;
}

/** True when any storage provider is wired up and willing to take the call. */
function storageProviderActive() {
  if (STORAGE_PROVIDER === 'cloudinary') return true;
  if (STORAGE_PROVIDER === 'supabase') return true;
  if (STORAGE_PROVIDER === 'firebase') return !!(STORAGE_UPLOADS_ENABLED && storage && !storageBlockedByCors);
  return false;
}

/**
 * Upload all images from kycData.images and signzy verifications
 * to the active storage provider, replacing base64 data with public URLs.
 */
async function uploadAllImages(appId, payload) {
  if (!storageProviderActive()) return payload;

  // KYC images (photograph, signature, address proof, etc.)
  // Sequential on purpose — lets the CORS short-circuit in
  // uploadImageToStorage stop the remaining uploads after one failure.
  if (payload.kycData?.images && Array.isArray(payload.kycData.images)) {
    const uploaded = [];
    for (let idx = 0; idx < payload.kycData.images.length; idx++) {
      const img = payload.kycData.images[idx];
      if (!img.data || img.data.startsWith('http') || img.data.startsWith('[')) {
        uploaded.push(img);
        continue;
      }
      // Short-circuit the remaining iterations after the active
      // provider signals it's unavailable — CORS on Firebase, 4xx /
      // RLS-reject on Supabase.
      if (!storageProviderActive()) { uploaded.push(img); continue; }
      const ext = img.type === 'png' ? 'png' : 'jpg';
      const filename = `kyc_${img.code || idx}_${img.sequence || idx}.${ext}`;
      const downloadUrl = await uploadImageToStorage(appId, filename, img.data, img.mime || 'image/jpeg');
      uploaded.push({
        ...img,
        uri: downloadUrl || img.uri,
        data: downloadUrl ? `[uploaded:${filename}]` : img.data,
        storageUrl: downloadUrl || '',
      });
    }
    payload.kycData = { ...payload.kycData, images: uploaded };
  }

  // KYC photo field (single base64 string)
  if (storageProviderActive()
      && payload.kycData?.photo
      && typeof payload.kycData.photo === 'string'
      && payload.kycData.photo.length > 1000) {
    const url = await uploadImageToStorage(appId, 'kyc_photo.jpg', payload.kycData.photo);
    if (url) {
      payload.kycData = { ...payload.kycData, photo: url, photoStorageUrl: url };
    }
  }

  // Supporting documents (offer letter, passport, fee break-up, etc. —
  // uploaded by the customer via SupportingDocuments screen or by sales
  // from the admin detail screen). Same shape as kyc images: data is
  // base64, contentType + fileName carry over so the dashboard can
  // render PDFs and images correctly.
  if (storageProviderActive() && Array.isArray(payload.supportingDocuments)) {
    const uploaded = [];
    for (let idx = 0; idx < payload.supportingDocuments.length; idx++) {
      const d = payload.supportingDocuments[idx];
      if (!d) { continue; }
      // Already-uploaded entries (storageUrl present) and entries that
      // never carried base64 (placeholder rows added by other flows)
      // pass through untouched.
      if (d.storageUrl || !d.data || d.data.startsWith('http') || d.data.startsWith('[')) {
        uploaded.push(d); continue;
      }
      if (!storageProviderActive()) { uploaded.push(d); continue; }
      const ext = (d.fileName?.split('.').pop()
        || (d.contentType?.includes('pdf') ? 'pdf' : 'jpg'));
      const filename = `support_${d.code || 'misc'}_${idx}.${ext}`;
      const url = await uploadImageToStorage(appId, filename, d.data, d.contentType || 'image/jpeg');
      uploaded.push({
        ...d,
        uri: url || d.uri,
        data: url ? `[uploaded:${filename}]` : d.data,
        storageUrl: url || '',
      });
    }
    payload.supportingDocuments = uploaded;
  }

  return payload;
}

// ─── Raw data subcollection ──────────────────────────────────────────────────

/**
 * Store a raw API response in a subcollection document so the main
 * application document stays under Firestore's 1MB limit.
 */
async function saveRawData(appId, key, data) {
  if (!db || !data) return;
  try {
    const rawStr = typeof data === 'string' ? data : JSON.stringify(data);
    // Firestore doc limit is 1MB. If the raw data exceeds 900KB, truncate.
    const truncated = rawStr.length > 900000;
    const safeData = truncated
      ? { _truncated: true, _originalSize: rawStr.length, _preview: rawStr.slice(0, 50000) }
      : data;

    const rawRef = doc(db, COLLECTION, appId, RAW_DATA_SUBCOLLECTION, key);
    await setDoc(rawRef, {
      key,
      data: safeData,
      size: rawStr.length,
      savedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.log('[applicationDb] saveRawData failed:', key, err?.message);
  }
}

// ─── Main save function ──────────────────────────────────────────────────────

/**
 * Save (upsert) a loan application to Firestore.
 *
 * Strategy:
 * 1. Upload base64 images to Firebase Storage → replace with download URLs
 * 2. Move rawResponse / rawJson fields to a subcollection
 * 3. Keep ALL extracted fields in the main document (name, dob, address,
 *    documents, income, tax, employers, etc.)
 */
export async function saveApplicationToDb(state) {
  if (!isFirebaseConfigured() || !state?.applicationId) return;

  try {
    const appId = state.applicationId;
    let payload = { ...state };
    delete payload._rawState;

    // ── Upload images (or strip them) ──
    // Runs whenever any provider is active (Firebase Blaze OR
    // Supabase). uploadAllImages internally short-circuits per
    // provider's own block-flag so this stays safe if the provider
    // rejects mid-batch.
    if (storageProviderActive()) {
      payload = await uploadAllImages(appId, payload);
      // After upload, replace any still-base64 image with the sentinel
      // so the Firestore doc doesn't blow past 1 MB even if one image
      // failed upload and kept its inline base64 data.
      payload = stripImagesForFirestore(payload);
    } else {
      // No upload provider configured → strip base64 images so the
      // Firestore doc stays under 1 MB. Staff tools show the
      // consolidated "captured but not stored" banner.
      payload = stripImagesForFirestore(payload);
    }

    // ── Move raw responses to subcollection ──
    const rawDataPromises = [];

    // KYC raw response
    if (payload.kycData?.rawResponse) {
      rawDataPromises.push(saveRawData(appId, 'kyc_rawResponse', payload.kycData.rawResponse));
      payload.kycData = { ...payload.kycData };
      delete payload.kycData.rawResponse;
    }
    if (payload.kycData?.raw) {
      rawDataPromises.push(saveRawData(appId, 'kyc_raw', payload.kycData.raw));
      payload.kycData = { ...payload.kycData };
      delete payload.kycData.raw;
    }

    // Signzy verification raw responses
    if (payload.signzyVerifications) {
      payload.signzyVerifications = { ...payload.signzyVerifications };
      for (const key of Object.keys(payload.signzyVerifications)) {
        const entry = payload.signzyVerifications[key];
        if (entry?.result?.rawResponse) {
          rawDataPromises.push(saveRawData(appId, `signzy_${key}_rawResponse`, entry.result.rawResponse));
          payload.signzyVerifications[key] = {
            ...entry,
            result: { ...entry.result },
          };
          delete payload.signzyVerifications[key].result.rawResponse;
        }
        // ITR rawJson per year (can be very large)
        if (entry?.result?.itrByYear) {
          payload.signzyVerifications[key] = {
            ...entry,
            result: {
              ...entry.result,
              itrByYear: entry.result.itrByYear.map((yr) => {
                if (yr.rawJson) {
                  rawDataPromises.push(saveRawData(appId, `itr_${yr.assessmentYear}_json`, yr.rawJson));
                  const { rawJson, ...rest } = yr;
                  return rest;
                }
                return yr;
              }),
            },
          };
        }
      }
    }

    // Fire all raw data saves concurrently (non-blocking for the main doc)
    if (rawDataPromises.length > 0) {
      Promise.all(rawDataPromises).catch((err) =>
        console.log('[applicationDb] Some raw data saves failed:', err?.message),
      );
    }

    // ── Strip any remaining base64 blobs that might have failed upload ──
    if (payload.kycData?.images) {
      payload.kycData.images = payload.kycData.images.map((img) => {
        if (img.data && !img.data.startsWith('[') && !img.data.startsWith('http') && img.data.length > 10000) {
          return { ...img, data: `[local:${img.data.length} chars]`, uri: img.storageUrl || img.uri || '' };
        }
        return img;
      });
    }
    if (payload.kycData?.photo && typeof payload.kycData.photo === 'string' && payload.kycData.photo.length > 10000) {
      payload.kycData = { ...payload.kycData, photo: `[local:${payload.kycData.photo.length} chars]` };
    }

    payload._updatedAt = serverTimestamp();
    if (!payload._createdAt) payload._createdAt = serverTimestamp();

    // Defence-in-depth: Firestore rejects nested arrays. CKYC + future
    // verification responses can shape addresses / tags / matrices as
    // [[a, b]] which kills the whole save. Walk the payload and convert
    // any inner array to an indexed object so the write succeeds.
    const writePayload = flattenNestedArraysForFirestore(payload);

    const ref = doc(db, COLLECTION, appId);
    await setDoc(ref, writePayload, { merge: true });
    console.log('[applicationDb] Saved:', appId, '→', state.status);
  } catch (err) {
    console.log('[applicationDb] Save failed:', err?.message);
    // If the doc is still too large, try saving without kycData images entirely
    if (err?.message?.includes('exceeds the maximum') || err?.code === 'invalid-argument') {
      try {
        const minPayload = { ...state };
        delete minPayload._rawState;
        if (minPayload.kycData) {
          minPayload.kycData = { ...minPayload.kycData };
          delete minPayload.kycData.images;
          delete minPayload.kycData.photo;
          delete minPayload.kycData.rawResponse;
          delete minPayload.kycData.raw;
        }
        if (minPayload.signzyVerifications) {
          minPayload.signzyVerifications = { ...minPayload.signzyVerifications };
          for (const key of Object.keys(minPayload.signzyVerifications)) {
            const entry = minPayload.signzyVerifications[key];
            if (entry?.result?.rawResponse) {
              minPayload.signzyVerifications[key] = { ...entry, result: { ...entry.result } };
              delete minPayload.signzyVerifications[key].result.rawResponse;
            }
            if (entry?.result?.itrByYear) {
              minPayload.signzyVerifications[key].result.itrByYear =
                entry.result.itrByYear.map(({ rawJson, ...rest }) => rest);
            }
          }
        }
        minPayload._updatedAt = serverTimestamp();
        minPayload._savedWithoutImages = true;
        const ref = doc(db, COLLECTION, state.applicationId);
        await setDoc(ref, flattenNestedArraysForFirestore(minPayload), { merge: true });
        console.log('[applicationDb] Saved (without images):', state.applicationId);
      } catch (retryErr) {
        console.log('[applicationDb] Retry save also failed:', retryErr?.message);
      }
    }
  }
}

// ─── Read functions ──────────────────────────────────────────────────────────

/**
 * Load all applications from Firestore, ordered by last update.
 */
export async function loadAllApplicationsFromDb() {
  if (!isFirebaseConfigured()) return [];

  try {
    const q = query(getCollection(), orderBy('lastUpdated', 'desc'));
    const snapshot = await getDocs(q);
    const apps = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.applicationId) apps.push(data);
    });
    console.log('[applicationDb] Loaded', apps.length, 'application(s) from Firestore');
    return apps;
  } catch (err) {
    console.log('[applicationDb] Load failed:', err?.message);
    return [];
  }
}

/**
 * Load applications filtered by status.
 */
export async function loadApplicationsByStatus(statuses) {
  if (!isFirebaseConfigured() || !Array.isArray(statuses) || statuses.length === 0) return [];

  try {
    const q = query(
      getCollection(),
      where('status', 'in', statuses.slice(0, 10)),
      orderBy('lastUpdated', 'desc'),
    );
    const snapshot = await getDocs(q);
    const apps = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.applicationId) apps.push(data);
    });
    return apps;
  } catch (err) {
    console.log('[applicationDb] Load by status failed:', err?.message);
    return [];
  }
}

/**
 * Load a single application by ID.
 */
export async function loadApplicationById(applicationId) {
  if (!isFirebaseConfigured() || !applicationId) return null;

  try {
    const docRef = doc(db, COLLECTION, applicationId);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.log('[applicationDb] Load by ID failed:', err?.message);
    return null;
  }
}

/**
 * Load raw data from the subcollection for an application.
 */
export async function loadRawData(applicationId, key) {
  if (!isFirebaseConfigured() || !applicationId || !key) return null;

  try {
    const rawRef = doc(db, COLLECTION, applicationId, RAW_DATA_SUBCOLLECTION, key);
    const snap = await getDoc(rawRef);
    return snap.exists() ? snap.data()?.data || null : null;
  } catch (err) {
    console.log('[applicationDb] Load raw data failed:', key, err?.message);
    return null;
  }
}

/**
 * Load all raw data documents for an application.
 */
export async function loadAllRawData(applicationId) {
  if (!isFirebaseConfigured() || !applicationId) return {};

  try {
    const rawCol = collection(db, COLLECTION, applicationId, RAW_DATA_SUBCOLLECTION);
    const snapshot = await getDocs(rawCol);
    const result = {};
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.key) result[d.key] = d.data;
    });
    return result;
  } catch (err) {
    console.log('[applicationDb] Load all raw data failed:', err?.message);
    return {};
  }
}
