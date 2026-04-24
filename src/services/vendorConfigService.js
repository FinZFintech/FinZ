import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

const CONFIG_DOC = 'vendor_config';
const CONFIG_COLLECTION = 'settings';

/**
 * Per-API Vendor Configuration
 *
 * Every API operation has its own vendor toggle so admin can mix
 * vendors at the individual API level:
 *   e.g. use Signzy for PAN but Digitap for employment check
 *
 * Each entry: { signzy: true/false, digitap: true/false }
 * At least one must be true per API. When both are true, the
 * router tries signzy first and falls back to digitap on failure.
 *
 * SMS operations similarly toggle between mtalkz and aisensy.
 */

const DEFAULT_CONFIG = {
  apis: {
    panVerification:    { label: 'PAN Verification',          signzy: true, digitap: false },
    // Bureau soft pull. Signzy's CIBIL is the active vendor while CRIF
    // hard-pull is pending integration. When CRIF goes live, flip the
    // signzy column off from the admin Vendor Config screen.
    cibilBureau:        { label: 'CIBIL Bureau (Soft Pull)',   signzy: true, crif: false },
    phonePrefill:       { label: 'Phone Prefill',             signzy: true, digitap: false },
    emailValidation:    { label: 'Email Validation',          signzy: true, digitap: false },
    fraudShield:        { label: 'FraudShield Lite',          signzy: true, digitap: false },
    employmentBasic:    { label: 'Employment (UAN Basic)',     signzy: true, digitap: false },
    bankIfscSearch:     { label: 'Bank IFSC Search',          signzy: true, digitap: false },
    bankVerification:   { label: 'Bank Account Verification', signzy: true, digitap: false },
    digilocker:         { label: 'DigiLocker KYC',            signzy: true, digitap: false },
    liveness:           { label: 'Liveness & Face Match',     signzy: true, digitap: false },
    gstPanToGstn:       { label: 'GST (PAN to GSTIN)',        signzy: true, digitap: false },
    gstDetailed:        { label: 'GSTIN Detailed',            signzy: true, digitap: false },
    itrPull:            { label: 'ITR Pull',                  signzy: true, digitap: false },
    form26AS:           { label: 'Form 26AS Pull',            signzy: true, digitap: false },
    phoneIntelligence:  { label: 'Phone Intelligence',        signzy: true, digitap: false },
    vkyc:               { label: 'Video KYC',                 signzy: false, digitap: true },
  },
  sms: {
    loginOtp:           { label: 'Login OTP',                 mtalkz: true, aisensy: false },
    transactionalSms:   { label: 'Transactional SMS',         mtalkz: true, aisensy: false },
  },
};

let cachedConfig = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

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
      // Merge with defaults so new APIs added in code don't disappear
      const stored = snap.data();
      cachedConfig = {
        apis: { ...DEFAULT_CONFIG.apis, ...stored.apis },
        sms: { ...DEFAULT_CONFIG.sms, ...stored.sms },
      };
      cacheTime = Date.now();
      return cachedConfig;
    }
    await setDoc(ref, { ...DEFAULT_CONFIG, _updatedAt: serverTimestamp() });
    cachedConfig = DEFAULT_CONFIG;
    cacheTime = Date.now();
    return DEFAULT_CONFIG;
  } catch (err) {
    console.log('[vendorConfig] Load failed:', err?.message);
    return cachedConfig || DEFAULT_CONFIG;
  }
}

export async function updateVendorConfig(newConfig, updatedBy) {
  // Validate: every API must have at least one vendor active
  for (const [key, val] of Object.entries(newConfig.apis || {})) {
    if (!val.signzy && !val.digitap) {
      throw new Error(`At least one vendor must be active for "${val.label || key}".`);
    }
  }
  for (const [key, val] of Object.entries(newConfig.sms || {})) {
    if (!val.mtalkz && !val.aisensy) {
      throw new Error(`At least one vendor must be active for "${val.label || key}".`);
    }
  }

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
 * Get the ordered list of active vendors for a specific API operation.
 * Primary vendor (signzy for API, mtalkz for SMS) comes first.
 *
 * @param {string} apiKey  Key from the config (e.g. 'panVerification')
 * @param {string} [category='apis']  'apis' or 'sms'
 * @returns {Promise<string[]>}  e.g. ['signzy', 'digitap'] or ['signzy']
 */
export async function getActiveVendorsForApi(apiKey, category = 'apis') {
  const config = await getVendorConfig();
  const entry = config?.[category]?.[apiKey];
  if (!entry) {
    // Unknown API — default to primary vendor only
    return category === 'apis' ? ['signzy'] : ['mtalkz'];
  }

  const active = [];
  if (category === 'apis') {
    if (entry.signzy) active.push('signzy');
    if (entry.digitap) active.push('digitap');
  } else {
    if (entry.mtalkz) active.push('mtalkz');
    if (entry.aisensy) active.push('aisensy');
  }
  return active;
}

// Legacy compat — used by vendorRouter
export async function getActiveVendors(pair) {
  if (pair === 'sms') {
    // Aggregate: if any SMS operation has a vendor active, include it
    const config = await getVendorConfig();
    const smsEntries = Object.values(config?.sms || {});
    const hasMtalkz = smsEntries.some((e) => e.mtalkz);
    const hasAisensy = smsEntries.some((e) => e.aisensy);
    const active = [];
    if (hasMtalkz) active.push('mtalkz');
    if (hasAisensy) active.push('aisensy');
    return active.length ? active : ['mtalkz'];
  }
  // For generic 'api' pair, return primary
  return ['signzy'];
}

export function clearVendorConfigCache() {
  cachedConfig = null;
  cacheTime = 0;
}
