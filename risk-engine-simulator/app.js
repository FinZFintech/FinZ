/**
 * FinZ Risk Engine Simulator v2 — UI Controller
 */

let currentScenario = 'good';
let currentPhase = 'A';
let currentApis = {};
let currentResult = null;

document.addEventListener('DOMContentLoaded', () => {
  const inputPanel = document.querySelector('.input-panel');
  const scenarioBar = document.createElement('div');
  scenarioBar.className = 'scenario-bar';
  scenarioBar.innerHTML = `
    <button class="btn-scenario active" data-scenario="good">Good Applicant</button>
    <button class="btn-scenario" data-scenario="risky">Risky Applicant</button>
    <button class="btn-scenario" data-scenario="fraud">Fraudulent Applicant</button>
  `;
  inputPanel.insertBefore(scenarioBar, inputPanel.querySelector('.input-grid'));

  scenarioBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-scenario');
    if (!btn) return;
    scenarioBar.querySelectorAll('.btn-scenario').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentScenario = btn.dataset.scenario;
    populateInputs(SCENARIOS[currentScenario].applicant);
  });

  document.getElementById('runSimulation').addEventListener('click', runSimulation);

  document.querySelector('.phase-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.phase-tab');
    if (!tab) return;
    document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPhase = tab.dataset.phase;
    renderPhase(currentPhase);
  });
});

function populateInputs(applicant) {
  for (const [key, value] of Object.entries(applicant)) {
    const el = document.getElementById(key);
    if (el) el.value = value;
  }
}

function readInputs() {
  return {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    dob: document.getElementById('dob').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    pan: document.getElementById('pan').value,
    aadhaarLast4: document.getElementById('aadhaarLast4').value,
    gstin: document.getElementById('gstin').value,
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    state: document.getElementById('state').value,
    pincode: document.getElementById('pincode').value,
    accountNumber: document.getElementById('accountNumber').value,
    ifsc: document.getElementById('ifsc').value,
    monthlyIncome: Number(document.getElementById('monthlyIncome').value),
    existingEmi: Number(document.getElementById('existingEmi').value),
    loanAmount: Number(document.getElementById('loanAmount').value),
    tenure: Number(document.getElementById('tenure').value),
    interestRate: Number(document.getElementById('interestRate').value),
    repeatBorrower: document.getElementById('repeatBorrower').value,
    imei: document.getElementById('imei').value,
    ipAddress: document.getElementById('ipAddress').value,
    deviceId: document.getElementById('deviceId').value,
  };
}

function runSimulation() {
  const applicant = readInputs();
  currentApis = generateApiResponses(currentScenario);
  currentResult = calculateFullRiskScore(currentApis, applicant);

  document.getElementById('phasesPanel').style.display = 'block';
  document.getElementById('scoringPanel').style.display = 'block';

  currentPhase = 'A';
  document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-phase="A"]').classList.add('active');

  renderPhase('A');
  renderScoring();
  document.getElementById('phasesPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}


function renderPhase(phase) {
  const container = document.getElementById('phaseContent');
  const phaseApis = Object.values(currentApis).filter(api => api.phase === phase);

  const phaseDescriptions = {
    A: 'Triggered after PAN + phone collected. Runs 9 APIs: identity verification, digital trust signals, velocity checks, and session behavior analytics.',
    B: 'Triggered after income data collected. Runs 8 APIs: credit bureau pull, income estimation, ITR verification, GST check, and employment verification.',
    C: 'Triggered after KYC + address obtained. Runs 8 APIs: address validation, geo-fencing, e-Aadhaar, DigiLocker, court records, and fraud ring detection.',
    D: 'Triggered after bank details verified. Runs 6 APIs: bank verification, document forgery, bank statement analysis (AA), IMEI check, and product-aware risk adjustment.',
  };

  const phaseGates = {
    A: { threshold: 200, label: 'Preliminary score ≥ 200 to continue' },
    B: { threshold: 300, label: 'Updated score ≥ 300 to continue' },
    C: { threshold: 350, label: 'Score ≥ 350 (or manual review)' },
    D: { threshold: null, label: 'Final score determines decision' },
  };

  const gate = phaseGates[phase];
  const phaseScore = currentResult.phaseScores[phase];
  const gatePassed = gate.threshold === null || phaseScore >= gate.threshold;

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;">${phaseDescriptions[phase]}</p>
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--bg); border-radius: 8px; border: 1px solid var(--border);">
        <span style="font-size: 12px; color: var(--text-muted);">Phase ${phase} Gate:</span>
        <span style="font-size: 13px; font-weight: 600;">${gate.label}</span>
        <span style="margin-left: auto; font-family: monospace; font-size: 16px; font-weight: 700; color: ${gatePassed ? 'var(--green)' : 'var(--red)'};">
          ${phaseScore} ${gatePassed ? 'PASS' : 'FAIL'}
        </span>
      </div>
    </div>
    ${phaseApis.map(api => renderApiCard(api)).join('')}
  `;

  container.querySelectorAll('.api-card-header').forEach(header => {
    header.addEventListener('click', () => header.parentElement.classList.toggle('expanded'));
  });
}


function renderApiCard(api) {
  const isSuccess = api.output.statusCode === 200;
  const statusClass = isSuccess ? 'success' : 'fail';
  const scoringExplanation = getScoringExplanation(api);

  return `
    <div class="api-card">
      <div class="api-card-header">
        <div>
          <div class="api-name">${api.name}</div>
          <div class="api-endpoint">${api.method} ${api.endpoint}</div>
        </div>
        <div class="api-status ${statusClass}">
          <span class="api-status-dot"></span>
          ${isSuccess ? 'Success' : 'Failed'}
        </div>
      </div>
      <div class="api-card-body">
        <div class="io-section">
          <div class="io-label input">Request Parameters (Input)</div>
          <pre>${syntaxHighlight(formatInput(api.input))}</pre>
        </div>
        <div class="io-section">
          <div class="io-label output">API Response (Output)</div>
          <pre>${syntaxHighlight(JSON.stringify(api.output, null, 2))}</pre>
        </div>
        <div class="io-section">
          <div class="io-label scoring">Scoring Impact</div>
          <pre>${scoringExplanation}</pre>
        </div>
      </div>
    </div>
  `;
}

function formatInput(inputDef) {
  const obj = {}, schema = {};
  for (const [key, def] of Object.entries(inputDef)) {
    obj[key] = def.value;
    schema[key] = `${def.type}${def.required ? ' (required)' : ' (optional)'} — ${def.description}`;
  }
  return JSON.stringify({ parameters: obj, schema }, null, 2);
}


// ─── Scoring Explanations ───────────────────────────────────────────────────

function getScoringExplanation(api) {
  const fn = SCORING_EXPLANATIONS[api.id];
  if (fn) return fn(api.output.result);
  return 'Scoring logic not defined for this API';
}

const SCORING_EXPLANATIONS = {
  panFetch: (r) => lines('Identity Verification', 10, [
    r.isValid ? '+ 20 pts  PAN is valid' : '- 50 pts  PAN is INVALID',
    r.panStatusLabel === 'VALID' ? '+ 10 pts  PAN status = VALID' : `- 50 pts  PAN status = ${r.panStatusLabel}`,
    r.aadhaarSeedingStatus === 'Yes' ? '+ 10 pts  Aadhaar seeded' : '-  5 pts  Aadhaar NOT seeded',
    r.individualTaxComplianceStatus === 'Operative' ? '+  5 pts  Tax operative' : '- 10 pts  Tax inoperative',
  ]),
  phoneToPan: (r) => lines('Identity Verification', 10, [
    r.matchFound ? '+ 15 pts  Phone-to-PAN match' : '-  5 pts  No match',
  ]),
  phoneIntelligence: (r) => lines('Phone & Digital Trust', 7, [
    r.riskScore < 300 ? `+ 20 pts  Risk ${r.riskScore} (low)` : r.riskScore >= 700 ? `- 30 pts  Risk ${r.riskScore} (HIGH)` : `+ 10 pts  Risk ${r.riskScore}`,
    r.phoneType === 'mobile' ? '+ 10 pts  Mobile' : `- 25 pts  ${r.phoneType}`,
    !r.isBlocklisted ? '+ 10 pts  Not blocklisted' : '- 40 pts  BLOCKLISTED',
    r.simSwapDetected ? `- 15 pts  SIM swap (time-decay applied)` : null,
    r.fraudSources?.length ? `- 40 pts  Fraud: ${r.fraudSources.join(', ')}` : null,
  ]),
  whatsappPresence: (r) => lines('Phone & Digital Trust', 7, [
    r.isRegistered && r.accountType === 'personal' ? '+ 15 pts  WhatsApp personal' : r.isRegistered ? '+ 10 pts  WhatsApp registered' : '-  5 pts  No WhatsApp',
  ]),
  digitalIdentityScore: (r) => lines('Phone & Digital Trust', 7, [
    r.score > 7 ? `+ 10 pts  Digital score: ${r.score}/10` : r.score <= 3 ? `- 10 pts  Score ${r.score}/10 (thin)` : `+  5 pts  Score ${r.score}/10`,
    r.ecomPresence?.length >= 2 ? `+  5 pts  E-commerce: ${r.ecomPresence.join(', ')}` : null,
    r.socialPresence?.length >= 1 ? `+  5 pts  Social: ${r.socialPresence.join(', ')}` : null,
    r.phoneFirstSeen ? `          Phone first seen: ${r.phoneFirstSeen}` : '- 10 pts  Phone first seen: unknown',
  ]),
  phoneToAlternate: (r) => lines('Device & Hardware', 5, [
    r.totalFound <= 2 ? `+ 15 pts  ${r.totalFound} alternate(s)` : r.totalFound <= 4 ? `+  5 pts  ${r.totalFound} alternates` : `- 15 pts  ${r.totalFound} alternates (suspicious)`,
  ]),
  phoneToIdentity: (r) => lines('Identity Verification', 10, [
    r.identities?.length >= 2 ? `+ 10 pts  ${r.identities.length} identity docs` : r.identities?.length === 1 ? '+  5 pts  1 doc' : '- 10 pts  No docs',
    r.consistencyScore >= 80 ? `+ 15 pts  Consistency: ${r.consistencyScore}%` : `- 10 pts  Consistency: ${r.consistencyScore}%`,
  ]),

  // ─── NEW Phase A APIs ───
  velocityCheck: (r) => lines('Fraud Detection', 10, [
    r.applicationsByPan.last7d === 0 ? '+ 10 pts  No repeat applications (7d)' : `- 20 pts  ${r.applicationsByPan.last7d} apps by PAN (7d)`,
    r.applicationsByDevice.last7d > 3 ? `- 20 pts  ${r.applicationsByDevice.last7d} apps from device (7d)` : null,
    r.sharedDeviceWithOtherPans ? '- 25 pts  Device shared across PANs' : null,
    r.sharedIpWithOtherPans ? '- 10 pts  IP shared across PANs' : null,
    r.sharedBankAccountWithOthers ? '- 30 pts  Shared bank account — MULE' : null,
    r.loanStackingDetected ? '- 15 pts  Loan stacking detected' : null,
    r.recentRejections >= 5 ? `- 15 pts  ${r.recentRejections} recent rejections` : r.recentRejections === 0 ? '+  5 pts  No recent rejections' : null,
    `          Velocity risk: ${r.velocityRisk}`,
  ]),
  sessionBehavior: (r) => lines('Session Behavior', 5, [
    r.totalFormTime >= 120 ? `+ 10 pts  Form time: ${r.totalFormTime}s (natural)` : r.totalFormTime < 30 ? `- 20 pts  Form time: ${r.totalFormTime}s (too fast)` : `          Form time: ${r.totalFormTime}s`,
    r.copyPasteCount === 0 ? '+ 10 pts  No copy-paste' : `- ${r.copyPasteCount > 2 ? 15 : 5} pts  Copy-paste: ${r.copyPasteCount} fields`,
    r.copyPasteDetected?.pan ? '-  5 pts  PAN was copy-pasted' : null,
    r.hesitationOnIncomeField ? '-  5 pts  Hesitation on income field' : null,
    r.isRooted || r.isJailbroken ? '- 20 pts  Rooted/jailbroken device' : null,
    r.isEmulator ? '- 25 pts  EMULATOR detected' : null,
    r.screenRecordingDetected ? '- 15 pts  Screen recording detected' : null,
    r.typingPatternHuman && r.mouseMovementNatural ? '+ 10 pts  Human interaction patterns' : null,
    !r.typingPatternHuman ? '- 15 pts  Non-human typing pattern' : null,
    !r.mouseMovementNatural ? '- 10 pts  Unnatural mouse/touch' : null,
    `          Behavior score: ${r.behaviorScore}/100`,
  ]),

  // ─── Phase B APIs ───
  creditBureauFetch: (r) => lines('Credit Bureau (CIBIL)', 18, [
    r.cibilScore >= 750 ? `+ 30 pts  CIBIL: ${r.cibilScore} (excellent)` : r.cibilScore >= 650 ? `+ 20 pts  CIBIL: ${r.cibilScore} (good)` : r.cibilScore >= 550 ? `+  5 pts  CIBIL: ${r.cibilScore} (fair)` : r.cibilScore >= 300 ? `- 20 pts  CIBIL: ${r.cibilScore} (poor)` : '- 10 pts  No credit history (NTC)',
    r.maxDpdLast12Months === 0 ? '+ 15 pts  Zero DPD (12m)' : r.maxDpdLast12Months != null ? `- ${Math.min(30, Math.round(r.maxDpdLast12Months/3))} pts  Max DPD 12m: ${r.maxDpdLast12Months}d` : null,
    r.recentDelinquency ? `          Recent delinquency: ${r.recentDelinquency} (time-decay applied)` : null,
    r.hardInquiriesLast6Months <= 2 ? '+ 10 pts  Low inquiries (6m)' : `- ${r.hardInquiriesLast6Months > 5 ? 15 : 5} pts  ${r.hardInquiriesLast6Months} inquiries (6m)`,
    r.writeOffs > 0 ? `- 30 pts  ${r.writeOffs} write-off(s)` : null,
    r.settlements > 0 ? `- 15 pts  ${r.settlements} settlement(s)` : null,
    r.creditUtilization != null ? `          Utilization: ${(r.creditUtilization*100).toFixed(0)}%` : null,
    r.oldestAccountAge ? `          Account age: ${r.oldestAccountAge}` : null,
    `          Active trades: ${r.totalActiveAccounts}, Outstanding: ₹${r.totalOutstanding?.toLocaleString()}`,
  ]),
  phoneToIncome: (r) => lines('Income & Capacity', 10, [
    r.estimatedMonthlyIncome ? `+ 10 pts  Estimated: ₹${r.estimatedMonthlyIncome.toLocaleString()} (${r.confidence})` : '- 10 pts  No income estimate',
    r.estimatedMonthlyIncome ? '          Income-to-EMI & consistency checks applied separately' : null,
  ]),
  phoneToPrefill: (r) => lines('Income & Capacity', 10, [
    r.dataRichness === 'high' ? '+  5 pts  Rich prefill data' : r.dataRichness === 'none' ? '-  5 pts  No prefill data' : '          Medium prefill',
  ]),
  employmentVerification: (r) => lines('Financial Stability', 10, [
    r.isEmployed ? `+ 20 pts  Employed at ${r.employerName}` : r.membershipStatus === 'not_found' ? '- 15 pts  No EPFO record' : `- 20 pts  Ended: ${r.dateOfExit}`,
  ]),
  advancedEmployment: (r) => lines('Financial Stability', 10, [
    r.employmentHistory?.length >= 2 ? `+  5 pts  History: ${r.totalExperience}` : null,
    r.pfFilingFrequency === 'monthly' ? '+ 10 pts  PF monthly' : r.pfFilingFrequency === 'quarterly' ? '+  3 pts  PF quarterly' : '- 10 pts  No PF',
    r.employerGstinActive ? '+  5 pts  Employer GSTIN active' : null,
    r.lastPfFiled ? `          Last PF: ${r.lastPfFiled} (time-decay applied)` : null,
  ]),
  itrVerification: (r) => lines('Income & Capacity', 10, [
    r.itrFiled && r.consecutiveYearsFiled >= 3 ? `+ 15 pts  ITR filed ${r.consecutiveYearsFiled} consecutive years` : r.itrFiled ? `+  5 pts  ITR filed ${r.consecutiveYearsFiled} year(s)` : '- 10 pts  No ITR filed',
    r.tdsMatchesItr ? '+  5 pts  TDS matches ITR' : r.tdsEntries26AS > 0 ? '-  5 pts  TDS/ITR mismatch' : null,
    r.incomeGrowthTrend === 'positive' ? '+  5 pts  Positive income trend' : null,
    r.itrIncomeVsDeclared ? `          ITR vs declared ratio: ${r.itrIncomeVsDeclared.ratio?.toFixed(2)}` : null,
  ]),
  gstVerification: (r) => lines('Income & Capacity', 10, [
    !r.applicable ? '          GST not applicable (salaried)' : null,
    r.applicable && r.gstStatus === 'active' && r.panGstMatch ? '+  5 pts  GST active, PAN matched' : null,
    r.applicable && r.gstStatus === 'cancelled' ? '- 10 pts  GSTIN cancelled' : null,
    r.applicable && r.filingFrequency === 'irregular' ? '-  5 pts  Irregular filings' : null,
    r.applicable && r.annualTurnover ? `          Turnover: ₹${r.annualTurnover?.toLocaleString()}, Trend: ${r.turnoverTrend}` : null,
  ]),

  // ─── Phase C APIs ───
  registeredAddress: (r) => lines('Address & Location', 5, [
    r.addressFound ? `+ 20 pts  Found, match: ${r.matchScore}%` : '- 15 pts  No address found',
    r.matchScore >= 80 ? '+ 15 pts  High match' : r.matchScore >= 50 ? '+  5 pts  Partial' : r.addressFound ? '- 10 pts  Mismatch' : null,
  ]),
  addressGeocode: (r) => lines('Address & Location', 5, [
    r.confidence > 0.7 ? `+ 15 pts  Confidence: ${(r.confidence*100).toFixed(0)}%` : `-  5 pts  Low: ${(r.confidence*100).toFixed(0)}%`,
    r.isInternationalBorder ? `- 10 pts  Border (${r.nearestBorderDistance}km)` : '+ 10 pts  Not near border',
  ]),
  pincodeDetails: (r) => lines('Address & Location', 5, [
    r.isServiceable && !r.isBlacklisted ? '+ 10 pts  Serviceable' : null,
    r.isBlacklisted ? '- 30 pts  BLACKLISTED' : null,
    r.riskCategory === 'low' ? '+  5 pts  Low-risk area' : r.riskCategory === 'high' ? '- 10 pts  High-risk area' : null,
  ]),
  geoFencing: (r) => lines('Address & Location', 5, [
    r.geoMatch && r.stateMatch ? `+ 20 pts  IP matches: ${r.ipCity}` : r.geoMatch ? '+  5 pts  Same country' : `- 20 pts  Mismatch: ${r.ipCountry}`,
    (r.isTor || r.isVpn) ? '- 15 pts  Anonymizer detected' : null,
  ]),
  digitalIntegrity: (r) => lines('Phone & Digital Trust', 7, [
    r.emailValid && !r.emailDisposable ? '+  5 pts  Valid email' : null,
    r.emailDisposable ? '- 15 pts  Disposable email' : null,
    r.ipBlocklisted ? '- 20 pts  IP BLOCKLISTED' : null,
    r.botLikelihood > 0.5 ? `- 20 pts  Bot: ${(r.botLikelihood*100).toFixed(0)}%` : null,
    `          Integrity: ${r.integrityScore}/100`,
  ]),
  eAadhaarXml: (r) => lines('Identity Verification', 10, [
    r.digitalSignatureValid ? '+  5 pts  Signature valid' : !r.aadhaarValid ? '- 15 pts  FAILED' : null,
  ]),
  digilockerDetails: (r) => lines('Identity Verification', 10, [
    r.totalDocuments >= 3 ? `+ 10 pts  ${r.totalDocuments} docs` : r.totalDocuments >= 1 ? `+  5 pts  ${r.totalDocuments} doc(s)` : '-  5 pts  No docs',
  ]),
  courtRecords: (r) => lines('Legal & Compliance', 6, [
    r.wilfulDefaulter.isDefaulter ? '- 80 pts  RBI WILFUL DEFAULTER (auto-decline)' : '+ 15 pts  Not a wilful defaulter',
    r.cersaiCheck.registered ? `- 10 pts  CERSAI: ${r.cersaiCheck.securedAssets} asset(s)` : '+  5 pts  No CERSAI',
    r.courtCases.totalFound === 0 ? '+ 15 pts  No court cases' : null,
    r.courtCases.criminalCases > 0 ? `- 25 pts  ${r.courtCases.criminalCases} criminal case(s)` : null,
    r.courtCases.civilCases > 0 ? `- 10 pts  ${r.courtCases.civilCases} civil case(s)` : null,
    r.insolvencyCheck.isBankrupt ? '- 40 pts  BANKRUPT' : null,
    r.insolvencyCheck.ncltCases > 0 ? `- 15 pts  ${r.insolvencyCheck.ncltCases} NCLT case(s)` : null,
    `          Legal risk: ${r.overallLegalRisk}`,
  ]),
  fraudRingDetection: (r) => lines('Fraud Detection', 10, [
    r.clusterSize <= 1 ? '+ 10 pts  No ring connections' : r.clusterSize <= 5 ? `- 10 pts  Cluster: ${r.clusterSize}` : `- 30 pts  FRAUD RING: ${r.clusterSize} in cluster`,
    r.networkRisk === 'critical' ? '- 20 pts  Critical network risk' : null,
    r.referralChainAnomaly ? '- 10 pts  Referral chain anomaly' : null,
    r.suspiciousPatterns?.length ? `          Patterns: ${r.suspiciousPatterns.join(', ')}` : null,
    `          Graph density: ${r.graphDensity}`,
  ]),

  // ─── Phase D APIs ───
  bankVerification: (r) => lines('Financial Stability', 10, [
    r.accountActive ? '+ 25 pts  Account active' : '- 30 pts  Inactive/not found',
    r.nameMatch && r.nameMatchScore >= 80 ? `+ 15 pts  Name match: ${r.nameMatchScore}%` : r.nameMatch ? `+  8 pts  Partial: ${r.nameMatchScore}%` : '- 20 pts  MISMATCH',
    r.upiLinked ? '+  5 pts  UPI linked' : null,
  ]),
  ifscSearch: (r) => lines('Financial Stability', 10, [
    r.valid ? `+  5 pts  IFSC valid: ${r.bankName}` : '- 10 pts  Invalid IFSC',
  ]),
  imeiFetch: (r) => lines('Device & Hardware', 5, [
    r.valid && !r.isStolen ? `+ 25 pts  Valid: ${r.brand} ${r.model}` : r.isStolen ? '- 50 pts  STOLEN/LOST' : '- 15 pts  Invalid IMEI',
    r.manufactureYear ? `          Age: ${r.deviceAge}` : null,
  ]),
  forgeryCheck: (r) => lines('Document Integrity', 4, [
    r.status === 'genuine' ? '+ 50 pts  Genuine' : r.status === 'suspicious' ? `+ 10 pts  Suspicious (${r.forgeryScore})` : `- 80 pts  FORGED (${r.forgeryScore})`,
    r.forgeryScore < 0.3 ? '+ 30 pts  Low forgery score' : r.forgeryScore >= 0.6 ? '- 20 pts  High forgery score' : null,
    r.anomalies?.length ? `          Anomalies: ${r.anomalies.join(', ')}` : null,
  ]),
  bankStatementAnalysis: (r) => lines('Bank Statement (AA)', 10, [
    r.salaryCredits.detected && r.salaryCredits.frequency === 'monthly' ? `+ 20 pts  Regular salary: ₹${r.salaryCredits.averageAmount?.toLocaleString()}/mo` : r.salaryCredits.detected ? `+  5 pts  Irregular income` : '- 15 pts  No salary credits',
    r.bounceRate === 0 ? '+ 15 pts  Zero bounces' : `- 20 pts  Bounce rate: ${(r.bounceRate*100).toFixed(1)}%`,
    r.cashFlowVolatility < 0.2 ? `+ 10 pts  Low volatility: ${(r.cashFlowVolatility*100).toFixed(0)}%` : r.cashFlowVolatility >= 0.5 ? `- 10 pts  High volatility: ${(r.cashFlowVolatility*100).toFixed(0)}%` : null,
    `          Avg balance: ₹${r.averageMonthlyBalance?.toLocaleString()}`,
    r.daysWithZeroBalance > 10 ? `- 15 pts  ${r.daysWithZeroBalance} zero-balance days` : null,
    r.suspiciousTransactions.length > 0 ? `- 20 pts  ${r.suspiciousTransactions.length} suspicious txn(s)` : null,
    r.circularTransactions ? '- 15 pts  Circular transactions' : null,
    r.emiDebits.bounced > 0 ? `- 10 pts  ${r.emiDebits.bounced} EMI bounce(s)` : null,
    `          Health: ${r.overallHealth}, Trend: ${r.endOfDayBalanceTrend}`,
  ]),
  productRiskAdjust: (r) => lines('Product-Aware (Modifier)', 0, [
    `          Amount tier: ${r.amountTier} (${r.amountRisk})`,
    `          Tenure: ${r.tenureCategory} (multiplier: ${r.tenureRiskMultiplier}x)`,
    `          Borrower: ${r.repeatBorrowerStatus}`,
    r.repeatBorrowerBonus !== 0 ? `${r.repeatBorrowerBonus > 0 ? '+' : ''}${r.repeatBorrowerBonus} pts  Repeat borrower adjustment` : null,
    r.firstTimeBorrowerPenalty > 0 ? `- ${r.firstTimeBorrowerPenalty} pts  First-time penalty` : null,
    `          Loan-to-income: ${r.loanToIncomeRatio?.toFixed(2)}`,
    `          Suggested max: ₹${r.suggestedMaxLoan?.toLocaleString()}`,
    `          Total adjustment: ${r.adjustmentPoints >= 0 ? '+' : ''}${r.adjustmentPoints} pts`,
  ]),
};

function lines(category, weight, items) {
  const header = weight > 0 ? `Category: ${category} (weight: ${weight}%)` : `${category}`;
  return [header, '─'.repeat(45), ...items.filter(Boolean)].join('\n');
}


// ─── Render Scoring Dashboard ───────────────────────────────────────────────

function renderScoring() {
  const r = currentResult;

  const arc = document.getElementById('scoreArc');
  const circumference = 2 * Math.PI * 54;
  arc.style.strokeDashoffset = circumference - (r.finalScore / 1000) * circumference;
  const color = getScoreColor(r.finalScore);
  arc.style.stroke = color;

  const scoreEl = document.getElementById('finalScoreValue');
  scoreEl.style.color = color;
  animateNumber(scoreEl, r.finalScore);

  const labelEl = document.getElementById('scoreLabel');
  if (r.finalScore >= 800) labelEl.textContent = 'LOW RISK';
  else if (r.finalScore >= 600) labelEl.textContent = 'MEDIUM RISK';
  else if (r.finalScore >= 400) labelEl.textContent = 'ELEVATED RISK';
  else if (r.finalScore >= 200) labelEl.textContent = 'HIGH RISK';
  else labelEl.textContent = 'VERY HIGH RISK';
  labelEl.style.color = color;

  const decisionEl = document.getElementById('scoreDecision');
  decisionEl.textContent = r.decisionLabel;
  decisionEl.className = 'score-decision';
  if (r.decision === 'approve' || r.decision === 'standard') decisionEl.classList.add('decision-approve');
  else if (r.decision === 'elevated') decisionEl.classList.add('decision-elevated');
  else if (r.decision === 'review') decisionEl.classList.add('decision-review');
  else decisionEl.classList.add('decision-decline');

  // Category bars
  const barsContainer = document.getElementById('categoryBars');
  barsContainer.innerHTML = Object.entries(r.categoryScores).map(([cat, data]) => {
    const weight = CATEGORY_WEIGHTS[cat];
    const barColor = CATEGORY_COLORS[cat];
    return `
      <div class="category-row">
        <div class="cat-name">${CATEGORY_LABELS[cat]}</div>
        <div class="cat-weight">${(weight * 100).toFixed(0)}%</div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width: 0%; background: ${barColor};" data-score="${data.score}"></div>
        </div>
        <div class="cat-score" style="color: ${getScoreColor(data.score * 10)}">${data.score}<span style="color:var(--text-muted);font-size:11px;font-weight:400">/100</span></div>
      </div>
    `;
  }).join('');

  setTimeout(() => {
    barsContainer.querySelectorAll('.cat-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.score + '%';
    });
  }, 50);

  // Modifiers
  if (r.modifiers?.length > 0) {
    document.getElementById('modifiersSection').style.display = 'block';
    document.getElementById('modifiersList').innerHTML = r.modifiers.map(m =>
      `<span class="flag-item" style="background: ${m.color}15; color: ${m.color}; border: 1px solid ${m.color}33;">
        ${m.points >= 0 ? '+' : ''}${m.points} ${m.label}
      </span>`
    ).join('');
  }

  // Flags
  document.getElementById('flagsList').innerHTML = r.allFlags.map(f =>
    `<span class="flag-item flag-${f.type}">${f.type === 'positive' ? '+' : f.type === 'negative' ? '!' : '~'} ${f.text}</span>`
  ).join('');

  // Phase progression
  document.getElementById('progressionChart').innerHTML = Object.entries(r.phaseScores).map(([phase, score]) => {
    const height = (score / 1000) * 100;
    const c = getScoreColor(score);
    return `
      <div class="progression-bar">
        <div class="prog-score" style="color: ${c}">${score}</div>
        <div class="prog-fill" style="height: ${height}%; background: ${c};"></div>
        <div class="prog-label">Phase ${phase}</div>
      </div>
    `;
  }).join('');
}


function getScoreColor(score) {
  if (score >= 800) return 'var(--green)';
  if (score >= 600) return '#00cec9';
  if (score >= 400) return 'var(--yellow)';
  if (score >= 200) return 'var(--orange)';
  return 'var(--red)';
}

function animateNumber(el, target) {
  let current = 0;
  const step = Math.ceil(target / 40);
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = current;
  }, 25);
}

function syntaxHighlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="string">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="boolean">$1</span>')
    .replace(/: (null)/g, ': <span class="null">null</span>');
}
