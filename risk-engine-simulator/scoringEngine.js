/**
 * FinZ Risk Scoring Engine
 *
 * Transforms raw API responses into a weighted risk score (0-1000).
 *
 * Architecture:
 *   1. Each of 7 categories produces a sub-score (0-100)
 *   2. Sub-scores are weighted and summed to produce a final score (0-1000)
 *   3. Red/green flags are collected for explainability
 *   4. A decision is derived from the final score
 */

// ─── Weights (must sum to 1.0) ──────────────────────────────────────────────

const CATEGORY_WEIGHTS = {
  identity:     0.20,  // 20% — PAN, name matching, identity docs
  financial:    0.25,  // 25% — Bank account, employment, PF
  phoneDigital: 0.15,  // 15% — Phone risk, WhatsApp, digital footprint
  address:      0.10,  // 10% — Geocode, pincode, geo-fencing
  income:       0.15,  // 15% — Income estimate, FOIR, prefill richness
  document:     0.05,  //  5% — Forgery detection
  device:       0.10,  // 10% — IMEI, alternate phones, identity consistency
};

const CATEGORY_LABELS = {
  identity:     'Identity Verification',
  financial:    'Financial Stability',
  phoneDigital: 'Phone & Digital Trust',
  address:      'Address & Location',
  income:       'Income & Capacity',
  document:     'Document Integrity',
  device:       'Device & Behavioral',
};

const CATEGORY_COLORS = {
  identity:     '#6c5ce7',
  financial:    '#00b894',
  phoneDigital: '#0984e3',
  address:      '#fdcb6e',
  income:       '#e17055',
  document:     '#d63031',
  device:       '#a29bfe',
};

// ─── Decision Thresholds ────────────────────────────────────────────────────

const THRESHOLDS = {
  AUTO_APPROVE:    800,
  STANDARD:        600,
  ELEVATED:        400,
  MANUAL_REVIEW:   200,
  // Below 200 = auto-decline
};


// ─── EMI Calculation ────────────────────────────────────────────────────────

function calculateEmi(principal, annualRate, tenureMonths) {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  return principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1);
}


// ═══════════════════════════════════════════════════════════════════════════
//  Category Scorers — each returns { score: 0-100, flags: [], details: {} }
// ═══════════════════════════════════════════════════════════════════════════

function scoreIdentity(apis) {
  let score = 0;
  const flags = [];
  const details = {};

  // --- PAN Fetch ---
  const pan = apis.panFetch?.output?.result;
  if (pan) {
    if (pan.isValid) {
      score += 20;
      flags.push({ type: 'positive', text: 'PAN is valid' });
    } else {
      score -= 50;
      flags.push({ type: 'negative', text: 'PAN is INVALID / FAKE' });
    }

    if (pan.panStatusLabel === 'VALID') {
      score += 10;
    } else if (['FAKE', 'DEACTIVATED', 'DELETED'].includes(pan.panStatusLabel)) {
      score -= 50;
      flags.push({ type: 'negative', text: `PAN status: ${pan.panStatusLabel}` });
    }

    if (pan.aadhaarSeedingStatus === 'Yes') {
      score += 10;
      flags.push({ type: 'positive', text: 'Aadhaar seeded to PAN' });
    } else {
      score -= 5;
      flags.push({ type: 'neutral', text: 'Aadhaar not seeded to PAN' });
    }

    if (pan.individualTaxComplianceStatus === 'Operative') {
      score += 5;
    } else {
      score -= 10;
      flags.push({ type: 'negative', text: 'Tax compliance: inoperative' });
    }

    details.panStatus = pan.panStatusLabel;
    details.aadhaarSeeded = pan.aadhaarSeedingStatus;
  }

  // --- Phone-to-PAN ---
  const p2p = apis.phoneToPan?.output?.result;
  if (p2p) {
    if (p2p.matchFound) {
      score += 15;
      flags.push({ type: 'positive', text: 'Phone-to-PAN match confirmed' });
    } else {
      score -= 5;
      flags.push({ type: 'neutral', text: 'Phone-to-PAN: no match found' });
    }
    details.phonePanMatch = p2p.matchFound;
  }

  // --- Phone to Identity Details ---
  const ident = apis.phoneToIdentity?.output?.result;
  if (ident) {
    if (ident.identities && ident.identities.length >= 2) {
      score += 10;
      flags.push({ type: 'positive', text: `${ident.identities.length} identity docs found (DL, Voter ID, etc.)` });
    } else if (ident.identities && ident.identities.length === 1) {
      score += 5;
    } else {
      score -= 10;
      flags.push({ type: 'negative', text: 'No identity documents found on record' });
    }

    if (ident.consistencyScore >= 80) {
      score += 15;
      flags.push({ type: 'positive', text: `Identity consistency score: ${ident.consistencyScore}%` });
    } else if (ident.consistencyScore >= 60) {
      score += 8;
      flags.push({ type: 'neutral', text: `Identity consistency score: ${ident.consistencyScore}%` });
    } else {
      score -= 10;
      flags.push({ type: 'negative', text: `Low identity consistency: ${ident.consistencyScore}%` });
    }
    details.identityDocs = ident.identities?.length || 0;
    details.consistencyScore = ident.consistencyScore;
  }

  // --- DigiLocker ---
  const digi = apis.digilockerDetails?.output?.result;
  if (digi) {
    if (digi.totalDocuments >= 3) {
      score += 10;
      flags.push({ type: 'positive', text: `${digi.totalDocuments} DigiLocker documents linked` });
    } else if (digi.totalDocuments >= 1) {
      score += 5;
    } else {
      score -= 5;
    }
    details.digilockerDocs = digi.totalDocuments;
  }

  // --- e-Aadhaar ---
  const eaa = apis.eAadhaarXml?.output?.result;
  if (eaa) {
    if (eaa.digitalSignatureValid) {
      score += 5;
      flags.push({ type: 'positive', text: 'e-Aadhaar digital signature valid' });
    } else if (eaa.aadhaarValid === false) {
      score -= 15;
      flags.push({ type: 'negative', text: 'e-Aadhaar validation failed' });
    }
  }

  return { score: clamp(score, 0, 100), flags, details };
}


function scoreFinancial(apis) {
  let score = 0;
  const flags = [];
  const details = {};

  // --- Bank Verification ---
  const bank = apis.bankVerification?.output?.result;
  if (bank) {
    if (bank.accountActive) {
      score += 25;
      flags.push({ type: 'positive', text: 'Bank account is active' });
    } else {
      score -= 30;
      flags.push({ type: 'negative', text: 'Bank account inactive or not found' });
    }

    if (bank.nameMatch && bank.nameMatchScore >= 80) {
      score += 15;
      flags.push({ type: 'positive', text: `Bank name match: ${bank.nameMatchScore}%` });
    } else if (bank.nameMatch) {
      score += 8;
      flags.push({ type: 'neutral', text: `Bank name partial match: ${bank.nameMatchScore}%` });
    } else {
      score -= 20;
      flags.push({ type: 'negative', text: 'Bank account name mismatch' });
    }

    if (bank.upiLinked) {
      score += 5;
      flags.push({ type: 'positive', text: 'UPI linked to account' });
    }

    details.bankActive = bank.accountActive;
    details.nameMatchScore = bank.nameMatchScore;
  }

  // --- IFSC Search ---
  const ifsc = apis.ifscSearch?.output?.result;
  if (ifsc) {
    if (ifsc.valid) {
      score += 5;
    } else {
      score -= 10;
      flags.push({ type: 'negative', text: 'IFSC code invalid' });
    }
    details.ifscValid = ifsc.valid;
  }

  // --- Employment Verification ---
  const emp = apis.employmentVerification?.output?.result;
  if (emp) {
    if (emp.isEmployed) {
      score += 20;
      flags.push({ type: 'positive', text: `Currently employed at ${emp.employerName}` });
    } else if (emp.membershipStatus === 'not_found') {
      score -= 15;
      flags.push({ type: 'negative', text: 'No EPFO employment record found' });
    } else {
      score -= 20;
      flags.push({ type: 'negative', text: `Employment ended: ${emp.dateOfExit}` });
    }
    details.isEmployed = emp.isEmployed;
    details.employer = emp.employerName;
  }

  // --- Advanced Employment ---
  const adv = apis.advancedEmployment?.output?.result;
  if (adv) {
    if (adv.employmentHistory && adv.employmentHistory.length >= 2) {
      score += 5;
      flags.push({ type: 'positive', text: `Stable work history: ${adv.totalExperience}` });
    }

    if (adv.pfFilingFrequency === 'monthly') {
      score += 10;
      flags.push({ type: 'positive', text: 'PF filed monthly (recent)' });
    } else if (adv.pfFilingFrequency === 'quarterly') {
      score += 3;
      flags.push({ type: 'neutral', text: 'PF filed quarterly' });
    } else {
      score -= 10;
      flags.push({ type: 'negative', text: 'No PF filing history' });
    }

    if (adv.employerGstinActive) {
      score += 5;
      flags.push({ type: 'positive', text: 'Employer GSTIN active' });
    }

    // Check recent PF filing
    if (adv.lastPfFiled) {
      const lastPf = new Date(adv.lastPfFiled);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      if (lastPf >= threeMonthsAgo) {
        score += 5;
      } else {
        score -= 5;
        flags.push({ type: 'neutral', text: 'PF not filed in last 3 months' });
      }
    }

    details.totalExperience = adv.totalExperience;
    details.pfFiling = adv.pfFilingFrequency;
  }

  return { score: clamp(score, 0, 100), flags, details };
}


function scorePhoneDigital(apis) {
  let score = 0;
  const flags = [];
  const details = {};

  // --- Phone Intelligence ---
  const pi = apis.phoneIntelligence?.output?.result;
  if (pi) {
    // Risk score (Signzy returns 0-1000, lower = safer)
    if (pi.riskScore < 300) {
      score += 20;
      flags.push({ type: 'positive', text: `Phone risk score: ${pi.riskScore} (low)` });
    } else if (pi.riskScore < 500) {
      score += 10;
      flags.push({ type: 'neutral', text: `Phone risk score: ${pi.riskScore} (medium)` });
    } else if (pi.riskScore < 700) {
      score += 0;
      flags.push({ type: 'neutral', text: `Phone risk score: ${pi.riskScore} (elevated)` });
    } else {
      score -= 30;
      flags.push({ type: 'negative', text: `Phone risk score: ${pi.riskScore} (HIGH)` });
    }

    // Phone type
    if (pi.phoneType === 'mobile') {
      score += 10;
    } else {
      score -= 25;
      flags.push({ type: 'negative', text: `Phone type: ${pi.phoneType} (not mobile)` });
    }

    // Blocklist
    if (!pi.isBlocklisted) {
      score += 10;
    } else {
      score -= 40;
      flags.push({ type: 'negative', text: 'Phone number is BLOCKLISTED' });
    }

    // SIM swap
    if (pi.simSwapDetected) {
      score -= 15;
      flags.push({ type: 'negative', text: `Recent SIM swap detected: ${pi.simSwapLastDate}` });
    }

    // Carrier quality
    if (['Airtel', 'Jio', 'Vi', 'BSNL'].includes(pi.carrier)) {
      score += 5;
    }

    // Fraud sources
    if (pi.fraudSources && pi.fraudSources.length > 0) {
      score -= 40;
      flags.push({ type: 'negative', text: `Fraud source flags: ${pi.fraudSources.join(', ')}` });
    }

    details.phoneRisk = pi.riskScore;
    details.phoneType = pi.phoneType;
    details.carrier = pi.carrier;
  }

  // --- WhatsApp ---
  const wa = apis.whatsappPresence?.output?.result;
  if (wa) {
    if (wa.isRegistered) {
      score += 10;
      if (wa.accountType === 'personal') {
        score += 5;
        flags.push({ type: 'positive', text: 'WhatsApp: personal account registered' });
      } else {
        flags.push({ type: 'neutral', text: 'WhatsApp: business account' });
      }
    } else {
      score -= 5;
      flags.push({ type: 'neutral', text: 'No WhatsApp account found' });
    }
    details.whatsapp = wa.isRegistered;
  }

  // --- Digital Identity Score ---
  const dis = apis.digitalIdentityScore?.output?.result;
  if (dis) {
    if (dis.score > 7) {
      score += 10;
      flags.push({ type: 'positive', text: `Digital identity score: ${dis.score}/10 (strong)` });
    } else if (dis.score > 5) {
      score += 5;
    } else if (dis.score > 3) {
      score += 0;
      flags.push({ type: 'neutral', text: `Digital identity score: ${dis.score}/10 (thin)` });
    } else {
      score -= 10;
      flags.push({ type: 'negative', text: `Digital identity score: ${dis.score}/10 (very thin)` });
    }

    if (dis.ecomPresence && dis.ecomPresence.length >= 2) {
      score += 5;
    }
    if (dis.socialPresence && dis.socialPresence.length >= 1) {
      score += 5;
    }

    // Phone first seen check
    if (dis.phoneFirstSeen) {
      const firstSeen = new Date(dis.phoneFirstSeen);
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      if (firstSeen <= twoYearsAgo) {
        score += 5;
        flags.push({ type: 'positive', text: `Phone first seen: ${dis.phoneFirstSeen} (established)` });
      } else {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        if (firstSeen > sixMonthsAgo) {
          score -= 15;
          flags.push({ type: 'negative', text: `Phone first seen: ${dis.phoneFirstSeen} (very recent)` });
        }
      }
    } else {
      score -= 10;
      flags.push({ type: 'negative', text: 'Phone first seen: unknown' });
    }

    details.digitalScore = dis.score;
    details.ecomPresence = dis.ecomPresence;
  }

  // --- Digital Integrity ---
  const di = apis.digitalIntegrity?.output?.result;
  if (di) {
    if (di.emailValid && !di.emailDisposable) {
      score += 5;
    } else if (di.emailDisposable) {
      score -= 15;
      flags.push({ type: 'negative', text: 'Disposable email detected' });
    }

    if (di.ipBlocklisted) {
      score -= 20;
      flags.push({ type: 'negative', text: 'IP address is BLOCKLISTED' });
    }

    if (di.botLikelihood > 0.5) {
      score -= 20;
      flags.push({ type: 'negative', text: `Bot activity likelihood: ${(di.botLikelihood * 100).toFixed(0)}%` });
    }

    details.emailValid = di.emailValid;
    details.emailDisposable = di.emailDisposable;
    details.ipBlocklisted = di.ipBlocklisted;
    details.integrityScore = di.integrityScore;
  }

  return { score: clamp(score, 0, 100), flags, details };
}


function scoreAddress(apis) {
  let score = 0;
  const flags = [];
  const details = {};

  // --- Registered Address ---
  const ra = apis.registeredAddress?.output?.result;
  if (ra) {
    if (ra.addressFound) {
      score += 20;
      if (ra.matchScore >= 80) {
        score += 15;
        flags.push({ type: 'positive', text: `Registered address matches: ${ra.matchScore}%` });
      } else if (ra.matchScore >= 50) {
        score += 5;
        flags.push({ type: 'neutral', text: `Registered address partial match: ${ra.matchScore}%` });
      } else {
        score -= 10;
        flags.push({ type: 'negative', text: `Registered address mismatch: ${ra.matchScore}%` });
      }
    } else {
      score -= 15;
      flags.push({ type: 'negative', text: 'No registered address found for phone' });
    }
    details.addressMatch = ra.matchScore;
  }

  // --- Address Geocode ---
  const geo = apis.addressGeocode?.output?.result;
  if (geo) {
    if (geo.confidence > 0.7) {
      score += 15;
      flags.push({ type: 'positive', text: `Geocode confidence: ${(geo.confidence * 100).toFixed(0)}%` });
    } else if (geo.confidence > 0.5) {
      score += 5;
    } else {
      score -= 5;
      flags.push({ type: 'neutral', text: `Low geocode confidence: ${(geo.confidence * 100).toFixed(0)}%` });
    }

    if (geo.isInternationalBorder) {
      score -= 10;
      flags.push({ type: 'negative', text: `Near international border (${geo.nearestBorderDistance} km)` });
    } else {
      score += 10;
    }

    if (geo.distanceFromDevice < 10) {
      score += 5;
    } else if (geo.distanceFromDevice > 100) {
      score -= 10;
      flags.push({ type: 'negative', text: `Device ${geo.distanceFromDevice} km from geocoded address` });
    }

    details.geocodeConfidence = geo.confidence;
    details.borderDistance = geo.nearestBorderDistance;
  }

  // --- Pincode Details ---
  const pc = apis.pincodeDetails?.output?.result;
  if (pc) {
    if (pc.isServiceable && !pc.isBlacklisted) {
      score += 10;
    }
    if (pc.isBlacklisted) {
      score -= 30;
      flags.push({ type: 'negative', text: 'Pincode is BLACKLISTED' });
    }
    if (pc.riskCategory === 'low') {
      score += 5;
    } else if (pc.riskCategory === 'high') {
      score -= 10;
      flags.push({ type: 'negative', text: `High-risk pincode area: ${pc.area}` });
    }
    details.pincodeRisk = pc.riskCategory;
    details.pinBlacklisted = pc.isBlacklisted;
  }

  // --- Geo Fencing ---
  const gf = apis.geoFencing?.output?.result;
  if (gf) {
    if (gf.geoMatch && gf.stateMatch) {
      score += 20;
      flags.push({ type: 'positive', text: `IP geo matches: ${gf.ipCity}, ${gf.ipState}` });
    } else if (gf.geoMatch && !gf.stateMatch) {
      score += 5;
      flags.push({ type: 'neutral', text: `IP in India but different state: ${gf.ipState}` });
    } else {
      score -= 20;
      flags.push({ type: 'negative', text: `IP geo mismatch: ${gf.ipCountry} (${gf.ipCity})` });
    }

    if (gf.isTor || gf.isVpn || gf.isProxy) {
      score -= 15;
      const types = [gf.isTor && 'Tor', gf.isVpn && 'VPN', gf.isProxy && 'Proxy'].filter(Boolean);
      flags.push({ type: 'negative', text: `Anonymizer detected: ${types.join(', ')}` });
    }

    details.ipLocation = `${gf.ipCity}, ${gf.ipState}, ${gf.ipCountry}`;
    details.threatScore = gf.threatScore;
  }

  return { score: clamp(score, 0, 100), flags, details };
}


function scoreIncome(apis, applicant) {
  let score = 0;
  const flags = [];
  const details = {};

  const requestedEmi = calculateEmi(
    applicant.loanAmount,
    applicant.interestRate,
    applicant.tenure
  );

  // --- Phone to Income ---
  const inc = apis.phoneToIncome?.output?.result;
  if (inc) {
    if (inc.estimatedMonthlyIncome) {
      score += 15;

      // Income vs EMI ratio
      if (inc.estimatedMonthlyIncome >= requestedEmi * 3) {
        score += 20;
        flags.push({ type: 'positive', text: `Estimated income ₹${inc.estimatedMonthlyIncome.toLocaleString()} (≥3x EMI)` });
      } else if (inc.estimatedMonthlyIncome >= requestedEmi * 2) {
        score += 10;
        flags.push({ type: 'positive', text: `Estimated income ₹${inc.estimatedMonthlyIncome.toLocaleString()} (≥2x EMI)` });
      } else {
        score += 0;
        flags.push({ type: 'neutral', text: `Estimated income ₹${inc.estimatedMonthlyIncome.toLocaleString()} (<2x EMI)` });
      }

      // Cross-check with declared income
      if (applicant.monthlyIncome > 0 && inc.estimatedMonthlyIncome > 0) {
        const ratio = inc.estimatedMonthlyIncome / applicant.monthlyIncome;
        if (ratio >= 0.7 && ratio <= 1.5) {
          score += 10;
          flags.push({ type: 'positive', text: 'Income consistent across sources' });
        } else {
          score -= 15;
          flags.push({ type: 'negative', text: `Income inconsistency: declared ₹${applicant.monthlyIncome.toLocaleString()} vs estimated ₹${inc.estimatedMonthlyIncome.toLocaleString()}` });
        }
      }

      details.estimatedIncome = inc.estimatedMonthlyIncome;
      details.confidence = inc.confidence;
    } else {
      score -= 20;
      flags.push({ type: 'negative', text: 'No income estimate available' });
    }
  }

  // --- FOIR Calculation (using declared income) ---
  if (applicant.monthlyIncome > 0) {
    const foir = applicant.existingEmi / applicant.monthlyIncome;
    const emiCapacity = applicant.monthlyIncome * 0.5 - applicant.existingEmi;

    if (foir < 0.4) {
      score += 20;
      flags.push({ type: 'positive', text: `FOIR: ${(foir * 100).toFixed(1)}% (healthy)` });
    } else if (foir < 0.5) {
      score += 10;
      flags.push({ type: 'neutral', text: `FOIR: ${(foir * 100).toFixed(1)}% (borderline)` });
    } else if (foir < 0.65) {
      score -= 10;
      flags.push({ type: 'negative', text: `FOIR: ${(foir * 100).toFixed(1)}% (high)` });
    } else {
      score -= 30;
      flags.push({ type: 'negative', text: `FOIR: ${(foir * 100).toFixed(1)}% (very high)` });
    }

    if (emiCapacity >= requestedEmi) {
      score += 10;
      flags.push({ type: 'positive', text: `EMI capacity ₹${Math.round(emiCapacity).toLocaleString()} ≥ requested ₹${Math.round(requestedEmi).toLocaleString()}` });
    } else {
      score -= 20;
      flags.push({ type: 'negative', text: `EMI capacity ₹${Math.round(emiCapacity).toLocaleString()} < requested ₹${Math.round(requestedEmi).toLocaleString()}` });
    }

    details.foir = foir;
    details.emiCapacity = emiCapacity;
    details.requestedEmi = requestedEmi;
  }

  // --- Prefill Data Richness ---
  const pf = apis.phoneToPrefill?.output?.result;
  if (pf) {
    if (pf.dataRichness === 'high') {
      score += 10;
      flags.push({ type: 'positive', text: 'Rich prefill data (multiple addresses, IDs)' });
    } else if (pf.dataRichness === 'medium') {
      score += 5;
    } else {
      score -= 5;
      flags.push({ type: 'neutral', text: 'Thin prefill data' });
    }
    details.prefillRichness = pf.dataRichness;
  }

  return { score: clamp(score, 0, 100), flags, details };
}


function scoreDocument(apis) {
  let score = 0;
  const flags = [];
  const details = {};

  const fc = apis.forgeryCheck?.output?.result;
  if (fc) {
    if (fc.status === 'genuine') {
      score += 50;
      flags.push({ type: 'positive', text: 'Document passes forgery check' });
    } else if (fc.status === 'suspicious') {
      score += 10;
      flags.push({ type: 'neutral', text: `Suspicious document (score: ${fc.forgeryScore.toFixed(2)})` });
    } else {
      score -= 80;
      flags.push({ type: 'negative', text: `FORGED document detected (score: ${fc.forgeryScore.toFixed(2)})` });
    }

    if (fc.forgeryScore < 0.3) {
      score += 30;
    } else if (fc.forgeryScore < 0.6) {
      score += 10;
    } else {
      score -= 20;
    }

    if (fc.anomalies && fc.anomalies.length > 0) {
      flags.push({ type: 'negative', text: `Anomalies: ${fc.anomalies.join(', ')}` });
    }

    if (fc.metadataConsistent) {
      score += 10;
    }

    // Selfie liveness (simulated as always passed for good/risky)
    score += 10;

    details.forgeryScore = fc.forgeryScore;
    details.status = fc.status;
    details.anomalies = fc.anomalies;
  }

  return { score: clamp(score, 0, 100), flags, details };
}


function scoreDevice(apis) {
  let score = 0;
  const flags = [];
  const details = {};

  // --- IMEI ---
  const imei = apis.imeiFetch?.output?.result;
  if (imei) {
    if (imei.valid && !imei.isStolen && !imei.isLost) {
      score += 25;
      flags.push({ type: 'positive', text: `Valid device: ${imei.brand} ${imei.model}` });
    } else if (imei.isStolen || imei.isLost) {
      score -= 50;
      flags.push({ type: 'negative', text: 'Device reported STOLEN/LOST' });
    } else {
      score -= 15;
      flags.push({ type: 'negative', text: 'Invalid IMEI' });
    }

    if (imei.manufactureYear && (new Date().getFullYear() - imei.manufactureYear) <= 5) {
      score += 10;
    } else if (imei.manufactureYear && (new Date().getFullYear() - imei.manufactureYear) > 8) {
      score -= 10;
      flags.push({ type: 'neutral', text: `Old device: ${imei.deviceAge}` });
    }

    details.device = imei.brand ? `${imei.brand} ${imei.model}` : 'Unknown';
    details.deviceAge = imei.deviceAge;
  }

  // --- Alternate Phones ---
  const alt = apis.phoneToAlternate?.output?.result;
  if (alt) {
    if (alt.totalFound <= 2) {
      score += 15;
      flags.push({ type: 'positive', text: `${alt.totalFound} alternate phone(s) — normal` });
    } else if (alt.totalFound <= 4) {
      score += 5;
      flags.push({ type: 'neutral', text: `${alt.totalFound} alternate phones found` });
    } else {
      score -= 15;
      flags.push({ type: 'negative', text: `${alt.totalFound} alternate phones — suspicious` });
    }
    details.alternatePhones = alt.totalFound;
  }

  // --- Identity Consistency (reusing phoneToIdentity) ---
  const ident = apis.phoneToIdentity?.output?.result;
  if (ident) {
    if (ident.consistencyScore >= 80) {
      score += 20;
    } else if (ident.consistencyScore >= 60) {
      score += 10;
    } else if (ident.consistencyScore > 0) {
      score -= 10;
      flags.push({ type: 'negative', text: 'Identity details inconsistent across records' });
    } else {
      score -= 25;
      flags.push({ type: 'negative', text: 'No identity consistency data' });
    }
  }

  // --- Digital Identity Score phone tenure ---
  const dis = apis.digitalIdentityScore?.output?.result;
  if (dis) {
    if (dis.phoneEmailLinked) {
      score += 10;
      flags.push({ type: 'positive', text: 'Phone-email link confirmed' });
    }
    if (dis.phoneFirstSeen) {
      const firstSeen = new Date(dis.phoneFirstSeen);
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      if (firstSeen <= twoYearsAgo) {
        score += 10;
      }
    } else {
      score -= 15;
    }
  }

  return { score: clamp(score, 0, 100), flags, details };
}


// ─── Aggregator ─────────────────────────────────────────────────────────────

function calculateFullRiskScore(apis, applicant) {
  const categoryScores = {
    identity:     scoreIdentity(apis),
    financial:    scoreFinancial(apis),
    phoneDigital: scorePhoneDigital(apis),
    address:      scoreAddress(apis),
    income:       scoreIncome(apis, applicant),
    document:     scoreDocument(apis),
    device:       scoreDevice(apis),
  };

  // Weighted aggregation → 0-1000
  let finalScore = 0;
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    finalScore += categoryScores[cat].score * weight * 10; // score(0-100) * weight * 10 → contribution to 0-1000
  }
  finalScore = Math.round(clamp(finalScore, 0, 1000));

  // Aggregate flags
  const allFlags = [];
  for (const cat of Object.values(categoryScores)) {
    allFlags.push(...cat.flags);
  }

  // Decision
  let decision, decisionLabel;
  if (finalScore >= THRESHOLDS.AUTO_APPROVE) {
    decision = 'approve';
    decisionLabel = 'AUTO-APPROVE';
  } else if (finalScore >= THRESHOLDS.STANDARD) {
    decision = 'standard';
    decisionLabel = 'APPROVE (Standard Checks)';
  } else if (finalScore >= THRESHOLDS.ELEVATED) {
    decision = 'elevated';
    decisionLabel = 'ENHANCED DUE DILIGENCE';
  } else if (finalScore >= THRESHOLDS.MANUAL_REVIEW) {
    decision = 'review';
    decisionLabel = 'MANUAL REVIEW';
  } else {
    decision = 'decline';
    decisionLabel = 'AUTO-DECLINE';
  }

  // Phase-wise progressive scores
  // Phase A: identity + phoneDigital + device (partial)
  const phaseAScore = Math.round(
    (categoryScores.identity.score * 0.40 +
     categoryScores.phoneDigital.score * 0.35 +
     categoryScores.device.score * 0.25) * 10
  );

  // Phase B: adds income + financial (partial)
  const phaseBScore = Math.round(
    (categoryScores.identity.score * CATEGORY_WEIGHTS.identity +
     categoryScores.phoneDigital.score * CATEGORY_WEIGHTS.phoneDigital +
     categoryScores.income.score * CATEGORY_WEIGHTS.income +
     categoryScores.financial.score * 0.10 +
     categoryScores.device.score * 0.05) * 10 / 0.65 * 0.65 // normalize
  );

  // Phase C: adds address
  const phaseCScore = Math.round(
    (categoryScores.identity.score * CATEGORY_WEIGHTS.identity +
     categoryScores.phoneDigital.score * CATEGORY_WEIGHTS.phoneDigital +
     categoryScores.income.score * CATEGORY_WEIGHTS.income +
     categoryScores.address.score * CATEGORY_WEIGHTS.address +
     categoryScores.financial.score * 0.10 +
     categoryScores.device.score * 0.05) * 10 / 0.75 * 0.75
  );

  return {
    finalScore,
    decision,
    decisionLabel,
    categoryScores,
    allFlags,
    phaseScores: {
      A: clamp(phaseAScore, 0, 1000),
      B: clamp(phaseBScore, 0, 1000),
      C: clamp(phaseCScore, 0, 1000),
      D: finalScore,
    },
  };
}


// ─── Utility ────────────────────────────────────────────────────────────────

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
