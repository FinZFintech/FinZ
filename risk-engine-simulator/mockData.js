/**
 * FinZ Risk Engine Simulator v2 — Mock API Data
 *
 * 31 APIs across 4 phases:
 *   Phase A (9): Identity + Digital Trust + Velocity + Session Behavior
 *   Phase B (8): Credit Bureau + Income + Employment + ITR + GST
 *   Phase C (8): Address + KYC + Legal + Fraud Ring
 *   Phase D (6): Bank + Document + Bank Statement + Product-Aware
 */

// ─── Scenario Presets ────────────────────────────────────────────────────────

const SCENARIOS = {
  good: {
    label: 'Good Applicant',
    description: 'Salaried professional, clean history, strong digital footprint',
    applicant: {
      firstName: 'Rajesh', lastName: 'Kumar', dob: '1990-05-15',
      email: 'rajesh.kumar@gmail.com', phone: '9876543210',
      pan: 'ABCPK1234A', aadhaarLast4: '5678', gstin: '',
      address: '42, MG Road, Koramangala', city: 'Bangalore',
      state: 'Karnataka', pincode: '560034',
      accountNumber: '1234567890123', ifsc: 'SBIN0001234',
      monthlyIncome: 65000, existingEmi: 8000,
      loanAmount: 200000, tenure: 12, interestRate: 14,
      repeatBorrower: 'no',
      imei: '352456789012345', ipAddress: '103.21.58.193',
      deviceId: 'a1b2c3d4-e5f6-7890',
    },
  },
  risky: {
    label: 'Risky Applicant',
    description: 'Self-employed, thin credit file, some red flags',
    applicant: {
      firstName: 'Deepak', lastName: 'Sharma', dob: '1985-11-22',
      email: 'deepak85@yahoo.co.in', phone: '7012345678',
      pan: 'BRSPS5678B', aadhaarLast4: '9012', gstin: '08AABCS1429B1ZT',
      address: '17, Railway Colony', city: 'Jodhpur',
      state: 'Rajasthan', pincode: '342001',
      accountNumber: '9876543210987', ifsc: 'PUNB0123400',
      monthlyIncome: 30000, existingEmi: 12000,
      loanAmount: 200000, tenure: 12, interestRate: 14,
      repeatBorrower: 'yes_bad',
      imei: '861234567890123', ipAddress: '49.36.12.88',
      deviceId: 'f9e8d7c6-b5a4-3210',
    },
  },
  fraud: {
    label: 'Fraudulent Applicant',
    description: 'Synthetic identity, VPN, burner phone, forged documents',
    applicant: {
      firstName: 'Amit', lastName: 'Verma', dob: '1995-01-10',
      email: 'amitverma_temp@tempmail.org', phone: '6000000001',
      pan: 'ZZZZZ9999Z', aadhaarLast4: '0000', gstin: 'INVALID_GST',
      address: '999, Unknown Layout', city: 'Srinagar',
      state: 'Jammu & Kashmir', pincode: '190001',
      accountNumber: '0000000000001', ifsc: 'ABCD0000000',
      monthlyIncome: 200000, existingEmi: 0,
      loanAmount: 500000, tenure: 6, interestRate: 14,
      repeatBorrower: 'no',
      imei: '000000000000000', ipAddress: '185.220.101.34',
      deviceId: 'xx-fake-device-xx',
    },
  },
};


// ─── API Definitions ────────────────────────────────────────────────────────

function generateApiResponses(scenario) {
  const s = SCENARIOS[scenario].applicant;
  const apis = {};

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE A — Identity + Digital Trust + Velocity + Behavioral
  // ═══════════════════════════════════════════════════════════════════════════

  apis.panFetch = {
    id: 'panFetch', name: 'PAN Fetch V2',
    endpoint: '/api/v3/pan/fetchV2', method: 'POST', phase: 'A', category: 'identity',
    description: 'Validates PAN card and retrieves holder details, tax compliance, and Aadhaar seeding status.',
    input: {
      pan: { type: 'string', description: 'PAN number (10 chars)', required: true, value: s.pan },
    },
    output: {
      good: { result: { isValid: true, panStatusLabel: 'VALID', firstName: 'RAJESH', lastName: 'KUMAR', typeOfHolder: 'Individual', isIndividual: true, aadhaarSeedingStatus: 'Yes', individualTaxComplianceStatus: 'Operative', lastUpdated: '2025-12-01' }, statusCode: 200 },
      risky: { result: { isValid: true, panStatusLabel: 'VALID', firstName: 'DEEPAK', lastName: 'SHARMA', typeOfHolder: 'Individual', isIndividual: true, aadhaarSeedingStatus: 'No', individualTaxComplianceStatus: 'Inoperative', lastUpdated: '2024-03-15' }, statusCode: 200 },
      fraud: { result: { isValid: false, panStatusLabel: 'FAKE', firstName: '', lastName: '', typeOfHolder: 'Unknown', isIndividual: false, aadhaarSeedingStatus: 'No', individualTaxComplianceStatus: 'Not Available', lastUpdated: null }, statusCode: 200 },
    }[scenario],
  };

  apis.phoneToPan = {
    id: 'phoneToPan', name: 'Phone to PAN',
    endpoint: '/api/v3/phonekyc/phoneToPan', method: 'POST', phase: 'A', category: 'identity',
    description: 'Looks up PAN number associated with a mobile number. Cross-references with provided PAN.',
    input: {
      phoneNumber: { type: 'string', description: 'Indian mobile number (10 digits)', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
    },
    output: {
      good: { result: { pan: 'ABCPK1234A', name: 'Rajesh Kumar', gender: 'M', dob: '15-05-1990', matchFound: true }, statusCode: 200 },
      risky: { result: { pan: null, name: null, gender: null, dob: null, matchFound: false }, statusCode: 200 },
      fraud: { result: { pan: null, name: null, gender: null, dob: null, matchFound: false }, statusCode: 200 },
    }[scenario],
  };

  apis.phoneIntelligence = {
    id: 'phoneIntelligence', name: 'Phone Intelligence',
    endpoint: '/api/v3/phone-intelligence', method: 'POST', phase: 'A', category: 'phoneDigital',
    description: 'Comprehensive phone risk analysis: carrier info, line type, risk scoring, blocklist check, SIM swap detection.',
    input: {
      phoneNumber: { type: 'string', description: 'Phone with country code', required: true, value: '+91' + s.phone },
      originatingIp: { type: 'string', description: 'Session IP', required: false, value: s.ipAddress },
      emailAddress: { type: 'string', description: 'Email', required: false, value: s.email },
      deviceId: { type: 'string', description: 'Device ID', required: false, value: s.deviceId },
    },
    output: {
      good: { result: { riskScore: 120, riskLevel: 'low', phoneType: 'mobile', carrier: 'Airtel', lineType: 'postpaid', isBlocklisted: false, simSwapDetected: false, simSwapLastDate: null, accountTenure: '5+ years', isPorted: false, isRoaming: false, countryCode: 'IN', fraudSources: [] }, statusCode: 200 },
      risky: { result: { riskScore: 520, riskLevel: 'medium', phoneType: 'mobile', carrier: 'BSNL', lineType: 'prepaid', isBlocklisted: false, simSwapDetected: true, simSwapLastDate: '2026-01-15', accountTenure: '6 months', isPorted: true, isRoaming: false, countryCode: 'IN', fraudSources: [] }, statusCode: 200 },
      fraud: { result: { riskScore: 890, riskLevel: 'very_high', phoneType: 'voip', carrier: 'Unknown', lineType: 'virtual', isBlocklisted: true, simSwapDetected: false, simSwapLastDate: null, accountTenure: 'unknown', isPorted: false, isRoaming: true, countryCode: 'IN', fraudSources: ['fraud_report_2025_aug', 'spam_db_flagged'] }, statusCode: 200 },
    }[scenario],
  };

  apis.whatsappPresence = {
    id: 'whatsappPresence', name: 'WhatsApp Presence',
    endpoint: '/api/v3/whatsapp-presence', method: 'POST', phase: 'A', category: 'phoneDigital',
    description: 'Checks if phone is registered on WhatsApp — personal vs business account.',
    input: { mobile: { type: 'string', description: 'Mobile number (10 digits)', required: true, value: s.phone } },
    output: {
      good: { result: { isRegistered: true, accountType: 'personal', profileExists: true }, statusCode: 200 },
      risky: { result: { isRegistered: true, accountType: 'business', profileExists: true }, statusCode: 200 },
      fraud: { result: { isRegistered: false, accountType: null, profileExists: false }, statusCode: 200 },
    }[scenario],
  };

  apis.digitalIdentityScore = {
    id: 'digitalIdentityScore', name: 'Digital Identity Score',
    endpoint: '/api/v3/digital-identity-score', method: 'POST', phase: 'A', category: 'phoneDigital',
    description: 'Composite digital identity score based on phone, email, and presence across e-commerce & social platforms.',
    input: {
      phone: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      email: { type: 'string', description: 'Email address', required: true, value: s.email },
      name: { type: 'string', description: 'Full name', required: false, value: s.firstName + ' ' + s.lastName },
      pincode: { type: 'string', description: 'Postal code', required: false, value: s.pincode },
    },
    output: {
      good: { result: { score: 8.2, maxScore: 10, phoneFirstSeen: '2019-03-20', emailFirstSeen: '2015-08-10', ecomPresence: ['amazon', 'flipkart', 'swiggy', 'zomato'], socialPresence: ['linkedin', 'instagram'], nameEmailMatch: true, phoneEmailLinked: true, riskBand: 'low' }, statusCode: 200 },
      risky: { result: { score: 4.5, maxScore: 10, phoneFirstSeen: '2025-09-01', emailFirstSeen: '2024-12-05', ecomPresence: ['flipkart'], socialPresence: [], nameEmailMatch: false, phoneEmailLinked: false, riskBand: 'medium' }, statusCode: 200 },
      fraud: { result: { score: 1.1, maxScore: 10, phoneFirstSeen: null, emailFirstSeen: null, ecomPresence: [], socialPresence: [], nameEmailMatch: false, phoneEmailLinked: false, riskBand: 'very_high' }, statusCode: 200 },
    }[scenario],
  };

  apis.phoneToAlternate = {
    id: 'phoneToAlternate', name: 'Phone to Alternate Phone',
    endpoint: '/api/v3/phonekyc/phoneToAlternatePhone', method: 'POST', phase: 'A', category: 'device',
    description: 'Finds alternate phone numbers associated with an individual.',
    input: {
      phoneNumber: { type: 'string', description: 'Primary mobile', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      pan: { type: 'string', description: 'PAN', required: false, value: s.pan },
    },
    output: {
      good: { result: { alternatePhones: [{ number: '9876500001', carrier: 'Jio', status: 'active' }], totalFound: 1 }, statusCode: 200 },
      risky: { result: { alternatePhones: [{ number: '7012300001', carrier: 'BSNL', status: 'active' }, { number: '7012300002', carrier: 'Vi', status: 'active' }, { number: '8899001122', carrier: 'Airtel', status: 'inactive' }, { number: '9001122334', carrier: 'Jio', status: 'active' }], totalFound: 4 }, statusCode: 200 },
      fraud: { result: { alternatePhones: [{ number: '6000000002', carrier: 'Unknown', status: 'active' }, { number: '6000000003', carrier: 'Unknown', status: 'active' }, { number: '6000000004', carrier: 'Unknown', status: 'active' }, { number: '6000000005', carrier: 'Unknown', status: 'active' }, { number: '6000000006', carrier: 'Unknown', status: 'active' }, { number: '6000000007', carrier: 'Unknown', status: 'inactive' }], totalFound: 6 }, statusCode: 200 },
    }[scenario],
  };

  apis.phoneToIdentity = {
    id: 'phoneToIdentity', name: 'Phone to Identity Details',
    endpoint: '/api/v3/phonekyc/phoneToIdentityDetails', method: 'POST', phase: 'A', category: 'identity',
    description: 'Retrieves identity documents (DL, Voter ID, Passport) linked to a phone number.',
    input: {
      phoneNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      pan: { type: 'string', description: 'PAN', required: false, value: s.pan },
    },
    output: {
      good: { result: { identities: [{ type: 'driving_licence', number: 'KA05-XXXX-1234', state: 'Karnataka', valid: true }, { type: 'voter_id', number: 'ABC1234567', state: 'Karnataka', valid: true }], nameOnRecords: 'Rajesh Kumar', gender: 'Male', dob: '1990-05-15', consistencyScore: 95 }, statusCode: 200 },
      risky: { result: { identities: [{ type: 'voter_id', number: 'RJ9876543', state: 'Rajasthan', valid: true }], nameOnRecords: 'Deepak Sharma', gender: 'Male', dob: '1985-11-22', consistencyScore: 72 }, statusCode: 200 },
      fraud: { result: { identities: [], nameOnRecords: null, gender: null, dob: null, consistencyScore: 0 }, statusCode: 200 },
    }[scenario],
  };

  // ─── NEW: Velocity & Repeat Detection ───
  apis.velocityCheck = {
    id: 'velocityCheck', name: 'Velocity & Repeat Detection',
    endpoint: '/api/v3/fraud/velocity-check', method: 'POST', phase: 'A', category: 'fraud',
    description: 'Detects repeat applications from same device/IP/phone/PAN. Identifies loan stacking and rapid successive applications.',
    input: {
      pan: { type: 'string', description: 'PAN number', required: true, value: s.pan },
      phone: { type: 'string', description: 'Phone number', required: true, value: s.phone },
      deviceId: { type: 'string', description: 'Device fingerprint', required: true, value: s.deviceId },
      ipAddress: { type: 'string', description: 'Client IP', required: true, value: s.ipAddress },
      email: { type: 'string', description: 'Email address', required: true, value: s.email },
    },
    output: {
      good: {
        result: {
          applicationsByPan: { last24h: 0, last7d: 0, last30d: 0 },
          applicationsByDevice: { last24h: 0, last7d: 0, last30d: 0 },
          applicationsByIp: { last24h: 1, last7d: 1, last30d: 1 },
          applicationsByPhone: { last24h: 0, last7d: 0, last30d: 0 },
          sharedDeviceWithOtherPans: false,
          sharedIpWithOtherPans: false,
          sharedBankAccountWithOthers: false,
          loanStackingDetected: false,
          velocityRisk: 'low',
          recentRejections: 0,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          applicationsByPan: { last24h: 0, last7d: 2, last30d: 5 },
          applicationsByDevice: { last24h: 0, last7d: 1, last30d: 3 },
          applicationsByIp: { last24h: 1, last7d: 3, last30d: 8 },
          applicationsByPhone: { last24h: 0, last7d: 2, last30d: 5 },
          sharedDeviceWithOtherPans: false,
          sharedIpWithOtherPans: true,
          sharedBankAccountWithOthers: false,
          loanStackingDetected: true,
          velocityRisk: 'medium',
          recentRejections: 3,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          applicationsByPan: { last24h: 3, last7d: 12, last30d: 28 },
          applicationsByDevice: { last24h: 5, last7d: 18, last30d: 45 },
          applicationsByIp: { last24h: 8, last7d: 30, last30d: 80 },
          applicationsByPhone: { last24h: 2, last7d: 10, last30d: 22 },
          sharedDeviceWithOtherPans: true,
          sharedIpWithOtherPans: true,
          sharedBankAccountWithOthers: true,
          loanStackingDetected: true,
          velocityRisk: 'critical',
          recentRejections: 15,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  // ─── NEW: Session Behavior Analytics ───
  apis.sessionBehavior = {
    id: 'sessionBehavior', name: 'Session Behavior Analytics',
    endpoint: '/api/v3/fraud/session-behavior', method: 'POST', phase: 'A', category: 'behavioral',
    description: 'Analyzes on-device session behavior: form fill speed, copy-paste detection, hesitation patterns, root/jailbreak, screenshots.',
    input: {
      sessionId: { type: 'string', description: 'Current session ID', required: true, value: 'sess_' + s.phone },
      deviceId: { type: 'string', description: 'Device fingerprint', required: true, value: s.deviceId },
    },
    output: {
      good: {
        result: {
          totalFormTime: 245,
          averageFieldTime: 8.2,
          copyPasteDetected: { pan: false, email: false, phone: false, name: false, address: false },
          copyPasteCount: 0,
          hesitationOnIncomeField: false,
          fieldCorrectionCount: 2,
          tabSwitchCount: 1,
          screenshotAttempts: 0,
          screenRecordingDetected: false,
          isRooted: false,
          isJailbroken: false,
          isEmulator: false,
          touchPressureConsistent: true,
          typingPatternHuman: true,
          mouseMovementNatural: true,
          behaviorScore: 92,
          riskLevel: 'low',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          totalFormTime: 68,
          averageFieldTime: 2.3,
          copyPasteDetected: { pan: true, email: false, phone: false, name: false, address: true },
          copyPasteCount: 2,
          hesitationOnIncomeField: true,
          fieldCorrectionCount: 7,
          tabSwitchCount: 8,
          screenshotAttempts: 1,
          screenRecordingDetected: false,
          isRooted: false,
          isJailbroken: false,
          isEmulator: false,
          touchPressureConsistent: true,
          typingPatternHuman: true,
          mouseMovementNatural: true,
          behaviorScore: 55,
          riskLevel: 'medium',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          totalFormTime: 12,
          averageFieldTime: 0.4,
          copyPasteDetected: { pan: true, email: true, phone: true, name: true, address: true },
          copyPasteCount: 8,
          hesitationOnIncomeField: false,
          fieldCorrectionCount: 0,
          tabSwitchCount: 0,
          screenshotAttempts: 3,
          screenRecordingDetected: true,
          isRooted: true,
          isJailbroken: false,
          isEmulator: true,
          touchPressureConsistent: false,
          typingPatternHuman: false,
          mouseMovementNatural: false,
          behaviorScore: 8,
          riskLevel: 'critical',
        },
        statusCode: 200,
      },
    }[scenario],
  };


  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE B — Credit Bureau + Income + Employment + ITR + GST
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── NEW: Credit Bureau (CIBIL) ───
  apis.creditBureauFetch = {
    id: 'creditBureauFetch', name: 'Credit Bureau Fetch (CIBIL)',
    endpoint: '/api/v3/credit-bureau/cibil-fetch', method: 'POST', phase: 'B', category: 'creditBureau',
    description: 'Fetches CIBIL credit score, active trade lines, DPD history, hard inquiries, write-offs, and credit utilization.',
    input: {
      pan: { type: 'string', description: 'PAN number', required: true, value: s.pan },
      name: { type: 'string', description: 'Full name', required: true, value: s.firstName + ' ' + s.lastName },
      dob: { type: 'string', description: 'Date of birth', required: true, value: s.dob },
      phone: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      consent: { type: 'boolean', description: 'Bureau pull consent', required: true, value: true },
    },
    output: {
      good: {
        result: {
          cibilScore: 782,
          scoreRange: { min: 300, max: 900 },
          scoreBand: 'good',
          activeTradeLines: [
            { type: 'credit_card', lender: 'HDFC Bank', sanctionedAmount: 200000, currentBalance: 18500, status: 'standard', dpd: 0, accountAge: '4y 2m' },
            { type: 'personal_loan', lender: 'Bajaj Finance', sanctionedAmount: 150000, currentBalance: 45000, status: 'standard', dpd: 0, accountAge: '1y 8m' },
          ],
          closedTradeLines: 3,
          totalActiveAccounts: 2,
          maxDpdLast12Months: 0,
          maxDpdLast24Months: 0,
          maxDpdEver: 0,
          hardInquiriesLast6Months: 1,
          hardInquiriesLast12Months: 2,
          writeOffs: 0,
          settlements: 0,
          creditUtilization: 0.09,
          totalOutstanding: 63500,
          oldestAccountAge: '6y 4m',
          recentDelinquency: null,
          suitFiledStatus: 'none',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          cibilScore: 598,
          scoreRange: { min: 300, max: 900 },
          scoreBand: 'fair',
          activeTradeLines: [
            { type: 'personal_loan', lender: 'Muthoot Finance', sanctionedAmount: 80000, currentBalance: 62000, status: 'sub_standard', dpd: 45, accountAge: '0y 8m' },
            { type: 'credit_card', lender: 'SBI Card', sanctionedAmount: 50000, currentBalance: 47500, status: 'standard', dpd: 0, accountAge: '2y 1m' },
          ],
          closedTradeLines: 1,
          totalActiveAccounts: 2,
          maxDpdLast12Months: 45,
          maxDpdLast24Months: 60,
          maxDpdEver: 90,
          hardInquiriesLast6Months: 5,
          hardInquiriesLast12Months: 9,
          writeOffs: 0,
          settlements: 1,
          creditUtilization: 0.84,
          totalOutstanding: 109500,
          oldestAccountAge: '2y 1m',
          recentDelinquency: '2025-11-15',
          suitFiledStatus: 'none',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          cibilScore: -1,
          scoreRange: { min: 300, max: 900 },
          scoreBand: 'no_history',
          activeTradeLines: [],
          closedTradeLines: 0,
          totalActiveAccounts: 0,
          maxDpdLast12Months: null,
          maxDpdLast24Months: null,
          maxDpdEver: null,
          hardInquiriesLast6Months: 0,
          hardInquiriesLast12Months: 0,
          writeOffs: 0,
          settlements: 0,
          creditUtilization: null,
          totalOutstanding: 0,
          oldestAccountAge: null,
          recentDelinquency: null,
          suitFiledStatus: 'none',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.phoneToIncome = {
    id: 'phoneToIncome', name: 'Phone to Income',
    endpoint: '/api/v3/phonekyc/phoneToIncome', method: 'POST', phase: 'B', category: 'income',
    description: 'Estimates income bracket based on phone-linked financial data.',
    input: {
      phoneNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      dob: { type: 'string', description: 'Date of birth', required: true, value: s.dob },
      pan: { type: 'string', description: 'PAN', required: false, value: s.pan },
    },
    output: {
      good: { result: { estimatedMonthlyIncome: 72000, incomeBracket: '50000-100000', confidence: 'high', incomeSource: 'salaried', employerCategory: 'private_sector' }, statusCode: 200 },
      risky: { result: { estimatedMonthlyIncome: 25000, incomeBracket: '20000-30000', confidence: 'low', incomeSource: 'self_employed', employerCategory: null }, statusCode: 200 },
      fraud: { result: { estimatedMonthlyIncome: null, incomeBracket: null, confidence: 'none', incomeSource: null, employerCategory: null }, statusCode: 200 },
    }[scenario],
  };

  apis.phoneToPrefill = {
    id: 'phoneToPrefill', name: 'Phone to Prefill',
    endpoint: '/api/v3/phonekyc/phoneToPrefill', method: 'POST', phase: 'B', category: 'income',
    description: 'Fetches prefill data (addresses, identity docs, demographics) linked to a phone number.',
    input: {
      phoneNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      pan: { type: 'string', description: 'PAN', required: false, value: s.pan },
    },
    output: {
      good: { result: { addresses: [{ address: '42, MG Road, Koramangala', city: 'Bangalore', state: 'Karnataka', pincode: '560034', type: 'current' }, { address: '18, 2nd Cross, Indiranagar', city: 'Bangalore', state: 'Karnataka', pincode: '560038', type: 'previous' }], identityDocuments: ['PAN', 'DL', 'Voter ID'], demographics: { age: 35, gender: 'Male', maritalStatus: 'Married' }, dataRichness: 'high' }, statusCode: 200 },
      risky: { result: { addresses: [{ address: '17, Railway Colony', city: 'Jodhpur', state: 'Rajasthan', pincode: '342001', type: 'current' }], identityDocuments: ['PAN', 'Voter ID'], demographics: { age: 40, gender: 'Male', maritalStatus: 'Unknown' }, dataRichness: 'medium' }, statusCode: 200 },
      fraud: { result: { addresses: [], identityDocuments: [], demographics: null, dataRichness: 'none' }, statusCode: 200 },
    }[scenario],
  };

  apis.employmentVerification = {
    id: 'employmentVerification', name: 'Employment Verification',
    endpoint: '/api/v3/employment-verification', method: 'POST', phase: 'B', category: 'financial',
    description: 'Checks employment status via EPFO records.',
    input: {
      mobile: { type: 'string', description: 'Registered mobile', required: true, value: s.phone },
      panNumber: { type: 'string', description: 'PAN', required: true, value: s.pan },
    },
    output: {
      good: { result: { isEmployed: true, employerName: 'Infosys Technologies Ltd', dateOfJoining: '2020-06-15', dateOfExit: null, uanNumber: 'UAN-10145678', pfBalance: 320000, lastContribution: '2026-02-28', membershipStatus: 'active' }, statusCode: 200 },
      risky: { result: { isEmployed: false, employerName: 'Sharma Traders', dateOfJoining: '2023-01-10', dateOfExit: '2025-08-30', uanNumber: 'UAN-20987654', pfBalance: 45000, lastContribution: '2025-08-15', membershipStatus: 'inactive' }, statusCode: 200 },
      fraud: { result: { isEmployed: false, employerName: null, dateOfJoining: null, dateOfExit: null, uanNumber: null, pfBalance: null, lastContribution: null, membershipStatus: 'not_found' }, statusCode: 200 },
    }[scenario],
  };

  apis.advancedEmployment = {
    id: 'advancedEmployment', name: 'Advanced Employment Verification',
    endpoint: '/api/v3/advanced-employment-verification', method: 'POST', phase: 'B', category: 'financial',
    description: 'Deep employment check: full work history, PF filing frequency, employer GSTIN cross-check.',
    input: {
      mobileNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      panNumber: { type: 'string', description: 'PAN', required: true, value: s.pan },
      consent: { type: 'boolean', description: 'User consent', required: true, value: true },
    },
    output: {
      good: { result: { employmentHistory: [{ employer: 'Infosys Technologies Ltd', from: '2020-06', to: 'present', duration: '5y 9m' }, { employer: 'Wipro Ltd', from: '2018-07', to: '2020-05', duration: '1y 10m' }, { employer: 'TCS', from: '2015-06', to: '2018-06', duration: '3y' }], totalExperience: '10+ years', pfFilingFrequency: 'monthly', lastPfFiled: '2026-02-28', currentEmployerGstin: '29AABCI1234F1ZS', employerGstinActive: true, employerSize: 'large', averageTenure: '3.5 years' }, statusCode: 200 },
      risky: { result: { employmentHistory: [{ employer: 'Sharma Traders', from: '2023-01', to: '2025-08', duration: '2y 7m' }, { employer: 'Quick Services', from: '2021-03', to: '2022-11', duration: '1y 8m' }], totalExperience: '4 years', pfFilingFrequency: 'quarterly', lastPfFiled: '2025-06-30', currentEmployerGstin: null, employerGstinActive: false, employerSize: 'micro', averageTenure: '2.1 years' }, statusCode: 200 },
      fraud: { result: { employmentHistory: [], totalExperience: null, pfFilingFrequency: null, lastPfFiled: null, currentEmployerGstin: null, employerGstinActive: false, employerSize: null, averageTenure: null }, statusCode: 200 },
    }[scenario],
  };

  // ─── NEW: ITR / 26AS Verification ───
  apis.itrVerification = {
    id: 'itrVerification', name: 'ITR / 26AS Verification',
    endpoint: '/api/v3/income/itr-26as-verify', method: 'POST', phase: 'B', category: 'income',
    description: 'Verifies Income Tax Returns and 26AS (TDS) data. Cross-checks declared income with ITR filings over 2-3 years.',
    input: {
      pan: { type: 'string', description: 'PAN number', required: true, value: s.pan },
      consent: { type: 'boolean', description: 'Consent for ITR pull', required: true, value: true },
    },
    output: {
      good: {
        result: {
          itrFiled: true,
          filingHistory: [
            { fy: '2024-25', totalIncome: 820000, taxPaid: 48000, filingDate: '2025-07-28', itrForm: 'ITR-1' },
            { fy: '2023-24', totalIncome: 750000, taxPaid: 39000, filingDate: '2024-07-15', itrForm: 'ITR-1' },
            { fy: '2022-23', totalIncome: 680000, taxPaid: 32000, filingDate: '2023-07-20', itrForm: 'ITR-1' },
          ],
          consecutiveYearsFiled: 3,
          incomeGrowthTrend: 'positive',
          averageAnnualIncome: 750000,
          tdsEntries26AS: 12,
          tdsMatchesItr: true,
          itrIncomeVsDeclared: { declared: s.monthlyIncome * 12, itrReported: 820000, ratio: 1.05 },
          verificationStatus: 'verified',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          itrFiled: true,
          filingHistory: [
            { fy: '2024-25', totalIncome: 280000, taxPaid: 0, filingDate: '2025-09-30', itrForm: 'ITR-4' },
          ],
          consecutiveYearsFiled: 1,
          incomeGrowthTrend: 'unknown',
          averageAnnualIncome: 280000,
          tdsEntries26AS: 2,
          tdsMatchesItr: false,
          itrIncomeVsDeclared: { declared: s.monthlyIncome * 12, itrReported: 280000, ratio: 0.78 },
          verificationStatus: 'partial',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          itrFiled: false,
          filingHistory: [],
          consecutiveYearsFiled: 0,
          incomeGrowthTrend: null,
          averageAnnualIncome: null,
          tdsEntries26AS: 0,
          tdsMatchesItr: false,
          itrIncomeVsDeclared: { declared: s.monthlyIncome * 12, itrReported: 0, ratio: 0 },
          verificationStatus: 'not_found',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  // ─── NEW: GST Verification ───
  apis.gstVerification = {
    id: 'gstVerification', name: 'GST Verification',
    endpoint: '/api/v3/gst/verify', method: 'POST', phase: 'B', category: 'income',
    description: 'Verifies GSTIN, checks filing history, revenue trends, and cross-checks with declared income (for self-employed).',
    input: {
      gstin: { type: 'string', description: 'GSTIN (15 chars)', required: true, value: s.gstin || 'N/A' },
      pan: { type: 'string', description: 'PAN for cross-check', required: true, value: s.pan },
    },
    output: {
      good: {
        result: {
          gstinProvided: false,
          applicable: false,
          reason: 'Salaried individual — GST not applicable',
          gstStatus: null,
          filingFrequency: null,
          lastFilingDate: null,
          annualTurnover: null,
          businessType: null,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          gstinProvided: true,
          applicable: true,
          reason: null,
          gstStatus: 'active',
          filingFrequency: 'irregular',
          lastFilingDate: '2025-09-15',
          annualTurnover: 1800000,
          turnoverTrend: 'declining',
          consecutiveFilings: 4,
          missedFilings: 3,
          businessType: 'retail_trade',
          panGstMatch: true,
          gstTurnoverVsDeclaredIncome: { ratio: 0.50, flag: 'income_lower_than_turnover_suggests' },
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          gstinProvided: true,
          applicable: true,
          reason: null,
          gstStatus: 'cancelled',
          filingFrequency: null,
          lastFilingDate: null,
          annualTurnover: null,
          turnoverTrend: null,
          consecutiveFilings: 0,
          missedFilings: null,
          businessType: null,
          panGstMatch: false,
          gstTurnoverVsDeclaredIncome: null,
        },
        statusCode: 200,
      },
    }[scenario],
  };


  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE C — Address + KYC + Legal + Fraud Ring
  // ═══════════════════════════════════════════════════════════════════════════

  apis.registeredAddress = {
    id: 'registeredAddress', name: 'Phone to Registered Address',
    endpoint: '/api/v3/phonekyc/phoneToRegisteredAddress', method: 'POST', phase: 'C', category: 'address',
    description: 'Fetches address registered against a mobile number from telecom records.',
    input: {
      phoneNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
    },
    output: {
      good: { result: { addressFound: true, registeredAddress: '42, MG Road, Koramangala, Bangalore, Karnataka - 560034', pincode: '560034', state: 'Karnataka', matchWithProvided: true, matchScore: 92 }, statusCode: 200 },
      risky: { result: { addressFound: true, registeredAddress: '45, Paota Industrial Area, Jodhpur, Rajasthan - 342006', pincode: '342006', state: 'Rajasthan', matchWithProvided: false, matchScore: 38 }, statusCode: 200 },
      fraud: { result: { addressFound: false, registeredAddress: null, pincode: null, state: null, matchWithProvided: false, matchScore: 0 }, statusCode: 200 },
    }[scenario],
  };

  apis.addressGeocode = {
    id: 'addressGeocode', name: 'Address Geocode Match',
    endpoint: '/api/v3/address-geocode-match', method: 'POST', phase: 'C', category: 'address',
    description: 'Geocodes address and matches against device coordinates. Detects border proximity.',
    input: {
      address: { type: 'string', description: 'Full address', required: true, value: s.address + ', ' + s.city + ', ' + s.state },
      latitude: { type: 'number', description: 'Device lat', required: false, value: scenario === 'good' ? 12.9352 : scenario === 'risky' ? 26.2389 : 34.0837 },
      longitude: { type: 'number', description: 'Device lng', required: false, value: scenario === 'good' ? 77.6245 : scenario === 'risky' ? 73.0243 : 74.7973 },
    },
    output: {
      good: { result: { geocodedAddress: '42, MG Road, Koramangala, Bangalore', geocodedLat: 12.9354, geocodedLng: 77.6247, confidence: 0.94, distanceFromDevice: 0.3, isInternationalBorder: false, nearestBorderDistance: 850, matchLevel: 'exact' }, statusCode: 200 },
      risky: { result: { geocodedAddress: 'Railway Colony, Jodhpur, Rajasthan', geocodedLat: 26.2750, geocodedLng: 73.0080, confidence: 0.62, distanceFromDevice: 12.5, isInternationalBorder: false, nearestBorderDistance: 180, matchLevel: 'partial' }, statusCode: 200 },
      fraud: { result: { geocodedAddress: 'Srinagar, Jammu & Kashmir', geocodedLat: 34.0837, geocodedLng: 74.7973, confidence: 0.31, distanceFromDevice: 0.5, isInternationalBorder: true, nearestBorderDistance: 35, matchLevel: 'city_only' }, statusCode: 200 },
    }[scenario],
  };

  apis.pincodeDetails = {
    id: 'pincodeDetails', name: 'Pincode Details',
    endpoint: '/api/v3/pincode-details', method: 'POST', phase: 'C', category: 'address',
    description: 'Retrieves demographics for a pincode: population, urban/rural, serviceability, blacklist status.',
    input: { pincode: { type: 'string', description: '6-digit pincode', required: true, value: s.pincode } },
    output: {
      good: { result: { pincode: '560034', area: 'Koramangala', city: 'Bangalore', district: 'Bangalore Urban', state: 'Karnataka', type: 'urban', population: 'high_density', isServiceable: true, isBlacklisted: false, riskCategory: 'low' }, statusCode: 200 },
      risky: { result: { pincode: '342001', area: 'Jodhpur City', city: 'Jodhpur', district: 'Jodhpur', state: 'Rajasthan', type: 'urban', population: 'medium_density', isServiceable: true, isBlacklisted: false, riskCategory: 'medium' }, statusCode: 200 },
      fraud: { result: { pincode: '190001', area: 'Srinagar GPO', city: 'Srinagar', district: 'Srinagar', state: 'Jammu & Kashmir', type: 'urban', population: 'medium_density', isServiceable: false, isBlacklisted: true, riskCategory: 'high' }, statusCode: 200 },
    }[scenario],
  };

  apis.geoFencing = {
    id: 'geoFencing', name: 'Geo Fencing',
    endpoint: '/api/v2/patrons/geofencing', method: 'POST', phase: 'C', category: 'address',
    description: 'Validates IP geolocation against claimed location. Detects VPN/proxy/Tor.',
    input: {
      ip: { type: 'string', description: 'Client IP', required: true, value: s.ipAddress },
      country: { type: 'string', description: 'Expected country', required: true, value: 'India' },
      state: { type: 'string', description: 'Expected state', required: false, value: s.state },
    },
    output: {
      good: { result: { ipCountry: 'India', ipState: 'Karnataka', ipCity: 'Bangalore', ipIsp: 'ACT Fibernet', isVpn: false, isProxy: false, isTor: false, isDatacenter: false, geoMatch: true, stateMatch: true, riskLevel: 'low', threatScore: 5 }, statusCode: 200 },
      risky: { result: { ipCountry: 'India', ipState: 'Maharashtra', ipCity: 'Mumbai', ipIsp: 'Jio 4G', isVpn: false, isProxy: false, isTor: false, isDatacenter: false, geoMatch: true, stateMatch: false, riskLevel: 'medium', threatScore: 35 }, statusCode: 200 },
      fraud: { result: { ipCountry: 'Germany', ipState: 'Bavaria', ipCity: 'Nuremberg', ipIsp: 'Tor Exit Node', isVpn: true, isProxy: true, isTor: true, isDatacenter: true, geoMatch: false, stateMatch: false, riskLevel: 'critical', threatScore: 98 }, statusCode: 200 },
    }[scenario],
  };

  apis.digitalIntegrity = {
    id: 'digitalIntegrity', name: 'Digital Integrity Check',
    endpoint: '/api/v2/patrons/digital-integrity', method: 'POST', phase: 'C', category: 'phoneDigital',
    description: 'Cross-validates email, phone, IP for consistency. Checks disposable emails, blocklisted IPs, bot activity.',
    input: {
      email: { type: 'string', description: 'Email', required: true, value: s.email },
      phone: { type: 'string', description: 'Phone', required: true, value: s.phone },
      ip: { type: 'string', description: 'IP', required: true, value: s.ipAddress },
    },
    output: {
      good: { result: { emailValid: true, emailDisposable: false, emailDomain: 'gmail.com', emailDomainAge: '1998-09-15', emailBlocklisted: false, phoneValid: true, phoneBlocklisted: false, ipBlocklisted: false, ipThreatLevel: 'none', botLikelihood: 0.02, overallIntegrity: 'high', integrityScore: 92 }, statusCode: 200 },
      risky: { result: { emailValid: true, emailDisposable: false, emailDomain: 'yahoo.co.in', emailDomainAge: '1997-01-18', emailBlocklisted: false, phoneValid: true, phoneBlocklisted: false, ipBlocklisted: false, ipThreatLevel: 'low', botLikelihood: 0.15, overallIntegrity: 'medium', integrityScore: 58 }, statusCode: 200 },
      fraud: { result: { emailValid: false, emailDisposable: true, emailDomain: 'tempmail.org', emailDomainAge: '2023-06-01', emailBlocklisted: true, phoneValid: false, phoneBlocklisted: true, ipBlocklisted: true, ipThreatLevel: 'critical', botLikelihood: 0.88, overallIntegrity: 'very_low', integrityScore: 5 }, statusCode: 200 },
    }[scenario],
  };

  apis.eAadhaarXml = {
    id: 'eAadhaarXml', name: 'Get e-Aadhaar XML',
    endpoint: '/api/v3/eaadhaar/get-xml', method: 'POST', phase: 'C', category: 'identity',
    description: 'Retrieves and parses e-Aadhaar XML data with digital signature validation.',
    input: {
      requestId: { type: 'string', description: 'KYC request ID', required: true, value: 'REQ-' + s.phone },
      shareCode: { type: 'string', description: '4-digit share code', required: true, value: '1234' },
    },
    output: {
      good: { result: { aadhaarValid: true, name: 'Rajesh Kumar', dob: '1990-05-15', gender: 'Male', address: '42, MG Road, Koramangala, Bangalore - 560034', photo: '[base64_photo_data]', digitalSignatureValid: true, issueDate: '2023-08-10' }, statusCode: 200 },
      risky: { result: { aadhaarValid: true, name: 'Deepak Sharma', dob: '1985-11-22', gender: 'Male', address: '17, Railway Colony, Jodhpur - 342001', photo: '[base64_photo_data]', digitalSignatureValid: true, issueDate: '2021-02-14' }, statusCode: 200 },
      fraud: { result: { aadhaarValid: false, name: null, dob: null, gender: null, address: null, photo: null, digitalSignatureValid: false, issueDate: null }, statusCode: 400 },
    }[scenario],
  };

  apis.digilockerDetails = {
    id: 'digilockerDetails', name: 'Get Details (DigiLocker)',
    endpoint: '/api/v3/digilocker/get-details', method: 'POST', phase: 'C', category: 'identity',
    description: 'Retrieves documents linked to DigiLocker account.',
    input: { requestId: { type: 'string', description: 'DigiLocker auth request ID', required: true, value: 'DL-REQ-' + s.phone } },
    output: {
      good: { result: { linkedDocuments: [{ type: 'Aadhaar', issuer: 'UIDAI', status: 'verified' }, { type: 'PAN Card', issuer: 'Income Tax Dept', status: 'verified' }, { type: 'Driving Licence', issuer: 'RTO Karnataka', status: 'verified' }, { type: 'Class 10 Marksheet', issuer: 'CBSE', status: 'verified' }], totalDocuments: 4, accountActive: true, lastAccessed: '2026-03-01' }, statusCode: 200 },
      risky: { result: { linkedDocuments: [{ type: 'Aadhaar', issuer: 'UIDAI', status: 'verified' }, { type: 'PAN Card', issuer: 'Income Tax Dept', status: 'verified' }], totalDocuments: 2, accountActive: true, lastAccessed: '2025-07-20' }, statusCode: 200 },
      fraud: { result: { linkedDocuments: [], totalDocuments: 0, accountActive: false, lastAccessed: null }, statusCode: 200 },
    }[scenario],
  };

  // ─── NEW: Court & Legal Records ───
  apis.courtRecords = {
    id: 'courtRecords', name: 'Court & Legal Records Check',
    endpoint: '/api/v3/legal/court-records', method: 'POST', phase: 'C', category: 'legal',
    description: 'Searches CERSAI, RBI wilful defaulter list, court case database, and SEBI debarment list.',
    input: {
      name: { type: 'string', description: 'Full name', required: true, value: s.firstName + ' ' + s.lastName },
      pan: { type: 'string', description: 'PAN number', required: true, value: s.pan },
      dob: { type: 'string', description: 'Date of birth', required: false, value: s.dob },
      fatherName: { type: 'string', description: 'Father name (optional)', required: false, value: null },
    },
    output: {
      good: {
        result: {
          cersaiCheck: { registered: false, securedAssets: 0 },
          wilfulDefaulter: { isDefaulter: false, source: 'RBI', lastChecked: '2026-03-01' },
          courtCases: { totalFound: 0, civilCases: 0, criminalCases: 0, pendingCases: 0, recentCases: [] },
          sebiDebarment: { isDebarred: false },
          insolvencyCheck: { isBankrupt: false, ncltCases: 0 },
          overallLegalRisk: 'clean',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          cersaiCheck: { registered: true, securedAssets: 1 },
          wilfulDefaulter: { isDefaulter: false, source: 'RBI', lastChecked: '2026-03-01' },
          courtCases: { totalFound: 2, civilCases: 2, criminalCases: 0, pendingCases: 1, recentCases: [{ caseType: 'civil', court: 'District Court Jodhpur', year: 2024, status: 'pending', description: 'Recovery suit by microfinance lender' }] },
          sebiDebarment: { isDebarred: false },
          insolvencyCheck: { isBankrupt: false, ncltCases: 0 },
          overallLegalRisk: 'moderate',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          cersaiCheck: { registered: false, securedAssets: 0 },
          wilfulDefaulter: { isDefaulter: true, source: 'RBI', lastChecked: '2026-03-01' },
          courtCases: { totalFound: 5, civilCases: 2, criminalCases: 3, pendingCases: 4, recentCases: [{ caseType: 'criminal', court: 'Sessions Court', year: 2025, status: 'pending', description: 'Cheating & forgery under IPC 420' }, { caseType: 'criminal', court: 'District Court', year: 2025, status: 'pending', description: 'Identity fraud under IT Act' }] },
          sebiDebarment: { isDebarred: false },
          insolvencyCheck: { isBankrupt: false, ncltCases: 1 },
          overallLegalRisk: 'critical',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  // ─── NEW: Fraud Ring / Network Graph ───
  apis.fraudRingDetection = {
    id: 'fraudRingDetection', name: 'Fraud Ring / Network Graph',
    endpoint: '/api/v3/fraud/network-graph', method: 'POST', phase: 'C', category: 'fraud',
    description: 'Analyzes connections between applicants: shared phone/address/device/bank. Detects fraud ring clusters and referral chain anomalies.',
    input: {
      pan: { type: 'string', description: 'PAN', required: true, value: s.pan },
      phone: { type: 'string', description: 'Phone', required: true, value: s.phone },
      email: { type: 'string', description: 'Email', required: true, value: s.email },
      deviceId: { type: 'string', description: 'Device ID', required: true, value: s.deviceId },
      accountNumber: { type: 'string', description: 'Bank account', required: true, value: s.accountNumber },
      address: { type: 'string', description: 'Address', required: true, value: s.address },
    },
    output: {
      good: {
        result: {
          clusterSize: 1,
          connectedApplicants: 0,
          sharedAttributes: [],
          referralChainLength: 0,
          referralChainAnomaly: false,
          commonEmployerCluster: false,
          commonEmployerClusterSize: 0,
          networkRisk: 'none',
          graphDensity: 0.0,
          suspiciousPatterns: [],
        },
        statusCode: 200,
      },
      risky: {
        result: {
          clusterSize: 4,
          connectedApplicants: 3,
          sharedAttributes: ['shared_ip_2_applicants', 'shared_employer_3_applicants'],
          referralChainLength: 2,
          referralChainAnomaly: false,
          commonEmployerCluster: true,
          commonEmployerClusterSize: 3,
          networkRisk: 'elevated',
          graphDensity: 0.35,
          suspiciousPatterns: ['employer_cluster_spike'],
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          clusterSize: 18,
          connectedApplicants: 17,
          sharedAttributes: ['shared_device_8_applicants', 'shared_ip_12_applicants', 'shared_address_5_applicants', 'shared_bank_account_3_applicants', 'shared_phone_prefix_15_applicants'],
          referralChainLength: 6,
          referralChainAnomaly: true,
          commonEmployerCluster: false,
          commonEmployerClusterSize: 0,
          networkRisk: 'critical',
          graphDensity: 0.82,
          suspiciousPatterns: ['device_farm_detected', 'address_farm_detected', 'rapid_cluster_growth', 'bank_mule_pattern'],
        },
        statusCode: 200,
      },
    }[scenario],
  };


  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE D — Bank + Document + Bank Statement + Device + Product-Aware
  // ═══════════════════════════════════════════════════════════════════════════

  apis.bankVerification = {
    id: 'bankVerification', name: 'Hybrid Bank Account Verification',
    endpoint: '/api/v3/bank/hybrid-verification', method: 'POST', phase: 'D', category: 'financial',
    description: 'Verifies bank account via penny drop + reverse penny drop. Confirms account active and name match.',
    input: {
      accountNumber: { type: 'string', description: 'Account number', required: true, value: s.accountNumber },
      ifsc: { type: 'string', description: 'IFSC code', required: true, value: s.ifsc },
      name: { type: 'string', description: 'Expected holder name', required: true, value: s.firstName + ' ' + s.lastName },
      mobile: { type: 'string', description: 'Mobile', required: false, value: s.phone },
    },
    output: {
      good: { result: { accountExists: true, accountActive: true, nameOnAccount: 'Rajesh Kumar', nameMatch: true, nameMatchScore: 98, accountType: 'savings', bankName: 'State Bank of India', branch: 'Koramangala Branch', pennyDropStatus: 'success', reversePennyDrop: 'verified', upiLinked: true }, statusCode: 200 },
      risky: { result: { accountExists: true, accountActive: true, nameOnAccount: 'Deepak K Sharma', nameMatch: true, nameMatchScore: 72, accountType: 'savings', bankName: 'Punjab National Bank', branch: 'Jodhpur Main', pennyDropStatus: 'success', reversePennyDrop: 'not_verified', upiLinked: false }, statusCode: 200 },
      fraud: { result: { accountExists: false, accountActive: false, nameOnAccount: null, nameMatch: false, nameMatchScore: 0, accountType: null, bankName: null, branch: null, pennyDropStatus: 'failed', reversePennyDrop: 'failed', upiLinked: false }, statusCode: 200 },
    }[scenario],
  };

  apis.ifscSearch = {
    id: 'ifscSearch', name: 'Search Bank by IFSC',
    endpoint: '/api/v3/bank/ifsc-search', method: 'POST', phase: 'D', category: 'financial',
    description: 'Validates IFSC code and returns bank branch details.',
    input: { ifscCode: { type: 'string', description: '11-char IFSC', required: true, value: s.ifsc } },
    output: {
      good: { result: { valid: true, bankName: 'State Bank of India', branch: 'Koramangala', city: 'Bangalore', state: 'Karnataka', micr: '560002045', neftEnabled: true, rtgsEnabled: true, impsEnabled: true }, statusCode: 200 },
      risky: { result: { valid: true, bankName: 'Punjab National Bank', branch: 'Jodhpur Main', city: 'Jodhpur', state: 'Rajasthan', micr: '342024002', neftEnabled: true, rtgsEnabled: true, impsEnabled: true }, statusCode: 200 },
      fraud: { result: { valid: false, bankName: null, branch: null, city: null, state: null, micr: null, neftEnabled: false, rtgsEnabled: false, impsEnabled: false }, statusCode: 200 },
    }[scenario],
  };

  apis.imeiFetch = {
    id: 'imeiFetch', name: 'IMEI Fetch',
    endpoint: '/api/v3/imei/fetch', method: 'POST', phase: 'D', category: 'device',
    description: 'Validates device IMEI: stolen/lost check, make/model, device age.',
    input: { imei: { type: 'string', description: '15-digit IMEI', required: true, value: s.imei } },
    output: {
      good: { result: { valid: true, brand: 'Samsung', model: 'Galaxy S23', deviceAge: '1.5 years', manufactureYear: 2024, isStolen: false, isLost: false, isBlacklisted: false, tac: '35245678', deviceType: 'smartphone' }, statusCode: 200 },
      risky: { result: { valid: true, brand: 'Xiaomi', model: 'Redmi 9', deviceAge: '4 years', manufactureYear: 2022, isStolen: false, isLost: false, isBlacklisted: false, tac: '86123456', deviceType: 'smartphone' }, statusCode: 200 },
      fraud: { result: { valid: false, brand: null, model: null, deviceAge: null, manufactureYear: null, isStolen: true, isLost: true, isBlacklisted: true, tac: '00000000', deviceType: 'unknown' }, statusCode: 200 },
    }[scenario],
  };

  apis.forgeryCheck = {
    id: 'forgeryCheck', name: 'Advance Forgery Lite',
    endpoint: '/api/v3/document/forgery-check', method: 'POST', phase: 'D', category: 'document',
    description: 'Analyzes uploaded documents for digital forgery or tampering signs.',
    input: {
      imageUrl: { type: 'string', description: 'Document image URL/base64', required: true, value: 'https://storage.finz.com/docs/' + s.pan + '_pancard.jpg' },
      threshold: { type: 'number', description: 'Detection threshold', required: false, value: 0.5 },
    },
    output: {
      good: { result: { status: 'genuine', forgeryScore: 0.08, confidence: 0.96, anomalies: [], metadataConsistent: true, fontConsistency: 'high', edgeAnalysis: 'clean', exifIntact: true }, statusCode: 200 },
      risky: { result: { status: 'suspicious', forgeryScore: 0.45, confidence: 0.71, anomalies: ['font_inconsistency_detected', 'jpeg_compression_artifacts'], metadataConsistent: true, fontConsistency: 'medium', edgeAnalysis: 'minor_artifacts', exifIntact: false }, statusCode: 200 },
      fraud: { result: { status: 'forged', forgeryScore: 0.92, confidence: 0.98, anomalies: ['text_overlay_detected', 'photoshop_signature', 'inconsistent_lighting', 'copy_paste_regions', 'metadata_stripped'], metadataConsistent: false, fontConsistency: 'low', edgeAnalysis: 'tampered', exifIntact: false }, statusCode: 200 },
    }[scenario],
  };

  // ─── NEW: Bank Statement Analysis (Account Aggregator) ───
  apis.bankStatementAnalysis = {
    id: 'bankStatementAnalysis', name: 'Bank Statement Analysis (AA)',
    endpoint: '/api/v3/account-aggregator/bank-statement', method: 'POST', phase: 'D', category: 'bankStatement',
    description: 'Fetches 6-12 months of bank transactions via Account Aggregator. Analyzes salary credits, EMI debits, average balance, bounce rate, cash flow volatility, and suspicious transactions.',
    input: {
      accountNumber: { type: 'string', description: 'Bank account', required: true, value: s.accountNumber },
      ifsc: { type: 'string', description: 'IFSC code', required: true, value: s.ifsc },
      consentHandle: { type: 'string', description: 'AA consent handle', required: true, value: 'AA-CONSENT-' + s.phone },
      months: { type: 'number', description: 'Months of data (6-12)', required: false, value: 6 },
    },
    output: {
      good: {
        result: {
          monthsAnalyzed: 6,
          salaryCredits: {
            detected: true,
            frequency: 'monthly',
            averageAmount: 64800,
            variance: 0.02,
            employer: 'Infosys Technologies',
            lastCreditDate: '2026-02-28',
            missedMonths: 0,
          },
          emiDebits: {
            detected: true,
            totalMonthlyEmi: 7800,
            emiAccounts: [{ lender: 'Bajaj Finance', amount: 7800, status: 'regular' }],
            bounced: 0,
          },
          averageMonthlyBalance: 42500,
          minBalance: 12000,
          maxBalance: 185000,
          averageMonthlyInflow: 78000,
          averageMonthlyOutflow: 62000,
          cashFlowVolatility: 0.12,
          bounceRate: 0.0,
          chequeBounces: 0,
          mandateBounces: 0,
          suspiciousTransactions: [],
          gamblingTransactions: 0,
          cryptoTransactions: 0,
          cashDepositsAboveThreshold: 0,
          circularTransactions: false,
          endOfDayBalanceTrend: 'stable',
          daysWithZeroBalance: 0,
          overallHealth: 'excellent',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          monthsAnalyzed: 6,
          salaryCredits: {
            detected: false,
            frequency: 'irregular',
            averageAmount: 28000,
            variance: 0.45,
            employer: null,
            lastCreditDate: '2026-01-15',
            missedMonths: 2,
          },
          emiDebits: {
            detected: true,
            totalMonthlyEmi: 11500,
            emiAccounts: [{ lender: 'Muthoot Finance', amount: 8000, status: 'irregular' }, { lender: 'SBI Card', amount: 3500, status: 'regular' }],
            bounced: 2,
          },
          averageMonthlyBalance: 8200,
          minBalance: -1500,
          maxBalance: 45000,
          averageMonthlyInflow: 35000,
          averageMonthlyOutflow: 38000,
          cashFlowVolatility: 0.58,
          bounceRate: 0.08,
          chequeBounces: 1,
          mandateBounces: 2,
          suspiciousTransactions: [],
          gamblingTransactions: 0,
          cryptoTransactions: 2,
          cashDepositsAboveThreshold: 3,
          circularTransactions: false,
          endOfDayBalanceTrend: 'declining',
          daysWithZeroBalance: 8,
          overallHealth: 'stressed',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          monthsAnalyzed: 6,
          salaryCredits: {
            detected: false,
            frequency: null,
            averageAmount: null,
            variance: null,
            employer: null,
            lastCreditDate: null,
            missedMonths: 6,
          },
          emiDebits: {
            detected: false,
            totalMonthlyEmi: 0,
            emiAccounts: [],
            bounced: 0,
          },
          averageMonthlyBalance: 500,
          minBalance: 0,
          maxBalance: 510000,
          averageMonthlyInflow: 520000,
          averageMonthlyOutflow: 519500,
          cashFlowVolatility: 0.95,
          bounceRate: 0.0,
          chequeBounces: 0,
          mandateBounces: 0,
          suspiciousTransactions: [
            { type: 'large_cash_deposit', amount: 500000, date: '2026-02-10' },
            { type: 'immediate_withdrawal', amount: 499500, date: '2026-02-10' },
          ],
          gamblingTransactions: 0,
          cryptoTransactions: 0,
          cashDepositsAboveThreshold: 1,
          circularTransactions: true,
          endOfDayBalanceTrend: 'flat_near_zero',
          daysWithZeroBalance: 25,
          overallHealth: 'suspicious',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  // ─── NEW: Product-Aware Risk Adjustment ───
  apis.productRiskAdjust = {
    id: 'productRiskAdjust', name: 'Product-Aware Risk Adjustment',
    endpoint: '/internal/risk/product-adjust', method: 'POST', phase: 'D', category: 'productAware',
    description: 'Adjusts risk based on loan product parameters: amount tier, tenure risk, repeat borrower status, and segment-specific thresholds.',
    input: {
      loanAmount: { type: 'number', description: 'Requested loan amount', required: true, value: s.loanAmount },
      tenure: { type: 'number', description: 'Tenure in months', required: true, value: s.tenure },
      interestRate: { type: 'number', description: 'Annual interest rate', required: true, value: s.interestRate },
      repeatBorrower: { type: 'string', description: 'Repeat borrower status', required: true, value: s.repeatBorrower },
    },
    output: {
      good: {
        result: {
          amountTier: 'medium',
          amountRisk: 'standard',
          tenureRiskMultiplier: 1.0,
          tenureCategory: 'short',
          repeatBorrowerBonus: 0,
          repeatBorrowerStatus: 'first_time',
          firstTimeBorrowerPenalty: 5,
          productSegment: 'personal_loan',
          suggestedMaxLoan: 300000,
          loanToIncomeRatio: 0.26,
          overallProductRisk: 'low',
          adjustmentPoints: -5,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          amountTier: 'medium',
          amountRisk: 'elevated',
          tenureRiskMultiplier: 1.0,
          tenureCategory: 'short',
          repeatBorrowerBonus: -15,
          repeatBorrowerStatus: 'repeat_with_issues',
          firstTimeBorrowerPenalty: 0,
          productSegment: 'personal_loan',
          suggestedMaxLoan: 80000,
          loanToIncomeRatio: 0.56,
          overallProductRisk: 'high',
          adjustmentPoints: -25,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          amountTier: 'high',
          amountRisk: 'very_high',
          tenureRiskMultiplier: 1.3,
          tenureCategory: 'short',
          repeatBorrowerBonus: 0,
          repeatBorrowerStatus: 'first_time',
          firstTimeBorrowerPenalty: 10,
          productSegment: 'personal_loan',
          suggestedMaxLoan: 0,
          loanToIncomeRatio: 0.21,
          overallProductRisk: 'extreme',
          adjustmentPoints: -50,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  return apis;
}
