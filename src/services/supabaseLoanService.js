import { supabase } from '../config/supabase';

export const supabaseLoanService = {
  // ============================================================
  // Institutes & Students
  // ============================================================
  async getInstitutes(search = '') {
    let query = supabase.from('institutes').select('*').eq('is_active', true);
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    const { data, error } = await query.order('name');
    if (error) throw error;
    return { institutes: data };
  },

  async getStudentDetails(instituteId, regNo) {
    // Student details are typically entered by the user during the loan flow,
    // not fetched from a lookup table. Return empty for now.
    return {
      student: {
        instituteId,
        registrationNumber: regNo,
        name: '',
        course: '',
        year: '',
      },
    };
  },

  async getInstituteLoanProducts(instituteId) {
    const { data, error } = await supabase
      .from('institutes')
      .select('loan_products')
      .eq('id', instituteId)
      .single();
    if (error) throw error;
    return { products: data.loan_products || [] };
  },

  // ============================================================
  // Companies & Employees
  // ============================================================
  async getCompanies(search = '') {
    let query = supabase.from('companies').select('*').eq('is_active', true);
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    const { data, error } = await query.order('name');
    if (error) throw error;
    return { companies: data };
  },

  async getEmployeeDetails(companyId, empId) {
    return {
      employee: {
        companyId,
        employeeId: empId,
        name: '',
        designation: '',
        department: '',
      },
    };
  },

  async getCompanyLoanProducts(companyId) {
    const { data, error } = await supabase
      .from('companies')
      .select('loan_products')
      .eq('id', companyId)
      .single();
    if (error) throw error;
    return { products: data.loan_products || [] };
  },

  // ============================================================
  // Loan CRUD
  // ============================================================
  async createLoan(loanData) {
    const { data, error } = await supabase
      .from('loans')
      .insert(loanData)
      .select()
      .single();
    if (error) throw error;
    return { loan: data };
  },

  async getLoanStatus(loanId) {
    const { data, error } = await supabase
      .from('loans')
      .select('id, status, step, updated_at')
      .eq('id', loanId)
      .single();
    if (error) throw error;
    return data;
  },

  async getLoans(filters = {}) {
    let query = supabase.from('loans').select('*');
    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.loan_type) query = query.eq('loan_type', filters.loan_type);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return { loans: data };
  },

  async getLoanDetails(loanId) {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .single();
    if (error) throw error;
    return { loan: data };
  },

  async updateLoan(loanId, updates) {
    const { data, error } = await supabase
      .from('loans')
      .update(updates)
      .eq('id', loanId)
      .select()
      .single();
    if (error) throw error;
    return { loan: data };
  },

  async checkEligibility(loanId) {
    // Eligibility is a business logic decision — store the result
    const { data: loan } = await supabase
      .from('loans')
      .select('amount, credit_score, income_data')
      .eq('id', loanId)
      .single();

    const eligible = (loan?.credit_score || 0) >= 650;
    const result = {
      eligible,
      maxAmount: eligible ? loan?.amount : 0,
      reason: eligible ? 'All checks passed' : 'Credit score below threshold',
    };

    await supabase
      .from('loans')
      .update({ eligibility_result: result, status: eligible ? 'fully_eligible' : 'not_eligible' })
      .eq('id', loanId);

    return result;
  },

  async getRepaymentSchedule(loanId) {
    const { data: loan } = await supabase
      .from('loans')
      .select('amount, tenure_months, interest_rate, emi_amount')
      .eq('id', loanId)
      .single();

    if (!loan) return { schedule: [] };

    const schedule = [];
    const monthlyRate = (loan.interest_rate || 8.5) / 12 / 100;
    const emi = loan.emi_amount || loan.amount * monthlyRate * Math.pow(1 + monthlyRate, loan.tenure_months) / (Math.pow(1 + monthlyRate, loan.tenure_months) - 1);
    let balance = loan.amount;

    for (let i = 1; i <= (loan.tenure_months || 12); i++) {
      const interest = balance * monthlyRate;
      const principal = emi - interest;
      balance = Math.max(0, balance - principal);
      schedule.push({
        month: i,
        emi: Math.round(emi),
        principal: Math.round(principal),
        interest: Math.round(interest),
        balance: Math.round(balance),
      });
    }

    return { schedule };
  },

  // ============================================================
  // Servicing
  // ============================================================
  async requestPrepayment(loanId, data) {
    return this.updateLoan(loanId, {
      remarks: `Prepayment requested: ${JSON.stringify(data)}`,
    });
  },

  async requestForeclosure(loanId) {
    return this.updateLoan(loanId, { status: 'closed', closed_at: new Date().toISOString() });
  },

  async requestNOC(loanId) {
    return this.updateLoan(loanId, {
      remarks: 'NOC requested',
    });
  },

  // ============================================================
  // eNACH & eSign
  // ============================================================
  async initiateEnach(loanId, data) {
    return this.updateLoan(loanId, { enach_status: 'initiated' });
  },

  async getEnachStatus(loanId) {
    const { data } = await supabase
      .from('loans')
      .select('enach_status')
      .eq('id', loanId)
      .single();
    return { status: data?.enach_status || 'pending' };
  },

  async initiateEsign(loanId) {
    return this.updateLoan(loanId, { esign_status: 'initiated' });
  },

  async getEsignStatus(loanId) {
    const { data } = await supabase
      .from('loans')
      .select('esign_status')
      .eq('id', loanId)
      .single();
    return { status: data?.esign_status || 'pending' };
  },
};
