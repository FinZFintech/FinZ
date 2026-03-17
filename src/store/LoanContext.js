import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOAN_STATUS } from '../config/constants';

const LoanContext = createContext(null);

const STORAGE_KEY = 'finz_loan_application';

// ─── Rejected statuses: application cannot be resumed ────────────────────────
const REJECTED_STATUSES = new Set([
  LOAN_STATUS.CREDIT_CHECK_FAILED,
  LOAN_STATUS.KYC_FAILED,
  LOAN_STATUS.NOT_ELIGIBLE,
]);

// ─── Terminal statuses: application is complete, no resume needed ─────────────
const TERMINAL_STATUSES = new Set([
  LOAN_STATUS.DISBURSED,
  LOAN_STATUS.ACTIVE,
  LOAN_STATUS.CLOSED,
]);

// ─── Actual screen flow (education loan) ─────────────────────────────────────
//
//  Step 0: InstituteSelection  → dispatches SET_INSTITUTE, SET_LOAN_TYPE
//  Step 1: StudentDetails      → dispatches SET_STUDENT
//  Step 1: BorrowerSelection   → dispatches SET_BORROWER_TYPE/DETAILS, SET_PRODUCT, SET_TENURE
//  Step 2: PanVerification     → dispatches SET_PAN, SET_CREDIT_SCORE
//  Step 3: IncomeVerification  → dispatches SET_PENNY_DROP, SET_BANK_DETAILS, SET_INCOME, SET_ELIGIBILITY
//  Step 4: KycVerification     → dispatches SET_KYC_DATA, SET_KYC_METHOD
//  Step 5: SelfieVerification  → dispatches SET_SELFIE
//  Step 6: EnachEsign          → dispatches SET_ENACH, SET_ESIGN, SET_VKYC, SET_RISK_PROFILE
//  Step 7: LoanSuccess         → dispatches RESET

// ─── Map state data → current application status ─────────────────────────────
// Checked in reverse order (most complete first) so the highest stage wins.
function computeStatus(state) {
  if (!state.loanType && !state.instituteDetails) return null; // no application

  // Stage 6: EnachEsign outputs
  if (state.esignStatus?.completed)                     return LOAN_STATUS.ESIGN_DONE;
  if (state.enachStatus?.completed)                     return LOAN_STATUS.ENACH_DONE;
  if (state.vkycStatus?.completed)                      return LOAN_STATUS.VKYC_DONE;

  // Stage 5: Selfie
  if (state.selfieData?.matched)                        return LOAN_STATUS.SELFIE_VERIFIED;

  // Stage 4: KYC
  if (state.kycData?.nameMatchFailed)                   return LOAN_STATUS.KYC_FAILED;
  if (state.kycData && state.kycMethod)                 return LOAN_STATUS.KYC_COMPLETED;

  // Stage 3: Income / eligibility
  if (state.eligibilityResult?.eligible === false)      return LOAN_STATUS.NOT_ELIGIBLE;
  if (state.eligibilityResult)                          return LOAN_STATUS.FULLY_ELIGIBLE;
  if (state.incomeData)                                 return LOAN_STATUS.INCOME_VERIFIED;
  if (state.bankDetails)                                return LOAN_STATUS.BANK_VERIFIED;

  // Stage 2: PAN / credit
  if (state.creditScore && state.creditScore < 500)     return LOAN_STATUS.CREDIT_CHECK_FAILED;
  if (state.panDetails && state.creditScore)            return LOAN_STATUS.CREDIT_CHECK_PASSED;
  if (state.panDetails)                                 return LOAN_STATUS.PAN_VERIFIED;

  // Stage 1: Application form
  if (state.borrowerDetails && state.selectedProduct)   return LOAN_STATUS.BORROWER_SELECTED;
  if (state.studentDetails)                             return LOAN_STATUS.STUDENT_DETAILS_DONE;
  if (state.instituteDetails)                           return LOAN_STATUS.INSTITUTE_VERIFIED;

  return LOAN_STATUS.DRAFT;
}

// ─── Map status → the NEXT screen the customer should land on ────────────────
// Key rule: status X means "X is DONE", so resume goes to X+1.
function getResumeScreen(status) {
  switch (status) {
    // Nothing done → start from scratch
    case LOAN_STATUS.DRAFT:
      return 'InstituteSelection';

    // Institute selected → need student details next
    case LOAN_STATUS.INSTITUTE_VERIFIED:
      return 'StudentDetails';

    // Student details done → need borrower / product selection
    case LOAN_STATUS.STUDENT_DETAILS_DONE:
      return 'BorrowerSelection';

    // Borrower selected → need PAN verification
    case LOAN_STATUS.BORROWER_SELECTED:
      return 'PanVerification';

    // PAN / credit done → need income verification
    case LOAN_STATUS.PAN_VERIFIED:
    case LOAN_STATUS.CREDIT_CHECK_PASSED:
      return 'IncomeVerification';

    // Bank verified but income not yet complete → still on income screen
    case LOAN_STATUS.BANK_VERIFIED:
      return 'IncomeVerification';

    // Income verified / eligible → need KYC next
    case LOAN_STATUS.INCOME_VERIFIED:
    case LOAN_STATUS.FULLY_ELIGIBLE:
    case LOAN_STATUS.PARTIALLY_ELIGIBLE:
      return 'KycVerification';

    // KYC done → need selfie next (or EnachEsign for >=60k, handled at screen level)
    case LOAN_STATUS.KYC_COMPLETED:
      return 'SelfieVerification';

    // Selfie done → need eNACH/eSign
    case LOAN_STATUS.SELFIE_VERIFIED:
      return 'EnachEsign';

    // eNACH/VKYC done but not eSigned → still on EnachEsign
    case LOAN_STATUS.ENACH_DONE:
    case LOAN_STATUS.VKYC_DONE:
      return 'EnachEsign';

    // eSigned → show success
    case LOAN_STATUS.ESIGN_DONE:
      return 'LoanSuccess';

    default:
      return 'InstituteSelection';
  }
}

// ─── Map status → step index for StepIndicator (0-based, 7 steps) ───────────
//  0: Institute  1: Apply(Student/Borrower)  2: PAN  3: Income  4: KYC  5: Verify(Selfie)  6: Sign(eNACH/eSign)
function getStepFromStatus(status) {
  switch (status) {
    case LOAN_STATUS.DRAFT:
      return 0;
    case LOAN_STATUS.INSTITUTE_VERIFIED:
      return 0;
    case LOAN_STATUS.STUDENT_DETAILS_DONE:
    case LOAN_STATUS.BORROWER_SELECTED:
      return 1;
    case LOAN_STATUS.PAN_VERIFIED:
    case LOAN_STATUS.CREDIT_CHECK_PASSED:
      return 2;
    case LOAN_STATUS.BANK_VERIFIED:
    case LOAN_STATUS.INCOME_VERIFIED:
    case LOAN_STATUS.FULLY_ELIGIBLE:
    case LOAN_STATUS.PARTIALLY_ELIGIBLE:
      return 3;
    case LOAN_STATUS.KYC_COMPLETED:
      return 4;
    case LOAN_STATUS.SELFIE_VERIFIED:
      return 5;
    case LOAN_STATUS.ENACH_DONE:
    case LOAN_STATUS.ESIGN_DONE:
    case LOAN_STATUS.VKYC_DONE:
      return 6;
    default:
      return 0;
  }
}

// ─── Status label for display ────────────────────────────────────────────────
function getStatusLabel(status) {
  const labels = {
    [LOAN_STATUS.DRAFT]: 'Draft',
    [LOAN_STATUS.INSTITUTE_VERIFIED]: 'Institute Selected',
    [LOAN_STATUS.STUDENT_DETAILS_DONE]: 'Student Details Done',
    [LOAN_STATUS.BORROWER_SELECTED]: 'Borrower Selected',
    [LOAN_STATUS.PAN_VERIFIED]: 'PAN Verified',
    [LOAN_STATUS.CREDIT_CHECK_PASSED]: 'Credit Check Passed',
    [LOAN_STATUS.CREDIT_CHECK_FAILED]: 'Credit Check Failed',
    [LOAN_STATUS.BANK_VERIFIED]: 'Bank Verified',
    [LOAN_STATUS.INCOME_VERIFIED]: 'Income Verified',
    [LOAN_STATUS.KYC_COMPLETED]: 'KYC Done',
    [LOAN_STATUS.KYC_FAILED]: 'KYC Failed',
    [LOAN_STATUS.SELFIE_VERIFIED]: 'Selfie Verified',
    [LOAN_STATUS.FULLY_ELIGIBLE]: 'Eligible',
    [LOAN_STATUS.PARTIALLY_ELIGIBLE]: 'Partially Eligible',
    [LOAN_STATUS.NOT_ELIGIBLE]: 'Not Eligible',
    [LOAN_STATUS.ENACH_DONE]: 'eNACH Done',
    [LOAN_STATUS.ESIGN_DONE]: 'eSigned',
    [LOAN_STATUS.VKYC_DONE]: 'VKYC Done',
    [LOAN_STATUS.MANUAL_REVIEW]: 'Under Review',
  };
  return labels[status] || status || 'Not Started';
}

// ─── Initial State ───────────────────────────────────────────────────────────
const initialState = {
  applicationId: null,
  currentLoan: null,
  loanType: null,
  instituteDetails: null,
  studentDetails: null,
  companyDetails: null,
  employeeDetails: null,
  borrowerType: null,
  borrowerDetails: null,
  selectedProduct: null,
  selectedTenure: null,
  panDetails: null,
  creditScore: null,
  kycMethod: null,
  kycData: null,
  selfieData: null,
  bankDetails: null,
  pennyDropResult: null,
  incomeData: null,
  eligibilityResult: null,
  enachStatus: null,
  esignStatus: null,
  vkycStatus: null,
  riskProfile: null,
  references: null,
  step: 0,
  // Persistence metadata
  status: null,
  lastUpdated: null,
  createdAt: null,
};

const loanReducer = (state, action) => {
  let next;
  switch (action.type) {
    case 'SET_LOAN_TYPE':
      next = { ...state, loanType: action.payload };
      break;
    case 'SET_INSTITUTE':
      next = { ...state, instituteDetails: action.payload };
      break;
    case 'SET_STUDENT':
      next = { ...state, studentDetails: action.payload };
      break;
    case 'SET_COMPANY':
      next = { ...state, companyDetails: action.payload };
      break;
    case 'SET_EMPLOYEE':
      next = { ...state, employeeDetails: action.payload };
      break;
    case 'SET_BORROWER_TYPE':
      next = { ...state, borrowerType: action.payload };
      break;
    case 'SET_BORROWER_DETAILS':
      next = { ...state, borrowerDetails: action.payload };
      break;
    case 'SET_PRODUCT':
      next = { ...state, selectedProduct: action.payload };
      break;
    case 'SET_TENURE':
      next = { ...state, selectedTenure: action.payload };
      break;
    case 'SET_PAN':
      next = { ...state, panDetails: action.payload };
      break;
    case 'SET_CREDIT_SCORE':
      next = { ...state, creditScore: action.payload };
      break;
    case 'SET_KYC_METHOD':
      next = { ...state, kycMethod: action.payload };
      break;
    case 'SET_KYC_DATA':
      next = { ...state, kycData: action.payload };
      break;
    case 'SET_SELFIE':
      next = { ...state, selfieData: action.payload };
      break;
    case 'SET_BANK_DETAILS':
      next = { ...state, bankDetails: action.payload };
      break;
    case 'SET_PENNY_DROP':
      next = { ...state, pennyDropResult: action.payload };
      break;
    case 'SET_INCOME':
      next = { ...state, incomeData: action.payload };
      break;
    case 'SET_ELIGIBILITY':
      next = { ...state, eligibilityResult: action.payload };
      break;
    case 'SET_ENACH':
      next = { ...state, enachStatus: action.payload };
      break;
    case 'SET_ESIGN':
      next = { ...state, esignStatus: action.payload };
      break;
    case 'SET_VKYC':
      next = { ...state, vkycStatus: action.payload };
      break;
    case 'SET_RISK_PROFILE':
      next = { ...state, riskProfile: action.payload };
      break;
    case 'SET_REFERENCES':
      next = { ...state, references: action.payload };
      break;
    case 'SET_CURRENT_LOAN':
      next = { ...state, currentLoan: action.payload };
      break;
    case 'SET_STEP':
      next = { ...state, step: action.payload };
      break;
    case 'RESTORE':
      // Restore saved state from AsyncStorage
      return { ...action.payload };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }

  // Auto-compute status and metadata on every mutation
  const now = new Date().toISOString();
  next.status = computeStatus(next);
  next.lastUpdated = now;
  if (!next.createdAt) next.createdAt = now;
  if (!next.applicationId) next.applicationId = 'APP_' + Date.now();
  next.step = getStepFromStatus(next.status);

  return next;
};

// ─── Persistence helpers ─────────────────────────────────────────────────────
async function saveApplication(state) {
  try {
    if (!state.status || state.status === null) return;
    // Don't persist terminal applications
    if (TERMINAL_STATUSES.has(state.status)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[LoanContext] Application saved:', state.applicationId, '→', state.status);
  } catch (err) {
    console.log('[LoanContext] Failed to save application:', err.message);
  }
}

async function loadApplication() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);

    // Don't restore rejected or terminal applications
    if (REJECTED_STATUSES.has(saved.status) || TERMINAL_STATUSES.has(saved.status)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }

    console.log('[LoanContext] Restored application:', saved.applicationId, '→', saved.status);
    return saved;
  } catch (err) {
    console.log('[LoanContext] Failed to load application:', err.message);
    return null;
  }
}

async function clearSavedApplication() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('[LoanContext] Cleared saved application');
  } catch (err) {
    console.log('[LoanContext] Failed to clear application:', err.message);
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export const LoanProvider = ({ children }) => {
  const [state, rawDispatch] = useReducer(loanReducer, initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasSavedApplication, setHasSavedApplication] = useState(false);

  // Load saved application on mount
  useEffect(() => {
    (async () => {
      const saved = await loadApplication();
      if (saved) {
        rawDispatch({ type: 'RESTORE', payload: saved });
        setHasSavedApplication(true);
      }
      setIsLoaded(true);
    })();
  }, []);

  // Auto-save on every state change (debounced via effect)
  useEffect(() => {
    if (!isLoaded) return;
    if (state.status) {
      saveApplication(state);
      setHasSavedApplication(true);
    } else {
      setHasSavedApplication(false);
    }
  }, [state, isLoaded]);

  // Wrapped dispatch that also handles RESET clearing storage
  const dispatch = useCallback((action) => {
    if (action.type === 'RESET') {
      clearSavedApplication();
      setHasSavedApplication(false);
    }
    rawDispatch(action);
  }, []);

  // Resume: navigate to the correct screen for the current application stage
  const getResumeInfo = useCallback(() => {
    if (!state.status || REJECTED_STATUSES.has(state.status) || TERMINAL_STATUSES.has(state.status)) {
      return null;
    }
    return {
      screen: getResumeScreen(state.status),
      status: state.status,
      statusLabel: getStatusLabel(state.status),
      applicationId: state.applicationId,
      step: state.step,
      createdAt: state.createdAt,
      lastUpdated: state.lastUpdated,
      instituteName: state.instituteDetails?.name || state.instituteDetails?.instituteName || null,
      loanType: state.loanType,
    };
  }, [state]);

  // Check if application is rejected (cannot resume)
  const isRejected = REJECTED_STATUSES.has(state.status);

  return (
    <LoanContext.Provider value={{
      state,
      dispatch,
      isLoaded,
      hasSavedApplication,
      getResumeInfo,
      isRejected,
      computeStatus: () => computeStatus(state),
      getStatusLabel: () => getStatusLabel(state.status),
    }}>
      {children}
    </LoanContext.Provider>
  );
};

export const useLoan = () => {
  const context = useContext(LoanContext);
  if (!context) throw new Error('useLoan must be used within LoanProvider');
  return context;
};

export { computeStatus, getResumeScreen, getStepFromStatus, getStatusLabel, REJECTED_STATUSES, TERMINAL_STATUSES };
