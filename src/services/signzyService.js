import axios from 'axios';
import { SIGNZY_CONFIG, PAN_STATUS_CODES } from '../config/constants';

const signzyApi = axios.create({
  baseURL: SIGNZY_CONFIG.BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: SIGNZY_CONFIG.AUTH_TOKEN,
    'x-client-unique-id': SIGNZY_CONFIG.CLIENT_ID,
  },
});

// Response interceptor to normalize Signzy error responses
signzyApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network error — no response received at all
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

    let message = 'Verification failed. Please try again.';

    if (status === 400) {
      const raw = data?.error?.message || '';
      if (/not valid/i.test(raw)) {
        message = 'PAN number is not valid. Please check and re-enter.';
      } else if (/required|empty/i.test(raw)) {
        message = 'PAN number is required. Please enter your PAN.';
      } else {
        message = 'Invalid request. Please check your PAN and try again.';
      }
    } else if (status === 401) {
      message = 'Verification failed. Please contact support.';
    } else if (status === 404) {
      message = 'PAN number not found. Please check and re-enter.';
    } else if (status === 409) {
      message = 'Verification is temporarily unavailable. Please try again later.';
    } else {
      message = 'Verification failed. Please try again.';
    }

    const err = new Error(message);
    err.statusCode = status;
    err.signzyError = data?.error || data;
    return Promise.reject(err);
  },
);

export const signzyService = {
  /**
   * Fetch PAN number using phone number and name (Signzy Phone-to-PAN API)
   * @param {string} phoneNumber - 10-digit mobile number
   * @param {string} firstName - Borrower's first name
   * @param {string} lastName - Borrower's last name
   */
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

  /**
   * Verify PAN number and fetch detailed information (Signzy PAN fetchV2 API)
   * @param {string} panNumber - PAN number to verify
   */
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
};
