import { getActiveVendorsForApi } from './vendorConfigService';

/**
 * Per-API Vendor Failover Router
 *
 * Routes each API call through the vendors configured for that
 * specific operation. When both vendors are active for an API,
 * tries the primary first and falls back to the alternate.
 *
 * Usage:
 *   const result = await routeApiCall('panVerification', {
 *     signzy: () => signzyService.verifyPan(pan),
 *     digitap: () => digitapService.verifyPan(pan),
 *   });
 *
 * The 'panVerification' key maps to the per-API config in Firestore.
 * Admin can toggle signzy/digitap independently for each API.
 */

/**
 * Route an API call through the vendor failover chain.
 *
 * @param {string} apiKey        Config key (e.g. 'panVerification')
 * @param {Object} handlers      Map of vendor key → async function
 * @param {string} [category='apis']  'apis' or 'sms'
 * @returns {Promise<any>}       Result from the first successful vendor
 */
export async function routeApiCall(apiKey, handlers, category = 'apis') {
  const activeVendors = await getActiveVendorsForApi(apiKey, category);

  if (activeVendors.length === 0) {
    throw new Error(`No active vendors for ${apiKey}. Please enable at least one vendor in admin settings.`);
  }

  let lastError = null;

  for (const vendor of activeVendors) {
    const handler = handlers[vendor];
    if (!handler) continue;

    try {
      console.log(`[vendorRouter] ${apiKey} → trying ${vendor}`);
      const result = await handler();
      console.log(`[vendorRouter] ${apiKey} → ${vendor} succeeded`);
      if (result && typeof result === 'object') {
        result._vendor = vendor;
      }
      return result;
    } catch (err) {
      console.log(`[vendorRouter] ${apiKey} → ${vendor} failed:`, err?.message);
      lastError = err;
    }
  }

  const err = new Error(
    lastError?.message || `${apiKey} failed on all vendors (${activeVendors.join(', ')})`,
  );
  err.statusCode = lastError?.statusCode;
  err.vendorsFailed = activeVendors;
  throw err;
}

/**
 * Route an SMS/OTP call through the per-API SMS vendor chain.
 */
export async function routeSmsCall(apiKey, handlers) {
  return routeApiCall(apiKey, handlers, 'sms');
}
