import api from './api';
import { API_ENDPOINTS, SUPABASE_MODE } from '../config/constants';
import { supabaseAdminService } from './supabaseAdminService';

const apiAdminService = {
  async getPendingLoans(filters = {}) {
    return api.get(API_ENDPOINTS.ADMIN.PENDING_LOANS, { params: filters });
  },

  async getLoanQueue(queueType) {
    return api.get(API_ENDPOINTS.ADMIN.LOAN_QUEUE, { params: { queueType } });
  },

  async updateLoanStatus(loanId, status, remarks) {
    return api.put(API_ENDPOINTS.ADMIN.UPDATE_STATUS.replace('{id}', loanId), {
      status,
      remarks,
    });
  },

  async getDashboardStats() {
    return api.get(API_ENDPOINTS.ADMIN.DASHBOARD_STATS);
  },
};

export const adminService = SUPABASE_MODE ? supabaseAdminService : apiAdminService;
