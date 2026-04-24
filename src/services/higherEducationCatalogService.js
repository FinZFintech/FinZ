/**
 * Higher Education catalog override service.
 *
 * The selection screen reads its country / state / university / course
 * options from the static bundled catalog (higherEducationData.js) by
 * default. Admin staff can override that catalog through the
 * AdminHigherEdCatalog screen — overrides are persisted in Firestore
 * (`config/higherEdCatalog`) so every device picks them up, with a
 * local AsyncStorage cache so the picker boots without a network
 * round-trip.
 *
 * The override shape mirrors HIGHER_EDUCATION_CATALOG exactly. When an
 * override exists the picker uses it WHOLESALE — i.e. the admin
 * decides whether to keep / replace / extend the bundled list. The
 * helpers exposed by this service have the same signature as the ones
 * in higherEducationData.js (listCountries, listStates, …) so the
 * screen can swap in a custom helper bag without conditional code.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import {
  HIGHER_EDUCATION_CATALOG as BUNDLED_CATALOG,
  USD_TO_INR_RATE,
} from './higherEducationData';

const STORAGE_KEY = 'finz_higher_ed_catalog_override_v1';
const CONFIG_DOC_PATH = ['config', 'higherEdCatalog'];

/**
 * Load the active catalog: admin override if present, else the bundled
 * one. Tries the AsyncStorage cache first for speed, then asks
 * Firestore in the background and refreshes the cache.
 */
export async function loadActiveCatalog() {
  // Cached override (sync-fast path)
  let cached = null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (_) { /* ignore */ }

  // Background-refresh from Firestore — non-blocking; the next picker
  // open picks up the freshest version.
  if (isFirebaseConfigured()) {
    getDoc(doc(db, ...CONFIG_DOC_PATH))
      .then(async (snap) => {
        if (snap.exists()) {
          const remote = snap.data()?.catalog || null;
          if (remote && JSON.stringify(remote) !== JSON.stringify(cached)) {
            try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote)); }
            catch (_) { /* ignore */ }
          }
        }
      })
      .catch(() => { /* network failure leaves the cache as-is */ });
  }

  return cached || BUNDLED_CATALOG;
}

/**
 * Persist a catalog override. Writes to Firestore (so other devices
 * pick it up) AND the local cache (so this device picks it up
 * immediately without re-reading Firestore).
 */
export async function saveCatalogOverride(catalog) {
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('catalog must be an object keyed by country code');
  }
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(catalog)); }
  catch (_) { /* ignore */ }

  if (isFirebaseConfigured()) {
    await setDoc(doc(db, ...CONFIG_DOC_PATH), {
      catalog,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}

/** Reset to the bundled catalog (clears both cache + Firestore doc). */
export async function clearCatalogOverride() {
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
  if (isFirebaseConfigured()) {
    await setDoc(doc(db, ...CONFIG_DOC_PATH), {
      catalog: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}

// ─── Picker-shaped helpers backed by the active catalog ──────────────────────

function listCountriesFrom(catalog) {
  return Object.entries(catalog).map(([code, c]) => ({
    code, name: c.countryName, flag: c.flag, isDomestic: !!c.isDomestic,
  }));
}

function listStatesFrom(catalog, countryCode) {
  const country = catalog[countryCode];
  if (!country) return [];
  return Object.entries(country.states || {}).map(([code, s]) => ({
    code, name: s.stateName,
  }));
}

function listUniversitiesFrom(catalog, countryCode, stateCode) {
  const state = catalog[countryCode]?.states?.[stateCode];
  if (!state) return [];
  return (state.universities || []).map((u) => ({
    id: u.id, name: u.name, city: u.city, ranking: u.ranking,
  }));
}

function listCoursesFrom(catalog, countryCode, stateCode, universityId) {
  const state = catalog[countryCode]?.states?.[stateCode];
  const uni = state?.universities?.find((u) => u.id === universityId);
  return uni?.courses || [];
}

/**
 * Returns a helpers bag (same signature as higherEducationData.js's
 * listCountries / listStates / …) backed by the currently active
 * catalog. The selection screen uses this so admin overrides take
 * effect without us threading the catalog through every list helper.
 */
export async function getHigherEdCatalog() {
  const catalog = await loadActiveCatalog();
  return {
    catalog,
    listCountries: () => listCountriesFrom(catalog),
    listStates: (cc) => listStatesFrom(catalog, cc),
    listUniversities: (cc, sc) => listUniversitiesFrom(catalog, cc, sc),
    listCourses: (cc, sc, uid) => listCoursesFrom(catalog, cc, sc, uid),
  };
}

export { USD_TO_INR_RATE };
