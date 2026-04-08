import axios from 'axios';
import { CKYC_CONFIG } from '../config/constants';

// ─── CKYC API client (FinZ CKYC gateway) ────────────────────────────────────
//
// Flow:
//   1. searchCkyc()      → returns ckyc_refer_no for a given PAN
//   2. sendCkycOtp()     → download request; triggers OTP to the registered mobile
//   3. resendCkycOtp()   → resends OTP (enabled 90 sec after the first request)
//   4. validateCkycOtp() → validates OTP and downloads full CKYC record
//
// Every endpoint accepts a `token` query parameter (configured in CKYC_CONFIG).
// Errors on these APIs often come back as HTTP 200 with { success:false, error:"..." }
// so the service normalizes the response and throws on failure.

const ckycApi = axios.create({
  baseURL: CKYC_CONFIG.BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

ckycApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const networkErr = new Error(
        'CKYC service unavailable. Please check your internet connection and try again.',
      );
      networkErr.statusCode = 0;
      networkErr.isNetworkError = true;
      return Promise.reject(networkErr);
    }

    const status = error.response.status;
    const data = error.response.data;
    const rawMsg = data?.error || data?.message || '';

    console.log('[ckycApi] Error response:', status, JSON.stringify(data));

    const err = new Error(rawMsg || 'CKYC request failed. Please try again.');
    err.statusCode = status;
    err.ckycError = data;
    return Promise.reject(err);
  },
);

/**
 * Append `?token=<TOKEN>` plus any extra query flags to an endpoint.
 */
function withToken(endpoint, extraParams = {}) {
  const params = new URLSearchParams();
  Object.entries(extraParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  });
  if (CKYC_CONFIG.TOKEN) params.append('token', CKYC_CONFIG.TOKEN);
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
}

/**
 * Generate a unique-per-day request ID (6-10 digits) for OTP download / validation.
 * We combine the seconds-since-midnight with a small random suffix to stay unique
 * even for rapid repeat calls.
 */
function generateRequestId() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const secondsToday = Math.floor((now - midnight) / 1000); // 0 – 86399
  const rand = Math.floor(Math.random() * 100); // 0 – 99
  // 6-7 digit requestId: secondsToday * 100 + rand → max 8_639_999
  return String(secondsToday * 100 + rand);
}

/**
 * Normalize a CKYC API response. Throws if `success` is false.
 */
function unwrap(data) {
  if (data && data.success === false) {
    const err = new Error(data.error || data.message || 'CKYC request failed.');
    err.ckycError = data;
    err.ckycSuccess = false;
    throw err;
  }
  return data;
}

export const ckycService = {
  /**
   * Step 1 — Search CKYC repository for an applicant.
   *
   * @param {Object} params
   * @param {string} params.pan           PAN number (identityNumber)
   * @param {string} params.name          Applicant full name
   * @param {string} [params.userId]      LMS user id
   * @param {string} [params.loanId]      LMS loan / application id
   * @returns {Promise<{ ckycReferNo: string, message: string, raw: Object }>}
   */
  async searchCkyc({ pan, name, userId = '', loanId = '' }) {
    if (!pan) throw new Error('PAN is required for CKYC search.');
    if (!name) throw new Error('Applicant name is required for CKYC search.');

    const endpoint = withToken(CKYC_CONFIG.ENDPOINTS.SEARCH, {
      download: 'no',
      updateRecord: 'no',
      uploadS3: 'no',
    });

    const body = {
      responseType: 'json',
      IdentityType: CKYC_CONFIG.IDENTITY_TYPE_PAN,
      IdentityNumber: pan,
      ApplicantName: name,
      type: 'search',
      userId: String(userId || ''),
      loanId: String(loanId || ''),
    };

    console.log('[ckycService] searchCkyc →', pan);

    const { data } = await ckycApi.post(endpoint, body);
    unwrap(data);

    return {
      ckycReferNo: data.ckyc_refer_no || data.ckycReferNo || '',
      message: data.message || '',
      raw: data,
    };
  },

  /**
   * Step 2 — Send OTP to the registered mobile number by issuing a download request.
   *
   * @param {Object} params
   * @param {string} params.pan          PAN number
   * @param {string} params.name         Applicant name
   * @param {string} params.referenceNo  ckyc_refer_no returned by searchCkyc
   * @param {string} params.mobile       Registered mobile (passed as DOB when authType=03)
   * @param {string} [params.userId]
   * @param {string} [params.loanId]
   * @param {string} [params.requestId]  Optional — auto-generated if not provided
   * @returns {Promise<{ message: string, requestId: string, raw: Object }>}
   */
  async sendCkycOtp({
    pan,
    name,
    referenceNo,
    mobile,
    userId = '',
    loanId = '',
    requestId,
  }) {
    if (!pan) throw new Error('PAN is required.');
    if (!referenceNo) throw new Error('CKYC reference number is required.');
    if (!mobile) throw new Error('Registered mobile number is required.');

    const endpoint = withToken(CKYC_CONFIG.ENDPOINTS.DOWNLOAD, { download: 'yes' });
    const reqId = requestId || generateRequestId();

    const body = {
      responseType: 'json',
      IdentityType: CKYC_CONFIG.IDENTITY_TYPE_PAN,
      IdentityNumber: pan,
      ApplicantName: name,
      loanId: String(loanId || ''),
      userId: String(userId || ''),
      authType: CKYC_CONFIG.AUTH_TYPE_MOBILE,
      referenceNo,
      DOB: mobile,
      requestId: reqId,
    };

    console.log('[ckycService] sendCkycOtp → requestId =', reqId);

    try {
      const { data } = await ckycApi.post(endpoint, body);
      // NOTE: The CKYC gateway returns `{ success: false, error: "OTP has been sent..." }`
      // on the happy path, so we do NOT blindly unwrap. Instead we detect OTP-sent
      // messages and treat them as success.
      const message = data?.error || data?.message || '';
      const isOtpSent = /otp.*sent/i.test(message);
      if (data?.success === false && !isOtpSent) {
        const err = new Error(message || 'Failed to send CKYC OTP.');
        err.ckycError = data;
        throw err;
      }
      return { message, requestId: reqId, raw: data };
    } catch (err) {
      console.log('[ckycService] sendCkycOtp error:', err.message);
      throw err;
    }
  },

  /**
   * Step 3 — Resend OTP (enabled only after 90 sec from the first request).
   *
   * @param {Object} params
   * @param {string} params.pan
   * @param {string} params.mobile     Registered mobile (passed as DOB)
   * @param {string} params.requestId  Same requestId used in sendCkycOtp
   * @returns {Promise<{ message: string, raw: Object }>}
   */
  async resendCkycOtp({ pan, mobile, requestId }) {
    if (!pan) throw new Error('PAN is required.');
    if (!mobile) throw new Error('Registered mobile number is required.');
    if (!requestId) throw new Error('Request ID is required for OTP resend.');

    const endpoint = withToken(CKYC_CONFIG.ENDPOINTS.VALIDATE_OTP);

    const body = {
      pan,
      otp: '',
      dob: mobile,
      requestId,
      responseType: 'json',
    };

    console.log('[ckycService] resendCkycOtp → requestId =', requestId);

    const { data } = await ckycApi.post(endpoint, body);
    const message = data?.error || data?.message || '';
    const isOtpSent = /otp.*sent|resend.*successfully/i.test(message);
    if (data?.success === false && !isOtpSent) {
      const err = new Error(message || 'Failed to resend CKYC OTP.');
      err.ckycError = data;
      throw err;
    }
    return { message, raw: data };
  },

  /**
   * Step 4 — Validate OTP and download the CKYC record.
   *
   * @param {Object} params
   * @param {string} params.pan
   * @param {string} params.otp        6-digit OTP shared by the user
   * @param {string} params.mobile     Registered mobile (passed as DOB)
   * @param {string} params.requestId  Same requestId used in sendCkycOtp
   * @returns {Promise<Object>} Normalized CKYC record or raw response
   */
  async validateCkycOtp({ pan, otp, mobile, requestId }) {
    if (!pan) throw new Error('PAN is required.');
    if (!otp) throw new Error('OTP is required.');
    if (!mobile) throw new Error('Registered mobile number is required.');
    if (!requestId) throw new Error('Request ID is required.');

    const endpoint = withToken(CKYC_CONFIG.ENDPOINTS.VALIDATE_OTP);

    const body = {
      pan,
      otp,
      dob: mobile,
      requestId,
      responseType: 'json',
    };

    console.log('[ckycService] validateCkycOtp → requestId =', requestId);

    const { data } = await ckycApi.post(endpoint, body);

    // Failure path — gateway returns { success:false, error:"..." }
    if (data?.success === false) {
      const err = new Error(data.error || 'OTP validation failed.');
      err.ckycError = data;
      throw err;
    }

    // Success path — response contains the CKYC record. The gateway may return
    // either a flattened record or a nested `data`/`kycData` object; normalize
    // it into the shape the app expects for details review.
    const record = data?.data || data?.kycData || data?.result || data || {};

    const personalDetails = record.PERSONAL_DETAILS || record.personalDetails || {};
    const addrDetails = record.PERMANENT_ADDRESS || record.permanentAddress || record.address || {};

    const name =
      record.name ||
      personalDetails.FULL_NAME ||
      personalDetails.fullName ||
      personalDetails.NAME ||
      '';
    const dob = record.dob || personalDetails.DATE_OF_BIRTH || personalDetails.dob || '';
    const gender = record.gender || personalDetails.GENDER || personalDetails.gender || '';
    const uid = record.uid || record.aadhaar || personalDetails.AADHAAR || '';
    const photo = record.photo || record.PHOTO || '';

    const addressLine =
      record.address ||
      addrDetails.LINE1 ||
      addrDetails.address ||
      [addrDetails.LINE1, addrDetails.LINE2, addrDetails.LINE3].filter(Boolean).join(', ');
    const city = addrDetails.CITY || addrDetails.DISTRICT || addrDetails.city || '';
    const stateName = addrDetails.STATE || addrDetails.state || '';
    const pincode = record.pincode || addrDetails.PIN_CODE || addrDetails.pincode || '';

    return {
      verified: true,
      ckycNumber: record.ckyc_number || record.CKYC_NUMBER || record.ckycNumber || '',
      name,
      dob,
      gender,
      uid,
      photo,
      address: addressLine,
      pincode,
      phone: mobile,
      splitAddress: {
        addressLine,
        city: city ? [city] : [],
        state: stateName ? [stateName] : [],
        pincode,
      },
      raw: record,
    };
  },
};
