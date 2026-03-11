/**
 * FinZ Risk Engine Simulator — UI Controller
 */

let currentScenario = 'good';
let currentPhase = 'A';
let currentApis = {};
let currentResult = null;

// ─── Initialization ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Add scenario bar before the input panel
  const inputPanel = document.querySelector('.input-panel');
  const scenarioBar = document.createElement('div');
  scenarioBar.className = 'scenario-bar';
  scenarioBar.innerHTML = `
    <button class="btn-scenario active" data-scenario="good">Good Applicant</button>
    <button class="btn-scenario" data-scenario="risky">Risky Applicant</button>
    <button class="btn-scenario" data-scenario="fraud">Fraudulent Applicant</button>
  `;
  inputPanel.insertBefore(scenarioBar, inputPanel.querySelector('.input-grid'));

  // Scenario switching
  scenarioBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-scenario');
    if (!btn) return;
    scenarioBar.querySelectorAll('.btn-scenario').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentScenario = btn.dataset.scenario;
    populateInputs(SCENARIOS[currentScenario].applicant);
  });

  // Run simulation
  document.getElementById('runSimulation').addEventListener('click', runSimulation);

  // Phase tabs
  document.querySelector('.phase-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.phase-tab');
    if (!tab) return;
    document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPhase = tab.dataset.phase;
    renderPhase(currentPhase);
  });
});


// ─── Populate Inputs ────────────────────────────────────────────────────────

function populateInputs(applicant) {
  for (const [key, value] of Object.entries(applicant)) {
    const el = document.getElementById(key);
    if (el) el.value = value;
  }
}


// ─── Read Inputs ────────────────────────────────────────────────────────────

function readInputs() {
  return {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    dob: document.getElementById('dob').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    pan: document.getElementById('pan').value,
    aadhaarLast4: document.getElementById('aadhaarLast4').value,
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
    imei: document.getElementById('imei').value,
    ipAddress: document.getElementById('ipAddress').value,
    deviceId: document.getElementById('deviceId').value,
  };
}


// ─── Run Simulation ─────────────────────────────────────────────────────────

function runSimulation() {
  const applicant = readInputs();
  currentApis = generateApiResponses(currentScenario);
  currentResult = calculateFullRiskScore(currentApis, applicant);

  // Show panels
  document.getElementById('phasesPanel').style.display = 'block';
  document.getElementById('scoringPanel').style.display = 'block';

  // Reset to Phase A
  currentPhase = 'A';
  document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-phase="A"]').classList.add('active');

  renderPhase('A');
  renderScoring();

  // Smooth scroll to results
  document.getElementById('phasesPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ─── Render Phase ───────────────────────────────────────────────────────────

function renderPhase(phase) {
  const container = document.getElementById('phaseContent');
  const phaseApis = Object.values(currentApis).filter(api => api.phase === phase);

  const phaseDescriptions = {
    A: 'Triggered after PAN + phone collected (Step 2). Runs 7 APIs in parallel to assess identity and digital trustworthiness.',
    B: 'Triggered after income data collected (Step 3). Runs 4 APIs to verify income, employment, and financial stability.',
    C: 'Triggered after KYC + address obtained (Step 4). Runs 7 APIs to validate address, location, and cross-check KYC documents.',
    D: 'Triggered after bank details verified (Step 5). Runs 4 APIs for bank verification, document forgery check, and device validation.',
  };

  const phaseGates = {
    A: { threshold: 200, label: 'Preliminary score must be ≥ 200 to continue' },
    B: { threshold: 300, label: 'Updated score must be ≥ 300 to continue' },
    C: { threshold: 350, label: 'Score must be ≥ 350 (or routed to manual review)' },
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

  // Toggle expand on click
  container.querySelectorAll('.api-card-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('expanded');
    });
  });
}


function renderApiCard(api) {
  const isSuccess = api.output.statusCode === 200;
  const statusClass = isSuccess ? 'success' : 'fail';
  const statusText = isSuccess ? 'Success' : 'Failed';

  // Build scoring explanation for this API
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
          ${statusText}
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
  const obj = {};
  for (const [key, def] of Object.entries(inputDef)) {
    obj[key] = def.value;
  }
  // Also show the schema
  const schema = {};
  for (const [key, def] of Object.entries(inputDef)) {
    schema[key] = `${def.type}${def.required ? ' (required)' : ' (optional)'} — ${def.description}`;
  }
  return JSON.stringify({ parameters: obj, schema }, null, 2);
}


function getScoringExplanation(api) {
  const explanations = {
    panFetch: (r) => {
      const lines = [];
      lines.push(`Category: Identity Verification (weight: 20%)`);
      lines.push(`─────────────────────────────────────────`);
      if (r.isValid) lines.push(`+ 20 pts  PAN is valid`);
      else lines.push(`- 50 pts  PAN is INVALID`);
      if (r.panStatusLabel === 'VALID') lines.push(`+ 10 pts  PAN status = VALID`);
      else if (['FAKE','DEACTIVATED'].includes(r.panStatusLabel)) lines.push(`- 50 pts  PAN status = ${r.panStatusLabel}`);
      if (r.aadhaarSeedingStatus === 'Yes') lines.push(`+ 10 pts  Aadhaar seeded to PAN`);
      else lines.push(`-  5 pts  Aadhaar NOT seeded`);
      if (r.individualTaxComplianceStatus === 'Operative') lines.push(`+  5 pts  Tax compliance: operative`);
      else lines.push(`- 10 pts  Tax compliance: inoperative`);
      return lines.join('\n');
    },
    phoneToPan: (r) => {
      const lines = [`Category: Identity Verification (weight: 20%)`, `─────────────────────────────────────────`];
      if (r.matchFound) lines.push(`+ 15 pts  Phone-to-PAN match confirmed`);
      else lines.push(`-  5 pts  No phone-to-PAN match`);
      return lines.join('\n');
    },
    phoneIntelligence: (r) => {
      const lines = [`Category: Phone & Digital Trust (weight: 15%)`, `─────────────────────────────────────────`];
      if (r.riskScore < 300) lines.push(`+ 20 pts  Risk score ${r.riskScore} (low)`);
      else if (r.riskScore < 500) lines.push(`+ 10 pts  Risk score ${r.riskScore} (medium)`);
      else if (r.riskScore >= 700) lines.push(`- 30 pts  Risk score ${r.riskScore} (HIGH)`);
      if (r.phoneType === 'mobile') lines.push(`+ 10 pts  Phone type: mobile`);
      else lines.push(`- 25 pts  Phone type: ${r.phoneType}`);
      if (!r.isBlocklisted) lines.push(`+ 10 pts  Not blocklisted`);
      else lines.push(`- 40 pts  BLOCKLISTED`);
      if (r.simSwapDetected) lines.push(`- 15 pts  SIM swap detected`);
      if (r.fraudSources?.length) lines.push(`- 40 pts  Fraud sources: ${r.fraudSources.join(', ')}`);
      return lines.join('\n');
    },
    whatsappPresence: (r) => {
      const lines = [`Category: Phone & Digital Trust (weight: 15%)`, `─────────────────────────────────────────`];
      if (r.isRegistered && r.accountType === 'personal') lines.push(`+ 15 pts  WhatsApp personal account`);
      else if (r.isRegistered) lines.push(`+ 10 pts  WhatsApp registered (business)`);
      else lines.push(`-  5 pts  No WhatsApp account`);
      return lines.join('\n');
    },
    digitalIdentityScore: (r) => {
      const lines = [`Category: Phone & Digital Trust (weight: 15%)`, `─────────────────────────────────────────`];
      if (r.score > 7) lines.push(`+ 10 pts  Digital score: ${r.score}/10 (strong)`);
      else if (r.score > 5) lines.push(`+  5 pts  Digital score: ${r.score}/10`);
      else if (r.score <= 3) lines.push(`- 10 pts  Digital score: ${r.score}/10 (very thin)`);
      if (r.ecomPresence?.length >= 2) lines.push(`+  5 pts  E-commerce presence: ${r.ecomPresence.join(', ')}`);
      if (r.socialPresence?.length >= 1) lines.push(`+  5 pts  Social presence: ${r.socialPresence.join(', ')}`);
      if (r.phoneFirstSeen) {
        const age = (new Date() - new Date(r.phoneFirstSeen)) / (365.25*24*60*60*1000);
        if (age >= 2) lines.push(`+  5 pts  Phone established (${r.phoneFirstSeen})`);
        else if (age < 0.5) lines.push(`- 15 pts  Phone very recent (${r.phoneFirstSeen})`);
      } else {
        lines.push(`- 10 pts  Phone first seen: unknown`);
      }
      return lines.join('\n');
    },
    phoneToAlternate: (r) => {
      const lines = [`Category: Device & Behavioral (weight: 10%)`, `─────────────────────────────────────────`];
      if (r.totalFound <= 2) lines.push(`+ 15 pts  ${r.totalFound} alternate phone(s) (normal)`);
      else if (r.totalFound <= 4) lines.push(`+  5 pts  ${r.totalFound} alternate phones`);
      else lines.push(`- 15 pts  ${r.totalFound} alternate phones (suspicious)`);
      return lines.join('\n');
    },
    phoneToIdentity: (r) => {
      const lines = [`Category: Identity Verification (weight: 20%)`, `─────────────────────────────────────────`];
      if (r.identities?.length >= 2) lines.push(`+ 10 pts  ${r.identities.length} identity docs found`);
      else if (r.identities?.length === 1) lines.push(`+  5 pts  1 identity doc found`);
      else lines.push(`- 10 pts  No identity docs`);
      if (r.consistencyScore >= 80) lines.push(`+ 15 pts  Consistency: ${r.consistencyScore}%`);
      else if (r.consistencyScore >= 60) lines.push(`+  8 pts  Consistency: ${r.consistencyScore}%`);
      else lines.push(`- 10 pts  Low consistency: ${r.consistencyScore}%`);
      return lines.join('\n');
    },
    phoneToIncome: (r) => {
      const lines = [`Category: Income & Capacity (weight: 15%)`, `─────────────────────────────────────────`];
      if (r.estimatedMonthlyIncome) {
        lines.push(`+ 15 pts  Income estimate available`);
        lines.push(`          Estimated: ₹${r.estimatedMonthlyIncome?.toLocaleString()}`);
        lines.push(`          Confidence: ${r.confidence}`);
        lines.push(`          Points for income-to-EMI ratio calculated separately`);
      } else {
        lines.push(`- 20 pts  No income estimate available`);
      }
      return lines.join('\n');
    },
    phoneToPrefill: (r) => {
      const lines = [`Category: Income & Capacity (weight: 15%)`, `─────────────────────────────────────────`];
      if (r.dataRichness === 'high') lines.push(`+ 10 pts  Rich prefill data`);
      else if (r.dataRichness === 'medium') lines.push(`+  5 pts  Medium prefill data`);
      else lines.push(`-  5 pts  Thin/no prefill data`);
      return lines.join('\n');
    },
    employmentVerification: (r) => {
      const lines = [`Category: Financial Stability (weight: 25%)`, `─────────────────────────────────────────`];
      if (r.isEmployed) lines.push(`+ 20 pts  Currently employed at ${r.employerName}`);
      else if (r.membershipStatus === 'not_found') lines.push(`- 15 pts  No EPFO record found`);
      else lines.push(`- 20 pts  Employment ended: ${r.dateOfExit}`);
      return lines.join('\n');
    },
    advancedEmployment: (r) => {
      const lines = [`Category: Financial Stability (weight: 25%)`, `─────────────────────────────────────────`];
      if (r.employmentHistory?.length >= 2) lines.push(`+  5 pts  Stable work history: ${r.totalExperience}`);
      if (r.pfFilingFrequency === 'monthly') lines.push(`+ 10 pts  PF filed monthly`);
      else if (r.pfFilingFrequency === 'quarterly') lines.push(`+  3 pts  PF filed quarterly`);
      else lines.push(`- 10 pts  No PF filings`);
      if (r.employerGstinActive) lines.push(`+  5 pts  Employer GSTIN active`);
      return lines.join('\n');
    },
    registeredAddress: (r) => {
      const lines = [`Category: Address & Location (weight: 10%)`, `─────────────────────────────────────────`];
      if (r.addressFound) {
        lines.push(`+ 20 pts  Registered address found`);
        if (r.matchScore >= 80) lines.push(`+ 15 pts  Match score: ${r.matchScore}%`);
        else if (r.matchScore >= 50) lines.push(`+  5 pts  Partial match: ${r.matchScore}%`);
        else lines.push(`- 10 pts  Mismatch: ${r.matchScore}%`);
      } else {
        lines.push(`- 15 pts  No registered address found`);
      }
      return lines.join('\n');
    },
    addressGeocode: (r) => {
      const lines = [`Category: Address & Location (weight: 10%)`, `─────────────────────────────────────────`];
      if (r.confidence > 0.7) lines.push(`+ 15 pts  Geocode confidence: ${(r.confidence*100).toFixed(0)}%`);
      else if (r.confidence > 0.5) lines.push(`+  5 pts  Geocode confidence: ${(r.confidence*100).toFixed(0)}%`);
      else lines.push(`-  5 pts  Low confidence: ${(r.confidence*100).toFixed(0)}%`);
      if (r.isInternationalBorder) lines.push(`- 10 pts  Near international border (${r.nearestBorderDistance}km)`);
      else lines.push(`+ 10 pts  Not near border`);
      return lines.join('\n');
    },
    pincodeDetails: (r) => {
      const lines = [`Category: Address & Location (weight: 10%)`, `─────────────────────────────────────────`];
      if (r.isServiceable && !r.isBlacklisted) lines.push(`+ 10 pts  Serviceable pincode`);
      if (r.isBlacklisted) lines.push(`- 30 pts  BLACKLISTED pincode`);
      if (r.riskCategory === 'low') lines.push(`+  5 pts  Low-risk area`);
      else if (r.riskCategory === 'high') lines.push(`- 10 pts  High-risk area`);
      return lines.join('\n');
    },
    geoFencing: (r) => {
      const lines = [`Category: Address & Location (weight: 10%)`, `─────────────────────────────────────────`];
      if (r.geoMatch && r.stateMatch) lines.push(`+ 20 pts  IP matches claimed location`);
      else if (r.geoMatch) lines.push(`+  5 pts  Same country, different state`);
      else lines.push(`- 20 pts  IP geo mismatch: ${r.ipCountry}`);
      if (r.isTor || r.isVpn) lines.push(`- 15 pts  Anonymizer detected`);
      return lines.join('\n');
    },
    digitalIntegrity: (r) => {
      const lines = [`Category: Phone & Digital Trust (weight: 15%)`, `─────────────────────────────────────────`];
      if (r.emailValid && !r.emailDisposable) lines.push(`+  5 pts  Valid, non-disposable email`);
      if (r.emailDisposable) lines.push(`- 15 pts  Disposable email detected`);
      if (r.ipBlocklisted) lines.push(`- 20 pts  IP BLOCKLISTED`);
      if (r.botLikelihood > 0.5) lines.push(`- 20 pts  Bot likelihood: ${(r.botLikelihood*100).toFixed(0)}%`);
      lines.push(`          Integrity score: ${r.integrityScore}/100`);
      return lines.join('\n');
    },
    eAadhaarXml: (r) => {
      const lines = [`Category: Identity Verification (weight: 20%)`, `─────────────────────────────────────────`];
      if (r.digitalSignatureValid) lines.push(`+  5 pts  Digital signature valid`);
      else if (!r.aadhaarValid) lines.push(`- 15 pts  e-Aadhaar validation FAILED`);
      return lines.join('\n');
    },
    digilockerDetails: (r) => {
      const lines = [`Category: Identity Verification (weight: 20%)`, `─────────────────────────────────────────`];
      if (r.totalDocuments >= 3) lines.push(`+ 10 pts  ${r.totalDocuments} DigiLocker docs linked`);
      else if (r.totalDocuments >= 1) lines.push(`+  5 pts  ${r.totalDocuments} DigiLocker doc(s)`);
      else lines.push(`-  5 pts  No DigiLocker documents`);
      return lines.join('\n');
    },
    bankVerification: (r) => {
      const lines = [`Category: Financial Stability (weight: 25%)`, `─────────────────────────────────────────`];
      if (r.accountActive) lines.push(`+ 25 pts  Account active`);
      else lines.push(`- 30 pts  Account inactive/not found`);
      if (r.nameMatch && r.nameMatchScore >= 80) lines.push(`+ 15 pts  Name match: ${r.nameMatchScore}%`);
      else if (r.nameMatch) lines.push(`+  8 pts  Partial name match: ${r.nameMatchScore}%`);
      else lines.push(`- 20 pts  Name MISMATCH`);
      if (r.upiLinked) lines.push(`+  5 pts  UPI linked`);
      return lines.join('\n');
    },
    ifscSearch: (r) => {
      const lines = [`Category: Financial Stability (weight: 25%)`, `─────────────────────────────────────────`];
      if (r.valid) lines.push(`+  5 pts  IFSC valid: ${r.bankName}, ${r.branch}`);
      else lines.push(`- 10 pts  Invalid IFSC code`);
      return lines.join('\n');
    },
    imeiFetch: (r) => {
      const lines = [`Category: Device & Behavioral (weight: 10%)`, `─────────────────────────────────────────`];
      if (r.valid && !r.isStolen) lines.push(`+ 25 pts  Valid device: ${r.brand} ${r.model}`);
      else if (r.isStolen || r.isLost) lines.push(`- 50 pts  Device STOLEN/LOST`);
      else lines.push(`- 15 pts  Invalid IMEI`);
      if (r.manufactureYear) {
        const age = new Date().getFullYear() - r.manufactureYear;
        if (age <= 5) lines.push(`+ 10 pts  Recent device (${r.deviceAge})`);
        else if (age > 8) lines.push(`- 10 pts  Old device (${r.deviceAge})`);
      }
      return lines.join('\n');
    },
    forgeryCheck: (r) => {
      const lines = [`Category: Document Integrity (weight: 5%)`, `─────────────────────────────────────────`];
      if (r.status === 'genuine') lines.push(`+ 50 pts  Document genuine`);
      else if (r.status === 'suspicious') lines.push(`+ 10 pts  Suspicious (score: ${r.forgeryScore})`);
      else lines.push(`- 80 pts  FORGED document detected`);
      if (r.forgeryScore < 0.3) lines.push(`+ 30 pts  Low forgery score`);
      else if (r.forgeryScore >= 0.6) lines.push(`- 20 pts  High forgery score`);
      if (r.anomalies?.length) lines.push(`          Anomalies: ${r.anomalies.join(', ')}`);
      return lines.join('\n');
    },
  };

  const fn = explanations[api.id];
  if (fn) return fn(api.output.result);
  return 'Scoring logic not defined for this API';
}


// ─── Render Scoring Dashboard ───────────────────────────────────────────────

function renderScoring() {
  const r = currentResult;

  // Final score ring
  const arc = document.getElementById('scoreArc');
  const circumference = 2 * Math.PI * 54; // 339.3
  const offset = circumference - (r.finalScore / 1000) * circumference;
  arc.style.strokeDashoffset = offset;

  // Color the arc
  const color = getScoreColor(r.finalScore);
  arc.style.stroke = color;

  // Score value
  const scoreEl = document.getElementById('finalScoreValue');
  scoreEl.style.color = color;
  animateNumber(scoreEl, r.finalScore);

  // Label
  const labelEl = document.getElementById('scoreLabel');
  if (r.finalScore >= 800) labelEl.textContent = 'LOW RISK';
  else if (r.finalScore >= 600) labelEl.textContent = 'MEDIUM RISK';
  else if (r.finalScore >= 400) labelEl.textContent = 'ELEVATED RISK';
  else if (r.finalScore >= 200) labelEl.textContent = 'HIGH RISK';
  else labelEl.textContent = 'VERY HIGH RISK';
  labelEl.style.color = color;

  // Decision
  const decisionEl = document.getElementById('scoreDecision');
  decisionEl.textContent = r.decisionLabel;
  decisionEl.className = 'score-decision';
  if (r.decision === 'approve') decisionEl.classList.add('decision-approve');
  else if (r.decision === 'standard') decisionEl.classList.add('decision-approve');
  else if (r.decision === 'elevated') decisionEl.classList.add('decision-elevated');
  else if (r.decision === 'review') decisionEl.classList.add('decision-review');
  else decisionEl.classList.add('decision-decline');

  // Category bars
  const barsContainer = document.getElementById('categoryBars');
  barsContainer.innerHTML = Object.entries(r.categoryScores).map(([cat, data]) => {
    const weight = CATEGORY_WEIGHTS[cat];
    const contribution = Math.round(data.score * weight * 10);
    const barColor = CATEGORY_COLORS[cat];
    return `
      <div class="category-row">
        <div class="cat-name">${CATEGORY_LABELS[cat]}</div>
        <div class="cat-weight">${(weight * 100).toFixed(0)}%</div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width: ${data.score}%; background: ${barColor};" data-score="${data.score}"></div>
        </div>
        <div class="cat-score" style="color: ${getScoreColor(data.score * 10)}">${data.score}<span style="color:var(--text-muted);font-size:11px;font-weight:400">/100</span></div>
      </div>
    `;
  }).join('');

  // Animate bars
  setTimeout(() => {
    barsContainer.querySelectorAll('.cat-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.score + '%';
    });
  }, 50);

  // Flags
  const flagsList = document.getElementById('flagsList');
  flagsList.innerHTML = r.allFlags.map(f =>
    `<span class="flag-item flag-${f.type}">${f.type === 'positive' ? '+' : f.type === 'negative' ? '!' : '~'} ${f.text}</span>`
  ).join('');

  // Phase progression
  const progChart = document.getElementById('progressionChart');
  progChart.innerHTML = Object.entries(r.phaseScores).map(([phase, score]) => {
    const height = (score / 1000) * 100;
    const color = getScoreColor(score);
    return `
      <div class="progression-bar">
        <div class="prog-score" style="color: ${color}">${score}</div>
        <div class="prog-fill" style="height: ${height}%; background: ${color};"></div>
        <div class="prog-label">Phase ${phase}</div>
      </div>
    `;
  }).join('');
}


// ─── Helpers ────────────────────────────────────────────────────────────────

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
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
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
