const MOCK_FIP_LIST = [
  { id: 'SBIN', code: 'SBIN', name: 'State Bank of India' },
  { id: 'HDFC', code: 'HDFC', name: 'HDFC Bank' },
  { id: 'ICICI', code: 'ICIC', name: 'ICICI Bank' },
  { id: 'KOTAK', code: 'KKBK', name: 'Kotak Mahindra Bank' },
  { id: 'AXIS', code: 'UTIB', name: 'Axis Bank' },
  { id: 'PNB', code: 'PUNB', name: 'Punjab National Bank' },
  { id: 'BOB', code: 'BARB', name: 'Bank of Baroda' },
  { id: 'CANARA', code: 'CNRB', name: 'Canara Bank' },
  { id: 'UNION', code: 'UBIN', name: 'Union Bank of India' },
  { id: 'IOB', code: 'IOBA', name: 'Indian Overseas Bank' },
  { id: 'IB', code: 'IDIB', name: 'Indian Bank' },
  { id: 'BOI', code: 'BKID', name: 'Bank of India' },
  { id: 'YES', code: 'YESB', name: 'Yes Bank' },
  { id: 'INDUSIND', code: 'INDB', name: 'IndusInd Bank' },
  { id: 'FEDERAL', code: 'FDRL', name: 'Federal Bank' },
  { id: 'IDFC', code: 'IDFB', name: 'IDFC First Bank' },
  { id: 'RBL', code: 'RATN', name: 'RBL Bank' },
  { id: 'BOM', code: 'MAHB', name: 'Bank of Maharashtra' },
  { id: 'UCO', code: 'UCBA', name: 'UCO Bank' },
  { id: 'CBI', code: 'CBIN', name: 'Central Bank of India' },
];

const IFSC_BANK_MAP = {
  SBIN: { bank: 'State Bank of India', branch: 'Main Branch' },
  HDFC: { bank: 'HDFC Bank', branch: 'Main Branch' },
  ICIC: { bank: 'ICICI Bank', branch: 'Main Branch' },
  KKBK: { bank: 'Kotak Mahindra Bank', branch: 'Main Branch' },
  UTIB: { bank: 'Axis Bank', branch: 'Main Branch' },
  PUNB: { bank: 'Punjab National Bank', branch: 'Main Branch' },
  BARB: { bank: 'Bank of Baroda', branch: 'Main Branch' },
  CNRB: { bank: 'Canara Bank', branch: 'Main Branch' },
  UBIN: { bank: 'Union Bank of India', branch: 'Main Branch' },
  IOBA: { bank: 'Indian Overseas Bank', branch: 'Main Branch' },
  IDIB: { bank: 'Indian Bank', branch: 'Main Branch' },
  BKID: { bank: 'Bank of India', branch: 'Main Branch' },
  YESB: { bank: 'Yes Bank', branch: 'Main Branch' },
  INDB: { bank: 'IndusInd Bank', branch: 'Main Branch' },
  FDRL: { bank: 'Federal Bank', branch: 'Main Branch' },
  IDFB: { bank: 'IDFC First Bank', branch: 'Main Branch' },
  RATN: { bank: 'RBL Bank', branch: 'Main Branch' },
  MAHB: { bank: 'Bank of Maharashtra', branch: 'Main Branch' },
  UCBA: { bank: 'UCO Bank', branch: 'Main Branch' },
  CBIN: { bank: 'Central Bank of India', branch: 'Main Branch' },
};

export const bankService = {
  async pennyDrop(data) {
    console.log('[bankService] Mock pennyDrop for account:', data.accountNumber?.slice(-4));
    await new Promise((r) => setTimeout(r, 1200));
    const name = (data.name || 'RAHUL SHARMA').toUpperCase();
    return {
      verified: true,
      nameMatch: true,
      accountHolderName: name,
      bankRefNo: 'PD' + Date.now(),
      accountNumberLast4: (data.accountNumber || '').slice(-4),
    };
  },

  async validateIfsc(ifsc) {
    console.log('[bankService] Mock validateIfsc:', ifsc);
    await new Promise((r) => setTimeout(r, 400));
    const prefix = (ifsc || '').substring(0, 4).toUpperCase();
    const match = IFSC_BANK_MAP[prefix];
    if (match) {
      return { bank: match.bank, branch: match.branch + ', ' + ifsc };
    }
    return { bank: '', branch: '' };
  },

  // Account Aggregator
  async getFIPList() {
    console.log('[bankService] Mock getFIPList');
    await new Promise((r) => setTimeout(r, 300));
    return { fips: MOCK_FIP_LIST };
  },

  async initiateAA(data) {
    console.log('[bankService] Mock initiateAA for FIP:', data.fipName);
    await new Promise((r) => setTimeout(r, 800));
    return { requestId: 'aa_' + Date.now(), status: 'initiated' };
  },

  async getAAStatus(requestId) {
    console.log('[bankService] Mock getAAStatus');
    await new Promise((r) => setTimeout(r, 500));
    return {
      status: 'completed',
      income: {
        monthlyIncome: 45000,
        averageBalance: 32000,
        totalCredits: 270000,
        totalDebits: 210000,
        emiObligations: 8000,
        bounceCount: 0,
        accountHolderName: 'RAHUL SHARMA',
        accountNumberLast4: '7890',
      },
    };
  },

  // Bank Statement
  async uploadBankStatement(formData) {
    console.log('[bankService] Mock uploadBankStatement');
    await new Promise((r) => setTimeout(r, 1500));
    return {
      income: {
        monthlyIncome: 45000,
        averageBalance: 32000,
        totalCredits: 270000,
        totalDebits: 210000,
        emiObligations: 8000,
        bounceCount: 0,
        accountHolderName: 'RAHUL SHARMA',
        accountNumberLast4: '7890',
      },
    };
  },

  async getIncomeAnalysis(analysisId) {
    console.log('[bankService] Mock getIncomeAnalysis:', analysisId);
    await new Promise((r) => setTimeout(r, 500));
    return {
      monthlyIncome: 45000,
      averageBalance: 32000,
      status: 'completed',
    };
  },
};
