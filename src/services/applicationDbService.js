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
import { db, isFirebaseConfigured } from '../config/firebase';

const COLLECTION = 'applications';

function getCollection() {
  if (!db) return null;
  return collection(db, COLLECTION);
}

/**
 * Save (upsert) a loan application to Firestore.
 * Called by LoanContext on every state change alongside the existing
 * AsyncStorage write. The document ID is the applicationId so
 * repeated saves are idempotent.
 *
 * We strip `_rawState` and large base64 image data from the payload
 * to keep document sizes under Firestore's 1 MB limit. The full
 * images remain in AsyncStorage on the originating device.
 */
export async function saveApplicationToDb(state) {
  if (!isFirebaseConfigured() || !state?.applicationId) return;

  try {
    const ref = doc(db, COLLECTION, state.applicationId);

    // Shallow clone and strip heavy fields to stay under 1 MB
    const payload = { ...state };
    delete payload._rawState;

    // Strip base64 image data from kycData.images and kycData.rawResponse
    if (payload.kycData) {
      payload.kycData = { ...payload.kycData };
      if (Array.isArray(payload.kycData.images)) {
        payload.kycData.images = payload.kycData.images.map((img) => ({
          ...img,
          data: img.data ? `[base64:${img.data.length} chars]` : '',
          uri: img.uri ? `[uri:${img.uri.length} chars]` : '',
        }));
      }
      // Keep rawResponse reference but truncate if too large
      if (payload.kycData.rawResponse) {
        const raw = JSON.stringify(payload.kycData.rawResponse);
        if (raw.length > 500000) {
          payload.kycData.rawResponse = { _truncated: true, _originalSize: raw.length };
        }
      }
    }

    // Strip rawResponse from signzy verifications that might be large
    if (payload.signzyVerifications) {
      payload.signzyVerifications = { ...payload.signzyVerifications };
      for (const key of Object.keys(payload.signzyVerifications)) {
        const entry = payload.signzyVerifications[key];
        if (entry?.result?.rawResponse) {
          const raw = JSON.stringify(entry.result.rawResponse);
          if (raw.length > 200000) {
            payload.signzyVerifications[key] = {
              ...entry,
              result: {
                ...entry.result,
                rawResponse: { _truncated: true, _originalSize: raw.length },
              },
            };
          }
        }
      }
    }

    payload._updatedAt = serverTimestamp();
    if (!payload._createdAt) payload._createdAt = serverTimestamp();

    await setDoc(ref, payload, { merge: true });
    console.log('[applicationDb] Saved:', state.applicationId, '→', state.status);
  } catch (err) {
    console.log('[applicationDb] Save failed:', err?.message);
  }
}

/**
 * Load all applications from Firestore, ordered by last update.
 * Used by admin / credit / sales dashboards.
 */
export async function loadAllApplicationsFromDb() {
  if (!isFirebaseConfigured()) return [];

  try {
    const q = query(
      getCollection(),
      orderBy('lastUpdated', 'desc'),
    );
    const snapshot = await getDocs(q);
    const apps = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.applicationId) {
        apps.push(data);
      }
    });
    console.log('[applicationDb] Loaded', apps.length, 'application(s) from Firestore');
    return apps;
  } catch (err) {
    console.log('[applicationDb] Load failed:', err?.message);
    return [];
  }
}

/**
 * Load applications filtered by status (e.g. for credit queue).
 */
export async function loadApplicationsByStatus(statuses) {
  if (!isFirebaseConfigured() || !Array.isArray(statuses) || statuses.length === 0) return [];

  try {
    const q = query(
      getCollection(),
      where('status', 'in', statuses.slice(0, 10)), // Firestore 'in' max 10
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
    const ref = doc(db, COLLECTION, applicationId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.log('[applicationDb] Load by ID failed:', err?.message);
    return null;
  }
}
