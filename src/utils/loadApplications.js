import AsyncStorage from '@react-native-async-storage/async-storage';

const MULTI_STORAGE_KEY = 'finz_loan_applications';

/**
 * Load all real applications from AsyncStorage (the same store
 * LoanContext writes to) and transform them into the shape the admin
 * dashboard cards expect.  Returns an array sorted by lastUpdated
 * (most recent first).
 *
 * The dashboards can merge this list with their mock data so staff
 * always see both real in-progress applications AND demo data.
 */
export async function loadRealApplications() {
  try {
    const raw = await AsyncStorage.getItem(MULTI_STORAGE_KEY);
    if (!raw) return [];
    const apps = JSON.parse(raw);
    if (!Array.isArray(apps)) return [];

    return apps
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

        // ── Meta ──
        lastUpdated: a.lastUpdated || a.createdAt || '',
        createdAt: a.createdAt || '',

        // Mark as real so dashboards can distinguish from mocks
        _isReal: true,
        // Keep the full raw state for the detail screen
        _rawState: a,
      }))
      .sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));
  } catch (err) {
    console.log('[loadRealApplications] Failed:', err?.message);
    return [];
  }
}

/**
 * Merge real applications with mock data. Real apps come first;
 * mocks are appended after with de-duplicated IDs.
 */
export function mergeWithMocks(realApps, mockApps) {
  const realIds = new Set(realApps.map((a) => a.id));
  const uniqueMocks = mockApps.filter((m) => !realIds.has(m.id));
  return [...realApps, ...uniqueMocks];
}
