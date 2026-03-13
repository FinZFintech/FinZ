export const APP_NAME = 'FinZ';
export const APP_VERSION = '1.0.0';

// MOCK_MODE: When true, all API calls will use mock data (no backend needed)
export const MOCK_MODE = true;

// Signzy API Configuration - configurable keys for Phone-to-PAN & PAN Verification
export const SIGNZY_CONFIG = {
  BASE_URL: 'https://api-preproduction.signzy.app/api/v3',
  AUTH_TOKEN: 'vqoNYa3hklTfQJBzUoEr1i1qahc6MtuR',
  CLIENT_ID: 'support@finz.finance',
  ENDPOINTS: {
    PHONE_TO_PAN: '/phonekyc/phonetoPan',
    PAN_FETCH_V2: '/pan/fetchV2',
  },
};

export const COLORS = {
  primary: '#2D2B6B',       // Navy (logo "fin" text & Z dark portion)
  primaryLight: '#3E3C8A',
  primaryDark: '#1E1C4E',
  secondary: '#F5B731',     // Golden yellow (logo dot on "i" & Z bottom)
  secondaryLight: '#F7C95C',
  teal: '#4AEDC4',          // Teal/mint green accent
  purple: '#7B6DAF',        // Purple (logo Z top portion)
  accent: '#4AEDC4',
  background: '#0D1017',    // Very dark background
  surface: '#151A24',       // Slightly lighter dark surface
  cardBg: '#1A1E2E',       // Card background
  cardBorder: 'rgba(255,255,255,0.08)', // Subtle card border
  error: '#FF6B6B',
  success: '#4AEDC4',
  warning: '#F5B731',
  info: '#7B6DAF',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E95A8',
  textLight: '#FFFFFF',
  border: 'rgba(255,255,255,0.1)',
  disabled: '#3A3F4E',
  overlay: 'rgba(0,0,0,0.6)',
  cardShadow: 'rgba(0,0,0,0.3)',
  headerBg: '#111520',     // Header background
  inputBg: '#1A1E2E',      // Input field background
  selectedBorder: '#4AEDC4', // Selected item border
  buttonGreen: '#4AEDC4',   // Primary CTA button color
  buttonGreenDark: '#3AAF8F', // Pressed state
};

export const FONTS = {
  regular: { fontSize: 14, color: COLORS.textPrimary },
  medium: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary },
  bold: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  heading: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
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

export const PAN_STATUS_CODES = {
  E: 'VALID',
  F: 'FAKE',
  X: 'DEACTIVATED',
  D: 'DELETED',
  N: 'INVALID',
  EA: 'AMALGAMATION',
  EC: 'ACQUISITION',
  ED: 'DEATH',
  EI: 'DISSOLUTION',
  EL: 'LIQUIDATED',
  EM: 'MERGER',
  EP: 'PARTITION',
  ES: 'SPLIT',
  EU: 'UNDER LIQUIDATION',
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
  // PAN endpoints removed — PAN operations now use Signzy API directly
  // via signzyService.js (SIGNZY_CONFIG above)
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
