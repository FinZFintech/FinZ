import { signzyService } from './signzyService';

// ─── Fuzzy Name Matching ──────────────────────────────────────────────────────
// Levenshtein distance for fuzzy string comparison

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Compute fuzzy match confidence score between two names.
 * Returns a score from 0 to 100.
 */
function fuzzyNameScore(name1, name2) {
  if (!name1 || !name2) return 0;

  const a = name1.trim().toUpperCase().replace(/\s+/g, ' ');
  const b = name2.trim().toUpperCase().replace(/\s+/g, ' ');

  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshteinDistance(a, b);
  const similarity = ((maxLen - dist) / maxLen) * 100;

  // Bonus: check if one contains the other (handles middle name variations)
  const containsBonus = a.includes(b) || b.includes(a) ? 15 : 0;

  // Bonus: check if all tokens in the shorter name appear in the longer
  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length > tokensB.length ? tokensA : tokensB;
  const tokenMatches = shorter.filter((t) => longer.includes(t)).length;
  const tokenBonus = shorter.length > 0 ? (tokenMatches / shorter.length) * 20 : 0;

  return Math.min(100, Math.round(similarity + containsBonus + tokenBonus));
}

const NAME_MATCH_THRESHOLD = 60; // >60% confidence

// ─── Static Data ──────────────────────────────────────────────────────────────

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

// ─── Bank Service ─────────────────────────────────────────────────────────────

export const bankService = {
  /**
   * Bank account verification via Signzy Hybrid API (penny drop / penniless).
   * Replaces the old mock pennyDrop.
   */
  async pennyDrop(data) {
    const { accountNumber, ifsc, name, mobile } = data;
    console.log('[bankService] pennyDrop → calling Signzy hybrid bank verification for:', accountNumber?.slice(-4));

    const result = await signzyService.verifyBankAccount(accountNumber, ifsc, name, mobile, {
      nameFuzzy: 'true',
      nameMatchScore: '0.6',
    });

    console.log('[bankService] pennyDrop result:', JSON.stringify({
      active: result.accountActive,
      nameMatch: result.nameMatch,
      nameMatchScore: result.nameMatchScore,
      accountHolderName: result.accountHolderName,
    }));

    return {
      verified: result.accountActive,
      nameMatch: result.nameMatch,
      nameMatchScore: result.nameMatchScore,
      accountHolderName: result.accountHolderName,
      bankRefNo: result.bankRRN || result.signzyReferenceId || '',
      accountNumberLast4: (accountNumber || '').slice(-4),
      reason: result.reason,
      signzyReferenceId: result.signzyReferenceId,
      beneIFSC: result.beneIFSC,
    };
  },

  /**
   * Cross-match names across bank (penny drop), PAN, and AA with fuzzy logic.
   * Returns match results for each pair with confidence scores.
   * @param {Object} names - { bankName, panName, aaName, borrowerName }
   * @returns {Object} Match results with scores and overall verdict
   */
  crossMatchNames({ bankName, panName, aaName, borrowerName }) {
    console.log('[bankService] crossMatchNames →', { bankName, panName, aaName, borrowerName });

    const pairs = [];

    // Bank vs PAN
    if (bankName && panName) {
      const score = fuzzyNameScore(bankName, panName);
      pairs.push({ pair: 'Bank vs PAN', name1: bankName, name2: panName, score, matched: score > NAME_MATCH_THRESHOLD });
    }

    // Bank vs AA
    if (bankName && aaName) {
      const score = fuzzyNameScore(bankName, aaName);
      pairs.push({ pair: 'Bank vs AA', name1: bankName, name2: aaName, score, matched: score > NAME_MATCH_THRESHOLD });
    }

    // PAN vs AA
    if (panName && aaName) {
      const score = fuzzyNameScore(panName, aaName);
      pairs.push({ pair: 'PAN vs AA', name1: panName, name2: aaName, score, matched: score > NAME_MATCH_THRESHOLD });
    }

    // Bank vs Borrower (application name)
    if (bankName && borrowerName) {
      const score = fuzzyNameScore(bankName, borrowerName);
      pairs.push({ pair: 'Bank vs Application', name1: bankName, name2: borrowerName, score, matched: score > NAME_MATCH_THRESHOLD });
    }

    const allMatched = pairs.length > 0 && pairs.every((p) => p.matched);
    const anyFailed = pairs.some((p) => !p.matched);
    const avgScore = pairs.length > 0
      ? Math.round(pairs.reduce((sum, p) => sum + p.score, 0) / pairs.length)
      : 0;

    const result = {
      pairs,
      allMatched,
      anyFailed,
      averageScore: avgScore,
      threshold: NAME_MATCH_THRESHOLD,
    };

    console.log('[bankService] crossMatchNames result:', JSON.stringify({
      allMatched: result.allMatched,
      averageScore: result.averageScore,
      pairs: result.pairs.map((p) => `${p.pair}: ${p.score}%`),
    }));

    return result;
  },

  async validateIfsc(ifsc) {
    console.log('[bankService] validateIfsc:', ifsc);
    // Try Signzy IFSC search first, fall back to local map
    try {
      const result = await signzyService.searchBankByIfsc(ifsc);
      if (result.bankName) {
        return { bank: result.bankName, branch: result.branchName || ifsc };
      }
    } catch (err) {
      console.log('[bankService] Signzy IFSC search failed, using local map:', err.message);
    }
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

export { fuzzyNameScore, NAME_MATCH_THRESHOLD };
