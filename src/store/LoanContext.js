import React, { createContext, useContext, useReducer } from 'react';

const LoanContext = createContext(null);

const initialState = {
  currentLoan: null,
  loanType: null,
  instituteDetails: null,
  studentDetails: null,
  companyDetails: null,
  employeeDetails: null,
  borrowerType: null, // 'self' or 'parent'
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
  step: 0,
};

const loanReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOAN_TYPE':
      return { ...state, loanType: action.payload };
    case 'SET_INSTITUTE':
      return { ...state, instituteDetails: action.payload };
    case 'SET_STUDENT':
      return { ...state, studentDetails: action.payload };
    case 'SET_COMPANY':
      return { ...state, companyDetails: action.payload };
    case 'SET_EMPLOYEE':
      return { ...state, employeeDetails: action.payload };
    case 'SET_BORROWER_TYPE':
      return { ...state, borrowerType: action.payload };
    case 'SET_BORROWER_DETAILS':
      return { ...state, borrowerDetails: action.payload };
    case 'SET_PRODUCT':
      return { ...state, selectedProduct: action.payload };
    case 'SET_TENURE':
      return { ...state, selectedTenure: action.payload };
    case 'SET_PAN':
      return { ...state, panDetails: action.payload };
    case 'SET_CREDIT_SCORE':
      return { ...state, creditScore: action.payload };
    case 'SET_KYC_METHOD':
      return { ...state, kycMethod: action.payload };
    case 'SET_KYC_DATA':
      return { ...state, kycData: action.payload };
    case 'SET_SELFIE':
      return { ...state, selfieData: action.payload };
    case 'SET_BANK_DETAILS':
      return { ...state, bankDetails: action.payload };
    case 'SET_PENNY_DROP':
      return { ...state, pennyDropResult: action.payload };
    case 'SET_INCOME':
      return { ...state, incomeData: action.payload };
    case 'SET_ELIGIBILITY':
      return { ...state, eligibilityResult: action.payload };
    case 'SET_ENACH':
      return { ...state, enachStatus: action.payload };
    case 'SET_ESIGN':
      return { ...state, esignStatus: action.payload };
    case 'SET_VKYC':
      return { ...state, vkycStatus: action.payload };
    case 'SET_RISK_PROFILE':
      return { ...state, riskProfile: action.payload };
    case 'SET_CURRENT_LOAN':
      return { ...state, currentLoan: action.payload };
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

export const LoanProvider = ({ children }) => {
  const [state, dispatch] = useReducer(loanReducer, initialState);

  return (
    <LoanContext.Provider value={{ state, dispatch }}>
      {children}
    </LoanContext.Provider>
  );
};

export const useLoan = () => {
  const context = useContext(LoanContext);
  if (!context) throw new Error('useLoan must be used within LoanProvider');
  return context;
};
