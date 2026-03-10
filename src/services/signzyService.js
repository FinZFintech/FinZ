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
    const status = error.response?.status;
    const data = error.response?.data;

    let message = 'Signzy API request failed';

    if (status === 400) {
      message = data?.error?.message || 'Invalid request parameters';
    } else if (status === 401) {
      message = data?.message || 'Invalid Signzy authentication credentials';
    } else if (status === 404) {
      message = data?.error?.message || 'Record not found';
    } else if (status === 409) {
      message = data?.error?.message || 'Service temporarily unavailable';
    } else if (data?.error?.message) {
      message = data.error.message;
    } else if (data?.message) {
      message = data.message;
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
