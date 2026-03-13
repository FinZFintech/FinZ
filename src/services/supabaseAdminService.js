import { supabase } from '../config/supabase';

export const supabaseAdminService = {
  async getPendingLoans(filters = {}) {
    let query = supabase
      .from('loans')
      .select('*, profiles!loans_user_id_fkey(name, phone, email)')
      .in('status', ['draft', 'manual_review', 'credit_check_passed', 'kyc_completed']);

    if (filters.loan_type) query = query.eq('loan_type', filters.loan_type);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return { loans: data || [] };
  },

  async getLoanQueue(queueType) {
    const statusMap = {
      credit: ['credit_check_passed', 'credit_check_failed'],
      kyc: ['kyc_completed', 'kyc_failed'],
      disbursement: ['fully_eligible', 'enach_done', 'esign_done', 'vkyc_done'],
    };

    const statuses = statusMap[queueType] || ['manual_review'];
    const { data, error } = await supabase
      .from('loans')
      .select('*, profiles!loans_user_id_fkey(name, phone)')
      .in('status', statuses)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { loans: data || [] };
  },

  async updateLoanStatus(loanId, status, remarks) {
    const updates = { status };
    if (remarks) updates.remarks = remarks;
    if (status === 'disbursed') updates.disbursed_at = new Date().toISOString();
    if (status === 'closed') updates.closed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('loans')
      .update(updates)
      .eq('id', loanId)
      .select()
      .single();

    if (error) throw error;
    return { loan: data };
  },

  async getDashboardStats() {
    const { data: loans, error } = await supabase
      .from('loans')
      .select('status, amount, loan_type');

    if (error) throw error;

    const stats = {
      totalLoans: loans.length,
      totalAmount: loans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
      byStatus: {},
      byType: {},
    };

    loans.forEach((loan) => {
      stats.byStatus[loan.status] = (stats.byStatus[loan.status] || 0) + 1;
      stats.byType[loan.loan_type] = (stats.byType[loan.loan_type] || 0) + 1;
    });

    return stats;
  },
};
