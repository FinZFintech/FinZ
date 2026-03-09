export const APP_NAME = 'FinZ';
export const APP_VERSION = '1.0.0';

// MOCK_MODE: When true, all API calls will use mock data (no backend needed)
export const MOCK_MODE = true;

export const COLORS = {
  primary: '#2D2B6B',       // Navy (logo "fin" text & Z dark portion)
  primaryLight: '#3E3C8A',
  primaryDark: '#1E1C4E',
  secondary: '#F5B731',     // Golden yellow (logo dot on "i" & Z bottom)
  secondaryLight: '#F7C95C',
  teal: '#2CC5BE',          // Teal (logo Z diagonal stroke)
  purple: '#7B6DAF',        // Purple (logo Z top portion)
  accent: '#2CC5BE',
  background: '#F5F6FB',
  surface: '#FFFFFF',
  error: '#D32F2F',
  success: '#2CC5BE',
  warning: '#F5B731',
  info: '#7B6DAF',
  textPrimary: '#2D2B6B',
  textSecondary: '#6E6E8A',
  textLight: '#FFFFFF',
  border: '#E4E4F0',
  disabled: '#B8B8CE',
  overlay: 'rgba(45,43,107,0.5)',
  cardShadow: 'rgba(45,43,107,0.08)',
};

export const FONTS = {
  regular: { fontSize: 14, color: COLORS.textPrimary },
  medium: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary },
  bold: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  heading: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  subheading: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  caption: { fontSize: 12, color: COLORS.textSecondary },
};

export const LOAN_TYPES = {
  EDUCATION: 'education',
  COACHING: 'coaching',
  EMPLOYEE: 'employee',
};

export const LOAN_STATUS = {
  DRAFT: 'draft',
  INSTITUTE_VERIFIED: 'institute_verified',
  PAN_VERIFIED: 'pan_verified',
  CREDIT_CHECK_PASSED: 'credit_check_passed',
  CREDIT_CHECK_FAILED: 'credit_check_failed',
  KYC_COMPLETED: 'kyc_completed',
  KYC_FAILED: 'kyc_failed',
  SELFIE_VERIFIED: 'selfie_verified',
  BANK_VERIFIED: 'bank_verified',
  INCOME_VERIFIED: 'income_verified',
  FULLY_ELIGIBLE: 'fully_eligible',
  PARTIALLY_ELIGIBLE: 'partially_eligible',
  NOT_ELIGIBLE: 'not_eligible',
  ENACH_DONE: 'enach_done',
  ESIGN_DONE: 'esign_done',
  VKYC_DONE: 'vkyc_done',
  DISBURSED: 'disbursed',
  ACTIVE: 'active',
  CLOSED: 'closed',
  MANUAL_REVIEW: 'manual_review',
};

export const USER_ROLES = {
  CUSTOMER: 'customer',
  SALES: 'sales',
  CREDIT: 'credit',
  ADMIN: 'admin',
};

export const KYC_METHODS = {
  CKYC: 'ckyc',
  DIGILOCKER: 'digilocker',
  AADHAAR_XML: 'aadhaar_xml',
};

export const API_ENDPOINTS = {
  BASE_URL: 'https://api.finzfintech.com/v1',
  AUTH: {
    SEND_OTP: '/auth/send-otp',
    VERIFY_OTP: '/auth/verify-otp',
    REFRESH_TOKEN: '/auth/refresh',
  },
  INSTITUTE: {
    LIST: '/institutes',
    STUDENT_DETAILS: '/institutes/{id}/students/{regNo}',
    LOAN_PRODUCTS: '/institutes/{id}/loan-products',
  },
  COMPANY: {
    LIST: '/companies',
    EMPLOYEE_DETAILS: '/companies/{id}/employees/{empId}',
    LOAN_PRODUCTS: '/companies/{id}/loan-products',
  },
  PAN: {
    VALIDATE: '/kyc/pan/validate',
    FETCH_BY_MOBILE: '/kyc/pan/fetch-by-mobile',
  },
  CREDIT: {
    SOFT_PULL: '/credit/soft-pull',
    HARD_PULL: '/credit/hard-pull',
    GATING_CHECK: '/credit/gating-check',
  },
  KYC: {
    CKYC_INITIATE: '/kyc/ckyc/initiate',
    CKYC_VERIFY: '/kyc/ckyc/verify-otp',
    DIGILOCKER_INITIATE: '/kyc/digilocker/initiate',
    DIGILOCKER_CALLBACK: '/kyc/digilocker/callback',
    AADHAAR_XML_UPLOAD: '/kyc/aadhaar-xml/upload',
    PINCODE_CHECK: '/kyc/pincode/check',
  },
  VERIFICATION: {
    SELFIE: '/verification/selfie',
    SELFIE_MATCH: '/verification/selfie/match',
    VKYC_INITIATE: '/verification/vkyc/initiate',
    VKYC_STATUS: '/verification/vkyc/status',
    NAME_MATCH: '/verification/name-match',
  },
  BANK: {
    PENNY_DROP: '/bank/penny-drop',
    IFSC_VALIDATE: '/bank/ifsc/validate',
  },
  INCOME: {
    AA_INITIATE: '/income/account-aggregator/initiate',
    AA_STATUS: '/income/account-aggregator/status',
    BANK_STATEMENT_UPLOAD: '/income/bank-statement/upload',
    ANALYSIS_RESULT: '/income/analysis/{id}',
  },
  LOAN: {
    CREATE: '/loans',
    STATUS: '/loans/{id}/status',
    LIST: '/loans',
    DETAILS: '/loans/{id}',
    ELIGIBILITY: '/loans/{id}/eligibility',
    ENACH_INITIATE: '/loans/{id}/enach/initiate',
    ENACH_STATUS: '/loans/{id}/enach/status',
    ESIGN_INITIATE: '/loans/{id}/esign/initiate',
    ESIGN_STATUS: '/loans/{id}/esign/status',
    REPAYMENT_SCHEDULE: '/loans/{id}/repayment-schedule',
    PREPAYMENT: '/loans/{id}/prepayment',
    FORECLOSURE: '/loans/{id}/foreclosure',
    NOC: '/loans/{id}/noc',
  },
  COMMUNICATION: {
    SEND_SMS: '/comm/sms',
    SEND_WHATSAPP: '/comm/whatsapp',
  },
  ADMIN: {
    PENDING_LOANS: '/admin/loans/pending',
    LOAN_QUEUE: '/admin/loans/queue',
    UPDATE_STATUS: '/admin/loans/{id}/status',
    DASHBOARD_STATS: '/admin/dashboard/stats',
  },
  ENGAGEMENT: {
    DAILY_TIP: '/engagement/daily-tip',
    CREDIT_SCORE_CHECK: '/engagement/credit-score',
    OFFERS: '/engagement/offers',
    REFERRAL: '/engagement/referral',
  },
};
