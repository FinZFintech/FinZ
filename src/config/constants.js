import { Platform } from 'react-native';

export const APP_NAME = 'FinZ';
export const APP_VERSION = '1.0.0';

// MOCK_MODE: When true, all API calls will use mock data (no backend needed)
export const MOCK_MODE = false;

// ─── External API base URLs ─────────────────────────────────────────────────
//
// Browsers enforce CORS on every cross-origin XHR/fetch, and most of the
// upstream gateways we call (Signzy, CKYC, mTalkz, Digitap) do NOT send
// Access-Control-Allow-Origin headers, so direct calls from the web build
// get blocked at the preflight stage. To work around this without standing
// up a separate backend, the Vercel deployment exposes same-origin proxy
// paths (`/proxy/<service>/...`) that forward to the upstream server-side.
// See `vercel.json` for the rewrites.
//
// On native (iOS / Android) there is no CORS, so we keep using the direct
// upstream URLs to avoid an unnecessary network hop.

const IS_WEB = Platform.OS === 'web';

const apiBase = (proxyPath, directUrl) => (IS_WEB ? proxyPath : directUrl);

// Signzy API Configuration - configurable keys for all Signzy v3 APIs
export const SIGNZY_CONFIG = {
  BASE_URL: apiBase('/proxy/signzy-v3', 'https://api-preproduction.signzy.app/api/v3'),
  AUTH_TOKEN: 'vqoNYa3hklTfQJBzUoEr1i1qahc6MtuR',
  CLIENT_ID: 'support@finz.finance',
  ENDPOINTS: {
    // Identity & PAN
    PHONE_TO_PAN: '/phonekyc/phonetoPan',
    PAN_FETCH_V2: '/pan/fetchV2',
    E_AADHAAR_XML: '/fetchEaadhaarXml',
    DIGILOCKER_DETAILS: '/fetchDigilockerDetails',

    // DigiLocker (Signzy)
    DIGILOCKER_CREATE_URL: '/digilocker/createUrl',
    DIGILOCKER_GET_EAADHAAR: '/digilocker/geteaadhaarwithxml',

    // Phone KYC Suite
    PHONE_TO_REGISTERED_ADDRESS: '/phonekyc/phoneToRegisteredAddress',
    PHONE_TO_ALTERNATE_PHONE: '/phonekyc/phoneToAlternatePhone',
    PHONE_TO_PREFILL: '/phonekyc/phoneToPrefill',
    PHONE_TO_INCOME: '/phonekyc/phoneToIncome',
    PHONE_TO_IDENTITY_DETAILS: '/phonekyc/phoneToIdentityDetails',
    PHONE_PREFILL: '/phonekyc/phone-prefill',

    // Risk & Fraud
    PHONE_INTELLIGENCE: '/phone-intelligence',
    WHATSAPP_PRESENCE: '/whatsapp-presence',
    DIGITAL_IDENTITY_SCORE: '/digital-identity-score',
    FRAUDSHIELD_LITE: '/fraudshield-advanced-score',

    // Banking (Hybrid Bank Account Verification — penny drop / penniless)
    BANK_ACCOUNT_VERIFICATION: '/bankaccountverification/bankaccountverifications',
    IFSC_SEARCH: '/ifsc/search',

    // Employment
    EMPLOYMENT_VERIFICATION: '/employmentVerification',
    ADVANCED_EMPLOYMENT: '/advancedEmploymentVerification',
    EMPLOYMENT_CURRENT_EMPLOYER: '/employment-verification/current-employer',

    // GST
    PAN_TO_GSTN: '/gst/panToGstnDetail',
    GSTN_DETAILED: '/gstn/gstndetailed',

    // Address
    ADDRESS_GEOCODE: '/addressGeocode',
    PINCODE_DETAILS: '/pincodeDetails',

    // Device
    IMEI_FETCH: '/imeiFetch',

    // Document
    FORGERY_CHECK: '/advanceForgeryLite',

    // Liveness & Selfie
    LIVENESS_CREATE_URL: '/liveness-secure/createUrl',
    LIVENESS_GET_DATA: '/liveness-secure/getData',

    // Face Match (OVD extraction + face verification)
    FACE_MATCH: '/ovd/extraction-face-verification',

    // Email Validation
    EMAIL_VALIDATION: '/validation/email',
  },
};

// CKYC API Configuration (FinZ CKYC gateway)
// Token is appended to every request as a query parameter: ?token=<Token>
export const CKYC_CONFIG = {
  // Live endpoint. UAT: https://ckycdev.finz.finance/api
  BASE_URL: apiBase('/proxy/ckyc', 'https://ckyc.finz.finance/api'),
  TOKEN: 'SiyHPws4mi43ka0P01',
  ENDPOINTS: {
    SEARCH: '/searchRequest',      // POST (CKYC search)
    DOWNLOAD: '/downloadRequest',  // POST (send OTP / download)
    VALIDATE_OTP: '/validateOTP',  // POST (resend / validate OTP)
  },
  // authType: 03 = mobile OTP, 01 = DOB
  AUTH_TYPE_MOBILE: '03',
  AUTH_TYPE_DOB: '01',
  // IdentityType: C = CKYC via PAN, E = CKYC via other
  IDENTITY_TYPE_PAN: 'C',
};

// Signzy v2 Patron-based auth (Geo Fencing, Digital Integrity)
export const SIGNZY_V2_CONFIG = {
  BASE_URL: apiBase('/proxy/signzy-v2', 'https://api-preproduction.signzy.app/api/v2/patrons'),
  USERNAME: 'support@finz.finance',
  PASSWORD: 'vqoNYa3hklTfQJBzUoEr1i1qahc6MtuR',
  ENDPOINTS: {
    LOGIN: '/login',
    GEO_FENCING: '/geoFencing',
    DIGITAL_INTEGRITY: '/digitalIntegrityCheck',
  },
};

// Signzy US OTP API Configuration
export const SIGNZY_OTP_CONFIG = {
  BASE_URL: apiBase('/proxy/signzy-otp', 'https://api-preproduction.signzy.us/api/v3'),
  AUTH_TOKEN: 'vqoNYa3hklTfQJBzUoEr1i1qahc6MtuR',
  CLIENT_ID: '64c1115454eb66846d026abf',
  ENDPOINTS: {
    SEND_OTP: '/otp-verification/send-otp',
    VERIFY_OTP: '/otp-verification/verify-otp',
  },
  DEFAULT_CHANNEL: 'SMSOTP',
  DEFAULT_OTP_LENGTH: '6',
};

export const MTALKZ_CONFIG = {
  BASE_URL: apiBase('/proxy/mtalkz', 'https://msgn.mtalkz.com/api'),
  API_KEY: 'LzICQhtamSRXXgqA',
  SENDER_ID: 'FINZ',
  TEMPLATES: {
    OTP: '{#otp#} is your One Time Password (OTP) for verification.\nThis OTP will only be valid for next 10 minutes. Please don\'t share OTP with anyone.\nThanks,\nFINZ',
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
  STUDENT_DETAILS_DONE: 'student_details_done',
  BORROWER_SELECTED: 'borrower_selected',
  PAN_VERIFIED: 'pan_verified',
  CREDIT_CHECK_PASSED: 'credit_check_passed',
  CREDIT_CHECK_FAILED: 'credit_check_failed',
  BANK_VERIFIED: 'bank_verified',
  INCOME_VERIFIED: 'income_verified',
  KYC_COMPLETED: 'kyc_completed',
  KYC_ADDRESS_REVIEW: 'kyc_address_review',
  KYC_FAILED: 'kyc_failed',
  SELFIE_VERIFIED: 'selfie_verified',
  FULLY_ELIGIBLE: 'fully_eligible',
  PARTIALLY_ELIGIBLE: 'partially_eligible',
  NOT_ELIGIBLE: 'not_eligible',
  ENACH_DONE: 'enach_done',
  ESIGN_DONE: 'esign_done',
  VKYC_DONE: 'vkyc_done',
  SUBMITTED: 'submitted',
  DISBURSED: 'disbursed',
  ACTIVE: 'active',
  CLOSED: 'closed',
  MANUAL_REVIEW: 'manual_review',
};

export const USER_ROLES = {
  CUSTOMER: 'customer',
  SALES: 'sales',
  CREDIT: 'credit',
  OPERATIONS: 'operations',
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
    AA_FIP_LIST: '/income/account-aggregator/fip-list',
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
  RISK: {
    CALCULATE: '/risk/calculate',
    SCORE: '/risk/{loanId}/score',
    PROFILE: '/risk/{loanId}/profile',
  },
};

// Risk Engine Configuration
export const RISK_CONFIG = {
  CATEGORY_WEIGHTS: {
    identity:      0.10,
    creditBureau:  0.18,
    financial:     0.10,
    bankStatement: 0.10,
    phoneDigital:  0.07,
    address:       0.05,
    income:        0.10,
    document:      0.04,
    device:        0.05,
    fraud:         0.10,
    behavioral:    0.05,
    legal:         0.06,
  },
  THRESHOLDS: {
    AUTO_APPROVE: 800,
    STANDARD: 600,
    ELEVATED: 400,
    MANUAL_REVIEW: 200,
  },
  PHASE_GATES: {
    PHASE_A_MIN: 200,
    PHASE_B_MIN: 300,
    PHASE_C_MIN: 350,
    AUTO_DECLINE: 200,
  },
};
