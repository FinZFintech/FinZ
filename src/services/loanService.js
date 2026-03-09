import api from './api';
import { API_ENDPOINTS } from '../config/constants';

const replaceParams = (url, params) => {
  let result = url;
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`{${key}}`, value);
  });
  return result;
};

export const loanService = {
  // Institute & Student
  async getInstitutes(search = '') {
    return api.get(API_ENDPOINTS.INSTITUTE.LIST, { params: { search } });
  },

  async getStudentDetails(instituteId, regNo) {
    return api.get(
      replaceParams(API_ENDPOINTS.INSTITUTE.STUDENT_DETAILS, { id: instituteId, regNo })
    );
  },

  async getInstituteLoanProducts(instituteId) {
    return api.get(replaceParams(API_ENDPOINTS.INSTITUTE.LOAN_PRODUCTS, { id: instituteId }));
  },

  // Company & Employee
  async getCompanies(search = '') {
    return api.get(API_ENDPOINTS.COMPANY.LIST, { params: { search } });
  },

  async getEmployeeDetails(companyId, empId) {
    return api.get(
      replaceParams(API_ENDPOINTS.COMPANY.EMPLOYEE_DETAILS, { id: companyId, empId })
    );
  },

  async getCompanyLoanProducts(companyId) {
    return api.get(replaceParams(API_ENDPOINTS.COMPANY.LOAN_PRODUCTS, { id: companyId }));
  },

  // Loan CRUD
  async createLoan(loanData) {
    return api.post(API_ENDPOINTS.LOAN.CREATE, loanData);
  },

  async getLoanStatus(loanId) {
    return api.get(replaceParams(API_ENDPOINTS.LOAN.STATUS, { id: loanId }));
  },

  async getLoans(filters = {}) {
    return api.get(API_ENDPOINTS.LOAN.LIST, { params: filters });
  },

  async getLoanDetails(loanId) {
    return api.get(replaceParams(API_ENDPOINTS.LOAN.DETAILS, { id: loanId }));
  },

  async checkEligibility(loanId) {
    return api.post(replaceParams(API_ENDPOINTS.LOAN.ELIGIBILITY, { id: loanId }));
  },

  async getRepaymentSchedule(loanId) {
    return api.get(replaceParams(API_ENDPOINTS.LOAN.REPAYMENT_SCHEDULE, { id: loanId }));
  },

  // Servicing
  async requestPrepayment(loanId, data) {
    return api.post(replaceParams(API_ENDPOINTS.LOAN.PREPAYMENT, { id: loanId }), data);
  },

  async requestForeclosure(loanId) {
    return api.post(replaceParams(API_ENDPOINTS.LOAN.FORECLOSURE, { id: loanId }));
  },

  async requestNOC(loanId) {
    return api.post(replaceParams(API_ENDPOINTS.LOAN.NOC, { id: loanId }));
  },

  // eNACH & eSign
  async initiateEnach(loanId, data) {
    return api.post(replaceParams(API_ENDPOINTS.LOAN.ENACH_INITIATE, { id: loanId }), data);
  },

  async getEnachStatus(loanId) {
    return api.get(replaceParams(API_ENDPOINTS.LOAN.ENACH_STATUS, { id: loanId }));
  },

  async initiateEsign(loanId) {
    return api.post(replaceParams(API_ENDPOINTS.LOAN.ESIGN_INITIATE, { id: loanId }));
  },

  async getEsignStatus(loanId) {
    return api.get(replaceParams(API_ENDPOINTS.LOAN.ESIGN_STATUS, { id: loanId }));
  },
};
