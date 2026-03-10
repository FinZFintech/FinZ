import api from './api';
import { API_ENDPOINTS } from '../config/constants';
import { signzyService } from './signzyService';

export const kycService = {
  // Phone-to-PAN lookup via Signzy API
  async fetchPanByMobile(mobile, firstName = '', lastName = '') {
    const data = await signzyService.phoneToPan(mobile, firstName, lastName);
    return {
      panNumber: data.pan || '',
      name: data.name || '',
      gender: data.gender || '',
      dateOfBirth: data.dateOfBirth || '',
    };
  },

  // PAN verification via Signzy API
  async validatePan(panNumber) {
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

  // DigiLocker
  async initiateDigilocker(data) {
    return api.post(API_ENDPOINTS.KYC.DIGILOCKER_INITIATE, data);
  },

  async handleDigilockerCallback(data) {
    return api.post(API_ENDPOINTS.KYC.DIGILOCKER_CALLBACK, data);
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

  // Selfie & vKYC
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
