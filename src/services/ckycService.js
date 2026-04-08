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
 * Throws if the token is missing — the gateway silently returns
 * `{success:true, ckyc_refer_no:""}` for unauthenticated requests,
 * so this failure mode must be caught loudly.
 */
function withToken(endpoint, extraParams = {}) {
  if (!CKYC_CONFIG.TOKEN) {
    const err = new Error(
      'CKYC token is not configured. Set CKYC_CONFIG.TOKEN in src/config/constants.js with the token provided by FinZ CKYC ops.',
    );
    err.ckycTokenMissing = true;
    throw err;
  }
  const params = new URLSearchParams();
  Object.entries(extraParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  });
  params.append('token', CKYC_CONFIG.TOKEN);
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
 * The CKYC gateway stores `user_id` and `loan_id` as INTEGER columns even
 * though the API doc types them as string. Sending `user_8577007777` causes
 * the backend to crash with `Truncated incorrect INTEGER value`. Strip
 * everything except digits and clamp the length so it fits in BIGINT.
 */
function sanitizeNumericId(value) {
  if (value === undefined || value === null) return '';
  const digits = String(value).replace(/\D+/g, '');
  // Clamp to 18 digits to stay within MySQL BIGINT range.
  return digits.slice(-18);
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

/**
 * Recursively walk the CKYC response looking for a reference number. The
 * gateway wraps `ckyc_refer_no` under different keys and shapes depending
 * on the endpoint version and whether the record is cached — it may be
 * a string, a number, an array, or an object with numeric keys like
 * `{"0":"INODYQ09239473"}`.
 */
function extractRefString(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return v ? String(v) : '';
  if (Array.isArray(v)) {
    for (const item of v) {
      const r = extractRefString(item);
      if (r) return r;
    }
    return '';
  }
  if (typeof v === 'object') {
    for (const key of Object.keys(v)) {
      const r = extractRefString(v[key]);
      if (r) return r;
    }
  }
  return '';
}

function findCkycRefNo(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return '';

  const keys = [
    'ckyc_refer_no',
    'ckycReferNo',
    'ckycRefNo',
    'ckyc_refno',
    'ckycRefno',
    'ckyc_reference_no',
    'ckycReferenceNo',
    'CKYC_REFERENCE_ID',
    'reference_no',
    'referenceNo',
    'referenceNumber',
    'refNo',
    'refNumber',
  ];
  for (const k of keys) {
    const r = extractRefString(obj[k]);
    if (r) return r;
  }

  // Recurse into likely containers.
  for (const child of ['data', 'result', 'response', 'payload', 'ckyc', 'record', 'SearchResponsePID']) {
    if (obj[child] && typeof obj[child] === 'object') {
      const found = findCkycRefNo(obj[child], depth + 1);
      if (found) return found;
    }
  }

  return '';
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

    // The gateway's docs advertise `download=no&updateRecord=no&uploadS3=no`
    // as defaults, but those cause a dry-run that returns an empty
    // ckyc_refer_no even for existing records. Flipping `updateRecord=yes`
    // makes the gateway actually persist the search and emit the reference.
    const endpoint = withToken(CKYC_CONFIG.ENDPOINTS.SEARCH, {
      download: 'no',
      updateRecord: 'yes',
      uploadS3: 'no',
    });

    // Normalize the applicant name — CKYC records are stored in uppercase
    // on the CERSAI side, and the gateway's matcher is whitespace-sensitive.
    const normalizedName = String(name).trim().replace(/\s+/g, ' ').toUpperCase();
    const normalizedPan = String(pan).trim().toUpperCase();

    const body = {
      responseType: 'json',
      IdentityType: CKYC_CONFIG.IDENTITY_TYPE_PAN,
      IdentityNumber: normalizedPan,
      ApplicantName: normalizedName,
      type: 'search',
      userId: sanitizeNumericId(userId),
      loanId: sanitizeNumericId(loanId),
    };

    console.log(
      '[ckycService] searchCkyc → endpoint =',
      endpoint,
      ', body =',
      JSON.stringify(body),
    );

    const { data } = await ckycApi.post(endpoint, body);

    // Log the full payload and search every plausible path so the OTP
    // step can proceed regardless of shape.
    console.log('[ckycService] searchCkyc raw response:', JSON.stringify(data));
    unwrap(data);

    const refNo = findCkycRefNo(data);
    if (!refNo) {
      console.log('[ckycService] searchCkyc: ckyc_refer_no not found in response');
    }

    return {
      ckycReferNo: refNo,
      message: data?.message || data?.msg || '',
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

    const normalizedName = String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const normalizedPan = String(pan).trim().toUpperCase();

    const body = {
      responseType: 'json',
      IdentityType: CKYC_CONFIG.IDENTITY_TYPE_PAN,
      IdentityNumber: normalizedPan,
      ApplicantName: normalizedName,
      loanId: sanitizeNumericId(loanId),
      userId: sanitizeNumericId(userId),
      authType: CKYC_CONFIG.AUTH_TYPE_MOBILE,
      referenceNo,
      DOB: mobile,
      requestId: reqId,
    };

    console.log(
      '[ckycService] sendCkycOtp → requestId =',
      reqId,
      ', referenceNo =',
      referenceNo,
    );

    // The CKYC gateway returns the OTP-sent message in two different shapes
    // depending on mood:
    //   - HTTP 200: { success:false, error:"OTP has been sent..." }
    //   - HTTP 500: { success:false, error:"OTP has been sent..." }  (!)
    // Treat either one as a happy path.
    const isOtpSentMsg = (msg) => /otp.*(sent|delivered)/i.test(msg || '');

    try {
      const { data } = await ckycApi.post(endpoint, body);
      const message = data?.error || data?.message || '';
      const isOtpSent = isOtpSentMsg(message);
      if (data?.success === false && !isOtpSent) {
        const err = new Error(message || 'Failed to send CKYC OTP.');
        err.ckycError = data;
        throw err;
      }
      return { message, requestId: reqId, raw: data };
    } catch (err) {
      const rawMsg =
        err.ckycError?.error ||
        err.ckycError?.message ||
        err.message ||
        '';
      if (isOtpSentMsg(rawMsg)) {
        console.log('[ckycService] sendCkycOtp: OTP-sent happy path (status =', err.statusCode, ')');
        return { message: rawMsg, requestId: reqId, raw: err.ckycError || {} };
      }
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

    const isResendSentMsg = (msg) => /otp.*(sent|delivered)|resend.*successfully/i.test(msg || '');

    try {
      const { data } = await ckycApi.post(endpoint, body);
      const message = data?.error || data?.message || '';
      if (data?.success === false && !isResendSentMsg(message)) {
        const err = new Error(message || 'Failed to resend CKYC OTP.');
        err.ckycError = data;
        throw err;
      }
      return { message, raw: data };
    } catch (err) {
      const rawMsg =
        err.ckycError?.error ||
        err.ckycError?.message ||
        err.message ||
        '';
      if (isResendSentMsg(rawMsg)) {
        console.log('[ckycService] resendCkycOtp: OTP-sent happy path (status =', err.statusCode, ')');
        return { message: rawMsg, raw: err.ckycError || {} };
      }
      console.log('[ckycService] resendCkycOtp error:', err.message);
      throw err;
    }
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
  async validateCkycOtp({ pan, otp, mobile, requestId, referenceNo }) {
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

    let data;
    try {
      const resp = await ckycApi.post(endpoint, body);
      data = resp.data;
    } catch (err) {
      // The gateway sometimes returns the validated record under HTTP 500.
      // If the body looks like a real CKYC record, treat it as success.
      const body = err.ckycError;
      if (body && (body.data || body.kycData || body.result || body.SearchResponsePID)) {
        console.log('[ckycService] validateCkycOtp: record returned via HTTP', err.statusCode);
        data = body;
      } else {
        const msg = body?.error || body?.message || err.message || 'OTP validation failed.';
        const e = new Error(msg);
        e.ckycError = body;
        throw e;
      }
    }

    console.log('[ckycService] validateCkycOtp raw response:', JSON.stringify(data));

    // Failure path — gateway returns { success:false, error:"..." }
    if (data?.success === false) {
      const err = new Error(data.error || 'OTP validation failed.');
      err.ckycError = data;
      throw err;
    }

    // Success path — the validated record lives at
    //   data.data.donwload_json   (note CERSAI's typo: 'donwload' not 'download')
    // and contains PERSONAL_DETAILS, IDENTITY_DETAILS, IMAGE_DETAILS, etc.
    // Walk through every plausible container so we tolerate future fixes
    // and any flatter shapes the gateway might return.
    const record =
      data?.data?.donwload_json ||
      data?.data?.download_json ||
      data?.donwload_json ||
      data?.download_json ||
      data?.data ||
      data?.kycData ||
      data?.result ||
      data ||
      {};

    const pd = record.PERSONAL_DETAILS || record.personalDetails || {};

    // ── Name ──
    // Build the cleanest available name. CERSAI sometimes returns
    // FULLNAME with double spaces and prefers PREFIX/FNAME/MNAME/LNAME
    // as separate fields; the *_NAME fields can also be empty arrays.
    const safeStr = (v) => (typeof v === 'string' ? v : '');
    const partsToString = (parts) =>
      parts
        .map(safeStr)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    const builtName = partsToString([pd.PREFIX, pd.FNAME, pd.MNAME, pd.LNAME]);
    const name =
      partsToString([safeStr(pd.FULLNAME) || safeStr(pd.FULL_NAME) || safeStr(pd.fullName) || safeStr(pd.NAME)]) ||
      builtName ||
      record.name ||
      '';

    // ── Father / Mother / Spouse names ──
    const fatherName =
      partsToString([safeStr(pd.FATHER_FULLNAME)]) ||
      partsToString([pd.FATHER_PREFIX, pd.FATHER_FNAME, pd.FATHER_MNAME, pd.FATHER_LNAME]) ||
      record.fatherName ||
      '';
    const motherName =
      partsToString([safeStr(pd.MOTHER_FULLNAME)]) ||
      partsToString([pd.MOTHER_PREFIX, pd.MOTHER_FNAME, pd.MOTHER_MNAME, pd.MOTHER_LNAME]) ||
      record.motherName ||
      '';
    const spouseName =
      partsToString([safeStr(pd.SPOUSE_FULLNAME)]) ||
      partsToString([pd.SPOUSE_PREFIX, pd.SPOUSE_FNAME, pd.SPOUSE_MNAME, pd.SPOUSE_LNAME]) ||
      '';

    // ── DOB / Gender / PAN ──
    const dob = safeStr(pd.DOB) || safeStr(pd.DATE_OF_BIRTH) || safeStr(pd.dob) || record.dob || '';
    const genderRaw = safeStr(pd.GENDER) || safeStr(pd.gender) || record.gender || '';
    const gender = genderRaw === 'M' ? 'Male' : genderRaw === 'F' ? 'Female' : genderRaw;
    const panFromCkyc = safeStr(pd.PAN) || record.pan || '';

    // ── Address (Permanent + Correspondence, structured + flat) ──
    // CKYC stores both addresses separately. PERM_CORRES_SAMEFLAG = 'Y'
    // means the correspondence address is identical to the permanent
    // address. We expose both in structured form so the UI can render
    // them side-by-side, plus a flat `address` string for the legacy
    // single-address consumers.
    const buildAddress = (prefix) => {
      const lines = [pd[`${prefix}_LINE1`], pd[`${prefix}_LINE2`], pd[`${prefix}_LINE3`]]
        .map(safeStr)
        .map((s) => s.trim())
        .filter(Boolean);
      const cityV = safeStr(pd[`${prefix}_CITY`]);
      const districtV = safeStr(pd[`${prefix}_DIST`]);
      const stateV = safeStr(pd[`${prefix}_STATE`]);
      const countryV = safeStr(pd[`${prefix}_COUNTRY`]);
      const pinV = safeStr(pd[`${prefix}_PIN`]);
      const poaV = safeStr(pd[`${prefix}_POA`]);
      if (!lines.length && !cityV && !pinV) return null;
      return {
        line1: lines[0] || '',
        line2: lines[1] || '',
        line3: lines[2] || '',
        addressLine: lines.join(', '),
        city: cityV,
        district: districtV,
        state: stateV,
        country: countryV,
        pincode: pinV,
        proofOfAddressCode: poaV, // CKYC POA type code (e.g. '01' = Passport)
      };
    };

    const permanentAddress = buildAddress('PERM');
    const correspondenceAddress = buildAddress('CORRES');
    const sameAddress = safeStr(pd.PERM_CORRES_SAMEFLAG).toUpperCase() === 'Y';

    // Flat address fields default to the permanent address (or
    // correspondence as a fallback) so the rest of the app keeps working.
    const addressLine =
      permanentAddress?.addressLine ||
      correspondenceAddress?.addressLine ||
      record.address ||
      '';
    const city = permanentAddress?.city || correspondenceAddress?.city || '';
    const district = permanentAddress?.district || correspondenceAddress?.district || '';
    const stateName = permanentAddress?.state || correspondenceAddress?.state || '';
    const country = permanentAddress?.country || correspondenceAddress?.country || '';
    const pincode = permanentAddress?.pincode || correspondenceAddress?.pincode || '';

    // ── Documents (IDENTITY_DETAILS) ──
    // CKYC identity type codes:
    //   A = Passport, B = Voter ID, C = PAN, D = Driving License,
    //   E = Aadhaar (UID), F = NREGA Job Card, G = Other,
    //   H = Aadhaar (with verification), J = eShram
    // IDVER_STATUS: 01 = Verified, 02 = Pending, 03 = Rejected.
    const IDENT_TYPE_LABELS = {
      A: 'Passport',
      B: 'Voter ID',
      C: 'PAN',
      D: 'Driving License',
      E: 'Aadhaar',
      F: 'NREGA Job Card',
      G: 'Other',
      H: 'Aadhaar (eKYC)',
      J: 'eShram',
    };
    const IDVER_STATUS_LABELS = {
      '01': 'Verified',
      '02': 'Pending',
      '03': 'Rejected',
    };

    const identityList =
      record.IDENTITY_DETAILS?.IDENTITY ||
      record.identityDetails?.identity ||
      [];
    const identArr = Array.isArray(identityList) ? identityList : [];

    const documents = identArr
      .map((row, idx) => {
        const num = safeStr(row?.IDENT_NUM);
        if (!num) return null;
        const type = safeStr(row?.IDENT_TYPE).toUpperCase();
        const verStatus = safeStr(row?.IDVER_STATUS);
        return {
          sequence: safeStr(row?.SEQUENCE_NO) || String(idx + 1),
          type,
          label: IDENT_TYPE_LABELS[type] || `Document (${type})`,
          number: num,
          verificationStatusCode: verStatus,
          verificationStatus: IDVER_STATUS_LABELS[verStatus] || verStatus,
          dateOfIssue: safeStr(row?.DATE_OF_ISSUE) || '',
          dateOfExpiry: safeStr(row?.DATE_OF_EXPIRY) || '',
          placeOfIssue: safeStr(row?.PLACE_OF_ISSUE) || '',
        };
      })
      .filter(Boolean);

    // CERSAI exposes PAN as a top-level PERSONAL_DETAILS.PAN field rather
    // than as an IDENTITY_DETAILS row, so it never makes it into the
    // documents list. Inject it as a synthetic doc (type 'C' = PAN) so the
    // UI shows the full identity footprint in one place. Skip if it's
    // already present (in case the gateway upgrades the response shape
    // later) or if PAN is missing.
    const panFromPd = safeStr(pd.PAN);
    if (panFromPd && !documents.some((d) => d.type === 'C' || d.number === panFromPd)) {
      documents.unshift({
        sequence: '0',
        type: 'C',
        label: IDENT_TYPE_LABELS.C,
        number: panFromPd,
        verificationStatusCode: '01',
        verificationStatus: 'Verified',
        dateOfIssue: '',
        dateOfExpiry: '',
        placeOfIssue: '',
      });
    }

    // ── UID (masked Aadhaar from documents list, prefer 'E' then 'H') ──
    const aadhaarDoc =
      documents.find((d) => d.type === 'E') ||
      documents.find((d) => d.type === 'H') ||
      null;
    const uid = aadhaarDoc?.number || safeStr(pd.AADHAAR) || record.uid || '';

    // ── Contact details ──
    const mobileCountryCode = safeStr(pd.MOB_CODE);
    const mobileNumber = safeStr(pd.MOB_NUM);
    const email = safeStr(pd.EMAIL);
    const residentialPhone = (() => {
      const std = safeStr(pd.RESI_STD_CODE);
      const num = safeStr(pd.RESI_TEL_NUM);
      if (!num) return '';
      return std ? `${std}-${num}` : num;
    })();
    const officePhone = (() => {
      const std = safeStr(pd.OFF_STD_CODE);
      const num = safeStr(pd.OFF_TEL_NUM);
      if (!num) return '';
      return std ? `${std}-${num}` : num;
    })();

    // ── Images (base64 in IMAGE_DETAILS.IMAGE[*].IMAGE_DATA) ──
    // CKYC standard image codes:
    //   01 = Address Proof, 02 = Identity Proof, 03 = Photograph,
    //   04 = Signature, 05 = Form
    // IMAGE_CODE '03' is the photograph used as the headline image.
    const IMAGE_CODE_LABELS = {
      '01': 'Address Proof',
      '02': 'Identity Proof',
      '03': 'Photograph',
      '04': 'Signature',
      '05': 'Form',
    };

    const imageList =
      record.IMAGE_DETAILS?.IMAGE ||
      record.imageDetails?.image ||
      [];
    const imageArr = Array.isArray(imageList) ? imageList : [];

    const images = imageArr
      .map((img, idx) => {
        const dataB64 = safeStr(img?.IMAGE_DATA);
        if (!dataB64) return null;
        const typeRaw = safeStr(img?.IMAGE_TYPE).toLowerCase();
        const mime = /^jpe?g$/.test(typeRaw)
          ? 'image/jpeg'
          : typeRaw === 'png'
            ? 'image/png'
            : typeRaw === 'pdf'
              ? 'application/pdf'
              : 'image/jpeg';
        const code = safeStr(img?.IMAGE_CODE);
        return {
          sequence: safeStr(img?.SEQUENCE_NO) || String(idx + 1),
          code,
          label: IMAGE_CODE_LABELS[code] || `Document ${idx + 1}`,
          type: typeRaw || 'jpg',
          mime,
          uri: `data:${mime};base64,${dataB64}`,
          data: dataB64,
        };
      })
      .filter(Boolean);

    const photoRow =
      images.find((img) => img.code === '03') ||
      images.find((img) => /jpe?g/.test(img.mime)) ||
      images[0] ||
      null;
    const photo = photoRow?.data || safeStr(record.PHOTO) || safeStr(record.photo) || '';

    // ── CKYC Number / Reference Number ──
    // CKYC_NO is the 14-digit CKYC identifier assigned by CERSAI.
    // CKYC_REFERENCE_ID is the per-search transaction reference (e.g.
    // "INODYQ09239473"). The caller can also pass `referenceNo` from
    // the original search step — it takes precedence so we keep the
    // search and validate references in sync even if CERSAI returns
    // different shapes between calls.
    const ckycNumber =
      safeStr(pd.CKYC_NO) ||
      safeStr(pd.CKYC_NUMBER) ||
      safeStr(record.ckyc_number) ||
      safeStr(record.CKYC_NUMBER) ||
      safeStr(record.ckycNumber) ||
      '';
    const ckycReferenceNo =
      safeStr(referenceNo) ||
      safeStr(pd.CKYC_REFERENCE_ID) ||
      findCkycRefNo(data) ||
      '';

    console.log(
      '[ckycService] validateCkycOtp normalized: name =',
      name,
      ', dob =',
      dob,
      ', pincode =',
      pincode,
      ', photo =',
      photo ? `${photo.length} bytes` : 'missing',
    );

    return {
      verified: true,
      ckycNumber,
      ckycReferenceNo,
      pan: panFromCkyc,
      name,
      fatherName,
      motherName,
      spouseName,
      dob,
      gender,
      uid,
      photo,
      images,
      // Identity documents extracted from IDENTITY_DETAILS — every PoI
      // CERSAI has on file, with type, number, and verification status.
      documents,
      // Flat address (legacy single-address consumers) defaults to permanent.
      address: addressLine,
      city,
      district,
      state: stateName,
      country,
      pincode,
      // Both addresses in structured form so the UI can show them both.
      permanentAddress,
      correspondenceAddress,
      sameAddress,
      // Contact details
      phone: mobileNumber || mobile,
      mobileNumber,
      mobileCountryCode,
      email,
      residentialPhone,
      officePhone,
      // The details-review screen reads splitAddress in this nested shape:
      //   sa.state[0]?.[0] || sa.state[0]
      // so wrap state in a nested array and city in a flat array.
      splitAddress: {
        addressLine,
        city: city ? [city] : [],
        state: stateName ? [[stateName]] : [],
        pincode,
      },
      // `record` is the unwrapped donwload_json container; `rawResponse`
      // is the complete JSON the gateway returned (success flag, message,
      // wrapper objects, etc.) so the application can audit / replay it.
      raw: record,
      rawResponse: data,
      validatedAt: new Date().toISOString(),
    };
  },
};
