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

export const signzyService = {
  /**
   * Fetch PAN number using phone number and name
   * @param {string} phoneNumber - 10-digit mobile number
   * @param {string} firstName - Borrower's first name
   * @param {string} lastName - Borrower's last name
   * @returns {{ pan: string, name: string, gender: string, dateOfBirth: string }}
   */
  async phoneToPan(phoneNumber, firstName, lastName) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PHONE_TO_PAN, {
      phoneNumber,
      firstName,
      lastName,
    });

    const { pan, personalInfo } = data.response;
    return {
      pan,
      name: personalInfo?.name?.trim() || '',
      gender: personalInfo?.gender || '',
      dateOfBirth: personalInfo?.dateOfBirth || '',
    };
  },

  /**
   * Verify PAN number and fetch detailed information
   * @param {string} panNumber - PAN number to verify
   * @returns {{ isValid: boolean, name: string, panNumber: string, panStatus: string, panStatusLabel: string, firstName: string, middleName: string, lastName: string, typeOfHolder: string, isIndividual: boolean, aadhaarSeedingStatus: string, individualTaxComplianceStatus: string }}
   */
  async verifyPan(panNumber) {
    const { data } = await signzyApi.post(SIGNZY_CONFIG.ENDPOINTS.PAN_FETCH_V2, {
      number: panNumber,
      returnIndividualTaxComplianceInfo: 'true',
      consent: 'Y',
    });

    const r = data.result;
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
