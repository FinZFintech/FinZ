import api from './api';
import { API_ENDPOINTS } from '../config/constants';
import { signzyService } from './signzyService';

export const kycService = {
  /**
   * Phone-to-PAN lookup — calls Signzy phoneToPan API directly.
   * URL: https://api-preproduction.signzy.app/api/v3/phonekyc/phonetoPan
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
   * URL: https://api-preproduction.signzy.app/api/v3/pan/fetchV2
   */
  async validatePan(panNumber) {
    console.log('[kycService] validatePan → calling signzyService.verifyPan directly');
    return signzyService.verifyPan(panNumber);
  },

  // Credit Bureau
  async softPull(data) {
    return api.post(API_ENDPOINTS.CREDIT.SOFT_PULL, data);
  },

  async hardPull(data) {
    return api.post(API_ENDPOINTS.CREDIT.HARD_PULL, data);
  },

  async checkGatingCriteria(data) {
    return api.post(API_ENDPOINTS.CREDIT.GATING_CHECK, data);
  },

  // CKYC
  async initiateCkyc(data) {
    return api.post(API_ENDPOINTS.KYC.CKYC_INITIATE, data);
  },

  async verifyCkycOtp(data) {
    return api.post(API_ENDPOINTS.KYC.CKYC_VERIFY, data);
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

  // Aadhaar XML
  async uploadAadhaarXml(formData) {
    return api.post(API_ENDPOINTS.KYC.AADHAAR_XML_UPLOAD, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Pincode check
  async checkPincode(pincode) {
    return api.post(API_ENDPOINTS.KYC.PINCODE_CHECK, { pincode });
  },

  // Selfie & Liveness (Signzy)

  /**
   * Create liveness verification URL for selfie capture.
   * Pass the KYC photo URL(s) for face matching.
   * @param {string[]} matchImageUrls - Publicly accessible image URLs
   * @param {Object} options - Additional options (languageCode, faceMatchThreshold, etc.)
   * @returns {{ token: string, videoUrl: string, consumerId: string }}
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
   * @param {string} token - Token from createLivenessUrl response
   * @returns {Object} Liveness result with faceMatch, passiveLiveliness, status, etc.
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
   * Verify a captured selfie against KYC photo.
   * Uses the backend selfie match endpoint for face comparison.
   * @param {string} selfieImage - Selfie image (base64 data URI or raw base64)
   * @param {string} kycPhoto - KYC photo (base64, data URI, or URL)
   * @returns {{ verified: boolean, matchPercentage: string, message: string, liveness: boolean, livenessScore: number }}
   */
  async verifySelfieWithKyc(selfieImage, kycPhoto) {
    console.log('[kycService] verifySelfieWithKyc → calling backend selfie match');

    // Extract raw base64 from data URI if needed
    const extractBase64 = (img) => {
      if (!img) return '';
      if (img.startsWith('data:')) {
        return img.split(',')[1] || '';
      }
      return img;
    };

    const selfieBase64 = extractBase64(selfieImage);
    const kycBase64 = extractBase64(
      kycPhoto.startsWith('http') ? kycPhoto : kycPhoto.startsWith('data:') ? kycPhoto : `data:image/jpeg;base64,${kycPhoto}`
    );

    try {
      const result = await api.post(API_ENDPOINTS.VERIFICATION.SELFIE_MATCH, {
        selfie: selfieBase64,
        kycImage: kycBase64,
      });

      console.log('[kycService] selfie match result:', JSON.stringify(result));

      // Normalize backend response
      const matchPercentage = result?.matchPercentage || result?.match_percentage || result?.score || '0.00%';
      const verified = result?.verified ?? result?.matched ?? false;
      const liveness = result?.liveness ?? result?.livenessVerified ?? true;
      const livenessScore = result?.livenessScore ?? result?.liveness_score ?? 1.0;

      return {
        verified,
        matchPercentage: typeof matchPercentage === 'number' ? `${matchPercentage.toFixed(2)}%` : matchPercentage,
        message: result?.message || '',
        liveness,
        livenessScore: typeof livenessScore === 'number' ? livenessScore : parseFloat(livenessScore) || 1.0,
      };
    } catch (err) {
      console.log('[kycService] selfie match error:', err.message || JSON.stringify(err));
      throw new Error(err.message || 'Face verification failed. Please try again.');
    }
  },

  /** @deprecated Use verifySelfieWithKyc instead */
  async verifySelfie(selfieBase64, kycImageBase64) {
    return api.post(API_ENDPOINTS.VERIFICATION.SELFIE_MATCH, {
      selfie: selfieBase64,
      kycImage: kycImageBase64,
    });
  },

  async initiateVkyc(loanId) {
    return api.post(API_ENDPOINTS.VERIFICATION.VKYC_INITIATE, { loanId });
  },

  async getVkycStatus(loanId) {
    return api.get(API_ENDPOINTS.VERIFICATION.VKYC_STATUS, { params: { loanId } });
  },

  // Name Match
  async matchNames(data) {
    return api.post(API_ENDPOINTS.VERIFICATION.NAME_MATCH, data);
  },
};
