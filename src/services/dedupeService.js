import {
  collection, getDocs, query, where, orderBy,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

const APPLICATIONS_COLLECTION = 'applications';

const ACTIVE_LOAN_STATUSES = new Set([
  'fully_eligible', 'enach_done', 'esign_done', 'vkyc_done',
  'submitted', 'disbursed', 'active',
]);

const CREDIT_REPORT_MAX_AGE_DAYS = 30;

/**
 * PAN Dedupe Check
 *
 * Searches all applications in Firestore for a given PAN and returns:
 *  - Whether the borrower has any existing applications
 *  - Whether they have an active/disbursed loan (KYC can be skipped)
 *  - Their most recent credit report and whether it's still fresh
 *  - Previous KYC data that can be reused
 *  - Previous eligibility data for reference
 */
export async function checkDedupeByPan(panNumber) {
  if (!isFirebaseConfigured() || !panNumber) {
    return { found: false, applications: [] };
  }

  try {
    // Search by PAN in panDetails.panNumber
    const q = query(
      collection(db, APPLICATIONS_COLLECTION),
      where('panDetails.panNumber', '==', panNumber.toUpperCase()),
      orderBy('lastUpdated', 'desc'),
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('[dedupe] No existing applications for PAN:', panNumber);
      return { found: false, applications: [] };
    }

    const applications = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.applicationId) applications.push(data);
    });

    console.log('[dedupe] Found', applications.length, 'application(s) for PAN:', panNumber);

    // Check for active loan
    const activeLoan = applications.find((a) => ACTIVE_LOAN_STATUSES.has(a.status));
    const hasActiveLoan = !!activeLoan;

    // Get most recent KYC data (from any previous application)
    const withKyc = applications.find((a) => a.kycData && a.kycMethod);
    const previousKyc = withKyc ? {
      kycData: withKyc.kycData,
      kycMethod: withKyc.kycMethod,
      applicationId: withKyc.applicationId,
      completedAt: withKyc.kycData?.validatedAt || withKyc.lastUpdated || '',
    } : null;

    // Get most recent credit report
    const withCredit = applications.find((a) => a.creditScore);
    let creditReport = null;
    let creditReportFresh = false;

    if (withCredit?.creditScore) {
      const creditTimeline = (withCredit.timeline || []).find(
        (e) => e.event === 'credit_check',
      );
      const creditDate = creditTimeline?.at || withCredit.lastUpdated || '';
      const ageMs = creditDate ? Date.now() - new Date(creditDate).getTime() : Infinity;
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      creditReportFresh = ageDays <= CREDIT_REPORT_MAX_AGE_DAYS;

      creditReport = {
        score: withCredit.creditScore?.cibilScore || withCredit.creditScore,
        data: withCredit.creditScore,
        applicationId: withCredit.applicationId,
        fetchedAt: creditDate,
        ageDays,
        isFresh: creditReportFresh,
      };
    }

    // Get previous eligibility
    const withEligibility = applications.find((a) => a.eligibilityResult);
    const previousEligibility = withEligibility?.eligibilityResult || null;

    // Get previous income data
    const withIncome = applications.find((a) => a.incomeData);
    const previousIncome = withIncome?.incomeData || null;

    return {
      found: true,
      applications: applications.map((a) => ({
        applicationId: a.applicationId,
        status: a.status,
        amount: a.studentDetails?.balanceFee || 0,
        createdAt: a.createdAt || '',
        lastUpdated: a.lastUpdated || '',
        instituteName: a.instituteDetails?.name || '',
      })),
      hasActiveLoan,
      activeLoanId: activeLoan?.applicationId || null,
      activeLoanStatus: activeLoan?.status || null,
      // KYC reuse
      canSkipKyc: hasActiveLoan && !!previousKyc,
      previousKyc,
      // Credit report
      creditReport,
      needsFreshCreditReport: !creditReportFresh,
      // Previous data
      previousEligibility,
      previousIncome,
    };
  } catch (err) {
    console.log('[dedupe] Check failed:', err?.message);
    return { found: false, applications: [], error: err?.message };
  }
}
