import api from './api';
import { API_ENDPOINTS } from '../config/constants';

export const bankService = {
  async pennyDrop(data) {
    return api.post(API_ENDPOINTS.BANK.PENNY_DROP, data);
  },

  async validateIfsc(ifsc) {
    return api.get(API_ENDPOINTS.BANK.IFSC_VALIDATE, { params: { ifsc } });
  },

  // Account Aggregator
  async getFIPList() {
    try {
      return await api.get(API_ENDPOINTS.INCOME.AA_FIP_LIST);
    } catch {
      // Mock FIP (Financial Information Provider) list
      return {
        fips: [
          { id: 'SBIN0000001', name: 'State Bank of India', code: 'SBI' },
          { id: 'HDFC0000001', name: 'HDFC Bank', code: 'HDFC' },
          { id: 'ICIC0000001', name: 'ICICI Bank', code: 'ICICI' },
          { id: 'KKBK0000001', name: 'Kotak Mahindra Bank', code: 'KOTAK' },
          { id: 'UTIB0000001', name: 'Axis Bank', code: 'AXIS' },
          { id: 'PUNB0000001', name: 'Punjab National Bank', code: 'PNB' },
          { id: 'BARB0000001', name: 'Bank of Baroda', code: 'BOB' },
          { id: 'CNRB0000001', name: 'Canara Bank', code: 'CANARA' },
          { id: 'UBIN0000001', name: 'Union Bank of India', code: 'UNION' },
          { id: 'IOBA0000001', name: 'Indian Overseas Bank', code: 'IOB' },
          { id: 'IDIB0000001', name: 'Indian Bank', code: 'IB' },
          { id: 'BKID0000001', name: 'Bank of India', code: 'BOI' },
          { id: 'YESB0000001', name: 'YES Bank', code: 'YES' },
          { id: 'INDB0000001', name: 'IndusInd Bank', code: 'INDUSIND' },
          { id: 'FDRL0000001', name: 'Federal Bank', code: 'FEDERAL' },
          { id: 'IDFB0000001', name: 'IDFC First Bank', code: 'IDFC' },
          { id: 'RATN0000001', name: 'RBL Bank', code: 'RBL' },
          { id: 'BNPA0000001', name: 'Bank of Maharashtra', code: 'BOM' },
          { id: 'UCBA0000001', name: 'UCO Bank', code: 'UCO' },
          { id: 'CBIN0000001', name: 'Central Bank of India', code: 'CBI' },
        ],
      };
    }
  },

  async initiateAA(data) {
    return api.post(API_ENDPOINTS.INCOME.AA_INITIATE, data);
  },

  async getAAStatus(requestId) {
    return api.get(API_ENDPOINTS.INCOME.AA_STATUS, { params: { requestId } });
  },

  // Bank Statement
  async uploadBankStatement(formData) {
    return api.post(API_ENDPOINTS.INCOME.BANK_STATEMENT_UPLOAD, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async getIncomeAnalysis(analysisId) {
    return api.get(API_ENDPOINTS.INCOME.ANALYSIS_RESULT.replace('{id}', analysisId));
  },
};
