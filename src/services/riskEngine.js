/**
 * FinZ Risk Engine v1
 *
 * Server-side risk scoring engine with 12 categories, time-decay weighting,
 * phased API orchestration, and product-aware adjustments.
 *
 * Score range: 0-1000
 * Decision thresholds: AUTO_APPROVE (800), STANDARD (600), ELEVATED (400),
 *                      MANUAL_REVIEW (200), AUTO_DECLINE (<200)
 */

import { signzyService } from './signzyService';
import { RISK_CONFIG } from '../config/constants';

const { CATEGORY_WEIGHTS, THRESHOLDS, PHASE_GATES } = RISK_CONFIG;

// ─── Utilities ──────────────────────────────────────────────────────────────

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function calculateEmi(principal, annualRate, tenureMonths) {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  return principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1);
}

/**
 * Time-decay multiplier (0.3 - 1.0) based on event recency.
 * Events within 30 days → 1.0, older than 2 years → 0.3.
 */
function timeDecay(dateStr) {
  if (!dateStr) return 0.5;
  const daysDiff = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 30) return 1.0;
  if (daysDiff <= 90) return 0.9;
  if (daysDiff <= 180) return 0.8;
  if (daysDiff <= 365) return 0.6;
  if (daysDiff <= 730) return 0.4;
  return 0.3;
}

/**
 * Safely resolve a Promise.allSettled result, returning null for rejected.
 */
function settled(result) {
  return result.status === 'fulfilled' ? result.value : null;
}

// ═════════════════════════════════════════════════════════════════════════════
//  Category Scorers (each returns { score: 0-100, flags: [] })
// ═════════════════════════════════════════════════════════════════════════════

function scoreIdentity(apis) {
  let score = 0;
  const flags = [];

  const pan = apis.panFetch;
  if (pan) {
    if (pan.isValid) { score += 20; flags.push({ type: 'positive', text: 'PAN is valid' }); }
    else { score -= 50; flags.push({ type: 'negative', text: 'PAN is INVALID / FAKE' }); }
    if (pan.panStatusLabel === 'VALID') score += 10;
    else if (['FAKE', 'DEACTIVATED', 'DELETED'].includes(pan.panStatusLabel)) {
      score -= 50; flags.push({ type: 'negative', text: `PAN status: ${pan.panStatusLabel}` });
    }
    if (pan.aadhaarSeedingStatus === 'Yes') { score += 10; flags.push({ type: 'positive', text: 'Aadhaar seeded to PAN' }); }
    else { score -= 5; flags.push({ type: 'neutral', text: 'Aadhaar not seeded to PAN' }); }
    if (pan.individualTaxComplianceStatus === 'Operative') score += 5;
    else { score -= 10; flags.push({ type: 'negative', text: 'Tax compliance: inoperative' }); }
  }

  const p2p = apis.phoneToPan;
  if (p2p) {
    if (p2p.pan) { score += 15; flags.push({ type: 'positive', text: 'Phone-to-PAN match confirmed' }); }
    else { score -= 5; flags.push({ type: 'neutral', text: 'Phone-to-PAN: no match found' }); }
  }

  const ident = apis.phoneToIdentity;
  if (ident) {
    if (ident.identities?.length >= 2) { score += 10; flags.push({ type: 'positive', text: `${ident.identities.length} identity docs found` }); }
    else if (ident.identities?.length === 1) score += 5;
    else { score -= 10; flags.push({ type: 'negative', text: 'No identity documents found' }); }
    if (ident.consistencyScore >= 80) { score += 15; flags.push({ type: 'positive', text: `Identity consistency: ${ident.consistencyScore}%` }); }
    else if (ident.consistencyScore >= 60) score += 8;
    else { score -= 10; flags.push({ type: 'negative', text: `Low identity consistency: ${ident.consistencyScore}%` }); }
  }

  const digi = apis.digilockerDetails;
  if (digi) {
    if (digi.totalDocuments >= 3) { score += 10; flags.push({ type: 'positive', text: `${digi.totalDocuments} DigiLocker docs` }); }
    else if (digi.totalDocuments >= 1) score += 5;
    else score -= 5;
  }

  const eaa = apis.eAadhaarXml;
  if (eaa) {
    if (eaa.digitalSignatureValid) { score += 5; flags.push({ type: 'positive', text: 'e-Aadhaar signature valid' }); }
    else if (eaa.aadhaarValid === false) { score -= 15; flags.push({ type: 'negative', text: 'e-Aadhaar validation FAILED' }); }
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreCreditBureau(apis) {
  let score = 0;
  const flags = [];

  const cb = apis.creditBureau;
  if (!cb) return { score: 0, flags: [{ type: 'neutral', text: 'Credit bureau data not available' }] };

  if (cb.cibilScore >= 750) { score += 30; flags.push({ type: 'positive', text: `CIBIL score: ${cb.cibilScore} (excellent)` }); }
  else if (cb.cibilScore >= 650) { score += 20; flags.push({ type: 'positive', text: `CIBIL score: ${cb.cibilScore} (good)` }); }
  else if (cb.cibilScore >= 550) { score += 5; flags.push({ type: 'neutral', text: `CIBIL score: ${cb.cibilScore} (fair)` }); }
  else if (cb.cibilScore >= 300) { score -= 20; flags.push({ type: 'negative', text: `CIBIL score: ${cb.cibilScore} (poor)` }); }
  else { score -= 10; flags.push({ type: 'neutral', text: 'No credit history (NTC / thin file)' }); }

  if (cb.maxDpdLast12Months === 0) { score += 15; flags.push({ type: 'positive', text: 'Zero DPD in last 12 months' }); }
  else if (cb.maxDpdLast12Months != null && cb.maxDpdLast12Months <= 30) { score += 5; }
  else if (cb.maxDpdLast12Months != null && cb.maxDpdLast12Months > 30) {
    score -= Math.min(30, Math.round(cb.maxDpdLast12Months / 3));
    flags.push({ type: 'negative', text: `Max DPD 12m: ${cb.maxDpdLast12Months} days` });
  }

  if (cb.recentDelinquency) {
    const decay = timeDecay(cb.recentDelinquency);
    score -= Math.round(20 * decay);
    flags.push({ type: 'negative', text: `Recent delinquency (decay: ${decay.toFixed(1)}x)` });
  }

  if (cb.hardInquiriesLast6Months <= 2) score += 10;
  else if (cb.hardInquiriesLast6Months <= 5) { score -= 5; flags.push({ type: 'neutral', text: `${cb.hardInquiriesLast6Months} hard inquiries (6m)` }); }
  else { score -= 15; flags.push({ type: 'negative', text: `${cb.hardInquiriesLast6Months} hard inquiries (6m) — credit hungry` }); }

  if (cb.writeOffs > 0) { score -= 30; flags.push({ type: 'negative', text: `${cb.writeOffs} write-off(s)` }); }
  if (cb.settlements > 0) { score -= 15; flags.push({ type: 'negative', text: `${cb.settlements} settlement(s)` }); }

  if (cb.creditUtilization != null) {
    if (cb.creditUtilization < 0.30) { score += 10; flags.push({ type: 'positive', text: `Credit utilization: ${(cb.creditUtilization * 100).toFixed(0)}%` }); }
    else if (cb.creditUtilization < 0.60) score += 5;
    else if (cb.creditUtilization < 0.80) score -= 5;
    else { score -= 15; flags.push({ type: 'negative', text: `Credit utilization: ${(cb.creditUtilization * 100).toFixed(0)}% (very high)` }); }
  }

  if (cb.oldestAccountAge) {
    const years = parseInt(cb.oldestAccountAge);
    if (years >= 5) { score += 10; flags.push({ type: 'positive', text: `Credit history: ${cb.oldestAccountAge}` }); }
    else if (years >= 2) score += 5;
  }

  if (cb.suitFiledStatus && cb.suitFiledStatus !== 'none') { score -= 20; flags.push({ type: 'negative', text: `Suit filed: ${cb.suitFiledStatus}` }); }

  return { score: clamp(score, 0, 100), flags };
}


function scoreFinancial(apis) {
  let score = 0;
  const flags = [];

  const bank = apis.bankVerification;
  if (bank) {
    if (bank.accountActive) { score += 25; flags.push({ type: 'positive', text: 'Bank account active' }); }
    else { score -= 30; flags.push({ type: 'negative', text: 'Bank account inactive/not found' }); }
    if (bank.nameMatch && bank.nameMatchScore >= 80) { score += 15; flags.push({ type: 'positive', text: `Bank name match: ${bank.nameMatchScore}%` }); }
    else if (bank.nameMatch) { score += 8; }
    else { score -= 20; flags.push({ type: 'negative', text: 'Bank name MISMATCH' }); }
    if (bank.upiLinked) { score += 5; flags.push({ type: 'positive', text: 'UPI linked' }); }
  }

  const ifsc = apis.ifscSearch;
  if (ifsc) {
    if (ifsc.valid) score += 5;
    else { score -= 10; flags.push({ type: 'negative', text: 'IFSC invalid' }); }
  }

  const emp = apis.employment;
  if (emp) {
    if (emp.isEmployed) { score += 20; flags.push({ type: 'positive', text: `Employed at ${emp.employerName}` }); }
    else if (emp.membershipStatus === 'not_found') { score -= 15; flags.push({ type: 'negative', text: 'No EPFO record' }); }
    else { score -= 20; flags.push({ type: 'negative', text: `Employment ended: ${emp.dateOfExit}` }); }
  }

  const adv = apis.advancedEmployment;
  if (adv) {
    if (adv.employmentHistory?.length >= 2) { score += 5; flags.push({ type: 'positive', text: `Work history: ${adv.totalExperience}` }); }
    if (adv.pfFilingFrequency === 'monthly') { score += 10; flags.push({ type: 'positive', text: 'PF filed monthly' }); }
    else if (adv.pfFilingFrequency === 'quarterly') score += 3;
    else { score -= 10; flags.push({ type: 'negative', text: 'No PF filings' }); }
    if (adv.employerGstinActive) { score += 5; flags.push({ type: 'positive', text: 'Employer GSTIN active' }); }
    if (adv.lastPfFiled) {
      const decay = timeDecay(adv.lastPfFiled);
      if (decay >= 0.8) score += 5;
      else { score -= 5; flags.push({ type: 'neutral', text: `PF stale (decay: ${decay.toFixed(1)}x)` }); }
    }
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreBankStatement(apis) {
  let score = 0;
  const flags = [];

  const bs = apis.bankStatement;
  if (!bs) return { score: 0, flags: [{ type: 'neutral', text: 'Bank statement data not available' }] };

  if (bs.salaryCredits?.detected && bs.salaryCredits.frequency === 'monthly') {
    score += 20;
    flags.push({ type: 'positive', text: `Regular salary: ₹${bs.salaryCredits.averageAmount?.toLocaleString()}/mo` });
    if (bs.salaryCredits.missedMonths === 0) score += 5;
  } else if (bs.salaryCredits?.detected) {
    score += 5;
    flags.push({ type: 'neutral', text: 'Irregular income pattern' });
  } else {
    score -= 15;
    flags.push({ type: 'negative', text: 'No salary credits detected' });
  }

  if (bs.bounceRate === 0) { score += 15; flags.push({ type: 'positive', text: 'Zero bounces' }); }
  else if (bs.bounceRate < 0.05) { score += 5; }
  else { score -= 20; flags.push({ type: 'negative', text: `Bounce rate: ${(bs.bounceRate * 100).toFixed(1)}%` }); }

  if (bs.cashFlowVolatility < 0.2) { score += 10; flags.push({ type: 'positive', text: 'Low cash flow volatility' }); }
  else if (bs.cashFlowVolatility < 0.5) score += 3;
  else { score -= 10; flags.push({ type: 'negative', text: 'High cash flow volatility' }); }

  if (bs.averageMonthlyBalance >= 25000) { score += 10; flags.push({ type: 'positive', text: `Avg balance: ₹${bs.averageMonthlyBalance.toLocaleString()}` }); }
  else if (bs.averageMonthlyBalance >= 5000) score += 3;
  else { score -= 10; flags.push({ type: 'negative', text: `Low avg balance: ₹${bs.averageMonthlyBalance.toLocaleString()}` }); }

  if (bs.daysWithZeroBalance > 10) { score -= 15; flags.push({ type: 'negative', text: `${bs.daysWithZeroBalance} days with zero balance` }); }
  else if (bs.daysWithZeroBalance === 0) score += 5;

  if (bs.suspiciousTransactions?.length > 0) { score -= 20; flags.push({ type: 'negative', text: `${bs.suspiciousTransactions.length} suspicious transaction(s)` }); }
  if (bs.circularTransactions) { score -= 15; flags.push({ type: 'negative', text: 'Circular transactions detected' }); }
  if (bs.gamblingTransactions > 0) { score -= 10; flags.push({ type: 'negative', text: `${bs.gamblingTransactions} gambling transaction(s)` }); }

  if (bs.emiDebits?.detected && bs.emiDebits.bounced > 0) {
    score -= 10;
    flags.push({ type: 'negative', text: `${bs.emiDebits.bounced} EMI bounce(s)` });
  }

  if (bs.endOfDayBalanceTrend === 'stable' || bs.endOfDayBalanceTrend === 'growing') score += 5;
  else if (bs.endOfDayBalanceTrend === 'declining') { score -= 5; flags.push({ type: 'neutral', text: 'Declining balance trend' }); }
  else if (bs.endOfDayBalanceTrend === 'flat_near_zero') { score -= 10; flags.push({ type: 'negative', text: 'Balance flat near zero' }); }

  return { score: clamp(score, 0, 100), flags };
}


function scorePhoneDigital(apis) {
  let score = 0;
  const flags = [];

  const pi = apis.phoneIntelligence;
  if (pi) {
    if (pi.riskScore < 300) { score += 20; flags.push({ type: 'positive', text: `Phone risk: ${pi.riskScore} (low)` }); }
    else if (pi.riskScore < 500) { score += 10; }
    else if (pi.riskScore >= 700) { score -= 30; flags.push({ type: 'negative', text: `Phone risk: ${pi.riskScore} (HIGH)` }); }
    if (pi.phoneType === 'mobile') score += 10;
    else { score -= 25; flags.push({ type: 'negative', text: `Phone type: ${pi.phoneType}` }); }
    if (!pi.isBlocklisted) score += 10;
    else { score -= 40; flags.push({ type: 'negative', text: 'Phone BLOCKLISTED' }); }
    if (pi.simSwapDetected) {
      const decay = timeDecay(pi.simSwapLastDate);
      score -= Math.round(15 * decay);
      flags.push({ type: 'negative', text: `SIM swap detected` });
    }
    if (pi.fraudSources?.length > 0) { score -= 40; flags.push({ type: 'negative', text: `Fraud flags: ${pi.fraudSources.join(', ')}` }); }
  }

  const wa = apis.whatsappPresence;
  if (wa) {
    if (wa.isRegistered && wa.accountType === 'personal') { score += 15; flags.push({ type: 'positive', text: 'WhatsApp personal' }); }
    else if (wa.isRegistered) score += 10;
    else { score -= 5; flags.push({ type: 'neutral', text: 'No WhatsApp' }); }
  }

  const dis = apis.digitalIdentityScore;
  if (dis) {
    if (dis.score > 7) { score += 10; flags.push({ type: 'positive', text: `Digital score: ${dis.score}/10` }); }
    else if (dis.score > 5) score += 5;
    else if (dis.score <= 3) { score -= 10; flags.push({ type: 'negative', text: `Digital score: ${dis.score}/10 (thin)` }); }
    if (dis.ecomPresence?.length >= 2) score += 5;
    if (dis.socialPresence?.length >= 1) score += 5;
    if (dis.phoneFirstSeen) {
      const ageYears = (Date.now() - new Date(dis.phoneFirstSeen).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears >= 2) { score += 5; flags.push({ type: 'positive', text: 'Phone established 2+ years' }); }
      else if (ageYears < 0.5) { score -= 15; flags.push({ type: 'negative', text: 'Phone very recent' }); }
    } else { score -= 10; flags.push({ type: 'negative', text: 'Phone first seen: unknown' }); }
  }

  const di = apis.digitalIntegrity;
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

  const ra = apis.registeredAddress;
  if (ra) {
    if (ra.addressFound) {
      score += 20;
      if (ra.matchScore >= 80) { score += 15; flags.push({ type: 'positive', text: `Address match: ${ra.matchScore}%` }); }
      else if (ra.matchScore >= 50) score += 5;
      else { score -= 10; flags.push({ type: 'negative', text: `Address mismatch: ${ra.matchScore}%` }); }
    } else { score -= 15; flags.push({ type: 'negative', text: 'No registered address found' }); }
  }

  const geo = apis.addressGeocode;
  if (geo) {
    if (geo.confidence > 0.7) { score += 15; flags.push({ type: 'positive', text: `Geocode confidence: ${(geo.confidence * 100).toFixed(0)}%` }); }
    else if (geo.confidence > 0.5) score += 5;
    else score -= 5;
    if (geo.isInternationalBorder) { score -= 10; flags.push({ type: 'negative', text: `Near border (${geo.nearestBorderDistance}km)` }); }
    else score += 10;
    if (geo.distanceFromDevice > 100) { score -= 10; flags.push({ type: 'negative', text: `Device ${geo.distanceFromDevice}km from address` }); }
  }

  const pc = apis.pincodeDetails;
  if (pc) {
    if (pc.isServiceable && !pc.isBlacklisted) score += 10;
    if (pc.isBlacklisted) { score -= 30; flags.push({ type: 'negative', text: 'BLACKLISTED pincode' }); }
    if (pc.riskCategory === 'low') score += 5;
    else if (pc.riskCategory === 'high') { score -= 10; flags.push({ type: 'negative', text: `High-risk area: ${pc.area}` }); }
  }

  const gf = apis.geoFencing;
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

  const inc = apis.phoneToIncome;
  if (inc?.estimatedMonthlyIncome) {
    score += 10;
    if (inc.estimatedMonthlyIncome >= requestedEmi * 3) { score += 10; flags.push({ type: 'positive', text: `Estimated income ₹${inc.estimatedMonthlyIncome.toLocaleString()} (≥3x EMI)` }); }
    else if (inc.estimatedMonthlyIncome >= requestedEmi * 2) score += 5;
    if (applicant.monthlyIncome > 0) {
      const ratio = inc.estimatedMonthlyIncome / applicant.monthlyIncome;
      if (ratio >= 0.7 && ratio <= 1.5) { score += 10; flags.push({ type: 'positive', text: 'Income consistent across sources' }); }
      else { score -= 15; flags.push({ type: 'negative', text: 'Income mismatch across sources' }); }
    }
  } else { score -= 10; flags.push({ type: 'negative', text: 'No income estimate available' }); }

  const itr = apis.itrVerification;
  if (itr) {
    if (itr.itrFiled && itr.consecutiveYearsFiled >= 3) { score += 15; flags.push({ type: 'positive', text: `ITR filed ${itr.consecutiveYearsFiled} consecutive years` }); }
    else if (itr.itrFiled) { score += 5; }
    else { score -= 10; flags.push({ type: 'negative', text: 'No ITR filed' }); }
    if (itr.tdsMatchesItr) { score += 5; flags.push({ type: 'positive', text: 'TDS matches ITR' }); }
    if (itr.incomeGrowthTrend === 'positive') { score += 5; }
  }

  const gst = apis.gstVerification;
  if (gst?.applicable) {
    if (gst.gstStatus === 'active' && gst.panGstMatch) { score += 5; flags.push({ type: 'positive', text: 'GST active & PAN matched' }); }
    else if (gst.gstStatus === 'cancelled') { score -= 10; flags.push({ type: 'negative', text: 'GSTIN cancelled' }); }
  }

  // FOIR calculation
  if (applicant.monthlyIncome > 0) {
    const foir = (applicant.existingEmi + requestedEmi) / applicant.monthlyIncome;
    const emiCapacity = applicant.monthlyIncome * 0.5 - applicant.existingEmi;
    if (foir < 0.4) { score += 15; flags.push({ type: 'positive', text: `FOIR: ${(foir * 100).toFixed(1)}% (healthy)` }); }
    else if (foir < 0.5) { score += 5; flags.push({ type: 'neutral', text: `FOIR: ${(foir * 100).toFixed(1)}% (borderline)` }); }
    else if (foir < 0.65) { score -= 10; flags.push({ type: 'negative', text: `FOIR: ${(foir * 100).toFixed(1)}% (high)` }); }
    else { score -= 20; flags.push({ type: 'negative', text: `FOIR: ${(foir * 100).toFixed(1)}% (very high)` }); }
    if (emiCapacity < requestedEmi) {
      flags.push({ type: 'negative', text: `EMI capacity ₹${Math.round(emiCapacity).toLocaleString()} < requested ₹${Math.round(requestedEmi).toLocaleString()}` });
    }
  }

  const pf = apis.phoneToPrefill;
  if (pf) {
    if (pf.dataRichness === 'high') score += 5;
    else if (pf.dataRichness === 'none') score -= 5;
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreDocument(apis) {
  let score = 0;
  const flags = [];

  const fc = apis.forgeryCheck;
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

  const imei = apis.imeiFetch;
  if (imei) {
    if (imei.valid && !imei.isStolen) { score += 25; flags.push({ type: 'positive', text: `Valid: ${imei.brand} ${imei.model}` }); }
    else if (imei.isStolen || imei.isLost) { score -= 50; flags.push({ type: 'negative', text: 'Device STOLEN/LOST' }); }
    else { score -= 15; flags.push({ type: 'negative', text: 'Invalid IMEI' }); }
    if (imei.manufactureYear && (new Date().getFullYear() - imei.manufactureYear) <= 5) score += 10;
  }

  const alt = apis.phoneToAlternate;
  if (alt) {
    if (alt.totalFound <= 2) { score += 15; flags.push({ type: 'positive', text: `${alt.totalFound} alternate phone(s)` }); }
    else if (alt.totalFound <= 4) score += 5;
    else { score -= 15; flags.push({ type: 'negative', text: `${alt.totalFound} alternate phones — suspicious` }); }
  }

  const ident = apis.phoneToIdentity;
  if (ident) {
    if (ident.consistencyScore >= 80) score += 20;
    else if (ident.consistencyScore >= 60) score += 10;
    else if (ident.consistencyScore > 0) score -= 10;
    else score -= 25;
  }

  const dis = apis.digitalIdentityScore;
  if (dis?.phoneEmailLinked) { score += 10; flags.push({ type: 'positive', text: 'Phone-email linked' }); }

  return { score: clamp(score, 0, 100), flags };
}


function scoreFraud(apis) {
  let score = 50;
  const flags = [];

  const vc = apis.velocityCheck;
  if (vc) {
    if (vc.applicationsByPan?.last7d === 0) score += 10;
    else if (vc.applicationsByPan?.last7d <= 2) { score -= 5; flags.push({ type: 'neutral', text: `${vc.applicationsByPan.last7d} apps by PAN (7d)` }); }
    else { score -= 20; flags.push({ type: 'negative', text: `${vc.applicationsByPan.last7d} apps by PAN (7d) — velocity breach` }); }

    if (vc.applicationsByDevice?.last7d > 3) { score -= 20; flags.push({ type: 'negative', text: `${vc.applicationsByDevice.last7d} apps from same device (7d)` }); }
    if (vc.sharedDeviceWithOtherPans) { score -= 25; flags.push({ type: 'negative', text: 'Device shared across multiple PANs' }); }
    if (vc.sharedIpWithOtherPans) { score -= 10; flags.push({ type: 'negative', text: 'IP shared across multiple PANs' }); }
    if (vc.sharedBankAccountWithOthers) { score -= 30; flags.push({ type: 'negative', text: 'Bank account shared — MULE suspect' }); }
    if (vc.loanStackingDetected) { score -= 15; flags.push({ type: 'negative', text: 'Loan stacking detected' }); }
    if (vc.recentRejections >= 5) { score -= 15; flags.push({ type: 'negative', text: `${vc.recentRejections} recent rejections` }); }
    if (vc.velocityRisk === 'low') score += 10;
    else if (vc.velocityRisk === 'critical') { score -= 20; flags.push({ type: 'negative', text: 'CRITICAL velocity risk' }); }
  }

  const fr = apis.fraudRing;
  if (fr) {
    if (fr.clusterSize <= 1) { score += 10; flags.push({ type: 'positive', text: 'No fraud ring connections' }); }
    else if (fr.clusterSize <= 5) { score -= 10; }
    else { score -= 30; flags.push({ type: 'negative', text: `FRAUD RING: cluster of ${fr.clusterSize}` }); }
    if (fr.networkRisk === 'critical') { score -= 20; flags.push({ type: 'negative', text: 'Critical network risk' }); }
    if (fr.referralChainAnomaly) { score -= 10; flags.push({ type: 'negative', text: 'Referral chain anomaly' }); }
  }

  return { score: clamp(score, 0, 100), flags };
}


function scoreBehavioral(apis) {
  let score = 50;
  const flags = [];

  const sb = apis.sessionBehavior;
  if (!sb) return { score: 50, flags: [{ type: 'neutral', text: 'Session behavior data not available' }] };

  if (sb.totalFormTime >= 120) { score += 10; flags.push({ type: 'positive', text: `Form time: ${sb.totalFormTime}s (natural)` }); }
  else if (sb.totalFormTime < 30) { score -= 20; flags.push({ type: 'negative', text: `Form time: ${sb.totalFormTime}s (bot/autofill)` }); }

  if (sb.copyPasteCount === 0) score += 10;
  else if (sb.copyPasteCount <= 2) { score -= 5; }
  else { score -= 15; flags.push({ type: 'negative', text: `Copy-paste: ${sb.copyPasteCount} fields` }); }

  if (sb.isRooted || sb.isJailbroken) { score -= 20; flags.push({ type: 'negative', text: 'Rooted/jailbroken device' }); }
  if (sb.isEmulator) { score -= 25; flags.push({ type: 'negative', text: 'EMULATOR detected' }); }
  if (sb.screenRecordingDetected) { score -= 15; flags.push({ type: 'negative', text: 'Screen recording detected' }); }

  if (sb.typingPatternHuman && sb.mouseMovementNatural) { score += 10; flags.push({ type: 'positive', text: 'Human interaction patterns' }); }
  else if (!sb.typingPatternHuman) { score -= 15; flags.push({ type: 'negative', text: 'Non-human typing pattern' }); }

  if (sb.behaviorScore >= 80) score += 10;
  else if (sb.behaviorScore < 30) score -= 15;

  return { score: clamp(score, 0, 100), flags };
}


function scoreLegal(apis) {
  let score = 50;
  const flags = [];

  const cr = apis.courtRecords;
  if (!cr) return { score: 50, flags: [{ type: 'neutral', text: 'Legal records not available' }] };

  if (cr.wilfulDefaulter?.isDefaulter) {
    score -= 80;
    flags.push({ type: 'negative', text: 'RBI WILFUL DEFAULTER — auto-decline trigger' });
  } else {
    score += 15;
    flags.push({ type: 'positive', text: 'Not a wilful defaulter' });
  }

  if (cr.cersaiCheck?.registered) { score -= 10; flags.push({ type: 'neutral', text: `CERSAI: ${cr.cersaiCheck.securedAssets} secured asset(s)` }); }
  else score += 5;

  if (cr.courtCases?.totalFound === 0) { score += 15; flags.push({ type: 'positive', text: 'No court cases found' }); }
  else {
    if (cr.courtCases?.criminalCases > 0) { score -= 25; flags.push({ type: 'negative', text: `${cr.courtCases.criminalCases} criminal case(s)` }); }
    if (cr.courtCases?.civilCases > 0) { score -= 10; flags.push({ type: 'negative', text: `${cr.courtCases.civilCases} civil case(s)` }); }
  }

  if (cr.sebiDebarment?.isDebarred) { score -= 20; flags.push({ type: 'negative', text: 'SEBI debarred' }); }
  if (cr.insolvencyCheck?.isBankrupt) { score -= 40; flags.push({ type: 'negative', text: 'DECLARED BANKRUPT' }); }
  if (cr.insolvencyCheck?.ncltCases > 0) { score -= 15; flags.push({ type: 'negative', text: `${cr.insolvencyCheck.ncltCases} NCLT case(s)` }); }

  return { score: clamp(score, 0, 100), flags };
}


// ═════════════════════════════════════════════════════════════════════════════
//  Aggregation & Decision
// ═════════════════════════════════════════════════════════════════════════════

function aggregateScore(categoryScores) {
  let finalScore = 0;
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    finalScore += (categoryScores[cat]?.score || 0) * weight * 10;
  }
  return Math.round(clamp(finalScore, 0, 1000));
}

function makeDecision(finalScore, apis) {
  // Hard auto-decline triggers
  const isWilfulDefaulter = apis.courtRecords?.wilfulDefaulter?.isDefaulter;
  const isCriticalFraudRing = apis.fraudRing?.networkRisk === 'critical';

  if (isWilfulDefaulter || isCriticalFraudRing) {
    return { decision: 'decline', label: 'AUTO-DECLINE (Hard Block)', reason: isWilfulDefaulter ? 'Wilful defaulter' : 'Critical fraud ring' };
  }
  if (finalScore >= THRESHOLDS.AUTO_APPROVE) return { decision: 'approve', label: 'AUTO-APPROVE', reason: null };
  if (finalScore >= THRESHOLDS.STANDARD) return { decision: 'standard', label: 'APPROVE (Standard Checks)', reason: null };
  if (finalScore >= THRESHOLDS.ELEVATED) return { decision: 'elevated', label: 'ENHANCED DUE DILIGENCE', reason: null };
  if (finalScore >= THRESHOLDS.MANUAL_REVIEW) return { decision: 'review', label: 'MANUAL REVIEW', reason: null };
  return { decision: 'decline', label: 'AUTO-DECLINE', reason: 'Score below minimum threshold' };
}


// ═════════════════════════════════════════════════════════════════════════════
//  API Orchestration — Phased Execution
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Phase A: Identity + Digital Trust + Device (after PAN + phone collected)
 * Returns preliminary risk score.
 */
export async function runPhaseA(applicant, existingApis = {}) {
  const { phone, firstName, lastName, pan, email, ipAddress, deviceId, pincode } = applicant;

  const [phoneIntel, whatsapp, digitalId, altPhone, identity] = await Promise.allSettled([
    signzyService.getPhoneIntelligence('+91' + phone, ipAddress, email, deviceId),
    signzyService.checkWhatsAppPresence(phone),
    signzyService.getDigitalIdentityScore(phone, email, `${firstName} ${lastName}`, pincode),
    signzyService.phoneToAlternatePhone(phone, firstName, lastName, pan),
    signzyService.phoneToIdentityDetails(phone, firstName, lastName, pan),
  ]);

  const apis = {
    ...existingApis,
    phoneIntelligence: settled(phoneIntel),
    whatsappPresence: settled(whatsapp),
    digitalIdentityScore: settled(digitalId),
    phoneToAlternate: settled(altPhone),
    phoneToIdentity: settled(identity),
  };

  const categoryScores = computeAllCategories(apis, applicant);
  const finalScore = aggregateScore(categoryScores);

  return {
    phase: 'A',
    apis,
    categoryScores,
    finalScore,
    decision: makeDecision(finalScore, apis),
    gate: finalScore >= PHASE_GATES.PHASE_A_MIN ? 'pass' : 'decline',
    completedAt: new Date().toISOString(),
  };
}

/**
 * Phase B: Income + Employment (after income data collected)
 */
export async function runPhaseB(applicant, existingApis = {}) {
  const { phone, firstName, lastName, pan, dob, address, pincode } = applicant;

  const [income, prefill, employment, advancedEmp] = await Promise.allSettled([
    signzyService.phoneToIncome(phone, firstName, dob, address, pincode, lastName, pan),
    signzyService.phoneToPrefill(phone, firstName, lastName, pan),
    signzyService.verifyEmployment(phone, pan),
    signzyService.advancedEmploymentVerification({ mobileNumber: phone, panNumber: pan }),
  ]);

  const apis = {
    ...existingApis,
    phoneToIncome: settled(income),
    phoneToPrefill: settled(prefill),
    employment: settled(employment),
    advancedEmployment: settled(advancedEmp),
  };

  const categoryScores = computeAllCategories(apis, applicant);
  const finalScore = aggregateScore(categoryScores);

  return {
    phase: 'B',
    apis,
    categoryScores,
    finalScore,
    decision: makeDecision(finalScore, apis),
    gate: finalScore >= PHASE_GATES.PHASE_B_MIN ? 'pass' : 'decline',
    completedAt: new Date().toISOString(),
  };
}

/**
 * Phase C: Address + KYC + Legal (after KYC + address obtained)
 */
export async function runPhaseC(applicant, existingApis = {}) {
  const { phone, firstName, lastName, pan, email, ipAddress, address, state, pincode } = applicant;

  const [regAddr, geocode, pincodeInfo, geoFence, digIntegrity] = await Promise.allSettled([
    signzyService.phoneToRegisteredAddress(phone, firstName, lastName, pan),
    signzyService.geocodeAddress(address, null, null),
    signzyService.getPincodeDetails(pincode),
    signzyService.checkGeoFencing(ipAddress, 'IN', state),
    signzyService.checkDigitalIntegrity(email, phone, ipAddress),
  ]);

  const apis = {
    ...existingApis,
    registeredAddress: settled(regAddr),
    addressGeocode: settled(geocode),
    pincodeDetails: settled(pincodeInfo),
    geoFencing: settled(geoFence),
    digitalIntegrity: settled(digIntegrity),
  };

  const categoryScores = computeAllCategories(apis, applicant);
  const finalScore = aggregateScore(categoryScores);

  return {
    phase: 'C',
    apis,
    categoryScores,
    finalScore,
    decision: makeDecision(finalScore, apis),
    gate: finalScore >= PHASE_GATES.PHASE_C_MIN ? 'pass' : 'review',
    completedAt: new Date().toISOString(),
  };
}

/**
 * Phase D: Bank + Document + Device (after bank details + selfie)
 */
export async function runPhaseD(applicant, existingApis = {}) {
  const { accountNumber, ifsc, firstName, lastName, phone, imei, documentImageUrl } = applicant;
  const fullName = `${firstName} ${lastName}`;

  const [bankVerify, ifscSearch, imeiResult, forgery] = await Promise.allSettled([
    signzyService.verifyBankAccount(accountNumber, ifsc, fullName, phone),
    signzyService.searchBankByIfsc(ifsc),
    imei ? signzyService.fetchImeiDetails(imei) : Promise.resolve(null),
    documentImageUrl ? signzyService.checkDocumentForgery(documentImageUrl) : Promise.resolve(null),
  ]);

  const apis = {
    ...existingApis,
    bankVerification: settled(bankVerify),
    ifscSearch: settled(ifscSearch),
    imeiFetch: settled(imeiResult),
    forgeryCheck: settled(forgery),
  };

  const categoryScores = computeAllCategories(apis, applicant);
  const finalScore = aggregateScore(categoryScores);

  return {
    phase: 'D',
    apis,
    categoryScores,
    finalScore,
    decision: makeDecision(finalScore, apis),
    gate: finalScore >= THRESHOLDS.MANUAL_REVIEW ? 'pass' : 'decline',
    completedAt: new Date().toISOString(),
  };
}


// ─── Compute all categories at once ─────────────────────────────────────────

function computeAllCategories(apis, applicant) {
  return {
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
}


// ═════════════════════════════════════════════════════════════════════════════
//  Full Risk Assessment (end-to-end)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Run the complete risk assessment across all 4 phases.
 * Returns a full risk profile with scores, flags, decision, and audit trail.
 */
export async function calculateFullRiskScore(applicant, externalData = {}) {
  const startTime = Date.now();
  const phaseResults = {};

  // Seed with any externally-provided data (credit bureau, bank statement, etc.)
  let apis = { ...externalData };

  // Phase A
  const phaseA = await runPhaseA(applicant, apis);
  phaseResults.A = { score: phaseA.finalScore, gate: phaseA.gate, completedAt: phaseA.completedAt };
  apis = phaseA.apis;

  if (phaseA.gate === 'decline') {
    return buildRiskProfile(applicant, apis, phaseA, phaseResults, startTime);
  }

  // Phase B
  const phaseB = await runPhaseB(applicant, apis);
  phaseResults.B = { score: phaseB.finalScore, gate: phaseB.gate, completedAt: phaseB.completedAt };
  apis = phaseB.apis;

  if (phaseB.gate === 'decline') {
    return buildRiskProfile(applicant, apis, phaseB, phaseResults, startTime);
  }

  // Phase C
  const phaseC = await runPhaseC(applicant, apis);
  phaseResults.C = { score: phaseC.finalScore, gate: phaseC.gate, completedAt: phaseC.completedAt };
  apis = phaseC.apis;

  // Phase D
  const phaseD = await runPhaseD(applicant, apis);
  phaseResults.D = { score: phaseD.finalScore, gate: phaseD.gate, completedAt: phaseD.completedAt };
  apis = phaseD.apis;

  return buildRiskProfile(applicant, apis, phaseD, phaseResults, startTime);
}


function buildRiskProfile(applicant, apis, latestPhase, phaseResults, startTime) {
  const allFlags = [];
  for (const cat of Object.values(latestPhase.categoryScores)) {
    allFlags.push(...cat.flags);
  }

  // Build reason codes for regulatory compliance
  const reasonCodes = allFlags
    .filter(f => f.type === 'negative')
    .map(f => f.text);

  return {
    applicationId: applicant.applicationId || null,
    finalScore: latestPhase.finalScore,
    decision: latestPhase.decision.decision,
    decisionLabel: latestPhase.decision.label,
    decisionReason: latestPhase.decision.reason,
    reasonCodes,
    calculatedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    lastPhase: latestPhase.phase,
    phases: phaseResults,
    categoryScores: latestPhase.categoryScores,
    allFlags,
    // Raw API responses for audit trail — in production, store encrypted
    apiResults: apis,
  };
}


// ─── Exports ────────────────────────────────────────────────────────────────

export const riskEngine = {
  calculateFullRiskScore,
  runPhaseA,
  runPhaseB,
  runPhaseC,
  runPhaseD,
  THRESHOLDS,
  PHASE_GATES,
};

export default riskEngine;
