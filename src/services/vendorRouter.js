import { getActiveVendors } from './vendorConfigService';

/**
 * Vendor Failover Router
 *
 * Wraps API calls with automatic failover between vendors.
 * When both vendors are active, tries the primary first — if it
 * fails, retries with the alternate. When only one is active,
 * uses that one directly with no fallback.
 *
 * Usage:
 *   const result = await routeApiCall('searchBankByIfsc', {
 *     signzy: () => signzyService.searchBankByIfscCode(ifsc),
 *     digitap: () => digitapService.searchBankByIfsc(ifsc),
 *   });
 */

/**
 * Route an API call through the vendor failover chain.
 *
 * @param {string} operationName  Human-readable name for logging
 * @param {Object} handlers       Map of vendor key → async function
 * @param {string} [pair='api']   Config pair ('api' or 'sms')
 * @returns {Promise<any>}        Result from the first successful vendor
 */
export async function routeApiCall(operationName, handlers, pair = 'api') {
  const activeVendors = await getActiveVendors(pair);

  if (activeVendors.length === 0) {
    throw new Error(`No active vendors for ${pair}. Please enable at least one vendor in admin settings.`);
  }

  let lastError = null;

  for (const vendor of activeVendors) {
    const handler = handlers[vendor];
    if (!handler) continue;

    try {
      console.log(`[vendorRouter] ${operationName} → trying ${vendor}`);
      const result = await handler();
      console.log(`[vendorRouter] ${operationName} → ${vendor} succeeded`);
      return { ...result, _vendor: vendor };
    } catch (err) {
      console.log(`[vendorRouter] ${operationName} → ${vendor} failed:`, err?.message);
      lastError = err;
      // Continue to next vendor
    }
  }

  // All vendors failed
  const err = new Error(
    lastError?.message || `${operationName} failed on all vendors (${activeVendors.join(', ')})`,
  );
  err.statusCode = lastError?.statusCode;
  err.vendorsFailed = activeVendors;
  throw err;
}

/**
 * Route an SMS/OTP call through the SMS vendor failover chain.
 */
export async function routeSmsCall(operationName, handlers) {
  return routeApiCall(operationName, handlers, 'sms');
}
