const MOCK_INSTITUTES = [
  { id: 'inst_001', name: 'IIT Bombay', city: 'Mumbai', courses: 45 },
  { id: 'inst_002', name: 'IIT Delhi', city: 'New Delhi', courses: 38 },
  { id: 'inst_003', name: 'BITS Pilani', city: 'Pilani', courses: 28 },
  { id: 'inst_004', name: 'NIT Trichy', city: 'Tiruchirappalli', courses: 22 },
  { id: 'inst_005', name: 'VIT Vellore', city: 'Vellore', courses: 35 },
  { id: 'inst_006', name: 'SRM University', city: 'Chennai', courses: 30 },
  { id: 'inst_007', name: 'Manipal Institute of Technology', city: 'Manipal', courses: 25 },
  { id: 'inst_008', name: 'Amity University', city: 'Noida', courses: 40 },
  { id: 'inst_009', name: 'Lovely Professional University', city: 'Phagwara', courses: 50 },
  { id: 'inst_010', name: 'Christ University', city: 'Bangalore', courses: 32 },
];

const MOCK_LOAN_PRODUCTS = [
  {
    id: 'prod_emi',
    name: 'Education Loan - EMI',
    interestRate: 14,
    processingFee: '2% + GST',
    foreclosureCharges: '4% of outstanding',
    tenures: [6, 9, 12, 18, 24],
  },
  {
    id: 'prod_bullet',
    name: 'Education Loan - Bullet Repayment',
    interestRate: 12,
    processingFee: '2.5% + GST',
    foreclosureCharges: 'Nil',
    tenures: [3, 6, 9, 12],
  },
];

export const loanService = {
  // Institute & Student
  async getInstitutes(search = '') {
    console.log('[loanService] Mock getInstitutes, search:', search);
    await new Promise((r) => setTimeout(r, 500));
    const q = (search || '').toLowerCase();
    const filtered = q
      ? MOCK_INSTITUTES.filter((i) => i.name.toLowerCase().includes(q) || i.city.toLowerCase().includes(q))
      : MOCK_INSTITUTES;
    return { institutes: filtered };
  },

  async getStudentDetails(instituteId, regNo) {
    console.log('[loanService] Mock getStudentDetails:', instituteId, regNo);
    await new Promise((r) => setTimeout(r, 600));
    return {
      regNo,
      studentName: 'Rahul Sharma',
      fatherName: 'Rajesh Sharma',
      courseName: 'B.Tech Computer Science',
      phone: '9876543210',
      email: 'rahul@example.com',
      balanceFee: 250000,
    };
  },

  async getInstituteLoanProducts(instituteId) {
    console.log('[loanService] Mock getInstituteLoanProducts:', instituteId);
    await new Promise((r) => setTimeout(r, 400));
    return { products: MOCK_LOAN_PRODUCTS };
  },

  // Company & Employee
  async getCompanies(search = '') {
    console.log('[loanService] Mock getCompanies');
    await new Promise((r) => setTimeout(r, 500));
    return { companies: [] };
  },

  async getEmployeeDetails(companyId, empId) {
    console.log('[loanService] Mock getEmployeeDetails');
    await new Promise((r) => setTimeout(r, 500));
    return { empId, name: 'Test Employee', designation: 'Engineer' };
  },

  async getCompanyLoanProducts(companyId) {
    console.log('[loanService] Mock getCompanyLoanProducts');
    await new Promise((r) => setTimeout(r, 400));
    return { products: MOCK_LOAN_PRODUCTS };
  },

  // Loan CRUD
  async createLoan(loanData) {
    console.log('[loanService] Mock createLoan');
    await new Promise((r) => setTimeout(r, 800));
    return { loanId: 'loan_' + Date.now(), status: 'draft' };
  },

  async getLoanStatus(loanId) {
    console.log('[loanService] Mock getLoanStatus:', loanId);
    await new Promise((r) => setTimeout(r, 300));
    return { loanId, status: 'active' };
  },

  async getLoans(filters = {}) {
    console.log('[loanService] Mock getLoans');
    await new Promise((r) => setTimeout(r, 500));
    return { loans: [] };
  },

  async getLoanDetails(loanId) {
    console.log('[loanService] Mock getLoanDetails:', loanId);
    await new Promise((r) => setTimeout(r, 500));
    return { loanId, status: 'active', amount: 250000 };
  },

  async checkEligibility(loanId) {
    console.log('[loanService] Mock checkEligibility:', loanId);
    await new Promise((r) => setTimeout(r, 1000));
    return { eligible: true, status: 'fully_eligible' };
  },

  async getRepaymentSchedule(loanId) {
    console.log('[loanService] Mock getRepaymentSchedule:', loanId);
    await new Promise((r) => setTimeout(r, 500));
    return { schedule: [] };
  },

  // Servicing
  async requestPrepayment(loanId, data) {
    console.log('[loanService] Mock requestPrepayment:', loanId);
    await new Promise((r) => setTimeout(r, 800));
    return { status: 'initiated', requestId: 'pp_' + Date.now() };
  },

  async requestForeclosure(loanId) {
    console.log('[loanService] Mock requestForeclosure:', loanId);
    await new Promise((r) => setTimeout(r, 800));
    return { status: 'initiated', requestId: 'fc_' + Date.now() };
  },

  async requestNOC(loanId) {
    console.log('[loanService] Mock requestNOC:', loanId);
    await new Promise((r) => setTimeout(r, 800));
    return { status: 'initiated', requestId: 'noc_' + Date.now() };
  },

  // eNACH & eSign
  async initiateEnach(loanId, data) {
    console.log('[loanService] Mock initiateEnach:', loanId);
    await new Promise((r) => setTimeout(r, 1000));
    return { mandateId: 'enach_' + Date.now(), status: 'initiated', url: 'https://example.com/enach-mock' };
  },

  async getEnachStatus(loanId) {
    console.log('[loanService] Mock getEnachStatus:', loanId);
    await new Promise((r) => setTimeout(r, 300));
    return { status: 'completed' };
  },

  async initiateEsign(loanId) {
    console.log('[loanService] Mock initiateEsign:', loanId);
    await new Promise((r) => setTimeout(r, 1000));
    return { sessionId: 'esign_' + Date.now(), status: 'initiated', url: 'https://example.com/esign-mock' };
  },

  async getEsignStatus(loanId) {
    console.log('[loanService] Mock getEsignStatus:', loanId);
    await new Promise((r) => setTimeout(r, 300));
    return { status: 'completed' };
  },

  async submitApplication(applicationData) {
    console.log('[loanService] Mock submitApplication:', applicationData.applicationId);
    await new Promise((r) => setTimeout(r, 1500));
    return {
      applicationId: applicationData.applicationId,
      status: 'submitted',
      message: 'Application submitted successfully',
      submittedAt: new Date().toISOString(),
    };
  },
};
