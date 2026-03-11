/**
 * FinZ Risk Engine Simulator — Mock API Data
 *
 * This file defines:
 *   1. Input parameters required for each Signzy API
 *   2. Simulated output responses with realistic dummy data
 *   3. Scenario presets (good applicant, risky applicant, fraudulent applicant)
 *
 * Each API entry follows the schema:
 *   {
 *     id:          unique key
 *     name:        display name
 *     endpoint:    Signzy API path
 *     method:      HTTP method
 *     phase:       which risk phase (A/B/C/D)
 *     category:    which scoring category it feeds
 *     description: what this API checks
 *     input:       { paramName: { type, description, required, example } }
 *     output:      simulated response object (varies by scenario)
 *   }
 */

// ─── Scenario Presets ────────────────────────────────────────────────────────

const SCENARIOS = {
  good: {
    label: 'Good Applicant',
    description: 'Salaried professional, clean history, strong digital footprint',
    applicant: {
      firstName: 'Rajesh', lastName: 'Kumar', dob: '1990-05-15',
      email: 'rajesh.kumar@gmail.com', phone: '9876543210',
      pan: 'ABCPK1234A', aadhaarLast4: '5678',
      address: '42, MG Road, Koramangala', city: 'Bangalore',
      state: 'Karnataka', pincode: '560034',
      accountNumber: '1234567890123', ifsc: 'SBIN0001234',
      monthlyIncome: 65000, existingEmi: 8000,
      loanAmount: 200000, tenure: 12, interestRate: 14,
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
      pan: 'BRSPS5678B', aadhaarLast4: '9012',
      address: '17, Railway Colony', city: 'Jodhpur',
      state: 'Rajasthan', pincode: '342001',
      accountNumber: '9876543210987', ifsc: 'PUNB0123400',
      monthlyIncome: 30000, existingEmi: 12000,
      loanAmount: 200000, tenure: 12, interestRate: 14,
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
      pan: 'ZZZZZ9999Z', aadhaarLast4: '0000',
      address: '999, Unknown Layout', city: 'Srinagar',
      state: 'Jammu & Kashmir', pincode: '190001',
      accountNumber: '0000000000001', ifsc: 'ABCD0000000',
      monthlyIncome: 200000, existingEmi: 0,
      loanAmount: 500000, tenure: 6, interestRate: 14,
      imei: '000000000000000', ipAddress: '185.220.101.34',
      deviceId: 'xx-fake-device-xx',
    },
  },
};


// ─── API Definitions with Input/Output Schemas ──────────────────────────────

function generateApiResponses(scenario) {
  const s = SCENARIOS[scenario].applicant;
  const apis = {};

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE A — Identity + Digital Trust  (triggered after PAN + phone collected)
  // ═══════════════════════════════════════════════════════════════════════════

  apis.panFetch = {
    id: 'panFetch',
    name: 'PAN Fetch V2',
    endpoint: '/api/v3/pan/fetchV2',
    method: 'POST',
    phase: 'A',
    category: 'identity',
    description: 'Validates PAN card and retrieves holder details, tax compliance, and Aadhaar seeding status.',
    input: {
      pan: { type: 'string', description: 'PAN number (10 chars)', required: true, value: s.pan },
    },
    output: {
      good: {
        result: {
          isValid: true,
          panStatusLabel: 'VALID',
          firstName: 'RAJESH', middleName: '', lastName: 'KUMAR',
          typeOfHolder: 'Individual', isIndividual: true,
          aadhaarSeedingStatus: 'Yes',
          individualTaxComplianceStatus: 'Operative',
          lastUpdated: '2025-12-01',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          isValid: true,
          panStatusLabel: 'VALID',
          firstName: 'DEEPAK', middleName: '', lastName: 'SHARMA',
          typeOfHolder: 'Individual', isIndividual: true,
          aadhaarSeedingStatus: 'No',
          individualTaxComplianceStatus: 'Inoperative',
          lastUpdated: '2024-03-15',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          isValid: false,
          panStatusLabel: 'FAKE',
          firstName: '', middleName: '', lastName: '',
          typeOfHolder: 'Unknown', isIndividual: false,
          aadhaarSeedingStatus: 'No',
          individualTaxComplianceStatus: 'Not Available',
          lastUpdated: null,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.phoneToPan = {
    id: 'phoneToPan',
    name: 'Phone to PAN',
    endpoint: '/api/v3/phonekyc/phoneToPan',
    method: 'POST',
    phase: 'A',
    category: 'identity',
    description: 'Looks up PAN number associated with a mobile number. Cross-references with provided PAN.',
    input: {
      phoneNumber: { type: 'string', description: 'Indian mobile number (10 digits)', required: true, value: s.phone },
      firstName: { type: 'string', description: 'Borrower first name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Borrower last name', required: true, value: s.lastName },
    },
    output: {
      good: {
        result: { pan: 'ABCPK1234A', name: 'Rajesh Kumar', gender: 'M', dob: '15-05-1990', matchFound: true },
        statusCode: 200,
      },
      risky: {
        result: { pan: null, name: null, gender: null, dob: null, matchFound: false },
        statusCode: 200,
      },
      fraud: {
        result: { pan: null, name: null, gender: null, dob: null, matchFound: false },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.phoneIntelligence = {
    id: 'phoneIntelligence',
    name: 'Phone Intelligence',
    endpoint: '/api/v3/phone-intelligence',
    method: 'POST',
    phase: 'A',
    category: 'phoneDigital',
    description: 'Comprehensive phone risk analysis: carrier info, line type, risk scoring, blocklist check, SIM swap detection.',
    input: {
      phoneNumber: { type: 'string', description: 'Phone number with country code', required: true, value: '+91' + s.phone },
      originatingIp: { type: 'string', description: 'Session IP address', required: false, value: s.ipAddress },
      emailAddress: { type: 'string', description: 'Applicant email', required: false, value: s.email },
      deviceId: { type: 'string', description: 'Device identifier', required: false, value: s.deviceId },
    },
    output: {
      good: {
        result: {
          riskScore: 120,
          riskLevel: 'low',
          phoneType: 'mobile',
          carrier: 'Airtel',
          lineType: 'postpaid',
          isBlocklisted: false,
          simSwapDetected: false,
          simSwapLastDate: null,
          accountTenure: '5+ years',
          isPorted: false,
          isRoaming: false,
          countryCode: 'IN',
          fraudSources: [],
        },
        statusCode: 200,
      },
      risky: {
        result: {
          riskScore: 520,
          riskLevel: 'medium',
          phoneType: 'mobile',
          carrier: 'BSNL',
          lineType: 'prepaid',
          isBlocklisted: false,
          simSwapDetected: true,
          simSwapLastDate: '2026-01-15',
          accountTenure: '6 months',
          isPorted: true,
          isRoaming: false,
          countryCode: 'IN',
          fraudSources: [],
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          riskScore: 890,
          riskLevel: 'very_high',
          phoneType: 'voip',
          carrier: 'Unknown',
          lineType: 'virtual',
          isBlocklisted: true,
          simSwapDetected: false,
          simSwapLastDate: null,
          accountTenure: 'unknown',
          isPorted: false,
          isRoaming: true,
          countryCode: 'IN',
          fraudSources: ['fraud_report_2025_aug', 'spam_db_flagged'],
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.whatsappPresence = {
    id: 'whatsappPresence',
    name: 'WhatsApp Presence',
    endpoint: '/api/v3/whatsapp-presence',
    method: 'POST',
    phase: 'A',
    category: 'phoneDigital',
    description: 'Checks if a phone number is registered on WhatsApp and whether it is a personal or business account.',
    input: {
      mobile: { type: 'string', description: 'Mobile number (10 digits)', required: true, value: s.phone },
    },
    output: {
      good: {
        result: { isRegistered: true, accountType: 'personal', profileExists: true },
        statusCode: 200,
      },
      risky: {
        result: { isRegistered: true, accountType: 'business', profileExists: true },
        statusCode: 200,
      },
      fraud: {
        result: { isRegistered: false, accountType: null, profileExists: false },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.digitalIdentityScore = {
    id: 'digitalIdentityScore',
    name: 'Digital Identity Score',
    endpoint: '/api/v3/digital-identity-score',
    method: 'POST',
    phase: 'A',
    category: 'phoneDigital',
    description: 'Calculates a composite digital identity score based on phone, email, and digital presence across e-commerce and social platforms.',
    input: {
      phone: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      email: { type: 'string', description: 'Email address', required: true, value: s.email },
      name: { type: 'string', description: 'Full name', required: false, value: s.firstName + ' ' + s.lastName },
      pincode: { type: 'string', description: 'Postal code', required: false, value: s.pincode },
    },
    output: {
      good: {
        result: {
          score: 8.2,
          maxScore: 10,
          phoneFirstSeen: '2019-03-20',
          emailFirstSeen: '2015-08-10',
          ecomPresence: ['amazon', 'flipkart', 'swiggy', 'zomato'],
          socialPresence: ['linkedin', 'instagram'],
          nameEmailMatch: true,
          phoneEmailLinked: true,
          riskBand: 'low',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          score: 4.5,
          maxScore: 10,
          phoneFirstSeen: '2025-09-01',
          emailFirstSeen: '2024-12-05',
          ecomPresence: ['flipkart'],
          socialPresence: [],
          nameEmailMatch: false,
          phoneEmailLinked: false,
          riskBand: 'medium',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          score: 1.1,
          maxScore: 10,
          phoneFirstSeen: null,
          emailFirstSeen: null,
          ecomPresence: [],
          socialPresence: [],
          nameEmailMatch: false,
          phoneEmailLinked: false,
          riskBand: 'very_high',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.phoneToAlternate = {
    id: 'phoneToAlternate',
    name: 'Phone to Alternate Phone',
    endpoint: '/api/v3/phonekyc/phoneToAlternatePhone',
    method: 'POST',
    phase: 'A',
    category: 'device',
    description: 'Finds alternate phone numbers associated with an individual, indicating how many SIMs/numbers they use.',
    input: {
      phoneNumber: { type: 'string', description: 'Primary mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      pan: { type: 'string', description: 'PAN number', required: false, value: s.pan },
    },
    output: {
      good: {
        result: {
          alternatePhones: [{ number: '9876500001', carrier: 'Jio', status: 'active' }],
          totalFound: 1,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          alternatePhones: [
            { number: '7012300001', carrier: 'BSNL', status: 'active' },
            { number: '7012300002', carrier: 'Vi', status: 'active' },
            { number: '8899001122', carrier: 'Airtel', status: 'inactive' },
            { number: '9001122334', carrier: 'Jio', status: 'active' },
          ],
          totalFound: 4,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          alternatePhones: [
            { number: '6000000002', carrier: 'Unknown', status: 'active' },
            { number: '6000000003', carrier: 'Unknown', status: 'active' },
            { number: '6000000004', carrier: 'Unknown', status: 'active' },
            { number: '6000000005', carrier: 'Unknown', status: 'active' },
            { number: '6000000006', carrier: 'Unknown', status: 'active' },
            { number: '6000000007', carrier: 'Unknown', status: 'inactive' },
          ],
          totalFound: 6,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.phoneToIdentity = {
    id: 'phoneToIdentity',
    name: 'Phone to Identity Details',
    endpoint: '/api/v3/phonekyc/phoneToIdentityDetails',
    method: 'POST',
    phase: 'A',
    category: 'identity',
    description: 'Retrieves identity documents (DL, Voter ID, Passport) linked to a phone number.',
    input: {
      phoneNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      pan: { type: 'string', description: 'PAN number', required: false, value: s.pan },
    },
    output: {
      good: {
        result: {
          identities: [
            { type: 'driving_licence', number: 'KA05-XXXX-1234', state: 'Karnataka', valid: true },
            { type: 'voter_id', number: 'ABC1234567', state: 'Karnataka', valid: true },
          ],
          nameOnRecords: 'Rajesh Kumar',
          gender: 'Male',
          dob: '1990-05-15',
          consistencyScore: 95,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          identities: [
            { type: 'voter_id', number: 'RJ9876543', state: 'Rajasthan', valid: true },
          ],
          nameOnRecords: 'Deepak Sharma',
          gender: 'Male',
          dob: '1985-11-22',
          consistencyScore: 72,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          identities: [],
          nameOnRecords: null,
          gender: null,
          dob: null,
          consistencyScore: 0,
        },
        statusCode: 200,
      },
    }[scenario],
  };


  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE B — Income + Employment  (triggered after income data collected)
  // ═══════════════════════════════════════════════════════════════════════════

  apis.phoneToIncome = {
    id: 'phoneToIncome',
    name: 'Phone to Income',
    endpoint: '/api/v3/phonekyc/phoneToIncome',
    method: 'POST',
    phase: 'B',
    category: 'income',
    description: 'Estimates income bracket for an individual based on phone-linked financial data.',
    input: {
      phoneNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      dob: { type: 'string', description: 'Date of birth (DD-MM-YYYY)', required: true, value: s.dob },
      address: { type: 'string', description: 'Current address', required: false, value: s.address },
      pincode: { type: 'string', description: 'Pincode', required: false, value: s.pincode },
      pan: { type: 'string', description: 'PAN number', required: false, value: s.pan },
    },
    output: {
      good: {
        result: {
          estimatedMonthlyIncome: 72000,
          incomeBracket: '50000-100000',
          confidence: 'high',
          incomeSource: 'salaried',
          employerCategory: 'private_sector',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          estimatedMonthlyIncome: 25000,
          incomeBracket: '20000-30000',
          confidence: 'low',
          incomeSource: 'self_employed',
          employerCategory: null,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          estimatedMonthlyIncome: null,
          incomeBracket: null,
          confidence: 'none',
          incomeSource: null,
          employerCategory: null,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.phoneToPrefill = {
    id: 'phoneToPrefill',
    name: 'Phone to Prefill',
    endpoint: '/api/v3/phonekyc/phoneToPrefill',
    method: 'POST',
    phase: 'B',
    category: 'income',
    description: 'Fetches prefill data (addresses, identity docs, demographics) linked to a phone number.',
    input: {
      phoneNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      pan: { type: 'string', description: 'PAN number', required: false, value: s.pan },
    },
    output: {
      good: {
        result: {
          addresses: [
            { address: '42, MG Road, Koramangala', city: 'Bangalore', state: 'Karnataka', pincode: '560034', type: 'current' },
            { address: '18, 2nd Cross, Indiranagar', city: 'Bangalore', state: 'Karnataka', pincode: '560038', type: 'previous' },
          ],
          identityDocuments: ['PAN', 'DL', 'Voter ID'],
          demographics: { age: 35, gender: 'Male', maritalStatus: 'Married' },
          dataRichness: 'high',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          addresses: [
            { address: '17, Railway Colony', city: 'Jodhpur', state: 'Rajasthan', pincode: '342001', type: 'current' },
          ],
          identityDocuments: ['PAN', 'Voter ID'],
          demographics: { age: 40, gender: 'Male', maritalStatus: 'Unknown' },
          dataRichness: 'medium',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          addresses: [],
          identityDocuments: [],
          demographics: null,
          dataRichness: 'none',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.employmentVerification = {
    id: 'employmentVerification',
    name: 'Employment Verification',
    endpoint: '/api/v3/employment-verification',
    method: 'POST',
    phase: 'B',
    category: 'financial',
    description: 'Checks employment status via EPFO (Employees Provident Fund Organization) records.',
    input: {
      mobile: { type: 'string', description: 'Registered mobile number', required: true, value: s.phone },
      panNumber: { type: 'string', description: 'PAN number', required: true, value: s.pan },
    },
    output: {
      good: {
        result: {
          isEmployed: true,
          employerName: 'Infosys Technologies Ltd',
          dateOfJoining: '2020-06-15',
          dateOfExit: null,
          uanNumber: 'UAN-10145678',
          pfBalance: 320000,
          lastContribution: '2026-02-28',
          membershipStatus: 'active',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          isEmployed: false,
          employerName: 'Sharma Traders',
          dateOfJoining: '2023-01-10',
          dateOfExit: '2025-08-30',
          uanNumber: 'UAN-20987654',
          pfBalance: 45000,
          lastContribution: '2025-08-15',
          membershipStatus: 'inactive',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          isEmployed: false,
          employerName: null,
          dateOfJoining: null,
          dateOfExit: null,
          uanNumber: null,
          pfBalance: null,
          lastContribution: null,
          membershipStatus: 'not_found',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.advancedEmployment = {
    id: 'advancedEmployment',
    name: 'Advanced Employment Verification',
    endpoint: '/api/v3/advanced-employment-verification',
    method: 'POST',
    phase: 'B',
    category: 'financial',
    description: 'Deep employment check: full work history, PF filing frequency, employer GSTIN cross-check.',
    input: {
      mobileNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      panNumber: { type: 'string', description: 'PAN number', required: true, value: s.pan },
      uanNumber: { type: 'string', description: 'UAN number (if known)', required: false, value: null },
      consent: { type: 'boolean', description: 'User consent flag', required: true, value: true },
    },
    output: {
      good: {
        result: {
          employmentHistory: [
            { employer: 'Infosys Technologies Ltd', from: '2020-06', to: 'present', duration: '5y 9m' },
            { employer: 'Wipro Ltd', from: '2018-07', to: '2020-05', duration: '1y 10m' },
            { employer: 'TCS', from: '2015-06', to: '2018-06', duration: '3y' },
          ],
          totalExperience: '10+ years',
          pfFilingFrequency: 'monthly',
          lastPfFiled: '2026-02-28',
          currentEmployerGstin: '29AABCI1234F1ZS',
          employerGstinActive: true,
          employerSize: 'large',
          averageTenure: '3.5 years',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          employmentHistory: [
            { employer: 'Sharma Traders', from: '2023-01', to: '2025-08', duration: '2y 7m' },
            { employer: 'Quick Services', from: '2021-03', to: '2022-11', duration: '1y 8m' },
          ],
          totalExperience: '4 years',
          pfFilingFrequency: 'quarterly',
          lastPfFiled: '2025-06-30',
          currentEmployerGstin: null,
          employerGstinActive: false,
          employerSize: 'micro',
          averageTenure: '2.1 years',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          employmentHistory: [],
          totalExperience: null,
          pfFilingFrequency: null,
          lastPfFiled: null,
          currentEmployerGstin: null,
          employerGstinActive: false,
          employerSize: null,
          averageTenure: null,
        },
        statusCode: 200,
      },
    }[scenario],
  };


  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE C — Address + KYC  (triggered after KYC + address obtained)
  // ═══════════════════════════════════════════════════════════════════════════

  apis.registeredAddress = {
    id: 'registeredAddress',
    name: 'Phone to Registered Address',
    endpoint: '/api/v3/phonekyc/phoneToRegisteredAddress',
    method: 'POST',
    phase: 'C',
    category: 'address',
    description: 'Fetches the address registered against a mobile number from telecom records.',
    input: {
      phoneNumber: { type: 'string', description: 'Mobile number', required: true, value: s.phone },
      firstName: { type: 'string', description: 'First name', required: true, value: s.firstName },
      lastName: { type: 'string', description: 'Last name', required: true, value: s.lastName },
      pan: { type: 'string', description: 'PAN number', required: false, value: s.pan },
    },
    output: {
      good: {
        result: {
          addressFound: true,
          registeredAddress: '42, MG Road, Koramangala, Bangalore, Karnataka - 560034',
          pincode: '560034',
          state: 'Karnataka',
          matchWithProvided: true,
          matchScore: 92,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          addressFound: true,
          registeredAddress: '45, Paota Industrial Area, Jodhpur, Rajasthan - 342006',
          pincode: '342006',
          state: 'Rajasthan',
          matchWithProvided: false,
          matchScore: 38,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          addressFound: false,
          registeredAddress: null,
          pincode: null,
          state: null,
          matchWithProvided: false,
          matchScore: 0,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.addressGeocode = {
    id: 'addressGeocode',
    name: 'Address Geocode Match',
    endpoint: '/api/v3/address-geocode-match',
    method: 'POST',
    phase: 'C',
    category: 'address',
    description: 'Geocodes an address and matches it against coordinates. Detects international border proximity.',
    input: {
      address: { type: 'string', description: 'Full address string', required: true, value: s.address + ', ' + s.city + ', ' + s.state },
      latitude: { type: 'number', description: 'Device latitude (if available)', required: false, value: scenario === 'good' ? 12.9352 : scenario === 'risky' ? 26.2389 : 34.0837 },
      longitude: { type: 'number', description: 'Device longitude (if available)', required: false, value: scenario === 'good' ? 77.6245 : scenario === 'risky' ? 73.0243 : 74.7973 },
    },
    output: {
      good: {
        result: {
          geocodedAddress: '42, MG Road, Koramangala, Bangalore, Karnataka',
          geocodedLat: 12.9354,
          geocodedLng: 77.6247,
          confidence: 0.94,
          distanceFromDevice: 0.3,
          isInternationalBorder: false,
          nearestBorderDistance: 850,
          matchLevel: 'exact',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          geocodedAddress: 'Railway Colony, Jodhpur, Rajasthan',
          geocodedLat: 26.2750,
          geocodedLng: 73.0080,
          confidence: 0.62,
          distanceFromDevice: 12.5,
          isInternationalBorder: false,
          nearestBorderDistance: 180,
          matchLevel: 'partial',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          geocodedAddress: 'Srinagar, Jammu & Kashmir',
          geocodedLat: 34.0837,
          geocodedLng: 74.7973,
          confidence: 0.31,
          distanceFromDevice: 0.5,
          isInternationalBorder: true,
          nearestBorderDistance: 35,
          matchLevel: 'city_only',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.pincodeDetails = {
    id: 'pincodeDetails',
    name: 'Pincode Details',
    endpoint: '/api/v3/pincode-details',
    method: 'POST',
    phase: 'C',
    category: 'address',
    description: 'Retrieves demographic and geographic details for a pincode: population, urban/rural, state, district.',
    input: {
      pincode: { type: 'string', description: '6-digit Indian pincode', required: true, value: s.pincode },
    },
    output: {
      good: {
        result: {
          pincode: '560034',
          area: 'Koramangala',
          city: 'Bangalore',
          district: 'Bangalore Urban',
          state: 'Karnataka',
          type: 'urban',
          population: 'high_density',
          isServiceable: true,
          isBlacklisted: false,
          riskCategory: 'low',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          pincode: '342001',
          area: 'Jodhpur City',
          city: 'Jodhpur',
          district: 'Jodhpur',
          state: 'Rajasthan',
          type: 'urban',
          population: 'medium_density',
          isServiceable: true,
          isBlacklisted: false,
          riskCategory: 'medium',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          pincode: '190001',
          area: 'Srinagar GPO',
          city: 'Srinagar',
          district: 'Srinagar',
          state: 'Jammu & Kashmir',
          type: 'urban',
          population: 'medium_density',
          isServiceable: false,
          isBlacklisted: true,
          riskCategory: 'high',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.geoFencing = {
    id: 'geoFencing',
    name: 'Geo Fencing',
    endpoint: '/api/v2/patrons/geofencing',
    method: 'POST',
    phase: 'C',
    category: 'address',
    description: 'Validates IP-based geolocation against claimed location. Detects VPN/proxy/Tor usage.',
    input: {
      ip: { type: 'string', description: 'Client IP address', required: true, value: s.ipAddress },
      country: { type: 'string', description: 'Expected country', required: true, value: 'India' },
      state: { type: 'string', description: 'Expected state', required: false, value: s.state },
    },
    output: {
      good: {
        result: {
          ipCountry: 'India',
          ipState: 'Karnataka',
          ipCity: 'Bangalore',
          ipIsp: 'ACT Fibernet',
          isVpn: false,
          isProxy: false,
          isTor: false,
          isDatacenter: false,
          geoMatch: true,
          stateMatch: true,
          riskLevel: 'low',
          threatScore: 5,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          ipCountry: 'India',
          ipState: 'Maharashtra',
          ipCity: 'Mumbai',
          ipIsp: 'Jio 4G',
          isVpn: false,
          isProxy: false,
          isTor: false,
          isDatacenter: false,
          geoMatch: true,
          stateMatch: false,
          riskLevel: 'medium',
          threatScore: 35,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          ipCountry: 'Germany',
          ipState: 'Bavaria',
          ipCity: 'Nuremberg',
          ipIsp: 'Tor Exit Node',
          isVpn: true,
          isProxy: true,
          isTor: true,
          isDatacenter: true,
          geoMatch: false,
          stateMatch: false,
          riskLevel: 'critical',
          threatScore: 98,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.digitalIntegrity = {
    id: 'digitalIntegrity',
    name: 'Digital Integrity Check',
    endpoint: '/api/v2/patrons/digital-integrity',
    method: 'POST',
    phase: 'C',
    category: 'phoneDigital',
    description: 'Cross-validates email, phone, and IP for consistency. Checks disposable emails, blocklisted IPs, and bot activity.',
    input: {
      email: { type: 'string', description: 'Email address', required: true, value: s.email },
      phone: { type: 'string', description: 'Phone number', required: true, value: s.phone },
      ip: { type: 'string', description: 'IP address', required: true, value: s.ipAddress },
    },
    output: {
      good: {
        result: {
          emailValid: true,
          emailDisposable: false,
          emailDomain: 'gmail.com',
          emailDomainAge: '1998-09-15',
          emailBlocklisted: false,
          phoneValid: true,
          phoneBlocklisted: false,
          ipBlocklisted: false,
          ipThreatLevel: 'none',
          botLikelihood: 0.02,
          overallIntegrity: 'high',
          integrityScore: 92,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          emailValid: true,
          emailDisposable: false,
          emailDomain: 'yahoo.co.in',
          emailDomainAge: '1997-01-18',
          emailBlocklisted: false,
          phoneValid: true,
          phoneBlocklisted: false,
          ipBlocklisted: false,
          ipThreatLevel: 'low',
          botLikelihood: 0.15,
          overallIntegrity: 'medium',
          integrityScore: 58,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          emailValid: false,
          emailDisposable: true,
          emailDomain: 'tempmail.org',
          emailDomainAge: '2023-06-01',
          emailBlocklisted: true,
          phoneValid: false,
          phoneBlocklisted: true,
          ipBlocklisted: true,
          ipThreatLevel: 'critical',
          botLikelihood: 0.88,
          overallIntegrity: 'very_low',
          integrityScore: 5,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.eAadhaarXml = {
    id: 'eAadhaarXml',
    name: 'Get e-Aadhaar XML',
    endpoint: '/api/v3/eaadhaar/get-xml',
    method: 'POST',
    phase: 'C',
    category: 'identity',
    description: 'Retrieves and parses e-Aadhaar XML data with digital signature validation.',
    input: {
      requestId: { type: 'string', description: 'KYC request ID from earlier step', required: true, value: 'REQ-' + s.phone },
      shareCode: { type: 'string', description: '4-digit share code set by user', required: true, value: '1234' },
    },
    output: {
      good: {
        result: {
          aadhaarValid: true,
          name: 'Rajesh Kumar',
          dob: '1990-05-15',
          gender: 'Male',
          address: '42, MG Road, Koramangala, Bangalore - 560034',
          photo: '[base64_photo_data]',
          digitalSignatureValid: true,
          issueDate: '2023-08-10',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          aadhaarValid: true,
          name: 'Deepak Sharma',
          dob: '1985-11-22',
          gender: 'Male',
          address: '17, Railway Colony, Jodhpur - 342001',
          photo: '[base64_photo_data]',
          digitalSignatureValid: true,
          issueDate: '2021-02-14',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          aadhaarValid: false,
          name: null,
          dob: null,
          gender: null,
          address: null,
          photo: null,
          digitalSignatureValid: false,
          issueDate: null,
        },
        statusCode: 400,
      },
    }[scenario],
  };

  apis.digilockerDetails = {
    id: 'digilockerDetails',
    name: 'Get Details (DigiLocker)',
    endpoint: '/api/v3/digilocker/get-details',
    method: 'POST',
    phase: 'C',
    category: 'identity',
    description: 'Retrieves documents linked to DigiLocker account: Aadhaar, PAN, DL, education certificates.',
    input: {
      requestId: { type: 'string', description: 'DigiLocker auth request ID', required: true, value: 'DL-REQ-' + s.phone },
    },
    output: {
      good: {
        result: {
          linkedDocuments: [
            { type: 'Aadhaar', issuer: 'UIDAI', status: 'verified' },
            { type: 'PAN Card', issuer: 'Income Tax Dept', status: 'verified' },
            { type: 'Driving Licence', issuer: 'RTO Karnataka', status: 'verified' },
            { type: 'Class 10 Marksheet', issuer: 'CBSE', status: 'verified' },
          ],
          totalDocuments: 4,
          accountActive: true,
          lastAccessed: '2026-03-01',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          linkedDocuments: [
            { type: 'Aadhaar', issuer: 'UIDAI', status: 'verified' },
            { type: 'PAN Card', issuer: 'Income Tax Dept', status: 'verified' },
          ],
          totalDocuments: 2,
          accountActive: true,
          lastAccessed: '2025-07-20',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          linkedDocuments: [],
          totalDocuments: 0,
          accountActive: false,
          lastAccessed: null,
        },
        statusCode: 200,
      },
    }[scenario],
  };


  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE D — Bank + Document + Device  (triggered after bank details)
  // ═══════════════════════════════════════════════════════════════════════════

  apis.bankVerification = {
    id: 'bankVerification',
    name: 'Hybrid Bank Account Verification',
    endpoint: '/api/v3/bank/hybrid-verification',
    method: 'POST',
    phase: 'D',
    category: 'financial',
    description: 'Verifies bank account via penny drop + reverse penny drop. Confirms account is active and holder name matches.',
    input: {
      accountNumber: { type: 'string', description: 'Bank account number', required: true, value: s.accountNumber },
      ifsc: { type: 'string', description: 'IFSC code', required: true, value: s.ifsc },
      name: { type: 'string', description: 'Expected account holder name', required: true, value: s.firstName + ' ' + s.lastName },
      mobile: { type: 'string', description: 'Mobile number', required: false, value: s.phone },
    },
    output: {
      good: {
        result: {
          accountExists: true,
          accountActive: true,
          nameOnAccount: 'Rajesh Kumar',
          nameMatch: true,
          nameMatchScore: 98,
          accountType: 'savings',
          bankName: 'State Bank of India',
          branch: 'Koramangala Branch',
          pennyDropStatus: 'success',
          reversePennyDrop: 'verified',
          upiLinked: true,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          accountExists: true,
          accountActive: true,
          nameOnAccount: 'Deepak K Sharma',
          nameMatch: true,
          nameMatchScore: 72,
          accountType: 'savings',
          bankName: 'Punjab National Bank',
          branch: 'Jodhpur Main',
          pennyDropStatus: 'success',
          reversePennyDrop: 'not_verified',
          upiLinked: false,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          accountExists: false,
          accountActive: false,
          nameOnAccount: null,
          nameMatch: false,
          nameMatchScore: 0,
          accountType: null,
          bankName: null,
          branch: null,
          pennyDropStatus: 'failed',
          reversePennyDrop: 'failed',
          upiLinked: false,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.ifscSearch = {
    id: 'ifscSearch',
    name: 'Search Bank by IFSC',
    endpoint: '/api/v3/bank/ifsc-search',
    method: 'POST',
    phase: 'D',
    category: 'financial',
    description: 'Validates IFSC code and returns bank branch details.',
    input: {
      ifscCode: { type: 'string', description: '11-character IFSC code', required: true, value: s.ifsc },
    },
    output: {
      good: {
        result: {
          valid: true,
          bankName: 'State Bank of India',
          branch: 'Koramangala',
          city: 'Bangalore',
          state: 'Karnataka',
          address: 'MG Road, Koramangala, Bangalore - 560034',
          micr: '560002045',
          neftEnabled: true,
          rtgsEnabled: true,
          impsEnabled: true,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          valid: true,
          bankName: 'Punjab National Bank',
          branch: 'Jodhpur Main Branch',
          city: 'Jodhpur',
          state: 'Rajasthan',
          address: 'Station Road, Jodhpur - 342001',
          micr: '342024002',
          neftEnabled: true,
          rtgsEnabled: true,
          impsEnabled: true,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          valid: false,
          bankName: null,
          branch: null,
          city: null,
          state: null,
          address: null,
          micr: null,
          neftEnabled: false,
          rtgsEnabled: false,
          impsEnabled: false,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.imeiFetch = {
    id: 'imeiFetch',
    name: 'IMEI Fetch',
    endpoint: '/api/v3/imei/fetch',
    method: 'POST',
    phase: 'D',
    category: 'device',
    description: 'Validates device IMEI: checks if device is stolen/lost, retrieves make/model, determines device age.',
    input: {
      imei: { type: 'string', description: '15-digit IMEI number', required: true, value: s.imei },
    },
    output: {
      good: {
        result: {
          valid: true,
          brand: 'Samsung',
          model: 'Galaxy S23',
          deviceAge: '1.5 years',
          manufactureYear: 2024,
          isStolen: false,
          isLost: false,
          isBlacklisted: false,
          tac: '35245678',
          deviceType: 'smartphone',
        },
        statusCode: 200,
      },
      risky: {
        result: {
          valid: true,
          brand: 'Xiaomi',
          model: 'Redmi 9',
          deviceAge: '4 years',
          manufactureYear: 2022,
          isStolen: false,
          isLost: false,
          isBlacklisted: false,
          tac: '86123456',
          deviceType: 'smartphone',
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          valid: false,
          brand: null,
          model: null,
          deviceAge: null,
          manufactureYear: null,
          isStolen: true,
          isLost: true,
          isBlacklisted: true,
          tac: '00000000',
          deviceType: 'unknown',
        },
        statusCode: 200,
      },
    }[scenario],
  };

  apis.forgeryCheck = {
    id: 'forgeryCheck',
    name: 'Advance Forgery Lite',
    endpoint: '/api/v3/document/forgery-check',
    method: 'POST',
    phase: 'D',
    category: 'document',
    description: 'Analyzes uploaded documents (PAN card image, bank statement, etc.) for signs of digital forgery or tampering.',
    input: {
      imageUrl: { type: 'string', description: 'URL/base64 of the document image', required: true, value: 'https://storage.finz.com/docs/' + s.pan + '_pancard.jpg' },
      threshold: { type: 'number', description: 'Forgery detection threshold (0-1)', required: false, value: 0.5 },
    },
    output: {
      good: {
        result: {
          status: 'genuine',
          forgeryScore: 0.08,
          confidence: 0.96,
          anomalies: [],
          metadataConsistent: true,
          fontConsistency: 'high',
          edgeAnalysis: 'clean',
          exifIntact: true,
        },
        statusCode: 200,
      },
      risky: {
        result: {
          status: 'suspicious',
          forgeryScore: 0.45,
          confidence: 0.71,
          anomalies: ['font_inconsistency_detected', 'jpeg_compression_artifacts'],
          metadataConsistent: true,
          fontConsistency: 'medium',
          edgeAnalysis: 'minor_artifacts',
          exifIntact: false,
        },
        statusCode: 200,
      },
      fraud: {
        result: {
          status: 'forged',
          forgeryScore: 0.92,
          confidence: 0.98,
          anomalies: [
            'text_overlay_detected',
            'photoshop_signature',
            'inconsistent_lighting',
            'copy_paste_regions',
            'metadata_stripped',
          ],
          metadataConsistent: false,
          fontConsistency: 'low',
          edgeAnalysis: 'tampered',
          exifIntact: false,
        },
        statusCode: 200,
      },
    }[scenario],
  };

  return apis;
}
