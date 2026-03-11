/**
 * FinZ Risk Scoring Engine v2
 *
 * 12 categories, time-decay weighting, product-aware adjustments.
 * Final score: 0-1000.
 */

// ─── Weights (must sum to 1.0) ──────────────────────────────────────────────

const CATEGORY_WEIGHTS = {
  identity:      0.10,  // PAN, Aadhaar, DigiLocker, phone-to-identity
  creditBureau:  0.18,  // CIBIL score, trade lines, DPD, inquiries
  financial:     0.10,  // Bank account, employment, PF, IFSC
  bankStatement: 0.10,  // Account Aggregator cash flow analysis
  phoneDigital:  0.07,  // Phone risk, WhatsApp, digital identity, integrity
  address:       0.05,  // Geocode, pincode, geo-fencing
  income:        0.10,  // Phone income, ITR/26AS, GST, FOIR
  document:      0.04,  // Forgery detection
  device:        0.05,  // IMEI, alternate phones
  fraud:         0.10,  // Velocity checks, fraud ring, network graph
  behavioral:    0.05,  // Session behavior analytics
  legal:         0.06,  // Court records, CERSAI, wilful defaulter
};

const CATEGORY_LABELS = {
  identity:      'Identity Verification',
  creditBureau:  'Credit Bureau (CIBIL)',
  financial:     'Financial Stability',
  bankStatement: 'Bank Statement (AA)',
  phoneDigital:  'Phone & Digital Trust',
  address:       'Address & Location',
  income:        'Income & Capacity',
  document:      'Document Integrity',
  device:        'Device & Hardware',
  fraud:         'Fraud Detection',
  behavioral:    'Session Behavior',
  legal:         'Legal & Compliance',
};

const CATEGORY_COLORS = {
  identity:      '#6c5ce7',
  creditBureau:  '#00b894',
  financial:     '#0984e3',
  bankStatement: '#00cec9',
  phoneDigital:  '#a29bfe',
  address:       '#fdcb6e',
  income:        '#e17055',
  document:      '#d63031',
  device:        '#636e72',
  fraud:         '#ff7675',
  behavioral:    '#74b9ff',
  legal:         '#fab1a0',
};

const THRESHOLDS = {
  AUTO_APPROVE:  800,
  STANDARD:      600,
  ELEVATED:      400,
  MANUAL_REVIEW: 200,
};

function calculateEmi(principal, annualRate, tenureMonths) {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  return principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Time-decay: returns a multiplier (0.3 - 1.0) based on how recent an event is.
 * Events within 30 days get full weight (1.0).
 * Events older than 2 years get minimum weight (0.3).
 */
function timeDecay(dateStr) {
  if (!dateStr) return 0.5;
  const eventDate = new Date(dateStr);
  const now = new Date();
  const daysDiff = (now - eventDate) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 30) return 1.0;
  if (daysDiff <= 90) return 0.9;
  if (daysDiff <= 180) return 0.8;
  if (daysDiff <= 365) return 0.6;
  if (daysDiff <= 730) return 0.4;
  return 0.3;
}


// ═══════════════════════════════════════════════════════════════════════════
//  Category Scorers
// ═══════════════════════════════════════════════════════════════════════════

function scoreIdentity(apis) {
  let score = 0;
  const flags = [];

  const pan = apis.panFetch?.output?.result;
  if (pan) {
    if (pan.isValid) { score += 20; flags.push({ type: 'positive', text: 'PAN is valid' }); }
    else { score -= 50; flags.push({ type: 'negative', text: 'PAN is INVALID / FAKE' }); }
    if (pan.panStatusLabel === 'VALID') score += 10;
    else if (['FAKE', 'DEACTIVATED', 'DELETED'].includes(pan.panStatusLabel)) { score -= 50; flags.push({ type: 'negative', text: `PAN status: ${pan.panStatusLabel}` }); }
    if (pan.aadhaarSeedingStatus === 'Yes') { score += 10; flags.push({ type: 'positive', text: 'Aadhaar seeded to PAN' }); }
    else { score -= 5; flags.push({ type: 'neutral', text: 'Aadhaar not seeded to PAN' }); }
    if (pan.individualTaxComplianceStatus === 'Operative') score += 5;
    else { score -= 10; flags.push({ type: 'negative', text: 'Tax compliance: inoperative' }); }
  }

  const p2p = apis.phoneToPan?.output?.result;
  if (p2p) {
    if (p2p.matchFound) { score += 15; flags.push({ type: 'positive', text: 'Phone-to-PAN match confirmed' }); }
    else { score -= 5; flags.push({ type: 'neutral', text: 'Phone-to-PAN: no match found' }); }
  }

  const ident = apis.phoneToIdentity?.output?.result;
  if (ident) {
    if (ident.identities?.length >= 2) { score += 10; flags.push({ type: 'positive', text: `${ident.identities.length} identity docs found` }); }
    else if (ident.identities?.length === 1) score += 5;
    else { score -= 10; flags.push({ type: 'negative', text: 'No identity documents found' }); }
    if (ident.consistencyScore >= 80) { score += 15; flags.push({ type: 'positive', text: `Identity consistency: ${ident.consistencyScore}%` }); }
    else if (ident.consistencyScore >= 60) score += 8;
    else { score -= 10; flags.push({ type: 'negative', text: `Low identity consistency: ${ident.consistencyScore}%` }); }
  }

  const digi = apis.digilockerDetails?.output?.result;
  if (digi) {
    if (digi.totalDocuments >= 3) { score += 10; flags.push({ type: 'positive', text: `${digi.totalDocuments} DigiLocker docs` }); }
    else if (digi.totalDocuments >= 1) score += 5;
    else score -= 5;
  }

  const eaa = apis.eAadhaarXml?.output?.result;
  if (eaa) {
    if (eaa.digitalSignatureValid) { score += 5; flags.push({ type: 'positive', text: 'e-Aadhaar signature valid' }); }
    else if (eaa.aadhaarValid === false) { score -= 15; flags.push({ type: 'negative', text: 'e-Aadhaar validation FAILED' }); }
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreCreditBureau(apis) {
  let score = 0;
  const flags = [];

  const cb = apis.creditBureauFetch?.output?.result;
  if (!cb) return { score: 0, flags: [{ type: 'neutral', text: 'Credit bureau data not available' }] };

  // CIBIL Score
  if (cb.cibilScore >= 750) { score += 30; flags.push({ type: 'positive', text: `CIBIL score: ${cb.cibilScore} (excellent)` }); }
  else if (cb.cibilScore >= 650) { score += 20; flags.push({ type: 'positive', text: `CIBIL score: ${cb.cibilScore} (good)` }); }
  else if (cb.cibilScore >= 550) { score += 5; flags.push({ type: 'neutral', text: `CIBIL score: ${cb.cibilScore} (fair)` }); }
  else if (cb.cibilScore >= 300) { score -= 20; flags.push({ type: 'negative', text: `CIBIL score: ${cb.cibilScore} (poor)` }); }
  else { score -= 10; flags.push({ type: 'neutral', text: 'No credit history (NTC / thin file)' }); }

  // DPD
  if (cb.maxDpdLast12Months === 0) { score += 15; flags.push({ type: 'positive', text: 'Zero DPD in last 12 months' }); }
  else if (cb.maxDpdLast12Months !== null && cb.maxDpdLast12Months <= 30) { score += 5; flags.push({ type: 'neutral', text: `Max DPD 12m: ${cb.maxDpdLast12Months} days` }); }
  else if (cb.maxDpdLast12Months !== null && cb.maxDpdLast12Months > 30) {
    const penalty = Math.min(30, Math.round(cb.maxDpdLast12Months / 3));
    score -= penalty;
    flags.push({ type: 'negative', text: `Max DPD 12m: ${cb.maxDpdLast12Months} days` });
  }

  // Recent delinquency with time decay
  if (cb.recentDelinquency) {
    const decay = timeDecay(cb.recentDelinquency);
    const penalty = Math.round(20 * decay);
    score -= penalty;
    flags.push({ type: 'negative', text: `Recent delinquency: ${cb.recentDelinquency} (decay: ${decay.toFixed(1)}x)` });
  }

  // Hard inquiries
  if (cb.hardInquiriesLast6Months <= 2) { score += 10; }
  else if (cb.hardInquiriesLast6Months <= 5) { score -= 5; flags.push({ type: 'neutral', text: `${cb.hardInquiriesLast6Months} hard inquiries (6m)` }); }
  else { score -= 15; flags.push({ type: 'negative', text: `${cb.hardInquiriesLast6Months} hard inquiries (6m) — credit hungry` }); }

  // Write-offs & settlements
  if (cb.writeOffs > 0) { score -= 30; flags.push({ type: 'negative', text: `${cb.writeOffs} write-off(s) on record` }); }
  if (cb.settlements > 0) { score -= 15; flags.push({ type: 'negative', text: `${cb.settlements} settlement(s) on record` }); }

  // Credit utilization
  if (cb.creditUtilization !== null) {
    if (cb.creditUtilization < 0.30) { score += 10; flags.push({ type: 'positive', text: `Credit utilization: ${(cb.creditUtilization * 100).toFixed(0)}% (healthy)` }); }
    else if (cb.creditUtilization < 0.60) { score += 5; }
    else if (cb.creditUtilization < 0.80) { score -= 5; flags.push({ type: 'neutral', text: `Credit utilization: ${(cb.creditUtilization * 100).toFixed(0)}% (high)` }); }
    else { score -= 15; flags.push({ type: 'negative', text: `Credit utilization: ${(cb.creditUtilization * 100).toFixed(0)}% (very high)` }); }
  }

  // Account age
  if (cb.oldestAccountAge) {
    const years = parseInt(cb.oldestAccountAge);
    if (years >= 5) { score += 10; flags.push({ type: 'positive', text: `Credit history age: ${cb.oldestAccountAge}` }); }
    else if (years >= 2) score += 5;
  }

  // Suit filed
  if (cb.suitFiledStatus !== 'none') { score -= 20; flags.push({ type: 'negative', text: `Suit filed: ${cb.suitFiledStatus}` }); }

  return { score: clamp(score, 0, 100), flags };
}


function scoreFinancial(apis) {
  let score = 0;
  const flags = [];

  const bank = apis.bankVerification?.output?.result;
  if (bank) {
    if (bank.accountActive) { score += 25; flags.push({ type: 'positive', text: 'Bank account active' }); }
    else { score -= 30; flags.push({ type: 'negative', text: 'Bank account inactive/not found' }); }
    if (bank.nameMatch && bank.nameMatchScore >= 80) { score += 15; flags.push({ type: 'positive', text: `Bank name match: ${bank.nameMatchScore}%` }); }
    else if (bank.nameMatch) { score += 8; flags.push({ type: 'neutral', text: `Bank name partial: ${bank.nameMatchScore}%` }); }
    else { score -= 20; flags.push({ type: 'negative', text: 'Bank name MISMATCH' }); }
    if (bank.upiLinked) { score += 5; flags.push({ type: 'positive', text: 'UPI linked' }); }
  }

  const ifsc = apis.ifscSearch?.output?.result;
  if (ifsc) {
    if (ifsc.valid) score += 5;
    else { score -= 10; flags.push({ type: 'negative', text: 'IFSC invalid' }); }
  }

  const emp = apis.employmentVerification?.output?.result;
  if (emp) {
    if (emp.isEmployed) { score += 20; flags.push({ type: 'positive', text: `Employed at ${emp.employerName}` }); }
    else if (emp.membershipStatus === 'not_found') { score -= 15; flags.push({ type: 'negative', text: 'No EPFO record' }); }
    else { score -= 20; flags.push({ type: 'negative', text: `Employment ended: ${emp.dateOfExit}` }); }
  }

  const adv = apis.advancedEmployment?.output?.result;
  if (adv) {
    if (adv.employmentHistory?.length >= 2) { score += 5; flags.push({ type: 'positive', text: `Work history: ${adv.totalExperience}` }); }
    if (adv.pfFilingFrequency === 'monthly') { score += 10; flags.push({ type: 'positive', text: 'PF filed monthly' }); }
    else if (adv.pfFilingFrequency === 'quarterly') score += 3;
    else { score -= 10; flags.push({ type: 'negative', text: 'No PF filings' }); }
    if (adv.employerGstinActive) { score += 5; flags.push({ type: 'positive', text: 'Employer GSTIN active' }); }

    // Time decay on last PF filing
    if (adv.lastPfFiled) {
      const decay = timeDecay(adv.lastPfFiled);
      if (decay >= 0.8) score += 5;
      else { score -= 5; flags.push({ type: 'neutral', text: `PF last filed: ${adv.lastPfFiled} (stale, decay: ${decay.toFixed(1)}x)` }); }
    }
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreBankStatement(apis) {
  let score = 0;
  const flags = [];

  const bs = apis.bankStatementAnalysis?.output?.result;
  if (!bs) return { score: 0, flags: [{ type: 'neutral', text: 'Bank statement data not available' }] };

  // Salary regularity
  if (bs.salaryCredits.detected && bs.salaryCredits.frequency === 'monthly') {
    score += 20;
    flags.push({ type: 'positive', text: `Regular salary: ₹${bs.salaryCredits.averageAmount?.toLocaleString()}/mo` });
    if (bs.salaryCredits.missedMonths === 0) score += 5;
  } else if (bs.salaryCredits.detected) {
    score += 5;
    flags.push({ type: 'neutral', text: `Irregular income: ₹${bs.salaryCredits.averageAmount?.toLocaleString()}/mo` });
  } else {
    score -= 15;
    flags.push({ type: 'negative', text: 'No salary credits detected' });
  }

  // Bounce rate
  if (bs.bounceRate === 0) { score += 15; flags.push({ type: 'positive', text: 'Zero bounces' }); }
  else if (bs.bounceRate < 0.05) { score += 5; flags.push({ type: 'neutral', text: `Bounce rate: ${(bs.bounceRate * 100).toFixed(1)}%` }); }
  else { score -= 20; flags.push({ type: 'negative', text: `Bounce rate: ${(bs.bounceRate * 100).toFixed(1)}% (${bs.chequeBounces} cheque, ${bs.mandateBounces} mandate)` }); }

  // Cash flow volatility
  if (bs.cashFlowVolatility < 0.2) { score += 10; flags.push({ type: 'positive', text: `Low cash flow volatility: ${(bs.cashFlowVolatility * 100).toFixed(0)}%` }); }
  else if (bs.cashFlowVolatility < 0.5) score += 3;
  else { score -= 10; flags.push({ type: 'negative', text: `High cash flow volatility: ${(bs.cashFlowVolatility * 100).toFixed(0)}%` }); }

  // Average balance
  if (bs.averageMonthlyBalance >= 25000) { score += 10; flags.push({ type: 'positive', text: `Avg balance: ₹${bs.averageMonthlyBalance.toLocaleString()}` }); }
  else if (bs.averageMonthlyBalance >= 5000) score += 3;
  else { score -= 10; flags.push({ type: 'negative', text: `Low avg balance: ₹${bs.averageMonthlyBalance.toLocaleString()}` }); }

  // Zero balance days
  if (bs.daysWithZeroBalance === 0) score += 5;
  else if (bs.daysWithZeroBalance > 10) { score -= 15; flags.push({ type: 'negative', text: `${bs.daysWithZeroBalance} days with zero balance` }); }

  // Suspicious transactions
  if (bs.suspiciousTransactions.length > 0) { score -= 20; flags.push({ type: 'negative', text: `${bs.suspiciousTransactions.length} suspicious transaction(s) detected` }); }
  if (bs.circularTransactions) { score -= 15; flags.push({ type: 'negative', text: 'Circular transactions detected' }); }
  if (bs.gamblingTransactions > 0) { score -= 10; flags.push({ type: 'negative', text: `${bs.gamblingTransactions} gambling transaction(s)` }); }
  if (bs.cryptoTransactions > 2) { score -= 5; flags.push({ type: 'neutral', text: `${bs.cryptoTransactions} crypto transactions` }); }

  // EMI consistency vs declared
  if (bs.emiDebits.detected && bs.emiDebits.bounced > 0) {
    score -= 10;
    flags.push({ type: 'negative', text: `${bs.emiDebits.bounced} EMI bounce(s) detected` });
  }

  // Balance trend
  if (bs.endOfDayBalanceTrend === 'stable' || bs.endOfDayBalanceTrend === 'growing') score += 5;
  else if (bs.endOfDayBalanceTrend === 'declining') { score -= 5; flags.push({ type: 'neutral', text: 'Declining balance trend' }); }
  else if (bs.endOfDayBalanceTrend === 'flat_near_zero') { score -= 10; flags.push({ type: 'negative', text: 'Balance flat near zero' }); }

  return { score: clamp(score, 0, 100), flags };
}


function scorePhoneDigital(apis) {
  let score = 0;
  const flags = [];

  const pi = apis.phoneIntelligence?.output?.result;
  if (pi) {
    if (pi.riskScore < 300) { score += 20; flags.push({ type: 'positive', text: `Phone risk: ${pi.riskScore} (low)` }); }
    else if (pi.riskScore < 500) { score += 10; flags.push({ type: 'neutral', text: `Phone risk: ${pi.riskScore} (medium)` }); }
    else if (pi.riskScore >= 700) { score -= 30; flags.push({ type: 'negative', text: `Phone risk: ${pi.riskScore} (HIGH)` }); }
    if (pi.phoneType === 'mobile') score += 10;
    else { score -= 25; flags.push({ type: 'negative', text: `Phone type: ${pi.phoneType}` }); }
    if (!pi.isBlocklisted) score += 10;
    else { score -= 40; flags.push({ type: 'negative', text: 'Phone BLOCKLISTED' }); }
    if (pi.simSwapDetected) {
      const decay = timeDecay(pi.simSwapLastDate);
      const penalty = Math.round(15 * decay);
      score -= penalty;
      flags.push({ type: 'negative', text: `SIM swap: ${pi.simSwapLastDate} (decay: ${decay.toFixed(1)}x, -${penalty}pts)` });
    }
    if (pi.fraudSources?.length > 0) { score -= 40; flags.push({ type: 'negative', text: `Fraud flags: ${pi.fraudSources.join(', ')}` }); }
  }

  const wa = apis.whatsappPresence?.output?.result;
  if (wa) {
    if (wa.isRegistered && wa.accountType === 'personal') { score += 15; flags.push({ type: 'positive', text: 'WhatsApp personal' }); }
    else if (wa.isRegistered) score += 10;
    else { score -= 5; flags.push({ type: 'neutral', text: 'No WhatsApp' }); }
  }

  const dis = apis.digitalIdentityScore?.output?.result;
  if (dis) {
    if (dis.score > 7) { score += 10; flags.push({ type: 'positive', text: `Digital score: ${dis.score}/10` }); }
    else if (dis.score > 5) score += 5;
    else if (dis.score <= 3) { score -= 10; flags.push({ type: 'negative', text: `Digital score: ${dis.score}/10 (very thin)` }); }
    if (dis.ecomPresence?.length >= 2) score += 5;
    if (dis.socialPresence?.length >= 1) score += 5;
    if (dis.phoneFirstSeen) {
      const age = (new Date() - new Date(dis.phoneFirstSeen)) / (365.25 * 24 * 60 * 60 * 1000);
      if (age >= 2) { score += 5; flags.push({ type: 'positive', text: `Phone established: ${dis.phoneFirstSeen}` }); }
      else if (age < 0.5) { score -= 15; flags.push({ type: 'negative', text: `Phone very recent: ${dis.phoneFirstSeen}` }); }
    } else { score -= 10; flags.push({ type: 'negative', text: 'Phone first seen: unknown' }); }
  }

  const di = apis.digitalIntegrity?.output?.result;
  if (di) {
    if (di.emailValid && !di.emailDisposable) score += 5;
    else if (di.emailDisposable) { score -= 15; flags.push({ type: 'negative', text: 'Disposable email' }); }
    if (di.ipBlocklisted) { score -= 20; flags.push({ type: 'negative', text: 'IP BLOCKLISTED' }); }
    if (di.botLikelihood > 0.5) { score -= 20; flags.push({ type: 'negative', text: `Bot likelihood: ${(di.botLikelihood * 100).toFixed(0)}%` }); }
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreAddress(apis) {
  let score = 0;
  const flags = [];

  const ra = apis.registeredAddress?.output?.result;
  if (ra) {
    if (ra.addressFound) {
      score += 20;
      if (ra.matchScore >= 80) { score += 15; flags.push({ type: 'positive', text: `Address match: ${ra.matchScore}%` }); }
      else if (ra.matchScore >= 50) score += 5;
      else { score -= 10; flags.push({ type: 'negative', text: `Address mismatch: ${ra.matchScore}%` }); }
    } else { score -= 15; flags.push({ type: 'negative', text: 'No registered address found' }); }
  }

  const geo = apis.addressGeocode?.output?.result;
  if (geo) {
    if (geo.confidence > 0.7) { score += 15; flags.push({ type: 'positive', text: `Geocode confidence: ${(geo.confidence * 100).toFixed(0)}%` }); }
    else if (geo.confidence > 0.5) score += 5;
    else score -= 5;
    if (geo.isInternationalBorder) { score -= 10; flags.push({ type: 'negative', text: `Near border (${geo.nearestBorderDistance}km)` }); }
    else score += 10;
    if (geo.distanceFromDevice > 100) { score -= 10; flags.push({ type: 'negative', text: `Device ${geo.distanceFromDevice}km from address` }); }
  }

  const pc = apis.pincodeDetails?.output?.result;
  if (pc) {
    if (pc.isServiceable && !pc.isBlacklisted) score += 10;
    if (pc.isBlacklisted) { score -= 30; flags.push({ type: 'negative', text: 'BLACKLISTED pincode' }); }
    if (pc.riskCategory === 'low') score += 5;
    else if (pc.riskCategory === 'high') { score -= 10; flags.push({ type: 'negative', text: `High-risk area: ${pc.area}` }); }
  }

  const gf = apis.geoFencing?.output?.result;
  if (gf) {
    if (gf.geoMatch && gf.stateMatch) { score += 20; flags.push({ type: 'positive', text: `IP matches: ${gf.ipCity}, ${gf.ipState}` }); }
    else if (gf.geoMatch) score += 5;
    else { score -= 20; flags.push({ type: 'negative', text: `IP mismatch: ${gf.ipCountry}` }); }
    if (gf.isTor || gf.isVpn || gf.isProxy) {
      const types = [gf.isTor && 'Tor', gf.isVpn && 'VPN', gf.isProxy && 'Proxy'].filter(Boolean);
      score -= 15; flags.push({ type: 'negative', text: `Anonymizer: ${types.join(', ')}` });
    }
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreIncome(apis, applicant) {
  let score = 0;
  const flags = [];
  const requestedEmi = calculateEmi(applicant.loanAmount, applicant.interestRate, applicant.tenure);

  // Phone to Income
  const inc = apis.phoneToIncome?.output?.result;
  if (inc?.estimatedMonthlyIncome) {
    score += 10;
    if (inc.estimatedMonthlyIncome >= requestedEmi * 3) { score += 10; flags.push({ type: 'positive', text: `Estimated income ₹${inc.estimatedMonthlyIncome.toLocaleString()} (≥3x EMI)` }); }
    else if (inc.estimatedMonthlyIncome >= requestedEmi * 2) score += 5;
    if (applicant.monthlyIncome > 0) {
      const ratio = inc.estimatedMonthlyIncome / applicant.monthlyIncome;
      if (ratio >= 0.7 && ratio <= 1.5) { score += 10; flags.push({ type: 'positive', text: 'Income consistent across sources' }); }
      else { score -= 15; flags.push({ type: 'negative', text: `Income mismatch: declared ₹${applicant.monthlyIncome.toLocaleString()} vs est. ₹${inc.estimatedMonthlyIncome.toLocaleString()}` }); }
    }
  } else { score -= 10; flags.push({ type: 'negative', text: 'No income estimate available' }); }

  // ITR / 26AS
  const itr = apis.itrVerification?.output?.result;
  if (itr) {
    if (itr.itrFiled && itr.consecutiveYearsFiled >= 3) { score += 15; flags.push({ type: 'positive', text: `ITR filed ${itr.consecutiveYearsFiled} consecutive years` }); }
    else if (itr.itrFiled && itr.consecutiveYearsFiled >= 1) { score += 5; flags.push({ type: 'neutral', text: `ITR filed ${itr.consecutiveYearsFiled} year(s)` }); }
    else { score -= 10; flags.push({ type: 'negative', text: 'No ITR filed' }); }
    if (itr.tdsMatchesItr) { score += 5; flags.push({ type: 'positive', text: 'TDS matches ITR' }); }
    else if (itr.tdsEntries26AS > 0) { score -= 5; flags.push({ type: 'negative', text: 'TDS/ITR mismatch' }); }
    if (itr.incomeGrowthTrend === 'positive') { score += 5; flags.push({ type: 'positive', text: 'Positive income growth trend' }); }
  }

  // GST
  const gst = apis.gstVerification?.output?.result;
  if (gst?.applicable) {
    if (gst.gstStatus === 'active' && gst.panGstMatch) { score += 5; flags.push({ type: 'positive', text: 'GST active & PAN matched' }); }
    else if (gst.gstStatus === 'cancelled') { score -= 10; flags.push({ type: 'negative', text: 'GSTIN cancelled' }); }
    if (gst.filingFrequency === 'irregular') { score -= 5; flags.push({ type: 'neutral', text: 'Irregular GST filings' }); }
  }

  // FOIR
  if (applicant.monthlyIncome > 0) {
    const foir = (applicant.existingEmi + requestedEmi) / applicant.monthlyIncome;
    const emiCapacity = applicant.monthlyIncome * 0.5 - applicant.existingEmi;
    if (foir < 0.4) { score += 15; flags.push({ type: 'positive', text: `FOIR: ${(foir * 100).toFixed(1)}% (healthy)` }); }
    else if (foir < 0.5) { score += 5; flags.push({ type: 'neutral', text: `FOIR: ${(foir * 100).toFixed(1)}% (borderline)` }); }
    else if (foir < 0.65) { score -= 10; flags.push({ type: 'negative', text: `FOIR: ${(foir * 100).toFixed(1)}% (high)` }); }
    else { score -= 20; flags.push({ type: 'negative', text: `FOIR: ${(foir * 100).toFixed(1)}% (very high)` }); }
    if (emiCapacity >= requestedEmi) flags.push({ type: 'positive', text: `EMI capacity ₹${Math.round(emiCapacity).toLocaleString()} ≥ requested ₹${Math.round(requestedEmi).toLocaleString()}` });
    else flags.push({ type: 'negative', text: `EMI capacity ₹${Math.round(emiCapacity).toLocaleString()} < requested ₹${Math.round(requestedEmi).toLocaleString()}` });
  }

  // Prefill richness
  const pf = apis.phoneToPrefill?.output?.result;
  if (pf) {
    if (pf.dataRichness === 'high') score += 5;
    else if (pf.dataRichness === 'none') score -= 5;
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreDocument(apis) {
  let score = 0;
  const flags = [];

  const fc = apis.forgeryCheck?.output?.result;
  if (fc) {
    if (fc.status === 'genuine') { score += 50; flags.push({ type: 'positive', text: 'Document genuine' }); }
    else if (fc.status === 'suspicious') { score += 10; flags.push({ type: 'neutral', text: `Suspicious (${fc.forgeryScore.toFixed(2)})` }); }
    else { score -= 80; flags.push({ type: 'negative', text: `FORGED (${fc.forgeryScore.toFixed(2)})` }); }
    if (fc.forgeryScore < 0.3) score += 30;
    else if (fc.forgeryScore < 0.6) score += 10;
    else score -= 20;
    if (fc.anomalies?.length > 0) flags.push({ type: 'negative', text: `Anomalies: ${fc.anomalies.join(', ')}` });
    if (fc.metadataConsistent) score += 10;
    score += 10; // selfie liveness placeholder
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreDevice(apis) {
  let score = 0;
  const flags = [];

  const imei = apis.imeiFetch?.output?.result;
  if (imei) {
    if (imei.valid && !imei.isStolen) { score += 25; flags.push({ type: 'positive', text: `Valid: ${imei.brand} ${imei.model}` }); }
    else if (imei.isStolen || imei.isLost) { score -= 50; flags.push({ type: 'negative', text: 'Device STOLEN/LOST' }); }
    else { score -= 15; flags.push({ type: 'negative', text: 'Invalid IMEI' }); }
    if (imei.manufactureYear && (new Date().getFullYear() - imei.manufactureYear) <= 5) score += 10;
  }

  const alt = apis.phoneToAlternate?.output?.result;
  if (alt) {
    if (alt.totalFound <= 2) { score += 15; flags.push({ type: 'positive', text: `${alt.totalFound} alternate phone(s)` }); }
    else if (alt.totalFound <= 4) score += 5;
    else { score -= 15; flags.push({ type: 'negative', text: `${alt.totalFound} alternate phones — suspicious` }); }
  }

  const ident = apis.phoneToIdentity?.output?.result;
  if (ident) {
    if (ident.consistencyScore >= 80) score += 20;
    else if (ident.consistencyScore >= 60) score += 10;
    else if (ident.consistencyScore > 0) score -= 10;
    else score -= 25;
  }

  const dis = apis.digitalIdentityScore?.output?.result;
  if (dis?.phoneEmailLinked) { score += 10; flags.push({ type: 'positive', text: 'Phone-email linked' }); }

  return { score: clamp(score, 0, 100), flags };
}


function scoreFraud(apis) {
  let score = 50; // Start at neutral
  const flags = [];

  // Velocity
  const vc = apis.velocityCheck?.output?.result;
  if (vc) {
    // Applications by PAN
    if (vc.applicationsByPan.last7d === 0) { score += 10; }
    else if (vc.applicationsByPan.last7d <= 2) { score -= 5; flags.push({ type: 'neutral', text: `${vc.applicationsByPan.last7d} apps by PAN (7d)` }); }
    else { score -= 20; flags.push({ type: 'negative', text: `${vc.applicationsByPan.last7d} apps by PAN (7d) — velocity breach` }); }

    // Applications by device
    if (vc.applicationsByDevice.last7d > 3) { score -= 20; flags.push({ type: 'negative', text: `${vc.applicationsByDevice.last7d} apps from same device (7d)` }); }
    else if (vc.applicationsByDevice.last30d > 5) { score -= 10; flags.push({ type: 'neutral', text: `${vc.applicationsByDevice.last30d} apps from device (30d)` }); }

    // Shared device/IP
    if (vc.sharedDeviceWithOtherPans) { score -= 25; flags.push({ type: 'negative', text: 'Device shared across multiple PANs' }); }
    if (vc.sharedIpWithOtherPans) { score -= 10; flags.push({ type: 'negative', text: 'IP shared across multiple PANs' }); }
    if (vc.sharedBankAccountWithOthers) { score -= 30; flags.push({ type: 'negative', text: 'Bank account shared with other applicants — MULE suspect' }); }

    // Loan stacking
    if (vc.loanStackingDetected) { score -= 15; flags.push({ type: 'negative', text: 'Loan stacking detected' }); }

    // Recent rejections
    if (vc.recentRejections === 0) score += 5;
    else if (vc.recentRejections >= 5) { score -= 15; flags.push({ type: 'negative', text: `${vc.recentRejections} recent rejections` }); }

    if (vc.velocityRisk === 'low') score += 10;
    else if (vc.velocityRisk === 'critical') { score -= 20; flags.push({ type: 'negative', text: 'CRITICAL velocity risk' }); }
  }

  // Fraud Ring
  const fr = apis.fraudRingDetection?.output?.result;
  if (fr) {
    if (fr.clusterSize <= 1) { score += 10; flags.push({ type: 'positive', text: 'No fraud ring connections' }); }
    else if (fr.clusterSize <= 5) { score -= 10; flags.push({ type: 'neutral', text: `Cluster size: ${fr.clusterSize} (${fr.connectedApplicants} connected)` }); }
    else { score -= 30; flags.push({ type: 'negative', text: `FRAUD RING: cluster of ${fr.clusterSize} (${fr.connectedApplicants} connected)` }); }

    if (fr.networkRisk === 'critical') { score -= 20; flags.push({ type: 'negative', text: 'Critical network risk' }); }
    if (fr.referralChainAnomaly) { score -= 10; flags.push({ type: 'negative', text: 'Referral chain anomaly detected' }); }
    if (fr.suspiciousPatterns?.length > 0) {
      flags.push({ type: 'negative', text: `Patterns: ${fr.suspiciousPatterns.join(', ')}` });
    }
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreBehavioral(apis) {
  let score = 50;
  const flags = [];

  const sb = apis.sessionBehavior?.output?.result;
  if (!sb) return { score: 50, flags: [{ type: 'neutral', text: 'Session behavior data not available' }] };

  // Form fill time
  if (sb.totalFormTime >= 120) { score += 10; flags.push({ type: 'positive', text: `Form time: ${sb.totalFormTime}s (natural)` }); }
  else if (sb.totalFormTime >= 30) { score += 0; }
  else { score -= 20; flags.push({ type: 'negative', text: `Form time: ${sb.totalFormTime}s (too fast — bot/autofill)` }); }

  // Copy-paste
  if (sb.copyPasteCount === 0) { score += 10; }
  else if (sb.copyPasteCount <= 2) { score -= 5; flags.push({ type: 'neutral', text: `Copy-paste detected (${sb.copyPasteCount} fields)` }); }
  else { score -= 15; flags.push({ type: 'negative', text: `Extensive copy-paste (${sb.copyPasteCount} fields)` }); }
  if (sb.copyPasteDetected?.pan) { score -= 5; flags.push({ type: 'negative', text: 'PAN was copy-pasted (not typed)' }); }

  // Hesitation on income
  if (sb.hesitationOnIncomeField) { score -= 5; flags.push({ type: 'neutral', text: 'Hesitation on income field' }); }

  // Root/jailbreak/emulator
  if (sb.isRooted || sb.isJailbroken) { score -= 20; flags.push({ type: 'negative', text: 'Rooted/jailbroken device' }); }
  if (sb.isEmulator) { score -= 25; flags.push({ type: 'negative', text: 'EMULATOR detected' }); }

  // Screenshot / recording
  if (sb.screenRecordingDetected) { score -= 15; flags.push({ type: 'negative', text: 'Screen recording detected' }); }
  if (sb.screenshotAttempts > 2) { score -= 5; flags.push({ type: 'neutral', text: `${sb.screenshotAttempts} screenshot attempts` }); }

  // Human patterns
  if (sb.typingPatternHuman && sb.mouseMovementNatural) { score += 10; flags.push({ type: 'positive', text: 'Human interaction patterns' }); }
  else if (!sb.typingPatternHuman) { score -= 15; flags.push({ type: 'negative', text: 'Non-human typing pattern' }); }
  if (!sb.mouseMovementNatural) { score -= 10; flags.push({ type: 'negative', text: 'Unnatural mouse/touch patterns' }); }

  // Behavior score from API
  if (sb.behaviorScore >= 80) score += 10;
  else if (sb.behaviorScore < 30) score -= 15;

  return { score: clamp(score, 0, 100), flags };
}


function scoreLegal(apis) {
  let score = 50; // Start neutral
  const flags = [];

  const cr = apis.courtRecords?.output?.result;
  if (!cr) return { score: 50, flags: [{ type: 'neutral', text: 'Legal records not available' }] };

  // Wilful defaulter
  if (cr.wilfulDefaulter.isDefaulter) {
    score -= 80;
    flags.push({ type: 'negative', text: 'RBI WILFUL DEFAULTER — auto-decline trigger' });
  } else {
    score += 15;
    flags.push({ type: 'positive', text: 'Not a wilful defaulter' });
  }

  // CERSAI
  if (cr.cersaiCheck.registered) { score -= 10; flags.push({ type: 'neutral', text: `CERSAI: ${cr.cersaiCheck.securedAssets} secured asset(s)` }); }
  else { score += 5; }

  // Court cases
  if (cr.courtCases.totalFound === 0) { score += 15; flags.push({ type: 'positive', text: 'No court cases found' }); }
  else {
    if (cr.courtCases.criminalCases > 0) { score -= 25; flags.push({ type: 'negative', text: `${cr.courtCases.criminalCases} criminal case(s)` }); }
    if (cr.courtCases.civilCases > 0) { score -= 10; flags.push({ type: 'negative', text: `${cr.courtCases.civilCases} civil case(s)` }); }
    if (cr.courtCases.pendingCases > 0) { score -= 5; flags.push({ type: 'neutral', text: `${cr.courtCases.pendingCases} pending case(s)` }); }
  }

  // SEBI
  if (cr.sebiDebarment.isDebarred) { score -= 20; flags.push({ type: 'negative', text: 'SEBI debarred' }); }

  // Insolvency
  if (cr.insolvencyCheck.isBankrupt) { score -= 40; flags.push({ type: 'negative', text: 'DECLARED BANKRUPT' }); }
  if (cr.insolvencyCheck.ncltCases > 0) { score -= 15; flags.push({ type: 'negative', text: `${cr.insolvencyCheck.ncltCases} NCLT case(s)` }); }

  return { score: clamp(score, 0, 100), flags };
}


// ─── Aggregator ─────────────────────────────────────────────────────────────

function calculateFullRiskScore(apis, applicant) {
  const categoryScores = {
    identity:      scoreIdentity(apis),
    creditBureau:  scoreCreditBureau(apis),
    financial:     scoreFinancial(apis),
    bankStatement: scoreBankStatement(apis),
    phoneDigital:  scorePhoneDigital(apis),
    address:       scoreAddress(apis),
    income:        scoreIncome(apis, applicant),
    document:      scoreDocument(apis),
    device:        scoreDevice(apis),
    fraud:         scoreFraud(apis),
    behavioral:    scoreBehavioral(apis),
    legal:         scoreLegal(apis),
  };

  // Weighted aggregation → 0-1000
  let finalScore = 0;
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    finalScore += categoryScores[cat].score * weight * 10;
  }

  // Product-aware adjustment
  const pa = apis.productRiskAdjust?.output?.result;
  let productAdjustment = 0;
  const modifiers = [];
  if (pa) {
    productAdjustment += pa.adjustmentPoints;
    if (pa.repeatBorrowerStatus === 'repeat_with_issues') {
      modifiers.push({ label: 'Repeat borrower (late payments)', points: pa.repeatBorrowerBonus, color: 'var(--red)' });
    } else if (pa.repeatBorrowerStatus === 'repeat_good') {
      modifiers.push({ label: 'Repeat borrower (good history)', points: pa.repeatBorrowerBonus, color: 'var(--green)' });
    }
    if (pa.firstTimeBorrowerPenalty > 0) {
      modifiers.push({ label: 'First-time borrower penalty', points: -pa.firstTimeBorrowerPenalty, color: 'var(--yellow)' });
    }
    if (pa.amountRisk === 'very_high') {
      modifiers.push({ label: 'High loan amount risk tier', points: -20, color: 'var(--red)' });
      productAdjustment -= 20;
    } else if (pa.amountRisk === 'elevated') {
      modifiers.push({ label: 'Elevated loan amount', points: -10, color: 'var(--orange)' });
      productAdjustment -= 10;
    }
    if (pa.tenureRiskMultiplier > 1.0) {
      const tenurePenalty = -Math.round((pa.tenureRiskMultiplier - 1.0) * 50);
      modifiers.push({ label: `Tenure risk (${pa.tenureCategory}, ${pa.tenureRiskMultiplier}x)`, points: tenurePenalty, color: 'var(--orange)' });
      productAdjustment += tenurePenalty;
    }
    modifiers.push({ label: 'Product adjustment total', points: productAdjustment, color: productAdjustment >= 0 ? 'var(--green)' : 'var(--red)' });
  }

  finalScore += productAdjustment;
  finalScore = Math.round(clamp(finalScore, 0, 1000));

  // Aggregate flags
  const allFlags = [];
  for (const cat of Object.values(categoryScores)) {
    allFlags.push(...cat.flags);
  }

  // Decision
  let decision, decisionLabel;
  // Hard auto-decline triggers
  const cr = apis.courtRecords?.output?.result;
  const isWilfulDefaulter = cr?.wilfulDefaulter?.isDefaulter;
  const fr = apis.fraudRingDetection?.output?.result;
  const isCriticalFraudRing = fr?.networkRisk === 'critical';

  if (isWilfulDefaulter || isCriticalFraudRing) {
    decision = 'decline';
    decisionLabel = 'AUTO-DECLINE (Hard Block)';
  } else if (finalScore >= THRESHOLDS.AUTO_APPROVE) {
    decision = 'approve'; decisionLabel = 'AUTO-APPROVE';
  } else if (finalScore >= THRESHOLDS.STANDARD) {
    decision = 'standard'; decisionLabel = 'APPROVE (Standard Checks)';
  } else if (finalScore >= THRESHOLDS.ELEVATED) {
    decision = 'elevated'; decisionLabel = 'ENHANCED DUE DILIGENCE';
  } else if (finalScore >= THRESHOLDS.MANUAL_REVIEW) {
    decision = 'review'; decisionLabel = 'MANUAL REVIEW';
  } else {
    decision = 'decline'; decisionLabel = 'AUTO-DECLINE';
  }

  // Phase progression
  const phaseAScore = Math.round(
    (categoryScores.identity.score * 0.30 + categoryScores.phoneDigital.score * 0.25 +
     categoryScores.device.score * 0.15 + categoryScores.fraud.score * 0.15 +
     categoryScores.behavioral.score * 0.15) * 10
  );
  const phaseBScore = Math.round(
    (categoryScores.identity.score * 0.15 + categoryScores.phoneDigital.score * 0.10 +
     categoryScores.creditBureau.score * 0.30 + categoryScores.income.score * 0.20 +
     categoryScores.financial.score * 0.15 + categoryScores.behavioral.score * 0.05 +
     categoryScores.fraud.score * 0.05) * 10
  );
  const phaseCScore = Math.round(
    (categoryScores.identity.score * 0.12 + categoryScores.phoneDigital.score * 0.08 +
     categoryScores.creditBureau.score * 0.22 + categoryScores.income.score * 0.15 +
     categoryScores.financial.score * 0.10 + categoryScores.address.score * 0.10 +
     categoryScores.legal.score * 0.10 + categoryScores.fraud.score * 0.08 +
     categoryScores.behavioral.score * 0.05) * 10
  );

  return {
    finalScore, decision, decisionLabel,
    categoryScores, allFlags, modifiers,
    phaseScores: {
      A: clamp(phaseAScore, 0, 1000),
      B: clamp(phaseBScore, 0, 1000),
      C: clamp(phaseCScore, 0, 1000),
      D: finalScore,
    },
  };
}
