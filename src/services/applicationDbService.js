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
import { db, storage, isFirebaseConfigured, STORAGE_UPLOADS_ENABLED } from '../config/firebase';

// When Cloud Storage uploads are disabled (no Blaze plan, etc.) we must
// also strip base64 image blobs out of the Firestore payload — otherwise
// the application doc can blow past Firestore's 1 MB per-doc limit the
// moment a CKYC response comes in. Kept close to stripHeavyBlobs in
// LoanContext so we don't drift.
function stripImagesForFirestore(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  if (out.kycData) {
    const kyc = { ...out.kycData };
    if (Array.isArray(kyc.images)) {
      kyc.images = kyc.images.map((img) => {
        if (!img?.data) return img;
        if (typeof img.data === 'string' && (img.data.startsWith('http') || img.data.startsWith('['))) {
          return img;
        }
        return { ...img, data: '[storage-disabled]' };
      });
    }
    if (typeof kyc.photo === 'string' && kyc.photo.length > 1000 && !kyc.photo.startsWith('http')) {
      kyc.photo = '[storage-disabled]';
    }
    if (typeof kyc.signature === 'string' && kyc.signature.length > 1000 && !kyc.signature.startsWith('http')) {
      kyc.signature = '[storage-disabled]';
    }
    out.kycData = kyc;
  }
  if (out.selfieData) {
    const s = { ...out.selfieData };
    for (const k of ['image', 'selfieImage', 'liveImage']) {
      if (typeof s[k] === 'string' && s[k].length > 1000 && !s[k].startsWith('http')) {
        s[k] = '[storage-disabled]';
      }
    }
    out.selfieData = s;
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

async function uploadImageToStorage(appId, filename, base64Data, contentType = 'image/jpeg') {
  if (!STORAGE_UPLOADS_ENABLED) return null;
  if (!storage || !base64Data || base64Data.length < 100) return null;
  if (storageBlockedByCors) return null;
  try {
    const storageRef = ref(storage, `applications/${appId}/images/${filename}`);
    // Handle both raw base64 and data URI formats
    const isDataUri = base64Data.startsWith('data:');
    if (isDataUri) {
      await uploadString(storageRef, base64Data, 'data_url');
    } else {
      await uploadString(storageRef, base64Data, 'base64', { contentType });
    }
    const url = await getDownloadURL(storageRef);
    return url;
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

/**
 * Upload all images from kycData.images and signzy verifications
 * to Firebase Storage, replacing base64 data with download URLs.
 */
async function uploadAllImages(appId, payload) {
  if (!STORAGE_UPLOADS_ENABLED) return payload;
  if (!storage) return payload;
  // Bail early when we already know Storage is blocked by CORS, so we
  // don't even try to dispatch the batch — the previous parallel
  // Promise.all meant the flag only kicked in AFTER the first failure,
  // but every sibling upload had already been fired into the void and
  // all of them filled the console with the same CORS error.
  if (storageBlockedByCors) return payload;

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
      if (storageBlockedByCors) { uploaded.push(img); continue; }
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
  if (!storageBlockedByCors
      && payload.kycData?.photo
      && typeof payload.kycData.photo === 'string'
      && payload.kycData.photo.length > 1000) {
    const url = await uploadImageToStorage(appId, 'kyc_photo.jpg', payload.kycData.photo);
    if (url) {
      payload.kycData = { ...payload.kycData, photo: url, photoStorageUrl: url };
    }
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

    // ── Upload images to Firebase Storage (or strip them) ──
    if (STORAGE_UPLOADS_ENABLED) {
      payload = await uploadAllImages(appId, payload);
    } else {
      // No Blaze plan → no Cloud Storage. Strip base64 images so the
      // Firestore doc doesn't blow past the 1 MB per-doc limit on a
      // CKYC-complete application. Staff tools will show a placeholder
      // where images would have been.
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

    const ref = doc(db, COLLECTION, appId);
    await setDoc(ref, payload, { merge: true });
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
        await setDoc(ref, minPayload, { merge: true });
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
