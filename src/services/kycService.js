import { signzyService } from './signzyService';

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

  // ─── MOCK APIs (until backend is integrated) ────────────────────────────

  // Credit Bureau
  async softPull(data) {
    console.log('[kycService] Mock softPull for:', data.pan);
    await new Promise((r) => setTimeout(r, 1000));
    return {
      score: 720,
      cibilScore: 720,
      gatingPassed: true,
      enquiryCount: 2,
      activeAccounts: 3,
      overdueAccounts: 0,
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

  // CKYC
  async initiateCkyc(data) {
    console.log('[kycService] Mock initiateCkyc');
    await new Promise((r) => setTimeout(r, 800));
    return {
      ckycNumber: 'CKYC' + Date.now(),
      name: data.name || 'RAHUL SHARMA',
      dob: '1995-01-15',
      address: '123 Main Street, Mumbai, Maharashtra 400001',
      phone: data.phone || '9876543210',
      pan: data.pan || '',
      status: 'verified',
    };
  },

  async verifyCkycOtp(data) {
    console.log('[kycService] Mock verifyCkycOtp');
    await new Promise((r) => setTimeout(r, 500));
    return { verified: true };
  },

  // Aadhaar XML
  async uploadAadhaarXml(formData) {
    console.log('[kycService] Mock uploadAadhaarXml');
    await new Promise((r) => setTimeout(r, 1000));
    return {
      name: 'RAHUL SHARMA',
      dob: '1995-01-15',
      gender: 'M',
      address: '123 Main Street, Mumbai, Maharashtra 400001',
      uid: 'XXXX-XXXX-1234',
      photo: '',
      verified: true,
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

  async initiateVkyc(loanId) {
    console.log('[kycService] Mock initiateVkyc for loan:', loanId);
    await new Promise((r) => setTimeout(r, 500));
    return {
      sessionId: 'vkyc_' + Date.now(),
      url: 'https://example.com/vkyc-mock',
      status: 'initiated',
    };
  },

  async getVkycStatus(loanId) {
    console.log('[kycService] Mock getVkycStatus for loan:', loanId);
    await new Promise((r) => setTimeout(r, 300));
    return { status: 'completed', verified: true };
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
