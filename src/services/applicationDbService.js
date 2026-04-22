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
import { db, storage, isFirebaseConfigured } from '../config/firebase';

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
async function uploadImageToStorage(appId, filename, base64Data, contentType = 'image/jpeg') {
  if (!storage || !base64Data || base64Data.length < 100) return null;
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
    console.log('[applicationDb] Image upload failed:', filename, err?.message);
    return null;
  }
}

/**
 * Upload all images from kycData.images and signzy verifications
 * to Firebase Storage, replacing base64 data with download URLs.
 */
async function uploadAllImages(appId, payload) {
  if (!storage) return payload;

  // KYC images (photograph, signature, address proof, etc.)
  if (payload.kycData?.images && Array.isArray(payload.kycData.images)) {
    const uploaded = await Promise.all(
      payload.kycData.images.map(async (img, idx) => {
        if (!img.data || img.data.startsWith('http') || img.data.startsWith('[')) {
          return img; // already a URL or placeholder
        }
        const ext = img.type === 'png' ? 'png' : 'jpg';
        const filename = `kyc_${img.code || idx}_${img.sequence || idx}.${ext}`;
        const downloadUrl = await uploadImageToStorage(appId, filename, img.data, img.mime || 'image/jpeg');
        return {
          ...img,
          uri: downloadUrl || img.uri,
          data: downloadUrl ? `[uploaded:${filename}]` : img.data,
          storageUrl: downloadUrl || '',
        };
      }),
    );
    payload.kycData = { ...payload.kycData, images: uploaded };
  }

  // KYC photo field (single base64 string)
  if (payload.kycData?.photo && typeof payload.kycData.photo === 'string' && payload.kycData.photo.length > 1000) {
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

    // ── Upload images to Firebase Storage ──
    payload = await uploadAllImages(appId, payload);

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
