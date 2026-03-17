/**
 * Digitap vKYC Integration Service
 *
 * Handles Video KYC (VCIP) via the Digitap API.
 * Used for loans >= ₹60,000 as per RBI guidelines.
 *
 * API Reference: Digitap VKYC v2 Integration Guide
 * Base URL: https://svc.digitap.ai
 */

const DIGITAP_BASE_URL = 'https://svc.digitap.ai';
const DIGITAP_CLIENT_ID = '42138379';
const DIGITAP_SECRET = 'QUJYjIquWQWXU6Ut9V7tIEOpSrx28mIT';
const DIGITAP_AUTH = 'Basic ' + btoa(`${DIGITAP_CLIENT_ID}:${DIGITAP_SECRET}`);

// ENT authorization for Aadhaar fetch (same credentials)
const ENT_AUTH = btoa(`${DIGITAP_CLIENT_ID}:${DIGITAP_SECRET}`);

async function digitapRequest(path, options = {}) {
  const url = `${DIGITAP_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: DIGITAP_AUTH,
    ...options.headers,
  };

  console.log(`[digitapService] ${options.method || 'POST'} ${path}`);

  const response = await fetch(url, {
    method: options.method || 'POST',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.log(`[digitapService] Error ${response.status}:`, errorText);
    throw new Error(`Digitap API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export const digitapService = {
  /**
   * Create a vKYC lead and get a shareable URL.
   * The URL is sent to the user via SMS and email by Digitap.
   *
   * @param {Object} params
   * @param {string} params.firstName
   * @param {string} params.lastName
   * @param {string} params.uniqueId - Application ID or unique identifier
   * @param {string} params.mobile
   * @param {string} params.email
   * @param {string} [params.nameAsPerAadhaar]
   * @param {string} [params.guardianNameAsPerAadhaar]
   * @param {string} [params.addressAsPerAadhaar]
   * @param {string} [params.aadhaarLastFourDigits]
   * @param {string} [params.dateOfAadhaarFetch]
   * @param {string} [params.imageOfUserBase64]
   * @param {string} [params.redirectionUrl]
   * @param {Array<Object>} [params.verificationQuestions]
   * @returns {Promise<{url: string, vkycCompleted: boolean, uniqueIdExist: boolean}>}
   */
  async createLead(params) {
    const body = {
      firstName: params.firstName,
      lastName: params.lastName,
      uniqueId: params.uniqueId,
      mobile: params.mobile || '',
      email: params.email || '',
      randomAssignment: false,
      preferredAgentEmailId: null,
      sendEmail: true,
      sendSms: true,
      isKyc: false,
      mandatoryTags: [],
      nonMandatoryTags: [],
    };

    // Add KYC data from Aadhaar/CKYC if available
    if (params.nameAsPerAadhaar) body.nameAsPerAadhaar = params.nameAsPerAadhaar;
    if (params.guardianNameAsPerAadhaar) body.guardianNameAsPerAadhaar = params.guardianNameAsPerAadhaar;
    if (params.addressAsPerAadhaar) body.addressAsPerAadhaar = params.addressAsPerAadhaar;
    if (params.aadhaarLastFourDigits) body.aadhaarLastFourDigits = params.aadhaarLastFourDigits;
    if (params.dateOfAadhaarFetch) body.dateOfAadhaarFetch = params.dateOfAadhaarFetch;
    if (params.imageOfUserBase64) body.imageOfUserBase64 = params.imageOfUserBase64;
    if (params.redirectionUrl) body.redirectionUrl = params.redirectionUrl;
    if (params.verificationQuestions) body.verificationQuestions = params.verificationQuestions;

    return digitapRequest('/vkyc/v2/integration/leads/', { body });
  },

  /**
   * Fetch session details by uniqueId to check vKYC status.
   *
   * @param {string|string[]} uniqueIds
   * @returns {Promise<Array<{sessionId, callStatus, vkycStatus, state, status, callInitiated}>>}
   */
  async getStatusByUniqueId(uniqueIds) {
    const ids = Array.isArray(uniqueIds) ? uniqueIds : [uniqueIds];
    return digitapRequest('/vkyc/v2/integration/sessions/unique-id/', {
      body: { uniqueIds: ids },
    });
  },

  /**
   * Fetch detailed session info by sessionId(s).
   *
   * @param {string|string[]} sessionIds
   * @returns {Promise<Object>} Map of sessionId -> details
   */
  async getSessionDetails(sessionIds) {
    const ids = Array.isArray(sessionIds) ? sessionIds : [sessionIds];
    return digitapRequest('/vkyc/v2/integration/sessions/details/', {
      body: { sessionIds: ids },
    });
  },

  /**
   * Get available tags (language preferences, etc.)
   * @returns {Promise<Array<{tagId, tagName, agentCount, status}>>}
   */
  async getTags() {
    return digitapRequest('/vkyc/v2/integration/tags/', { method: 'GET' });
  },

  /**
   * Get unified KYC data (Aadhaar fetch) using kycTransactionId.
   * Uses ENT authorization header.
   *
   * @param {string} transactionId
   * @returns {Promise<Object>}
   */
  async getKycData(transactionId) {
    const url = `${DIGITAP_BASE_URL}/ent/v1/get-paperless-vkyc`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ent_authorization: ENT_AUTH,
      },
      body: JSON.stringify({ transactionId }),
    });

    if (!response.ok) {
      throw new Error(`Digitap ENT API error: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Build verification questions from application state.
   * These are asked during the vKYC call by the agent.
   */
  buildVerificationQuestions(appState) {
    const questions = [];
    const kycData = appState.kycData || {};
    const product = appState.selectedProduct || {};
    const loanAmount = appState.studentDetails?.balanceFee || 0;
    const tenure = appState.selectedTenure || 12;
    const institute = appState.instituteDetails?.name || appState.instituteDetails?.instituteName || '';
    const course = appState.studentDetails?.courseName || '';
    const bankName = appState.bankDetails?.bankName || '';
    const occupation = appState.bankDetails?.occupation || '';
    const annualIncome = appState.bankDetails?.declaredAnnualIncome || 0;

    // Calculate EMI
    const rate = product.interestRate || 14;
    const monthlyRate = rate / 1200;
    const emi = loanAmount > 0 && tenure > 0
      ? Math.round(loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1))
      : 0;

    // Calculate EMI start date (next month 5th)
    const now = new Date();
    const emiStart = new Date(now.getFullYear(), now.getMonth() + 1, 5);
    const emiStartStr = emiStart.toISOString().split('T')[0];

    if (kycData.dob) {
      questions.push({ question: 'Please confirm your date of birth as per Aadhaar?', answer: kycData.dob });
    }
    if (loanAmount > 0) {
      questions.push({ question: 'Please confirm the loan amount?', answer: `Rs. ${loanAmount.toLocaleString('en-IN')}` });
    }
    if (tenure) {
      questions.push({ question: 'Please confirm the loan Tenure?', answer: `${tenure} Months` });
    }
    if (annualIncome > 0) {
      questions.push({ question: 'Please confirm your annual Income?', answer: `Rs. ${annualIncome.toLocaleString('en-IN')}` });
    }
    if (occupation) {
      questions.push({ question: 'Please confirm your profession as you entered in the application?', answer: occupation });
    }
    if (institute) {
      questions.push({ question: 'Please confirm the Institute name?', answer: institute });
    }
    if (course) {
      questions.push({ question: 'Please confirm the course name?', answer: course });
    }
    if (emi > 0) {
      questions.push({ question: 'Please confirm the EMI Amount?', answer: `Rs. ${emi.toLocaleString('en-IN')}` });
    }
    if (emiStartStr) {
      questions.push({ question: 'Please confirm the EMI Start Date?', answer: emiStartStr });
    }
    if (bankName) {
      questions.push({ question: 'Please confirm the bank name where the e-NACH was Initiated?', answer: bankName });
    }

    return questions;
  },
};
