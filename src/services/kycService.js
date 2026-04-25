import { signzyService } from './signzyService';
import { ckycService } from './ckycService';
import { getActiveVendorsForApi } from './vendorConfigService';

export const kycService = {
  // ─── REAL APIs (Signzy) ──────────────────────────────────────────────────

  /**
   * Phone-to-PAN lookup — calls Signzy phoneToPan API directly.
   */
  async fetchPanByMobile(mobile, firstName = '', lastName = '') {
    console.log('[kycService] fetchPanByMobile → calling signzyService.phoneToPan directly');
    const result = await signzyService.phoneToPan(mobile, firstName, lastName);
    console.log('[kycService] phoneToPan result:', JSON.stringify(result));
    return {
      panNumber: result.pan || '',
      name: result.name || '',
      gender: result.gender || '',
      dateOfBirth: result.dateOfBirth || '',
    };
  },

  /**
   * PAN verification — calls Signzy PAN fetchV2 API directly.
   */
  async validatePan(panNumber) {
    console.log('[kycService] validatePan → calling signzyService.verifyPan directly');
    return signzyService.verifyPan(panNumber);
  },

  // DigiLocker — calls Signzy DigiLocker API directly (2-step flow)

  /**
   * Step 1: Create DigiLocker authorization URL.
   * Returns { url, requestId }.
   */
  async initiateDigilocker(options = {}) {
    console.log('[kycService] initiateDigilocker → calling signzyService.digilockerCreateUrl');
    const result = await signzyService.digilockerCreateUrl(options);
    console.log('[kycService] digilockerCreateUrl result: requestId =', result.requestId);
    return result;
  },

  /**
   * Step 2: Fetch eAadhaar data after user completes DigiLocker consent.
   * Returns KYC data (name, dob, address, photo, uid, etc.).
   */
  async fetchDigilockerEAadhaar(requestId) {
    console.log('[kycService] fetchDigilockerEAadhaar → calling signzyService.digilockerGetEAadhaar');
    const result = await signzyService.digilockerGetEAadhaar(requestId);
    console.log('[kycService] digilockerGetEAadhaar result:', JSON.stringify({
      name: result.name,
      uid: result.uid,
      dob: result.dob,
      address: result.address,
    }));
    return result;
  },

  // Selfie & Liveness (Signzy)

  /**
   * Create liveness verification URL for selfie capture.
   */
  async createLivenessUrl(matchImageUrls, options = {}) {
    console.log('[kycService] createLivenessUrl → calling signzyService.livenessCreateUrl');
    const result = await signzyService.livenessCreateUrl({
      matchImage: matchImageUrls,
      ...options,
    });
    console.log('[kycService] livenessCreateUrl result: token =', result.token);
    return result;
  },

  /**
   * Get liveness verification results after user completes the selfie journey.
   */
  async getLivenessData(token) {
    console.log('[kycService] getLivenessData → calling signzyService.livenessGetData');
    const result = await signzyService.livenessGetData(token);
    console.log('[kycService] livenessGetData result:', JSON.stringify({
      status: result.status,
      faceMatchVerified: result.faceMatch?.verified,
      liveness: result.passiveLiveliness?.liveness,
    }));
    return result;
  },

  /**
   * Verify a captured selfie against KYC photo via Signzy face match.
   */
  async verifySelfieWithKyc(selfieImage, kycPhoto) {
    console.log('[kycService] verifySelfieWithKyc → calling signzyService.faceMatch');

    const hasValidSelfie = selfieImage && selfieImage.length > 100;
    const hasValidKycPhoto = kycPhoto &&
      (kycPhoto.startsWith('http') || kycPhoto.startsWith('data:') || kycPhoto.length > 100);

    if (!hasValidSelfie) {
      return {
        verified: false,
        matchPercentage: '0.00%',
        message: 'Selfie image is missing or invalid. Please retake.',
        liveness: false,
        livenessScore: 0,
      };
    }

    if (!hasValidKycPhoto) {
      return {
        verified: false,
        matchPercentage: '0.00%',
        message: 'KYC photo is missing. Please complete KYC verification first.',
        liveness: true,
        livenessScore: 1.0,
      };
    }

    try {
      const result = await signzyService.faceMatch(selfieImage, kycPhoto);
      console.log('[kycService] faceMatch result:', JSON.stringify(result));
      return {
        verified: result.verified ?? false,
        matchPercentage: result.matchPercentage || '0.00%',
        message: result.message || '',
        liveness: true,
        livenessScore: 1.0,
      };
    } catch (err) {
      console.log('[kycService] faceMatch error:', err.message || JSON.stringify(err));
      throw new Error(err.message || 'Face verification failed. Please try again.');
    }
  },

  // ─── Credit Bureau ─────────────────────────────────────────────────────
  // softPull tries the live Signzy CIBIL API when the cibilBureau
  // vendor toggle is on (default until CRIF hard-pull is integrated).
  // On success the caller gets a normalized {cibilScore, gatingPassed,
  // raw report, PDF URL} object plus the full Signzy payload on
  // `_signzy` for audit logging. Falls back to the deterministic mock
  // when Signzy is disabled / unreachable so the flow still completes.
  async softPull(data) {
    const enabled = await getActiveVendorsForApi('cibilBureau').catch(() => ({ signzy: true }));
    const useSignzy = !!enabled?.signzy;

    if (useSignzy && data?.pan) {
      try {
        // CIBIL needs a few fields beyond PAN — pass through whatever
        // the caller provided. Most are mandatory upstream; missing
        // ones become empty strings and the API will respond with a
        // 400 the catch-block surfaces.
        const result = await signzyService.cibilConsumerReport({
          phoneNumber: data.phone || '',
          panNumber: data.pan,
          firstName: data.firstName || (data.name || '').split(/\s+/)[0] || '',
          lastName: data.lastName || ((data.name || '').split(/\s+/).slice(-1)[0]) || '',
          gender: data.gender || 'Male',
          dateOfBirth: data.dob || data.dateOfBirth || '',
          address: data.address || '',
          pincode: data.pincode || '',
          consent: {
            consentFlag: true,
            consentTimestamp: Math.floor(Date.now() / 1000),
            consentIpAddress: data.ipAddress || '0.0.0.0',
          },
        });
        console.log('[kycService] CIBIL softPull → score =', result.cibilScore, ', gating =', result.gatingPassed);
        return {
          score: result.cibilScore,
          cibilScore: result.cibilScore,
          gatingPassed: !!result.gatingPassed,
          enquiryCount: 0,
          activeAccounts: 0,
          overdueAccounts: 0,
          source: 'signzy_cibil',
          // Carry the full Signzy result so the caller can stash it on
          // signzyVerifications.cibilBureau without making a second call.
          _signzy: result,
        };
      } catch (err) {
        console.log('[kycService] CIBIL softPull failed, falling back to mock:', err?.message);
        // Fall through to the mock below so the flow still completes —
        // but thread the Signzy error through so the UI can tell the
        // reviewer WHY the bureau wasn't hit (instead of the generic
        // "no_bureau / mock" banner).
        return {
          score: 720,
          cibilScore: 720,
          gatingPassed: true,
          enquiryCount: 2,
          activeAccounts: 3,
          overdueAccounts: 0,
          source: 'mock',
          _signzyError: err?.message || 'CIBIL bureau call failed',
          _signzyStatusCode: err?.statusCode || err?.response?.status || null,
        };
      }
    }

    console.log('[kycService] Mock softPull for:', data?.pan);
    await new Promise((r) => setTimeout(r, 800));
    return {
      score: 720,
      cibilScore: 720,
      gatingPassed: true,
      enquiryCount: 2,
      activeAccounts: 3,
      overdueAccounts: 0,
      source: 'mock',
    };
  },

  async hardPull(data) {
    console.log('[kycService] Mock hardPull for:', data.pan);
    await new Promise((r) => setTimeout(r, 1000));
    return {
      score: 720,
      cibilScore: 720,
      totalAccounts: 5,
      activeAccounts: 3,
      closedAccounts: 2,
      overdueAccounts: 0,
      totalOutstanding: 150000,
      totalEmi: 8000,
    };
  },

  async checkGatingCriteria(data) {
    console.log('[kycService] Mock checkGatingCriteria');
    await new Promise((r) => setTimeout(r, 500));
    return { passed: true, reason: '' };
  },

  // ─── CKYC (FinZ CKYC Gateway) ──────────────────────────────────────────
  //
  // Real flow:
  //   1. initiateCkyc()   — search CKYC repo, then trigger OTP download.
  //                         Returns { ckycReferNo, requestId } that must be
  //                         held by the caller across subsequent calls.
  //   2. resendCkycOtp()  — resend OTP (enabled 90s after first request).
  //   3. verifyCkycOtp()  — validate OTP and return the normalized CKYC
  //                         record shaped like DigiLocker / Aadhaar XML so
  //                         the details-review UI works unchanged.

  /**
   * Step 1: search the CKYC repository and trigger an OTP to the
   * applicant's registered mobile number.
   *
   * @param {Object} data
   * @param {string} data.pan      PAN number
   * @param {string} data.name     Applicant name
   * @param {string} data.phone    Registered mobile number
   * @param {string} [data.userId] LMS user id (optional)
   * @param {string} [data.loanId] LMS application / loan id (optional)
   * @returns {Promise<{ ckycReferNo: string, requestId: string, message: string }>}
   */
  async initiateCkyc(data) {
    console.log('[kycService] initiateCkyc → calling ckycService.searchCkyc');

    const searchResult = await ckycService.searchCkyc({
      pan: data.pan,
      name: data.name,
      userId: data.userId,
      loanId: data.loanId,
    });

    if (!searchResult.ckycReferNo) {
      console.log(
        '[kycService] initiateCkyc: no ckyc_refer_no in search response. Raw =',
        JSON.stringify(searchResult.raw),
      );
      const rawMsg = (searchResult.message || '').toLowerCase();

      // When the gateway token is missing/invalid, it silently answers
      // `{success:true, ckyc_refer_no:"", message:"searching done"}` so
      // real records look like "no record" to the app. Detect that exact
      // fingerprint and surface a clear "token/config" error instead.
      const looksLikeAuthSilentFail =
        searchResult.raw &&
        searchResult.raw.success === true &&
        rawMsg.includes('searching done') &&
        !searchResult.ckycReferNo;

      if (looksLikeAuthSilentFail) {
        const err = new Error(
          'CKYC gateway rejected the request silently. Please verify the CKYC token in src/config/constants.js (CKYC_CONFIG.TOKEN) and that the PAN/name match the CERSAI record exactly.',
        );
        err.ckycConfigIssue = true;
        throw err;
      }

      const err = new Error(
        rawMsg.includes('no record')
          ? 'No CKYC record found for this PAN. Please use DigiLocker instead.'
          : searchResult.message || 'CKYC search did not return a reference number. Please use DigiLocker instead.',
      );
      err.noRecord = true;
      throw err;
    }

    console.log('[kycService] initiateCkyc → ckyc_refer_no =', searchResult.ckycReferNo);

    const otpResult = await ckycService.sendCkycOtp({
      pan: data.pan,
      name: data.name,
      referenceNo: searchResult.ckycReferNo,
      mobile: data.phone,
      userId: data.userId,
      loanId: data.loanId,
    });

    return {
      ckycReferNo: searchResult.ckycReferNo,
      requestId: otpResult.requestId,
      message: otpResult.message,
    };
  },

  /**
   * Resend the CKYC OTP. Must be called with the same `requestId`
   * returned from `initiateCkyc`. Enabled only 90s after the first
   * send.
   */
  async resendCkycOtp(data) {
    console.log('[kycService] resendCkycOtp → calling ckycService.resendCkycOtp');
    return ckycService.resendCkycOtp({
      pan: data.pan,
      mobile: data.phone,
      requestId: data.requestId,
    });
  },

  /**
   * Step 2: validate the OTP and download the full CKYC record.
   *
   * Returns a KYC object shaped like DigiLocker / Aadhaar XML so that
   * the existing details-review screen works without changes.
   */
  async verifyCkycOtp(data) {
    console.log('[kycService] verifyCkycOtp → calling ckycService.validateCkycOtp');

    const result = await ckycService.validateCkycOtp({
      pan: data.pan,
      otp: data.otp,
      mobile: data.phone,
      requestId: data.requestId,
      referenceNo: data.referenceNo,
    });

    console.log(
      '[kycService] verifyCkycOtp result: name =',
      result.name,
      ', pincode =',
      result.pincode,
      ', ckycNumber =',
      result.ckycNumber,
      ', ckycReferenceNo =',
      result.ckycReferenceNo,
    );
    return result;
  },

  // Aadhaar XML
  async uploadAadhaarXml(formData) {
    console.log('[kycService] Mock uploadAadhaarXml');
    await new Promise((r) => setTimeout(r, 1000));
    return {
      name: 'RAHUL SHARMA',
      dob: '1995-01-15',
      gender: 'M',
      address: '123, Andheri West, Mumbai, Maharashtra 400053',
      pincode: '400053',
      uid: 'XXXX-XXXX-1234',
      photo: '',
      verified: true,
      splitAddress: {
        addressLine: '123, Andheri West',
        city: ['Mumbai'],
        state: ['Maharashtra'],
        pincode: '400053',
      },
    };
  },

  // Pincode check
  async checkPincode(pincode) {
    console.log('[kycService] Mock checkPincode:', pincode);
    await new Promise((r) => setTimeout(r, 300));
    return {
      serviceable: true,
      area: 'Andheri West',
      district: 'Mumbai',
      state: 'Maharashtra',
      status: 'OK',
    };
  },

  /** @deprecated Use verifySelfieWithKyc instead */
  async verifySelfie(selfieBase64, kycImageBase64) {
    console.log('[kycService] Mock verifySelfie (deprecated)');
    await new Promise((r) => setTimeout(r, 1000));
    return {
      verified: true,
      matchPercentage: '85.50%',
      message: 'Face match successful (mock)',
    };
  },

  /**
   * Initiate vKYC via Digitap API.
   * Creates a lead and returns the shareable URL.
   * SMS and email are sent to the customer by Digitap automatically.
   *
   * @param {Object} params - Application state and borrower details
   * @returns {Promise<{url: string, uniqueId: string, vkycCompleted: boolean}>}
   */
  async initiateVkyc(params) {
    const { digitapService } = require('./digitapService');
    console.log('[kycService] Initiating vKYC via Digitap for:', params.uniqueId);

    const result = await digitapService.createLead({
      firstName: params.firstName,
      lastName: params.lastName,
      uniqueId: params.uniqueId,
      mobile: params.mobile,
      email: params.email,
      nameAsPerAadhaar: params.nameAsPerAadhaar,
      guardianNameAsPerAadhaar: params.guardianNameAsPerAadhaar,
      addressAsPerAadhaar: params.addressAsPerAadhaar,
      aadhaarLastFourDigits: params.aadhaarLastFourDigits,
      dateOfAadhaarFetch: params.dateOfAadhaarFetch,
      imageOfUserBase64: params.imageOfUserBase64,
      redirectionUrl: params.redirectionUrl,
      verificationQuestions: params.verificationQuestions,
    });

    return {
      url: result.url,
      uniqueId: params.uniqueId,
      vkycCompleted: result.vkycCompleted || false,
      uniqueIdExist: result.uniqueIdExist || false,
    };
  },

  /**
   * Check vKYC status via Digitap API using uniqueId.
   *
   * @param {string} uniqueId - The unique application identifier
   * @returns {Promise<{status: string, vkycStatus: string, sessionId: string, callStatus: string}>}
   */
  async getVkycStatus(uniqueId) {
    const { digitapService } = require('./digitapService');
    console.log('[kycService] Checking vKYC status for:', uniqueId);

    let sessions;
    try {
      sessions = await digitapService.getStatusByUniqueId(uniqueId);
    } catch (err) {
      // Digitap returns 400 "No session found for the given uniqueId"
      // when no vKYC lead exists yet (e.g. customer clicked "Check
      // status" before "Initiate vKYC", or the link expired before the
      // session was created). Treat this as NOT_STARTED so the UI can
      // show a helpful message instead of bubbling a raw 400.
      const msg = String(err?.message || '');
      const detail = String(err?.signzyError?.errors || err?.response?.data?.errors || '');
      const body = `${msg} ${detail}`;
      const noSession = /no session found/i.test(body) || err?.statusCode === 400;
      if (noSession) {
        return {
          status: 'pending',
          vkycStatus: 'NOT_STARTED',
          reason: 'no_session',
          checkedAt: new Date().toISOString(),
        };
      }
      throw err;
    }

    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return {
        status: 'pending',
        vkycStatus: 'NOT_STARTED',
        reason: 'no_session',
        checkedAt: new Date().toISOString(),
      };
    }

    // Defensive: digitapService.getStatusByUniqueId already normalises
    // the response to an array, but a future upstream shape change
    // could still leave a stray null in there. Pick the latest entry
    // that's actually an object so we never index 'undefined.vkycStatus'.
    const latest = [...sessions].reverse().find((s) => s && typeof s === 'object') || {};
    const isApproved = latest.vkycStatus === 'APPROVED';
    const isRejected = latest.vkycStatus === 'REJECTED';
    const isCompleted = isApproved;

    return {
      status: isCompleted ? 'completed' : isRejected ? 'rejected' : 'pending',
      vkycStatus: latest.vkycStatus || 'INCOMPLETE',
      sessionId: latest.sessionId,
      callStatus: latest.callStatus,
      callInitiated: latest.callInitiated,
      verified: isApproved,
      rejectionReason: latest.rejectionReason || latest.rejectReason || '',
      checkedAt: new Date().toISOString(),
    };
  },

  /**
   * Fetch detailed vKYC session data (PAN image, selfie, video, etc.)
   *
   * @param {string} sessionId
   * @returns {Promise<Object>}
   */
  async getVkycSessionDetails(sessionId) {
    const { digitapService } = require('./digitapService');
    console.log('[kycService] Fetching vKYC session details:', sessionId);
    const details = await digitapService.getSessionDetails(sessionId);
    return details[sessionId] || null;
  },

  // Name Match (fuzzy, >60% threshold)
  async matchNames(data) {
    const { fuzzyNameScore, NAME_MATCH_THRESHOLD } = require('./bankService');
    console.log('[kycService] matchNames (fuzzy)');

    // Support both { name1, name2 } and { panName, kycName, borrowerName }
    const pairs = [];
    if (data.name1 && data.name2) {
      pairs.push({ a: data.name1, b: data.name2 });
    }
    if (data.panName && data.kycName) {
      pairs.push({ a: data.panName, b: data.kycName });
    }
    if (data.panName && data.borrowerName) {
      pairs.push({ a: data.panName, b: data.borrowerName });
    }
    if (data.kycName && data.borrowerName) {
      pairs.push({ a: data.kycName, b: data.borrowerName });
    }

    let bestScore = 0;
    for (const { a, b } of pairs) {
      const score = fuzzyNameScore(a, b);
      if (score > bestScore) bestScore = score;
    }

    const matched = bestScore > NAME_MATCH_THRESHOLD;
    console.log('[kycService] matchNames result: score =', bestScore, ', matched =', matched);
    return {
      matched,
      score: bestScore,
      status: 'OK',
    };
  },
};
