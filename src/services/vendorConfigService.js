import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

const CONFIG_DOC = 'vendor_config';
const CONFIG_COLLECTION = 'settings';

/**
 * Vendor Configuration
 *
 * Two vendor pairs:
 *   API calls:  Signzy (primary) ↔ Digitap (alternate)
 *   SMS/OTP:    mTalkz (primary) ↔ Aisensy (alternate)
 *
 * At least one vendor per pair must be active at all times.
 * When both are active, the router tries the primary first and
 * falls back to the alternate on failure.
 */

const DEFAULT_CONFIG = {
  api: {
    signzy: { active: true, label: 'Signzy', type: 'primary' },
    digitap: { active: false, label: 'Digitap', type: 'alternate' },
  },
  sms: {
    mtalkz: { active: true, label: 'mTalkz', type: 'primary' },
    aisensy: { active: false, label: 'Aisensy', type: 'alternate' },
  },
};

let cachedConfig = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Load vendor config from Firestore (with 1-minute cache).
 */
export async function getVendorConfig() {
  if (cachedConfig && Date.now() - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  if (!isFirebaseConfigured()) {
    cachedConfig = DEFAULT_CONFIG;
    cacheTime = Date.now();
    return DEFAULT_CONFIG;
  }

  try {
    const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      cachedConfig = snap.data();
      cacheTime = Date.now();
      return cachedConfig;
    }
    // First time — seed with defaults
    await setDoc(ref, { ...DEFAULT_CONFIG, _updatedAt: serverTimestamp() });
    cachedConfig = DEFAULT_CONFIG;
    cacheTime = Date.now();
    return DEFAULT_CONFIG;
  } catch (err) {
    console.log('[vendorConfig] Load failed:', err?.message);
    return cachedConfig || DEFAULT_CONFIG;
  }
}

/**
 * Update vendor config in Firestore.
 * Validates that at least one vendor per pair remains active.
 */
export async function updateVendorConfig(newConfig, updatedBy) {
  // Validate: at least one active per pair
  const apiActive = Object.values(newConfig.api || {}).some((v) => v.active);
  const smsActive = Object.values(newConfig.sms || {}).some((v) => v.active);
  if (!apiActive) throw new Error('At least one API vendor (Signzy or Digitap) must be active.');
  if (!smsActive) throw new Error('At least one SMS vendor (mTalkz or Aisensy) must be active.');

  if (!isFirebaseConfigured()) {
    cachedConfig = newConfig;
    cacheTime = Date.now();
    return;
  }

  try {
    const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
    await setDoc(ref, {
      ...newConfig,
      _updatedBy: updatedBy || '',
      _updatedAt: serverTimestamp(),
    });
    cachedConfig = newConfig;
    cacheTime = Date.now();
    console.log('[vendorConfig] Updated by', updatedBy);
  } catch (err) {
    console.log('[vendorConfig] Update failed:', err?.message);
    throw err;
  }
}

/**
 * Check if a specific vendor is active.
 */
export async function isVendorActive(pair, vendorKey) {
  const config = await getVendorConfig();
  return config?.[pair]?.[vendorKey]?.active ?? false;
}

/**
 * Get the ordered list of active vendors for a pair.
 * Primary first, then alternate.
 */
export async function getActiveVendors(pair) {
  const config = await getVendorConfig();
  const vendors = config?.[pair] || {};
  const active = [];
  // Primary first
  for (const [key, val] of Object.entries(vendors)) {
    if (val.active && val.type === 'primary') active.unshift(key);
    else if (val.active) active.push(key);
  }
  return active;
}

export function clearVendorConfigCache() {
  cachedConfig = null;
  cacheTime = 0;
}
