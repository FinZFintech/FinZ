export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
};

export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const maskPan = (pan) => {
  if (!pan || pan.length < 10) return pan;
  return `${pan.slice(0, 4)}XXXX${pan.slice(8)}`;
};

export const maskMobile = (mobile) => {
  if (!mobile || mobile.length < 10) return mobile;
  return `XXXXXX${mobile.slice(-4)}`;
};

export const maskAccountNumber = (accNo) => {
  if (!accNo || accNo.length < 4) return accNo;
  return `${'X'.repeat(accNo.length - 4)}${accNo.slice(-4)}`;
};

export const validatePan = (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);

export const validateMobile = (mobile) => /^[6-9]\d{9}$/.test(mobile);

export const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const validateIfsc = (ifsc) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);

export const validateAccountNumber = (accNo) => /^\d{9,18}$/.test(accNo);

export const calculateEmi = (principal, ratePerAnnum, tenureMonths) => {
  const monthlyRate = ratePerAnnum / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  return Math.round(emi);
};

export const generateRepaymentSchedule = (principal, ratePerAnnum, tenureMonths, startDate) => {
  const monthlyRate = ratePerAnnum / 12 / 100;
  const emi = calculateEmi(principal, ratePerAnnum, tenureMonths);
  const schedule = [];
  let balance = principal;
  const date = new Date(startDate);

  for (let i = 1; i <= tenureMonths; i++) {
    const interest = Math.round(balance * monthlyRate);
    const principalComponent = emi - interest;
    balance = Math.max(0, balance - principalComponent);
    date.setMonth(date.getMonth() + 1);

    schedule.push({
      emiNo: i,
      date: new Date(date),
      emiAmount: emi,
      principal: principalComponent,
      interest,
      balance: Math.round(balance),
    });
  }
  return schedule;
};

export const getStatusColor = (status) => {
  const statusColors = {
    draft: '#6B7280',
    institute_verified: '#7B6DAF',
    student_details_done: '#7B6DAF',
    borrower_selected: '#7B6DAF',
    pan_verified: '#7B6DAF',
    credit_check_passed: '#4AEDC4',
    credit_check_failed: '#FF6B6B',
    kyc_completed: '#4AEDC4',
    kyc_address_review: '#F5B731',
    kyc_failed: '#FF6B6B',
    selfie_verified: '#4AEDC4',
    bank_verified: '#4AEDC4',
    income_verified: '#4AEDC4',
    fully_eligible: '#4AEDC4',
    partially_eligible: '#F5B731',
    not_eligible: '#FF6B6B',
    enach_done: '#4AEDC4',
    esign_done: '#4AEDC4',
    vkyc_done: '#4AEDC4',
    disbursed: '#4AEDC4',
    active: '#4AEDC4',
    closed: '#6B7280',
    manual_review: '#F5B731',
  };
  return statusColors[status] || '#6B7280';
};

export const getStatusLabel = (status) => {
  const labels = {
    draft: 'Draft',
    institute_verified: 'Institute Verified',
    student_details_done: 'Student Details Done',
    borrower_selected: 'Borrower Selected',
    pan_verified: 'PAN Verified',
    credit_check_passed: 'Credit Check Passed',
    credit_check_failed: 'Credit Check Failed',
    kyc_completed: 'KYC Completed',
    kyc_address_review: 'Address Under Review',
    kyc_failed: 'KYC Failed',
    selfie_verified: 'Selfie Verified',
    bank_verified: 'Bank Verified',
    income_verified: 'Income Verified',
    fully_eligible: 'Approved',
    partially_eligible: 'Partially Eligible',
    not_eligible: 'Not Eligible',
    enach_done: 'eNACH Done',
    esign_done: 'eSigned',
    vkyc_done: 'vKYC Done',
    disbursed: 'Disbursed',
    active: 'Active',
    closed: 'Closed',
    manual_review: 'Under Review',
  };
  return labels[status] || status;
};
