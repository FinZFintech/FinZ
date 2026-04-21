import axios from 'axios';
import { SIGNZY_CONFIG, SIGNZY_OTP_CONFIG, SIGNZY_V2_CONFIG, PAN_STATUS_CODES } from '../config/constants';

// ─── Signzy v3 API client (token auth) ──────────────────────────────────────

const signzyApi = axios.create({
  baseURL: SIGNZY_CONFIG.BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: SIGNZY_CONFIG.AUTH_TOKEN,
    'x-client-unique-id': SIGNZY_CONFIG.CLIENT_ID,
  },
});

signzyApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const networkErr = new Error(
        'Verification failed. Please check your internet connection and try again.',
      );
      networkErr.statusCode = 0;
      networkErr.isNetworkError = true;
      return Promise.reject(networkErr);
    }

    const status = error.response.status;
    const data = error.response.data;

    console.log('[signzyApi] Error response:', status, JSON.stringify(data));

    let message = 'Verification failed. Please try again.';

    if (status === 400) {
      const raw = data?.error?.message || '';
      if (/not valid/i.test(raw)) {
        message = 'PAN number is not valid. Please check and re-enter.';
      } else if (/required|empty/i.test(raw)) {
        message = 'PAN number is required. Please enter your PAN.';
      } else {
        message = 'Invalid request. Please check your input and try again.';
      }
    } else if (status === 401) {
      message = 'Verification failed. Please contact support.';
    } else if (status === 404) {
      message = 'Record not found. Please check and re-enter.';
    } else if (status === 409) {
      message = 'Service is temporarily unavailable. Please try again later.';
    }

    const err = new Error(message);
    err.statusCode = status;
    err.signzyError = data?.error || data;
    return Promise.reject(err);
  },
);

// ─── Signzy US OTP API client ───────────────────────────────────────────────

const signzyOtpApi = axios.create({
  baseURL: SIGNZY_OTP_CONFIG.BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: SIGNZY_OTP_CONFIG.AUTH_TOKEN,
  },
});

signzyOtpApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const networkErr = new Error(
        'OTP service unavailable. Please check your internet connection and try again.',
      );
      networkErr.statusCode = 0;
      networkErr.isNetworkError = true;
      return Promise.reject(networkErr);
    }

    const status = error.response.status;
    const data = error.response.data;

    let message = 'OTP verification failed. Please try again.';

    if (status === 400) {
      const raw = data?.error?.message || '';
      if (/not valid|not allowed/i.test(raw)) {
        message = 'Mobile number is not valid. Please check and re-enter.';
      } else if (/customer not found/i.test(raw)) {
        message = 'Customer not found. Please contact support.';
      } else if (/custom text/i.test(raw)) {
        message = 'OTP configuration error. Please contact support.';
      } else {
        message = 'Invalid request. Please check and try again.';
      }
    } else if (status === 401) {
      message = 'Authentication failed. Please contact support.';
    } else if (status === 404) {
      const raw = data?.error?.message || '';
      if (/blocked/i.test(raw)) {
        message = 'This phone number has been blocked. Please contact support.';
      } else {
        message = 'OTP service not available. Please try again later.';
      }
    } else if (status === 409) {
      message = 'OTP service is temporarily unavailable. Please try again later.';
    } else if (status === 422) {
      message = 'Unable to process OTP request. Please try again.';
    }

    const err = new Error(message);
    err.statusCode = status;
    err.signzyError = data?.error || data;
    return Promise.reject(err);
  },
);

// ─── Signzy v2 Patron-based API client (login + token) ─────────────────────

let v2AccessToken = null;
let v2TokenExpiry = 0;

async function getV2Token() {
  if (v2AccessToken && Date.now() < v2TokenExpiry) return v2AccessToken;

  const { data } = await axios.post(
    `${SIGNZY_V2_CONFIG.BASE_URL}${SIGNZY_V2_CONFIG.ENDPOINTS.LOGIN}`,
    {
      email: SIGNZY_V2_CONFIG.USERNAME,
      password: SIGNZY_V2_CONFIG.PASSWORD,
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
  );

  v2AccessToken = data.id || data.accessToken;
  v2TokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // refresh after 23h
  return v2AccessToken;
}

async function signzyV2Post(endpoint, body) {
  const token = await getV2Token();
  const { data } = await axios.post(
    `${SIGNZY_V2_CONFIG.BASE_URL}${endpoint}`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      timeout: 30000,
    },
  );
  return data;
}

// ─── Helper to safely extract result ────────────────────────────────────────

function extractResult(data) {
  return data?.result || data?.response || data;
}

// ═════════════════════════════════════════════════════════════════════════════
//  Signzy Service — All APIs
// ═════════════════════════════════════════════════════════════════════════════

export const signzyService = {

  // ─── Identity & PAN ─────────────────────────────────────────────────────

  async phoneToPan(phoneNumber, firstName, lastName) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_TO_PAN, {
      phoneNumber,
      firstName,
      lastName,
    });

    const resp = data.response || data;
    const pan = resp.pan || '';
    const personalInfo = resp.personalInfo || {};

    return {
      pan,
      name: personalInfo.name?.trim() || '',
      gender: personalInfo.gender || '',
      dateOfBirth: personalInfo.dateOfBirth || '',
    };
  },

  async verifyPan(panNumber) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PAN_FETCH_V2, {
      number: panNumber,
      returnIndividualTaxComplianceInfo: 'true',
      consent: 'Y',
    });

    const r = data.result || data;
    const statusCode = r.panStatusCode || '';

    return {
      isValid: r.isValid === true,
      name: r.name || '',
      panNumber: r.number || panNumber,
      panStatus: r.panStatus || '',
      panStatusLabel: PAN_STATUS_CODES[statusCode] || r.panStatus || 'UNKNOWN',
      firstName: r.firstName || '',
      middleName: r.middleName || '',
      lastName: r.lastName || '',
      typeOfHolder: r.typeOfHolder || '',
      isIndividual: r.isIndividual === true,
      aadhaarSeedingStatus: r.aadhaarSeedingStatus || '',
      individualTaxComplianceStatus: r.individualTaxComplianceStatus || '',
    };
  },

  async getEAadhaarXml(requestId, options = {}) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.E_AADHAAR_XML, {
      requestId,
      ...options,
    });
    const r = extractResult(data);
    return {
      aadhaarValid: r.aadhaarValid ?? null,
      digitalSignatureValid: r.digitalSignatureValid ?? null,
      name: r.name || '',
      dob: r.dob || '',
      gender: r.gender || '',
      address: r.address || '',
    };
  },

  async getDigilockerDetails(requestId) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.DIGILOCKER_DETAILS, {
      requestId,
    });
    const r = extractResult(data);
    return {
      totalDocuments: r.totalDocuments || 0,
      documents: r.documents || [],
      isVerified: r.isVerified ?? false,
    };
  },

  /**
   * DigiLocker Step 1 — Create authorization URL.
   * Returns a URL to redirect the user to DigiLocker consent screen,
   * and a requestId to poll for eAadhaar data after consent.
   */
  async digilockerCreateUrl(options = {}) {
    const {
      redirectUrl = 'finz://kyc/digilocker-callback',
      callbackUrl,
      internalId,
    } = options;

    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.DIGILOCKER_CREATE_URL, {
      signup: 'true',
      redirectUrl,
      redirectTime: '1',
      ...(callbackUrl ? { callbackUrl } : {}),
      successRedirectUrl: redirectUrl,
      successRedirectTime: '3',
      failureRedirectUrl: redirectUrl,
      failureRedirectTime: '3',
      logoVisible: 'true',
      logo: 'https://www.finz.finance/logo.png',
      supportEmailVisible: 'true',
      supportEmail: 'support@finz.finance',
      purpose: 'kyc',
      getScope: 'true',
      consentValidTill: String(Math.floor(Date.now() / 1000) + 86400 * 30), // 30 days
      showLoaderState: true,
      ...(internalId ? { internalId } : {}),
      companyName: 'FinZ Finance Pvt Ltd',
      favIcon: 'https://www.finz.finance/favicon.png',
      title: 'FinZ Finance Pvt Ltd',
      headerTitle: 'FinZ Finance Pvt Ltd',
      getBase64Files: true,
      getEAadhaarPdf: true,
      getEAadhaarJpeg: true,
    });

    const r = extractResult(data);
    return {
      url: r.url || '',
      requestId: r.requestId || '',
    };
  },

  /**
   * DigiLocker Step 2 — Fetch eAadhaar data after user completes consent.
   * Call with the requestId from digilockerCreateUrl.
   */
  async digilockerGetEAadhaar(requestId) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.DIGILOCKER_GET_EAADHAAR, {
      requestId,
      getEAadhaarPdf: true,
      getEAadhaarJpeg: true,
    });

    const r = extractResult(data);
    return {
      name: r.name || '',
      uid: r.uid || '',
      dob: r.dob || '',
      gender: r.gender || '',
      address: r.address || '',
      photo: r.photo || '',
      splitAddress: r.splitAddress || {},
      aadhaarJpeg: r.aadhaarJpeg || '',
      aadhaarPdf: r.aadhaarPdf || '',
      xmlFileLink: r.xmlFileLink || '',
      signatureValid: r.x509Data?.validAadhaarDSC === 'yes',
    };
  },

  // ─── Phone KYC Suite ────────────────────────────────────────────────────

  async phoneToRegisteredAddress(phoneNumber, firstName, lastName, pan) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_TO_REGISTERED_ADDRESS, {
      phoneNumber, firstName, lastName, pan,
    });
    const r = extractResult(data);
    return {
      addressFound: r.addressFound ?? false,
      address: r.address || '',
      city: r.city || '',
      state: r.state || '',
      pincode: r.pincode || '',
      matchScore: r.matchScore ?? 0,
    };
  },

  async phoneToAlternatePhone(phoneNumber, firstName, lastName, pan) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_TO_ALTERNATE_PHONE, {
      phoneNumber, firstName, lastName, pan,
    });
    const r = extractResult(data);
    return {
      alternatePhones: r.alternatePhones || [],
      totalFound: r.totalFound || 0,
    };
  },

  async phoneToPrefill(phoneNumber, firstName, lastName, pan) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_TO_PREFILL, {
      phoneNumber, firstName, lastName, pan,
    });
    const r = extractResult(data);
    return {
      addresses: r.addresses || [],
      emails: r.emails || [],
      dataRichness: r.dataRichness || 'none',
    };
  },

  /**
   * Phone KYC — Phone Prefill (/phonekyc/phone-prefill).
   *
   * Comprehensive user footprint by phone + PAN + name. Returns
   * contact details (alternate phones, emails), address history
   * (with report date + type), identity documents (PAN, passport,
   * voter ID, driving license), and demographics (name, gender,
   * age, dob, reported income).
   *
   * Primary / most-recent address is surfaced as `primaryAddress`
   * so the app can prefill the communication address without the
   * caller having to walk the whole list.
   */
  async phonePrefill(phoneNumber, firstName, lastName, pan) {
    console.log(
      '[signzyService] phonePrefill → phone =',
      phoneNumber,
      ', firstName =',
      firstName,
      ', pan =',
      pan,
    );

    const body = { phoneNumber, firstName };
    if (lastName) body.lastName = lastName;
    if (pan) body.pan = pan;

    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_PREFILL, body);
    const r = data?.response || data?.result || data || {};

    // Normalize the nested `{ serialNo, <field> }` arrays into simple
    // lists of strings — easier to render and dedupe.
    const pickList = (arr, key) =>
      Array.isArray(arr)
        ? arr
            .map((item) => (typeof item === 'string' ? item : item?.[key]))
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter(Boolean)
        : [];

    const alternatePhones = pickList(r.alternatePhone, 'phoneNumber');
    const emails = pickList(r.email, 'email');
    const voterIds = pickList(r.voterId, 'voterId');
    const passports = pickList(r.passport, 'passport');
    const drivingLicenses = pickList(r.drivingLicense, 'drivingLicense');

    // Address history — keep the structured form so callers can show the
    // reported date / type, but also pick the most useful one as the
    // "primary" for prefill (Type === 'Primary' first, else most recent
    // by ReportedDate).
    const addresses = Array.isArray(r.address)
      ? r.address
          .map((a) => ({
            seq: String(a?.Seq || ''),
            reportedDate: String(a?.ReportedDate || ''),
            address: String(a?.Address || '').replace(/\s+/g, ' ').trim(),
            state: String(a?.State || ''),
            postal: String(a?.Postal || ''),
            type: String(a?.Type || ''),
          }))
          .filter((a) => a.address)
      : [];

    const byDateDesc = (a, b) => (b.reportedDate || '').localeCompare(a.reportedDate || '');
    const primaryCandidates = addresses.filter((a) => /primary/i.test(a.type));
    const sortedPrimary = [...primaryCandidates].sort(byDateDesc);
    const sortedAll = [...addresses].sort(byDateDesc);
    const primaryAddress = sortedPrimary[0] || sortedAll[0] || null;

    const nameObj = r.name || {};

    return {
      // Contact
      alternatePhones,
      emails,
      primaryEmail: emails[0] || '',
      // Addresses
      addresses,
      primaryAddress,
      // Identity
      pan: r.pan || '',
      voterIds,
      passports,
      drivingLicenses,
      // Demographics
      name: {
        fullName: String(nameObj.fullName || '').trim(),
        firstName: String(nameObj.firstName || '').trim(),
        lastName: String(nameObj.lastName || '').trim(),
      },
      gender: r.gender || '',
      age: r.age ? String(r.age) : '',
      dob: r.dob || '',
      income: r.income ? String(r.income) : '',
      // Audit
      rawResponse: data,
    };
  },

  async phoneToIncome(phoneNumber, firstName, dob, address, pincode, lastName, pan) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_TO_INCOME, {
      phoneNumber, firstName, dob, address, pincode, lastName, pan,
    });
    const r = extractResult(data);
    return {
      estimatedMonthlyIncome: r.estimatedMonthlyIncome ?? null,
      incomeRange: r.incomeRange || '',
      confidence: r.confidence ?? 0,
    };
  },

  async phoneToIdentityDetails(phoneNumber, firstName, lastName, pan) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_TO_IDENTITY_DETAILS, {
      phoneNumber, firstName, lastName, pan,
    });
    const r = extractResult(data);
    return {
      identities: r.identities || [],
      nameOnRecords: r.nameOnRecords || '',
      gender: r.gender || '',
      dob: r.dob || '',
      consistencyScore: r.consistencyScore ?? 0,
    };
  },

  // ─── Risk & Fraud ──────────────────────────────────────────────────────

  async getPhoneIntelligence(phoneNumber, originatingIp, emailAddress, deviceId) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_INTELLIGENCE, {
      phoneNumber, originatingIp, emailAddress, deviceId,
    });
    const r = extractResult(data);
    return {
      riskScore: r.riskScore ?? 500,
      riskLevel: r.riskLevel || 'unknown',
      phoneType: r.phoneType || 'unknown',
      carrier: r.carrier || '',
      lineType: r.lineType || '',
      isBlocklisted: r.isBlocklisted ?? false,
      simSwapDetected: r.simSwapDetected ?? false,
      simSwapLastDate: r.simSwapLastDate || null,
      accountTenure: r.accountTenure || '',
      isPorted: r.isPorted ?? false,
      isRoaming: r.isRoaming ?? false,
      fraudSources: r.fraudSources || [],
    };
  },

  async checkWhatsAppPresence(mobile) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.WHATSAPP_PRESENCE, {
      mobile,
    });
    const r = extractResult(data);
    return {
      isRegistered: r.isRegistered ?? false,
      accountType: r.accountType || null,
      profileExists: r.profileExists ?? false,
    };
  },

  async getDigitalIdentityScore(phone, email, name, pincode) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.DIGITAL_IDENTITY_SCORE, {
      phone, email, name, pincode,
    });
    const r = extractResult(data);
    return {
      score: r.score ?? 0,
      maxScore: r.maxScore || 10,
      phoneFirstSeen: r.phoneFirstSeen || null,
      emailFirstSeen: r.emailFirstSeen || null,
      ecomPresence: r.ecomPresence || [],
      socialPresence: r.socialPresence || [],
      nameEmailMatch: r.nameEmailMatch ?? false,
      phoneEmailLinked: r.phoneEmailLinked ?? false,
      riskBand: r.riskBand || 'unknown',
    };
  },

  // ─── Banking ────────────────────────────────────────────────────────────

  /**
   * Hybrid Bank Account Verification (penny drop / penniless).
   * Uses Signzy's hybrid routing — penniless for 80+ banks, penny drop as fallback.
   * @param {string} accountNumber - Beneficiary account number
   * @param {string} ifsc - Beneficiary IFSC code
   * @param {string} [name] - Beneficiary name for fuzzy name match
   * @param {string} [mobile] - Beneficiary mobile
   * @param {Object} [options] - Extra options (nameMatchScore, nameFuzzy, fetchAccountNumber)
   * @returns {Object} Verification result
   */
  async verifyBankAccount(accountNumber, ifsc, name, mobile, options = {}) {
    const body = {
      beneficiaryAccount: accountNumber,
      beneficiaryIFSC: ifsc,
    };

    if (name) body.beneficiaryName = name;
    if (mobile) body.beneficiaryMobile = mobile;

    // Enable fuzzy name match by default with 60% threshold
    body.nameFuzzy = options.nameFuzzy || 'true';
    body.nameMatchScore = options.nameMatchScore || '0.6';
    if (options.fetchAccountNumber) body.fetchAccountNumber = true;

    console.log('[signzyService] verifyBankAccount → calling hybrid bank verification');

    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.BANK_ACCOUNT_VERIFICATION, body);
    const r = data?.result || data;
    const transfer = r.bankTransfer || {};

    return {
      accountActive: r.active === 'yes',
      reason: r.reason || '',
      nameMatch: r.nameMatch === 'yes',
      nameMatchScore: r.nameMatchScore !== 'not available'
        ? parseFloat(r.nameMatchScore) || 0
        : null,
      mobileMatch: r.mobileMatch === 'yes',
      signzyReferenceId: r.signzyReferenceId || '',
      auditTrail: r.auditTrail || {},
      // Bank transfer details (from penny drop)
      accountHolderName: transfer.beneName || '',
      bankRRN: transfer.bankRRN || '',
      beneIFSC: transfer.beneIFSC || '',
      beneMobile: transfer.beneMobile || '',
      response: transfer.response || '',
    };
  },

  async searchBankByIfsc(ifscCode) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.IFSC_SEARCH, {
      ifsc: ifscCode,
    });
    const r = extractResult(data);
    return {
      valid: r.valid ?? false,
      bankName: r.bankName || r.bank || '',
      branch: r.branch || '',
      city: r.city || '',
      state: r.state || '',
    };
  },

  // ─── Employment ─────────────────────────────────────────────────────────

  async verifyEmployment(mobile, panNumber) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.EMPLOYMENT_VERIFICATION, {
      mobile, panNumber,
    });
    const r = extractResult(data);
    return {
      isEmployed: r.isEmployed ?? false,
      employerName: r.employerName || '',
      membershipStatus: r.membershipStatus || '',
      dateOfExit: r.dateOfExit || null,
    };
  },

  /**
   * Employment Verification — UAN Basic (EPFO lookup by mobile + PAN).
   *
   * Endpoint: POST /employment-verification/current-employer
   * Used for salaried applicants where PF is being deducted — pulls
   * current / most recent EPFO employment record and every UAN linked
   * to the applicant.
   *
   * Returns a normalized object with the headline employment summary
   * (employer name, joining / exit dates, UAN count, is_employed),
   * a detailed per-UAN breakdown with basic_details + employment_details,
   * and the raw Signzy payload for audit. All fields default safely
   * when Signzy returns a partial record.
   */
  async getCurrentEmployer(mobile, panNumber) {
    console.log('[signzyService] getCurrentEmployer → mobile =', mobile, ', pan =', panNumber);
    const { data } = await signzyApi.post(
      SIGNZY_CONFIG.ENDPOINTS.EMPLOYMENT_CURRENT_EMPLOYER,
      { mobile, panNumber },
    );

    const r = extractResult(data);
    const summary = r.employmentSummary || {};
    const recent = summary.recent_employer_data || {};
    const uanDetails = r.uanDetails || {};
    const uanNumbers = Array.isArray(r.uanNumbers) ? r.uanNumbers : [];

    // Flatten the per-UAN map into an array for easier rendering.
    const uans = Object.entries(uanDetails).map(([uan, details]) => {
      const basic = details?.basic_details || {};
      const emp = details?.employment_details || {};
      return {
        uan,
        name: basic.name || '',
        gender: basic.gender || '',
        dob: basic.date_of_birth || '',
        mobile: basic.mobile || '',
        aadhaarVerificationStatus: basic.aadhaar_verification_status ?? null,
        employeeConfidenceScore: basic.employee_confidence_score ?? null,
        memberId: emp.member_id || '',
        establishmentId: emp.establishment_id || '',
        establishmentName: emp.establishment_name || '',
        dateOfJoining: emp.date_of_joining || '',
        dateOfExit: emp.date_of_exit || '',
        leaveReason: emp.leave_reason || '',
        employerConfidenceScore: emp.employer_confidence_score ?? null,
      };
    });

    return {
      resultCode: data.resultCode ?? r.resultCode ?? null,
      isEmployed: summary.is_employed ?? false,
      uanCount: summary.uan_count ?? uanNumbers.length,
      employeeNameMatch: summary.employee_name_match ?? null,
      employerNameMatch: summary.employer_name_match ?? null,
      dateOfExitMarked: summary.date_of_exit_marked ?? false,
      recentEmployer: {
        memberId: recent.member_id || '',
        establishmentId: recent.establishment_id || '',
        establishmentName: recent.establishment_name || '',
        dateOfJoining: recent.date_of_joining || '',
        dateOfExit: recent.date_of_exit || '',
        employerConfidenceScore: recent.employer_confidence_score ?? null,
        matchingUan: recent.matching_uan || '',
      },
      uans,
      uanNumbers,
      uanDataSource: Array.isArray(r.uanDataSource) ? r.uanDataSource : [],
      rawResponse: data,
    };
  },

  async advancedEmploymentVerification(params) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.ADVANCED_EMPLOYMENT, params);
    const r = extractResult(data);
    return {
      employmentHistory: r.employmentHistory || [],
      totalExperience: r.totalExperience || '',
      pfFilingFrequency: r.pfFilingFrequency || 'none',
      lastPfFiled: r.lastPfFiled || null,
      employerGstinActive: r.employerGstinActive ?? false,
    };
  },

  // ─── Address ────────────────────────────────────────────────────────────

  async geocodeAddress(address, latitude, longitude) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.ADDRESS_GEOCODE, {
      address, latitude, longitude,
    });
    const r = extractResult(data);
    return {
      confidence: r.confidence ?? 0,
      formattedAddress: r.formattedAddress || '',
      lat: r.lat || r.latitude || null,
      lng: r.lng || r.longitude || null,
      isInternationalBorder: r.isInternationalBorder ?? false,
      nearestBorderDistance: r.nearestBorderDistance || null,
      distanceFromDevice: r.distanceFromDevice || null,
    };
  },

  async getPincodeDetails(pincode) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PINCODE_DETAILS, {
      pincode,
    });
    const r = extractResult(data);
    return {
      isServiceable: r.isServiceable ?? true,
      isBlacklisted: r.isBlacklisted ?? false,
      area: r.area || '',
      district: r.district || '',
      state: r.state || '',
      riskCategory: r.riskCategory || 'medium',
    };
  },

  // ─── Device ─────────────────────────────────────────────────────────────

  async fetchImeiDetails(imei) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.IMEI_FETCH, {
      imei,
    });
    const r = extractResult(data);
    return {
      valid: r.valid ?? false,
      brand: r.brand || '',
      model: r.model || '',
      isStolen: r.isStolen ?? false,
      isLost: r.isLost ?? false,
      manufactureYear: r.manufactureYear || null,
    };
  },

  // ─── Document ───────────────────────────────────────────────────────────

  async checkDocumentForgery(imageUrl, threshold = 0.5) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.FORGERY_CHECK, {
      imageUrl, threshold,
    });
    const r = extractResult(data);
    return {
      status: r.status || 'unknown',
      forgeryScore: r.forgeryScore ?? 0,
      anomalies: r.anomalies || [],
      metadataConsistent: r.metadataConsistent ?? true,
    };
  },

  // ─── Patron-based APIs (v2) ─────────────────────────────────────────────

  async checkGeoFencing(ip, country, state) {
    const result = await signzyV2Post(SIGNZY_V2_CONFIG.ENDPOINTS.GEO_FENCING, {
      ip, country, state,
    });
    const r = result?.result || result;
    return {
      geoMatch: r.geoMatch ?? false,
      stateMatch: r.stateMatch ?? false,
      ipCity: r.ipCity || '',
      ipState: r.ipState || '',
      ipCountry: r.ipCountry || '',
      isTor: r.isTor ?? false,
      isVpn: r.isVpn ?? false,
      isProxy: r.isProxy ?? false,
    };
  },

  async checkDigitalIntegrity(email, phone, ip) {
    const result = await signzyV2Post(SIGNZY_V2_CONFIG.ENDPOINTS.DIGITAL_INTEGRITY, {
      email, phone, ip,
    });
    const r = result?.result || result;
    return {
      emailValid: r.emailValid ?? false,
      emailDisposable: r.emailDisposable ?? false,
      ipBlocklisted: r.ipBlocklisted ?? false,
      botLikelihood: r.botLikelihood ?? 0,
    };
  },

  // ─── Liveness & Selfie ─────────────────────────────────────────────

  /**
   * Create a liveness verification URL for selfie capture & face match.
   * The returned videoUrl should be loaded in a WebView with camera permission.
   * @param {Object} options
   * @param {string[]} options.matchImage - Publicly accessible image URLs for face matching
   * @param {string} [options.languageCode='en']
   * @param {number} [options.faceMatchThreshold=0.6]
   * @param {string} [options.callbackUrl]
   * @param {string} [options.redirectUrl]
   * @returns {{ token: string, videoUrl: string, consumerId: string }}
   */
  async livenessCreateUrl(options = {}) {
    const {
      matchImage = [],
      languageCode = 'en',
      faceMatchThreshold = 0.6,
      callbackUrl,
      redirectUrl,
    } = options;

    // Signzy matchImage: prefer http(s) URLs; also accept data URIs and raw base64
    // since the pre-production API may support them.
    const validMatchImages = matchImage
      .filter((img) => typeof img === 'string' && img.length > 10)
      .map((img) => {
        if (img.startsWith('http://') || img.startsWith('https://')) return img;
        if (img.startsWith('data:image')) return img;
        // Assume raw base64 — wrap as data URI
        return `data:image/jpeg;base64,${img}`;
      });

    const body = {
      languageCode,
      hideBottomLogo: 'true',
      reviewImage: 'true',
      additionalChecks: 'true',
      allowCameraSwitch: 'true',
    };

    // Only include matchImage and faceMatchThreshold when we have valid image URLs
    if (validMatchImages.length > 0) {
      body.matchImage = validMatchImages;
      body.faceMatchThreshold = faceMatchThreshold;
    }

    // Only include callback/redirect if they are valid http(s) URLs
    if (callbackUrl && callbackUrl.startsWith('http')) {
      body.callbackUrl = callbackUrl;
    }
    if (redirectUrl && redirectUrl.startsWith('http')) {
      body.redirectUrl = redirectUrl;
    }

    console.log('[signzyService] livenessCreateUrl request body:', JSON.stringify(body));

    let data;
    try {
      const response = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.LIVENESS_CREATE_URL, body);
      data = response.data;
    } catch (err) {
      console.log('[signzyService] livenessCreateUrl error response:', JSON.stringify(err.signzyError || err.message));
      throw err;
    }

    const r = extractResult(data);
    return {
      token: r.token || '',
      videoUrl: r.videoUrl || '',
      consumerId: r.consumerId || '',
    };
  },

  /**
   * Get liveness verification results after the user completes the journey.
   * Call after receiving "Verification Done" message from the WebView.
   * @param {string} token - Token from livenessCreateUrl response
   * @returns {{ result: Object, essentials: Object }}
   */
  async livenessGetData(token) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.LIVENESS_GET_DATA, {
      token,
    });

    const r = data?.result || data;
    return {
      consumerId: r.consumerId || '',
      token: r.token || token,
      isUsed: r.isUsed || 0,
      capturedImage: r.capturedImage || '',
      faceMatch: {
        verified: r.faceMatch?.verified ?? false,
        message: r.faceMatch?.message || '',
        matchPercentage: r.faceMatch?.matchPercentage || '0.00%',
      },
      passiveLiveliness: {
        liveness: r.passiveLiveliness?.liveness ?? false,
        score: r.passiveLiveliness?.score ?? 0,
      },
      status: r.status ?? false,
      additionalChecks: {
        status: r.additionalChecks?.status ?? true,
        attemptNumber: r.additionalChecks?.attemptNumber ?? 1,
        failedChecks: r.additionalChecks?.failedChecks || [],
        isFaceCovered: r.additionalChecks?.isFaceCovered ?? false,
      },
    };
  },

  // ─── Face Match ─────────────────────────────────────────────────────────

  /**
   * Compare a selfie image against a KYC/ID image using Signzy face verification.
   * Accepts base64 data URIs or public URLs.
   * @param {string} selfieImage - Selfie image (base64 data URI or URL)
   * @param {string} idImage - KYC/ID image (base64 data URI or URL)
   * @param {number} [threshold=0.6] - Match threshold (0.05–0.95)
   * @returns {{ verified: boolean, matchPercentage: string, message: string }}
   */
  async faceMatch(selfieImage, idImage, threshold = 0.6) {
    const body = {
      selfie_url: selfieImage,
      id_url: idImage,
      threshold,
    };

    console.log('[signzyService] faceMatch → calling extraction-face-verification');

    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.FACE_MATCH, body);
    const r = extractResult(data);
    const faceDetails = r.faceMatchDetails || r.faceMatch || {};

    return {
      verified: faceDetails.verified ?? false,
      matchPercentage: faceDetails.matchPercentage || '0.00%',
      message: faceDetails.message || '',
    };
  },

  // ─── Email Validation ─────────────────────────────────────────────────

  RISKY_EMAIL_STATUSES: ['invalid', 'spamtrap', 'abuse', 'do_not_mail', 'unknown'],

  async verifyEmail(emailId) {
    console.log('[signzyService] verifyEmail →', emailId);

    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.EMAIL_VALIDATION, {
      emailId,
    });

    const verifyData = data?.result?.emailverifyData || {};

    const isRisky = this.RISKY_EMAIL_STATUSES.includes(verifyData.status);

    return {
      email: verifyData.email || emailId,
      status: verifyData.status || 'unknown',
      subStatus: verifyData.sub_status || '',
      freeEmail: verifyData.free_email === 'true' || verifyData.free_email === true,
      disposable: verifyData.sub_status === 'disposable',
      toxic: verifyData.sub_status === 'toxic',
      mxFound: verifyData.mx_found === 'true' || verifyData.mx_found === true,
      mxRecord: verifyData.mx_record || '',
      smtpProvider: verifyData.smtp_provider || '',
      domain: verifyData.domain || '',
      domainAgeDays: verifyData.domain_age_days || '',
      didYouMean: verifyData.did_you_mean || '',
      isRisky,
    };
  },

  // ─── OTP ────────────────────────────────────────────────────────────────

  async sendOtp(phoneNumber, options = {}) {
    const {
      channel = SIGNZY_OTP_CONFIG.DEFAULT_CHANNEL,
      customTextId = SIGNZY_OTP_CONFIG.DEFAULT_OTP_LENGTH,
    } = options;

    const { data } = await signzyOtpApi.post(SIGNZY_OTP_CONFIG.ENDPOINTS.SEND_OTP, {
      clientId: SIGNZY_OTP_CONFIG.CLIENT_ID,
      phoneNumber,
      channel,
      customTextId,
    });

    const result = data.result || data;
    return {
      success: result.status === 200,
      statusDescription: result.statusDescription || '',
    };
  },

  async verifyOtp(phoneNumber, otp) {
    const { data } = await signzyOtpApi.post(SIGNZY_OTP_CONFIG.ENDPOINTS.VERIFY_OTP, {
      clientId: SIGNZY_OTP_CONFIG.CLIENT_ID,
      phoneNumber,
      otp,
    });

    const result = data.result || data;
    return {
      success: result.status === 200,
      statusDescription: result.statusDescription || '',
    };
  },
};
