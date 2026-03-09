import api from './api';
import { API_ENDPOINTS } from '../config/constants';

export const engagementService = {
  async getDailyTip() {
    return api.get(API_ENDPOINTS.ENGAGEMENT.DAILY_TIP);
  },

  async checkCreditScore(panNumber) {
    return api.post(API_ENDPOINTS.ENGAGEMENT.CREDIT_SCORE_CHECK, { panNumber });
  },

  async getOffers() {
    return api.get(API_ENDPOINTS.ENGAGEMENT.OFFERS);
  },

  async submitReferral(data) {
    return api.post(API_ENDPOINTS.ENGAGEMENT.REFERRAL, data);
  },
};
