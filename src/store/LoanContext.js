import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOAN_STATUS, VKYC_AMOUNT_THRESHOLD } from '../config/constants';

// ─── Helper: derive the requested loan amount from state ─────────────────────
// Looks through all the places an amount might live (product, tenure variants,
// borrowerDetails, education balanceFee) so consumer screens — and the
// resume-router's VKYC threshold check — don't have to duplicate this logic.
function getRequestedAmount(state) {
  if (!state) return 0;
  return (
    state.selectedProduct?.requestedAmount ||
    state.selectedProduct?.amount ||
    state.selectedProduct?.loanAmount ||
    state.selectedTenure?.amount ||
    state.borrowerDetails?.requestedAmount ||
    state.studentDetails?.balanceFee ||
    0
  );
}

// ─── Helper: does this application need VKYC instead of selfie? ─────────────
// Loans >= threshold skip the selfie screen entirely and verify identity
// through a live video-KYC call that also handles selfie liveness.
function requiresVkyc(state) {
  return getRequestedAmount(state) >= VKYC_AMOUNT_THRESHOLD;
}
import { saveApplicationToDb } from '../services/applicationDbService';

const LoanContext = createContext(null);

const STORAGE_KEY = 'finz_loan_application';
const MULTI_STORAGE_KEY = 'finz_loan_applications'; // Array of all draft applications
const AUTO_DISCARD_DAYS = 7;

// ─── Rejected statuses: application cannot be resumed ────────────────────────
const REJECTED_STATUSES = new Set([
  LOAN_STATUS.CREDIT_CHECK_FAILED,
  LOAN_STATUS.KYC_FAILED,
]);

// ─── Terminal statuses: application is complete, no resume needed ─────────────
const TERMINAL_STATUSES = new Set([
  LOAN_STATUS.SUBMITTED,
  LOAN_STATUS.DISBURSED,
  LOAN_STATUS.ACTIVE,
  LOAN_STATUS.CLOSED,
]);

// ─── Discarded status: customer explicitly dropped the application ───────────
// Admin / sales still see these in the queue (via savedApplications) but the
// customer must not — they wouldn't recognize a draft they threw away.
const DISCARDED_STATUSES = new Set([
  LOAN_STATUS.DISCARDED,
]);

// Is this app something the customer can still resume?
function isResumable(app) {
  return app && app.status
      && !TERMINAL_STATUSES.has(app.status)
      && !REJECTED_STATUSES.has(app.status)
      && !DISCARDED_STATUSES.has(app.status);
}

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

  // Stage 7: Application submitted
  if (state.submittedAt)                                return LOAN_STATUS.SUBMITTED;

  // Stage 6: EnachEsign outputs
  if (state.esignStatus?.completed)                     return LOAN_STATUS.ESIGN_DONE;
  if (state.enachStatus?.completed)                     return LOAN_STATUS.ENACH_DONE;
  if (state.vkycStatus?.completed)                      return LOAN_STATUS.VKYC_DONE;

  // Stage 5: Selfie
  if (state.selfieData?.matched)                        return LOAN_STATUS.SELFIE_VERIFIED;

  // Stage 4: KYC
  if (state.kycData?.nameMatchFailed)                   return LOAN_STATUS.KYC_FAILED;
  if (state.addressCorrection?.status === 'pending')    return LOAN_STATUS.KYC_ADDRESS_REVIEW;
  if (state.addressCorrection?.status === 'rejected')   return LOAN_STATUS.KYC_FAILED;
  if (state.kycData?.detailsIncorrect)                  return LOAN_STATUS.KYC_ADDRESS_REVIEW;
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
// When state is provided, KYC_COMPLETED branches on loan amount: >= threshold
// skips selfie entirely and goes straight to EnachEsign (VKYC is handled there).
function getResumeScreen(status, state) {
  const skipSelfie = state ? requiresVkyc(state) : false;
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

    // Not eligible → allow re-visiting income verification to retry
    case LOAN_STATUS.NOT_ELIGIBLE:
      return 'IncomeVerification';

    // KYC address under review → back to KYC screen (shows review status)
    case LOAN_STATUS.KYC_ADDRESS_REVIEW:
      return 'KycVerification';

    // KYC done → if loan >= 60k skip selfie (VKYC inside EnachEsign handles
    // liveness); otherwise go to SelfieVerification.
    case LOAN_STATUS.KYC_COMPLETED:
      return skipSelfie ? 'EnachEsign' : 'SelfieVerification';

    // Selfie done → need eNACH/eSign
    case LOAN_STATUS.SELFIE_VERIFIED:
      return 'EnachEsign';

    // eNACH/VKYC done but not eSigned → still on EnachEsign
    case LOAN_STATUS.ENACH_DONE:
    case LOAN_STATUS.VKYC_DONE:
      return 'EnachEsign';

    // eSigned → still on EnachEsign (needs to submit)
    case LOAN_STATUS.ESIGN_DONE:
      return 'EnachEsign';

    // Submitted → show success
    case LOAN_STATUS.SUBMITTED:
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
    case LOAN_STATUS.NOT_ELIGIBLE:
      return 3;
    case LOAN_STATUS.KYC_ADDRESS_REVIEW:
    case LOAN_STATUS.KYC_COMPLETED:
      return 4;
    case LOAN_STATUS.SELFIE_VERIFIED:
      return 5;
    case LOAN_STATUS.ENACH_DONE:
    case LOAN_STATUS.ESIGN_DONE:
    case LOAN_STATUS.VKYC_DONE:
    case LOAN_STATUS.SUBMITTED:
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
    [LOAN_STATUS.KYC_ADDRESS_REVIEW]: 'Address Under Review',
    [LOAN_STATUS.KYC_FAILED]: 'KYC Failed',
    [LOAN_STATUS.SELFIE_VERIFIED]: 'Selfie Verified',
    [LOAN_STATUS.FULLY_ELIGIBLE]: 'Eligible',
    [LOAN_STATUS.PARTIALLY_ELIGIBLE]: 'Partially Eligible',
    [LOAN_STATUS.NOT_ELIGIBLE]: 'Not Eligible',
    [LOAN_STATUS.ENACH_DONE]: 'eNACH Done',
    [LOAN_STATUS.ESIGN_DONE]: 'eSigned',
    [LOAN_STATUS.VKYC_DONE]: 'VKYC Done',
    [LOAN_STATUS.SUBMITTED]: 'Submitted',
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
  // Up to 2 co-borrowers can be attached to a single application. Each
  // one is a standalone verification subject: own PAN + credit score,
  // own KYC, own income / bank details, own penny drop, own vKYC when
  // the loan amount crosses ₹60k, and own signature on the final
  // agreement. Populated by the BorrowerSelection screen; each entry
  // has its own { id, name, phone, dob, email, pan, relationship,
  // panDetails, creditScore, kycData, kycMethod, incomeData,
  // bankDetails, pennyDropResult, vkycStatus, esignStatus, signzyVerifications }.
  coBorrowers: [],
  // Points at the co-borrower whose verification flow is currently
  // being driven on screen. When null, the screens read / write the
  // main-borrower slice. Set by the BorrowerSelection "Complete KYC
  // for co-borrower" CTA and cleared on return.
  activeCoBorrowerId: null,
  selectedProduct: null,
  selectedTenure: null,
  panDetails: null,
  creditScore: null,
  kycMethod: null,
  kycData: null,
  // Append-only audit trail of every KYC failure (any method) so ops can
  // see what was tried, why it failed, and what the gateway returned.
  // Each entry: { method, stage, reason, statusCode?, errorCode?, raw?, at }
  kycFailures: [],
  // Signzy verification results (employment / phone intel / email / etc.).
  // Keyed by verification type so more APIs can slot in alongside the
  // existing employmentBasic entry without schema changes.
  // Each entry: { status: 'success'|'failure', result?, error?, fetchedAt }
  signzyVerifications: {},
  addressCorrection: null,   // { address, city, state, pincode, proofUri, proofName, status: 'pending'|'approved'|'rejected' }
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
  submittedAt: null,
  // Append-only timeline of every milestone with exact timestamp
  timeline: [],
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
      // Merge with existing instead of replacing. Partial updates (from
      // the bot, for example) otherwise wipe sibling fields — e.g. a
      // {name} dispatch erased the phone / dob / pan that were already
      // captured on state.
      next = { ...state, borrowerDetails: { ...(state.borrowerDetails || {}), ...action.payload } };
      break;
    case 'SET_PRODUCT':
      // Merge so partial bot dispatches (e.g. just {requestedAmount}) don't
      // wipe name / interestRate / processingFee captured earlier.
      next = { ...state, selectedProduct: { ...(state.selectedProduct || {}), ...action.payload } };
      break;
    case 'SET_TENURE':
      next = { ...state, selectedTenure: action.payload };
      break;
    case 'SET_PAN':
      // Merge — keeps previous panFetch / credit metadata intact when
      // the bot later writes just {panNumber, verified}.
      next = { ...state, panDetails: { ...(state.panDetails || {}), ...action.payload } };
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
    case 'ADD_KYC_FAILURE':
      next = {
        ...state,
        kycFailures: [...(state.kycFailures || []), action.payload],
      };
      break;
    case 'CLEAR_KYC_FAILURES':
      next = { ...state, kycFailures: [] };
      break;
    case 'SET_SIGNZY_VERIFICATION':
      // payload: { key, status, result?, error?, fetchedAt? }
      next = {
        ...state,
        signzyVerifications: {
          ...(state.signzyVerifications || {}),
          [action.payload.key]: {
            status: action.payload.status,
            result: action.payload.result ?? null,
            error: action.payload.error ?? null,
            fetchedAt: action.payload.fetchedAt || new Date().toISOString(),
          },
        },
      };
      break;
    case 'CLEAR_SIGNZY_VERIFICATIONS':
      next = { ...state, signzyVerifications: {} };
      break;
    case 'SET_ADDRESS_CORRECTION':
      next = { ...state, addressCorrection: action.payload };
      break;
    case 'SET_SELFIE':
      next = { ...state, selfieData: action.payload };
      break;
    case 'SET_BANK_DETAILS':
      // Merge, same reasoning as SET_BORROWER_DETAILS — partial updates
      // shouldn't erase sibling fields (ifsc vs accountNumber etc.).
      next = { ...state, bankDetails: { ...(state.bankDetails || {}), ...action.payload } };
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

    // ── Co-borrower actions ─────────────────────────────────────────────
    // Up to 2 co-borrowers per application. Each has the same schema as
    // the main borrower (name/phone/dob/pan/relationship + the verification
    // fields) and goes through KYC / credit / income / vKYC independently.
    case 'ADD_CO_BORROWER': {
      if ((state.coBorrowers || []).length >= 2) {
        next = state; break; // enforce the 2-co-borrower cap
      }
      const id = action.payload?.id || `cb_${Date.now()}_${Math.random().toString(36).slice(-4)}`;
      const newCo = {
        id,
        name: '', fatherName: '', phone: '', dob: '', email: '', pan: '',
        relationship: '',
        panDetails: null,
        creditScore: null,
        kycData: null,
        kycMethod: null,
        incomeData: null,
        bankDetails: null,
        pennyDropResult: null,
        vkycStatus: null,
        esignStatus: null,
        signzyVerifications: {},
        ...action.payload,
      };
      next = { ...state, coBorrowers: [...(state.coBorrowers || []), newCo] };
      break;
    }
    case 'UPDATE_CO_BORROWER': {
      // Merge — same reasoning as SET_BORROWER_DETAILS. Payload:
      // { id, ...fieldsToMerge }. Fields with dotted paths (e.g.
      // 'panDetails') are merged one level deep so partial updates
      // don't wipe sibling keys.
      const { id, ...patch } = action.payload || {};
      if (!id) { next = state; break; }
      const merged = (state.coBorrowers || []).map((cb) => {
        if (cb.id !== id) return cb;
        const out = { ...cb };
        for (const [k, v] of Object.entries(patch)) {
          if (v && typeof v === 'object' && !Array.isArray(v) && cb[k] && typeof cb[k] === 'object') {
            out[k] = { ...cb[k], ...v };
          } else {
            out[k] = v;
          }
        }
        return out;
      });
      next = { ...state, coBorrowers: merged };
      break;
    }
    case 'REMOVE_CO_BORROWER': {
      const id = action.payload;
      const remaining = (state.coBorrowers || []).filter((cb) => cb.id !== id);
      const activeId = state.activeCoBorrowerId === id ? null : state.activeCoBorrowerId;
      next = { ...state, coBorrowers: remaining, activeCoBorrowerId: activeId };
      break;
    }
    case 'SET_ACTIVE_CO_BORROWER': {
      // Switches the "current verification subject" — screens read this
      // and route their read/write into the co-borrower slice. payload =
      // null ⇒ main borrower, else co-borrower id.
      next = { ...state, activeCoBorrowerId: action.payload || null };
      break;
    }
    case 'SET_SUBMITTED':
      next = { ...state, submittedAt: action.payload };
      break;
    case 'SET_CURRENT_LOAN':
      next = { ...state, currentLoan: action.payload };
      break;
    case 'SET_STEP':
      next = { ...state, step: action.payload };
      break;
    case 'ADD_TIMELINE_EVENT':
      next = {
        ...state,
        timeline: [...(state.timeline || []), action.payload],
      };
      break;
    case 'RESTORE':
      next = { ...initialState, ...action.payload };
      break;
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

  // ── Auto-record timeline for key milestones ──
  const timeline = [...(next.timeline || [])];
  const lastEvent = timeline[timeline.length - 1]?.event;
  const EVENT_MAP = {
    SET_INSTITUTE: 'institute_selected',
    SET_STUDENT: 'student_details',
    SET_BORROWER_DETAILS: 'borrower_details',
    SET_PAN: 'pan_verified',
    SET_CREDIT_SCORE: 'credit_check',
    SET_BANK_DETAILS: 'bank_details',
    SET_PENNY_DROP: 'penny_drop',
    SET_INCOME: 'income_verified',
    SET_ELIGIBILITY: 'eligibility_check',
    SET_KYC_DATA: 'kyc_completed',
    SET_SELFIE: 'selfie_verified',
    SET_ENACH: 'enach',
    SET_ESIGN: 'esign',
    SET_VKYC: 'vkyc',
    SET_SUBMITTED: 'submitted',
  };
  const eventName = EVENT_MAP[action.type];
  if (eventName && eventName !== lastEvent) {
    timeline.push({ event: eventName, at: now, action: action.type });
    next.timeline = timeline;
  }

  return next;
};

// ─── Persistence helpers (multi-application) ────────────────────────────────
function isExpired(app) {
  if (!app.createdAt) return false;
  const age = Date.now() - new Date(app.createdAt).getTime();
  return age > AUTO_DISCARD_DAYS * 24 * 60 * 60 * 1000;
}

// ─── Auto-discard expired system rejections ─────────────────────────────────
// System rejections (CIBIL / FOIR / KYC auto-fails) should drop out of
// the customer's view after AUTO_DISCARD_DAYS so a closed decision
// doesn't linger in MyLoans forever. We DON'T delete the record — it
// gets re-stamped to status:'discarded' with discardedAt + an
// autoDiscardReason so admin / ops / credit dashboards still see it
// under the Discarded filter. Manual rejections are NOT auto-discarded
// because those are a human call; the reviewer can discard them
// explicitly if they want.
function shouldAutoDiscardAutoRejection(app) {
  if (!app || !app.status) return false;
  if (app.status === 'discarded') return false;
  if (!REJECTED_STATUSES.has(app.status)) return false;
  if (app.adminAction?.action === 'reject') return false; // manual rejection
  const rejectedAt = app.lastUpdated || app.createdAt;
  if (!rejectedAt) return false;
  const age = Date.now() - new Date(rejectedAt).getTime();
  return age > AUTO_DISCARD_DAYS * 24 * 60 * 60 * 1000;
}

async function loadAllApplications() {
  try {
    // Migrate from legacy single-application key if present
    const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY);
    const multiRaw = await AsyncStorage.getItem(MULTI_STORAGE_KEY);
    let apps = multiRaw ? JSON.parse(multiRaw) : [];

    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy.applicationId && !apps.find((a) => a.applicationId === legacy.applicationId)) {
        apps.push(legacy);
      }
      await AsyncStorage.removeItem(STORAGE_KEY);
    }

    // Only discard apps older than AUTO_DISCARD_DAYS — keep everything
    // else (including terminal and rejected apps) so admin / credit /
    // sales dashboards can see the full pipeline when they read from
    // the same AsyncStorage key via loadRealApplications().
    const before = apps.length;
    let mutated = false;
    apps = apps.filter((a) => {
      if (isExpired(a)) {
        console.log('[LoanContext] Auto-discarded expired:', a.applicationId);
        return false;
      }
      return true;
    });

    // Auto-discard expired SYSTEM rejections in-place (don't drop the
    // record — the dashboards still surface it under the Discarded
    // filter, but the customer's MyLoans / HomeScreen resume banner
    // stops showing it thanks to the DISCARDED_STATUSES exclusion).
    apps = apps.map((a) => {
      if (!shouldAutoDiscardAutoRejection(a)) return a;
      mutated = true;
      console.log('[LoanContext] Auto-discarding expired auto-rejection:', a.applicationId, '→', a.status, '(was rejected at', a.lastUpdated || a.createdAt, ')');
      return {
        ...a,
        status: 'discarded',
        discardedAt: new Date().toISOString(),
        autoDiscardReason: 'auto_rejected_expired',
        // Keep the previous rejected status visible so ops / credit can
        // see why the system closed the loop.
        previousStatus: a.status,
        previousStatusChangedAt: a.lastUpdated || a.createdAt,
      };
    });

    if (apps.length !== before || mutated) {
      await AsyncStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(apps));
    }
    console.log('[LoanContext] Loaded', apps.length, 'application(s)');
    return apps;
  } catch (err) {
    console.log('[LoanContext] Failed to load applications:', err.message);
    return [];
  }
}

// AsyncStorage on web is capped at ~5 MB per origin. A single CKYC
// payload easily blows past that because it carries embedded
// photograph / signature base64 images (100-500 KB each) plus the
// raw gateway response (another ~1 MB). The full state is already
// persisted to Firestore + Firebase Storage, so for the local
// AsyncStorage copy we only need a lightweight shape that can
// restore the customer flow — strip the heavy blobs before writing.
function stripHeavyBlobs(state) {
  if (!state || typeof state !== 'object') return state;
  const trimmed = { ...state };
  if (trimmed.kycData) {
    const { rawResponse, raw, images, photograph, signature, ...kycLite } = trimmed.kycData;
    trimmed.kycData = kycLite;
  }
  if (trimmed.signzyVerifications && typeof trimmed.signzyVerifications === 'object') {
    const pruned = {};
    for (const [k, v] of Object.entries(trimmed.signzyVerifications)) {
      if (!v || typeof v !== 'object') { pruned[k] = v; continue; }
      const { rawResponse, raw, ...lite } = v;
      // Drill one level deeper — result may also carry a rawResponse /
      // large payload (e.g. ITR per-year rawJson).
      if (lite.result && typeof lite.result === 'object') {
        const { rawResponse: rr, raw: r2, itrByYear, ...resultLite } = lite.result;
        if (Array.isArray(itrByYear)) {
          resultLite.itrByYear = itrByYear.map(({ rawJson, pdfBase64, ...rest }) => rest);
        }
        lite.result = resultLite;
      }
      pruned[k] = lite;
    }
    trimmed.signzyVerifications = pruned;
  }
  if (trimmed.selfieData) {
    const { image, selfieImage, liveImage, ...selfieLite } = trimmed.selfieData;
    trimmed.selfieData = selfieLite;
  }
  return trimmed;
}

async function saveApplicationToList(state) {
  try {
    if (!state.applicationId) return;
    // Always persist — even terminal and rejected apps — so admin /
    // credit / sales dashboards can see the full pipeline. The customer
    // flow only restores resumable apps (filtered in the Provider).
    const raw = await AsyncStorage.getItem(MULTI_STORAGE_KEY);
    let apps = raw ? JSON.parse(raw) : [];
    // Auto-discard expired
    apps = apps.filter((a) => !isExpired(a));
    const trimmed = stripHeavyBlobs(state);
    const idx = apps.findIndex((a) => a.applicationId === state.applicationId);
    if (idx >= 0) {
      apps[idx] = trimmed;
    } else {
      apps.push(trimmed);
    }
    const serialized = JSON.stringify(apps);
    try {
      await AsyncStorage.setItem(MULTI_STORAGE_KEY, serialized);
    } catch (quotaErr) {
      // Last-ditch: drop the biggest non-active entries until the list fits.
      if (/quota|QuotaExceeded/i.test(quotaErr?.message || '')) {
        console.warn('[LoanContext] AsyncStorage quota hit; compacting…');
        const pinned = apps.filter((a) => a.applicationId === state.applicationId);
        const others = apps.filter((a) => a.applicationId !== state.applicationId);
        // Keep the current app + up to 2 most recent others.
        others.sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));
        const compact = [...pinned, ...others.slice(0, 2)];
        await AsyncStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(compact));
        console.warn('[LoanContext] Compacted to', compact.length, 'apps');
      } else {
        throw quotaErr;
      }
    }
    console.log(
      '[LoanContext] Saved application:',
      state.applicationId, '→', state.status,
      `(${apps.length} total, ${serialized.length} bytes)`,
      'hasSignzy:', !!state.signzyVerifications && Object.keys(state.signzyVerifications).length > 0,
      'hasKycData:', !!state.kycData,
    );
  } catch (err) {
    console.log('[LoanContext] Failed to save application:', err.message);
  }
}

async function removeApplicationFromList(applicationId) {
  try {
    const raw = await AsyncStorage.getItem(MULTI_STORAGE_KEY);
    let apps = raw ? JSON.parse(raw) : [];
    apps = apps.filter((a) => a.applicationId !== applicationId);
    await AsyncStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(apps));
    console.log('[LoanContext] Removed application:', applicationId);
  } catch (err) {
    console.log('[LoanContext] Failed to remove application:', err.message);
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export const LoanProvider = ({ children }) => {
  const [state, rawDispatch] = useReducer(loanReducer, initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasSavedApplication, setHasSavedApplication] = useState(false);
  const [savedApplications, setSavedApplications] = useState([]); // All persisted draft apps

  // Load all saved applications on mount, restore the most recent
  // *resumable* one as active (terminal / rejected are kept in the
  // list for admin dashboards but not auto-restored for the customer).
  useEffect(() => {
    (async () => {
      const apps = await loadAllApplications();
      setSavedApplications(apps);

      // Pick only apps the customer can resume — terminal / rejected stay
      // visible to admin via savedApplications, but discarded drafts are
      // hidden from the customer (they explicitly threw them away).
      const resumable = apps.filter(
        (a) => !TERMINAL_STATUSES.has(a.status)
            && !REJECTED_STATUSES.has(a.status)
            && !DISCARDED_STATUSES.has(a.status),
      );

      if (resumable.length > 0) {
        const sorted = [...resumable].sort(
          (a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0),
        );
        rawDispatch({ type: 'RESTORE', payload: sorted[0] });
        setHasSavedApplication(true);
      } else {
        // Only non-resumable drafts (terminal / rejected / discarded) in
        // storage — the customer has no active work to surface.
        setHasSavedApplication(false);
      }
      setIsLoaded(true);
    })();
  }, []);

  // Auto-save current application on every state change —
  // dual-write to AsyncStorage (local, offline-capable) AND
  // Firestore (shared across all devices / roles).
  useEffect(() => {
    if (!isLoaded) return;
    if (state.applicationId) {
      saveApplicationToList(state);
      saveApplicationToDb(state); // fire-and-forget to Firestore
      setHasSavedApplication(true);
      // Update local list cache
      setSavedApplications((prev) => {
        const idx = prev.findIndex((a) => a.applicationId === state.applicationId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = state;
          return copy;
        }
        return [...prev, state];
      });
    } else {
      // Check if any *resumable* apps remain — terminal / rejected /
      // discarded apps still live in storage for admins but must not
      // surface the "resume draft" UI to the customer.
      setSavedApplications((prev) => {
        const remaining = prev.filter((a) => a.applicationId !== state.applicationId);
        setHasSavedApplication(remaining.some(isResumable));
        return remaining;
      });
    }
  }, [state, isLoaded]);

  // Wrapped dispatch that handles RESET (discard current) and SWITCH_APPLICATION
  const dispatch = useCallback((action) => {
    if (action.type === 'RESET') {
      // Remove only the current active application
      const appId = state.applicationId;
      if (appId) {
        removeApplicationFromList(appId);
        setSavedApplications((prev) => {
          const remaining = prev.filter((a) => a.applicationId !== appId);
          setHasSavedApplication(remaining.some(isResumable));
          return remaining;
        });
      }
    }
    rawDispatch(action);
  }, [state.applicationId]);

  // Resume info for the current active application
  const getResumeInfo = useCallback(() => {
    if (!state.status
        || REJECTED_STATUSES.has(state.status)
        || TERMINAL_STATUSES.has(state.status)
        || DISCARDED_STATUSES.has(state.status)) {
      return null;
    }
    return {
      screen: getResumeScreen(state.status, state),
      status: state.status,
      statusLabel: getStatusLabel(state.status),
      applicationId: state.applicationId,
      step: state.step,
      createdAt: state.createdAt,
      lastUpdated: state.lastUpdated,
      instituteName: state.instituteDetails?.name || state.instituteDetails?.instituteName || null,
      loanType: state.loanType,
      requiresVkyc: requiresVkyc(state),
    };
  }, [state]);

  // Get resume info for any saved application. Returns null for discarded
  // drafts so the customer never sees an application they threw away.
  const getResumeInfoForApp = useCallback((app) => {
    if (!app.status
        || REJECTED_STATUSES.has(app.status)
        || TERMINAL_STATUSES.has(app.status)
        || DISCARDED_STATUSES.has(app.status)) {
      return null;
    }
    return {
      screen: getResumeScreen(app.status, app),
      status: app.status,
      statusLabel: getStatusLabel(app.status),
      applicationId: app.applicationId,
      step: app.step || getStepFromStatus(app.status),
      createdAt: app.createdAt,
      lastUpdated: app.lastUpdated,
      instituteName: app.instituteDetails?.name || app.instituteDetails?.instituteName || null,
      requiresVkyc: requiresVkyc(app),
      loanType: app.loanType,
    };
  }, []);

  // Switch to a different saved application
  const switchApplication = useCallback((applicationId) => {
    const app = savedApplications.find((a) => a.applicationId === applicationId);
    if (app) {
      rawDispatch({ type: 'RESTORE', payload: app });
    }
  }, [savedApplications]);

  // Start a new application (does NOT discard existing ones)
  const startNewApplication = useCallback(() => {
    rawDispatch({ type: 'RESET' });
    // RESET clears state to initialState — the new app gets a fresh applicationId on first mutation
  }, []);

  // Discard a specific application by ID
  const discardApplication = useCallback((applicationId) => {
    // Mark as discarded instead of deleting — so admin/credit/sales
    // can still see discarded applications in the queue.
    const app = savedApplications.find((a) => a.applicationId === applicationId);
    if (app) {
      const discarded = { ...app, status: 'discarded', discardedAt: new Date().toISOString() };
      saveApplicationToList(discarded);
      saveApplicationToDb(discarded);
    }
    setSavedApplications((prev) => {
      const remaining = prev.filter((a) => a.applicationId !== applicationId);
      setHasSavedApplication(remaining.some(isResumable));
      return remaining;
    });
    // If we just discarded the active one, reset state
    if (applicationId === state.applicationId) {
      rawDispatch({ type: 'RESET' });
    }
  }, [state.applicationId, savedApplications]);

  const isRejected = REJECTED_STATUSES.has(state.status);

  return (
    <LoanContext.Provider value={{
      state,
      dispatch,
      isLoaded,
      hasSavedApplication,
      savedApplications,
      getResumeInfo,
      getResumeInfoForApp,
      switchApplication,
      startNewApplication,
      discardApplication,
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

// Returns the borrower "slice" that verification screens should read
// from / write to. When a co-borrower is active (user tapped
// "Complete KYC for co-borrower X") this returns that co-borrower's
// row and an updater callback bound to UPDATE_CO_BORROWER. Otherwise
// it returns the main-borrower fields on state.
export function getActiveBorrower(state) {
  if (state?.activeCoBorrowerId) {
    const cb = (state.coBorrowers || []).find((c) => c.id === state.activeCoBorrowerId);
    if (cb) {
      return {
        isCoBorrower: true,
        id: cb.id,
        name: cb.name,
        phone: cb.phone,
        dob: cb.dob,
        email: cb.email,
        pan: cb.pan,
        relationship: cb.relationship,
        panDetails: cb.panDetails,
        creditScore: cb.creditScore,
        kycData: cb.kycData,
        kycMethod: cb.kycMethod,
        incomeData: cb.incomeData,
        bankDetails: cb.bankDetails,
        pennyDropResult: cb.pennyDropResult,
        vkycStatus: cb.vkycStatus,
        esignStatus: cb.esignStatus,
        signzyVerifications: cb.signzyVerifications,
      };
    }
  }
  return {
    isCoBorrower: false,
    id: null,
    name: state?.borrowerDetails?.name,
    phone: state?.borrowerDetails?.phone,
    dob: state?.borrowerDetails?.dob,
    email: state?.borrowerDetails?.email,
    pan: state?.panDetails?.panNumber || state?.borrowerDetails?.pan,
    relationship: state?.borrowerDetails?.relationship || null,
    panDetails: state?.panDetails,
    creditScore: state?.creditScore,
    kycData: state?.kycData,
    kycMethod: state?.kycMethod,
    incomeData: state?.incomeData,
    bankDetails: state?.bankDetails,
    pennyDropResult: state?.pennyDropResult,
    vkycStatus: state?.vkycStatus,
    esignStatus: state?.esignStatus,
    signzyVerifications: state?.signzyVerifications,
  };
}

// True once a given borrower slice (main OR co-borrower) has completed
// every gate the application needs: PAN + credit, KYC, income, and —
// when the loan amount crosses the VKYC threshold — vKYC.
export function isBorrowerFullyVerified(borrowerSlice, loanAmount) {
  if (!borrowerSlice) return false;
  const panOk = !!borrowerSlice.panDetails?.panNumber;
  const creditOk = !!borrowerSlice.creditScore
    && (borrowerSlice.creditScore.gatingPassed
      || (borrowerSlice.creditScore.cibilScore || borrowerSlice.creditScore.score || 0) >= 500);
  const kycOk = !!borrowerSlice.kycData && !!borrowerSlice.kycMethod;
  const incomeOk = !!borrowerSlice.incomeData;
  const needsVkyc = (loanAmount || 0) >= 60000;
  const vkycOk = !needsVkyc || borrowerSlice.vkycStatus === 'completed';
  return panOk && creditOk && kycOk && incomeOk && vkycOk;
}

export {
  computeStatus,
  getResumeScreen,
  getStepFromStatus,
  getStatusLabel,
  getRequestedAmount,
  requiresVkyc,
  REJECTED_STATUSES,
  TERMINAL_STATUSES,
};
