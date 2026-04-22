import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAllApplicationsFromDb } from '../services/applicationDbService';
import { isFirebaseConfigured } from '../config/firebase';

const MULTI_STORAGE_KEY = 'finz_loan_applications';

/**
 * Load all real applications — tries Firestore first (shared DB visible
 * to all roles on all devices), falls back to AsyncStorage (local
 * device only) when Firebase isn't configured.
 *
 * Returns an array sorted by lastUpdated (most recent first), shaped
 * for the admin dashboard cards.
 */
export async function loadRealApplications() {
  try {
    let apps = [];

    // ── Primary: Firestore (shared across devices / roles) ──
    if (isFirebaseConfigured()) {
      const firestoreApps = await loadAllApplicationsFromDb();
      console.log(
        '[loadRealApplications] Firestore:',
        firestoreApps.length,
        'app(s)',
        firestoreApps.map((a) => `${a.applicationId} (${a.status})`).join(', '),
      );
      apps = firestoreApps;
    }

    // ── Fallback: AsyncStorage (local, same-device only) ──
    if (apps.length === 0) {
      const raw = await AsyncStorage.getItem(MULTI_STORAGE_KEY);
      console.log(
        '[loadRealApplications] AsyncStorage fallback:',
        raw ? `${raw.length} chars` : 'null (no data)',
      );
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          apps = parsed;
          console.log(
            '[loadRealApplications] AsyncStorage:',
            apps.length,
            'app(s):',
            apps.map((a) => `${a.applicationId} (${a.status})`).join(', '),
          );
        }
      }
    }

    if (apps.length === 0) return [];

    const transformed = apps
      .filter((a) => a && a.applicationId)
      .map((a) => ({
        // ── Fields the dashboard cards render ──
        id: a.applicationId,
        customerName:
          a.borrowerDetails?.name ||
          a.studentDetails?.studentName ||
          'Unknown',
        customerPhone: a.borrowerDetails?.phone || '',
        customerEmail: a.borrowerDetails?.email || '',
        customerDob: a.borrowerDetails?.dob || '',
        customerGender: a.kycData?.gender || '',
        customerAddress: a.kycData?.address || a.borrowerDetails?.address || '',
        instituteName:
          a.instituteDetails?.name ||
          a.instituteDetails?.instituteName ||
          a.companyDetails?.name ||
          '',
        amount: a.studentDetails?.balanceFee || 0,
        status: a.status || 'draft',
        creditScore: typeof a.creditScore === 'object' ? a.creditScore?.cibilScore : a.creditScore,
        riskScore: a.riskProfile?.totalScore || null,
        appliedDate:
          a.createdAt
            ? new Date(a.createdAt).toISOString().slice(0, 10)
            : '',
        category: a.loanType || 'Education',

        // ── PAN / KYC / Borrower ──
        panNumber: a.panDetails?.panNumber || a.borrowerDetails?.pan || '',
        borrowerType: a.borrowerType || 'Self',
        studentName: a.studentDetails?.studentName || '',
        fatherName: a.kycData?.fatherName || '',
        courseName: a.studentDetails?.courseName || '',
        regNo: a.studentDetails?.regNo || '',

        // ── KYC ──
        kycMethod: a.kycMethod || null,
        kycStatus:
          a.kycData && a.kycMethod
            ? 'Verified'
            : a.kycData?.nameMatchFailed
              ? 'Name Mismatch'
              : 'Pending',
        kycData: a.kycData || null,
        kycFailures: a.kycFailures || [],
        aadhaarLast4: a.kycData?.uid ? a.kycData.uid.slice(-4) : '',

        // ── Bank / Income ──
        bankName: a.bankDetails?.bankName || '',
        accountNumber: a.bankDetails?.accountNumber
          ? `XXXX XXXX ${a.bankDetails.accountNumber.slice(-4)}`
          : '',
        ifscCode: a.bankDetails?.ifsc || '',
        pennyDropStatus: a.pennyDropResult ? 'Verified' : 'Pending',
        monthlyIncome: a.incomeData?.monthlyIncome || 0,
        incomeSource: a.incomeData?.source || a.bankDetails?.occupationCategory || '',

        // ── Loan product ──
        product: a.selectedProduct?.name || '',
        interestRate: a.selectedProduct?.interestRate || 0,
        tenure: a.selectedTenure || 0,
        processingFee: a.selectedProduct?.processingFee || '',
        emi: a.selectedProduct && a.selectedTenure && a.studentDetails?.balanceFee
          ? Math.round(a.studentDetails.balanceFee * 0.09)
          : 0,

        // ── eNACH / eSign / vKYC ──
        enachStatus: a.enachStatus?.completed ? 'Completed' : 'Pending',
        esignStatus: a.esignStatus?.completed ? 'Completed' : 'Pending',

        // ── Signzy verifications (full objects for staff detail screen) ──
        signzyVerifications: a.signzyVerifications || {},

        // ── Risk ──
        riskProfile: a.riskProfile || null,

        // ── Selfie ──
        selfieData: a.selfieData || null,

        // ── References ──
        references: a.references || null,

        // ── Timeline ──
        timeline: a.timeline || [],

        // ── Eligibility ──
        eligibilityResult: a.eligibilityResult || null,

        // ── Meta ──
        lastUpdated: a.lastUpdated || a.createdAt || '',
        createdAt: a.createdAt || '',

        // Mark as real so dashboards can distinguish from mocks
        _isReal: true,
        // Keep the full raw state for the detail screen
        _rawState: a,
      }))
      .sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));

    console.log(
      '[loadRealApplications] Returning',
      transformed.length,
      'transformed app(s)',
    );
    return transformed;
  } catch (err) {
    console.log('[loadRealApplications] Failed:', err?.message);
    return [];
  }
}

