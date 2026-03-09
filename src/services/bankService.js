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
