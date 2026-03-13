/**
 * Bank Statement Parser
 *
 * Parses income analysis data from Account Aggregator or bank statement upload
 * into the format expected by the risk engine's scoreBankStatement() scorer.
 *
 * Input: raw income analysis from AA/bank statement APIs
 * Output: normalized bank statement data for risk scoring
 */

/**
 * Parse Account Aggregator response into risk engine format.
 * @param {object} aaData - Raw AA data (from bankService.getIncomeAnalysis)
 * @returns {object} Normalized bank statement data for risk scoring
 */
export function parseAccountAggregatorData(aaData) {
  if (!aaData) return null;

  const transactions = aaData.transactions || [];
  const summary = aaData.summary || aaData;

  // Detect salary credits
  const salaryCredits = detectSalaryPattern(transactions, summary);

  // Calculate bounce metrics
  const bounceMetrics = calculateBounceMetrics(transactions, summary);

  // Cash flow analysis
  const cashFlow = analyzeCashFlow(transactions, summary);

  // Suspicious transaction detection
  const suspicious = detectSuspiciousTransactions(transactions);

  // EMI detection
  const emiDebits = detectEmiDebits(transactions, summary);

  return {
    salaryCredits,
    bounceRate: bounceMetrics.bounceRate,
    chequeBounces: bounceMetrics.chequeBounces,
    mandateBounces: bounceMetrics.mandateBounces,
    cashFlowVolatility: cashFlow.volatility,
    averageMonthlyBalance: cashFlow.averageMonthlyBalance,
    daysWithZeroBalance: cashFlow.daysWithZeroBalance,
    endOfDayBalanceTrend: cashFlow.trend,
    suspiciousTransactions: suspicious.transactions,
    circularTransactions: suspicious.hasCircular,
    gamblingTransactions: suspicious.gamblingCount,
    cryptoTransactions: suspicious.cryptoCount,
    emiDebits,
  };
}

/**
 * Parse raw bank statement upload response (from PDF/CSV analysis).
 * @param {object} statementData - Parsed bank statement data
 * @returns {object} Normalized bank statement data for risk scoring
 */
export function parseBankStatementUpload(statementData) {
  if (!statementData) return null;

  // If already in the right format (from a processor like Perfios/Finbox)
  if (statementData.salaryCredits && statementData.bounceRate !== undefined) {
    return statementData;
  }

  // Parse from raw income analysis format
  return {
    salaryCredits: {
      detected: (statementData.monthlyIncome || 0) > 0,
      frequency: statementData.salaryFrequency || (statementData.monthlyIncome > 0 ? 'monthly' : 'none'),
      averageAmount: statementData.monthlyIncome || 0,
      missedMonths: statementData.missedSalaryMonths || 0,
    },
    bounceRate: statementData.bounceCount > 0
      ? statementData.bounceCount / Math.max(statementData.totalTransactions || 1, 1)
      : 0,
    chequeBounces: statementData.chequeBounces || 0,
    mandateBounces: statementData.mandateBounces || statementData.bounceCount || 0,
    cashFlowVolatility: calculateVolatilityFromSummary(statementData),
    averageMonthlyBalance: statementData.averageBalance || 0,
    daysWithZeroBalance: statementData.daysWithZeroBalance || 0,
    endOfDayBalanceTrend: inferBalanceTrend(statementData),
    suspiciousTransactions: [],
    circularTransactions: false,
    gamblingTransactions: 0,
    cryptoTransactions: 0,
    emiDebits: {
      detected: (statementData.emiObligations || 0) > 0,
      totalAmount: statementData.emiObligations || 0,
      bounced: 0,
    },
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function detectSalaryPattern(transactions, summary) {
  if (summary.salaryDetected !== undefined) {
    return {
      detected: summary.salaryDetected,
      frequency: summary.salaryFrequency || 'monthly',
      averageAmount: summary.averageSalary || summary.monthlyIncome || 0,
      missedMonths: summary.missedSalaryMonths || 0,
    };
  }

  // Heuristic: look for recurring credits of similar amounts
  const credits = transactions.filter(t => t.type === 'credit' && t.amount > 5000);
  if (credits.length === 0) {
    return { detected: false, frequency: 'none', averageAmount: 0, missedMonths: 0 };
  }

  // Group by month
  const monthlyCredits = {};
  credits.forEach(t => {
    const month = (t.date || t.transactionDate || '').substring(0, 7);
    if (month) {
      if (!monthlyCredits[month]) monthlyCredits[month] = [];
      monthlyCredits[month].push(t.amount);
    }
  });

  const months = Object.keys(monthlyCredits).sort();
  if (months.length < 2) {
    return { detected: false, frequency: 'irregular', averageAmount: 0, missedMonths: 0 };
  }

  // Find the most common credit amount (salary indicator)
  const allAmounts = credits.map(t => t.amount);
  const avgCredit = allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length;

  // Check if amounts are within 20% of average (salary consistency)
  const consistentCredits = allAmounts.filter(a => Math.abs(a - avgCredit) / avgCredit < 0.2);
  const isRegular = consistentCredits.length >= months.length * 0.7;

  return {
    detected: true,
    frequency: isRegular ? 'monthly' : 'irregular',
    averageAmount: Math.round(avgCredit),
    missedMonths: Math.max(0, 6 - months.length), // Assume 6-month statement
  };
}

function calculateBounceMetrics(transactions, summary) {
  if (summary.bounceRate !== undefined) {
    return {
      bounceRate: summary.bounceRate,
      chequeBounces: summary.chequeBounces || 0,
      mandateBounces: summary.mandateBounces || summary.bounceCount || 0,
    };
  }

  const bounced = transactions.filter(t =>
    t.status === 'bounced' || t.status === 'returned' ||
    /bounce|return|dishonour/i.test(t.narration || t.description || '')
  );

  const totalDebits = transactions.filter(t => t.type === 'debit').length || 1;

  return {
    bounceRate: bounced.length / totalDebits,
    chequeBounces: bounced.filter(t => /cheque|chq/i.test(t.narration || '')).length,
    mandateBounces: bounced.filter(t => /nach|mandate|ecs/i.test(t.narration || '')).length,
  };
}

function analyzeCashFlow(transactions, summary) {
  if (summary.cashFlowVolatility !== undefined) {
    return {
      volatility: summary.cashFlowVolatility,
      averageMonthlyBalance: summary.averageMonthlyBalance || summary.averageBalance || 0,
      daysWithZeroBalance: summary.daysWithZeroBalance || 0,
      trend: summary.endOfDayBalanceTrend || summary.balanceTrend || 'stable',
    };
  }

  return {
    volatility: calculateVolatilityFromSummary(summary),
    averageMonthlyBalance: summary.averageBalance || 0,
    daysWithZeroBalance: summary.daysWithZeroBalance || 0,
    trend: inferBalanceTrend(summary),
  };
}

const SUSPICIOUS_KEYWORDS = /gambling|bet365|dream11|poker|casino|lottery|matka/i;
const CRYPTO_KEYWORDS = /wazirx|coinswitch|coindcx|binance|crypto|bitcoin|zebpay/i;
const CIRCULAR_KEYWORDS = /self.?transfer|own.?account/i;

function detectSuspiciousTransactions(transactions) {
  const suspicious = [];
  let gamblingCount = 0;
  let cryptoCount = 0;
  let hasCircular = false;

  transactions.forEach(t => {
    const narration = t.narration || t.description || '';

    if (SUSPICIOUS_KEYWORDS.test(narration)) {
      suspicious.push({ type: 'gambling', narration, amount: t.amount, date: t.date });
      gamblingCount++;
    }

    if (CRYPTO_KEYWORDS.test(narration)) {
      cryptoCount++;
    }

    if (CIRCULAR_KEYWORDS.test(narration)) {
      hasCircular = true;
    }
  });

  return { transactions: suspicious, gamblingCount, cryptoCount, hasCircular };
}

function detectEmiDebits(transactions, summary) {
  if (summary.emiObligations !== undefined) {
    return {
      detected: (summary.emiObligations || 0) > 0,
      totalAmount: summary.emiObligations || 0,
      bounced: summary.emiBounces || 0,
    };
  }

  const emiTxns = transactions.filter(t =>
    /emi|loan|nach|mandate/i.test(t.narration || t.description || '') &&
    t.type === 'debit'
  );

  const bounced = emiTxns.filter(t => t.status === 'bounced' || t.status === 'returned');

  return {
    detected: emiTxns.length > 0,
    totalAmount: emiTxns.reduce((sum, t) => sum + (t.amount || 0), 0),
    bounced: bounced.length,
  };
}

function calculateVolatilityFromSummary(summary) {
  if (summary.cashFlowVolatility !== undefined) return summary.cashFlowVolatility;
  const totalCredits = summary.totalCredits || 0;
  const totalDebits = summary.totalDebits || 0;
  if (totalCredits === 0) return 1.0;
  const ratio = totalDebits / totalCredits;
  if (ratio > 0.95) return 0.7; // Spending almost everything
  if (ratio > 0.8) return 0.4;
  if (ratio > 0.6) return 0.2;
  return 0.1;
}

function inferBalanceTrend(summary) {
  if (summary.endOfDayBalanceTrend) return summary.endOfDayBalanceTrend;
  if (summary.balanceTrend) return summary.balanceTrend;
  const avg = summary.averageBalance || 0;
  if (avg <= 500) return 'flat_near_zero';
  if (avg <= 5000) return 'declining';
  return 'stable';
}
