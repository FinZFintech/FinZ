# Risk Engine Implementation Plan

## Overview

Build a comprehensive risk scoring engine that orchestrates all 22 Signzy APIs alongside existing credit/income data to produce a unified **FinZ Risk Score (0-1000)** for every loan application. The engine runs as a service layer between API responses and loan decisioning, replacing the current ad-hoc gating checks with a structured, weighted scoring model.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Loan Application Flow                 │
│  Step 0-1: Collect borrower info, phone, institute      │
│  Step 2: PAN verification                               │
│  Step 3: Income verification                            │
│  Step 4: KYC verification                               │
│  Step 5: Selfie + Bank details                          │
│  Step 6: eNACH + eSign                                  │
└──────────────────────┬──────────────────────────────────┘
                       │ triggers
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Risk Engine (riskEngine.js)                 │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  API Layer   │  │  Scoring     │  │  Decision     │  │
│  │  Orchestrator│──│  Calculator  │──│  Engine       │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         │                                    │          │
│         ▼                                    ▼          │
│  ┌─────────────┐                   ┌───────────────┐   │
│  │  signzy      │                   │  Risk Profile │   │
│  │  Service.js  │                   │  (score +     │   │
│  │  (all APIs)  │                   │   flags +     │   │
│  └─────────────┘                   │   breakdown)  │   │
│                                    └───────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Risk Score Model

### Score Range: 0-1000
- **800-1000**: Low Risk → Auto-approve
- **600-799**: Medium Risk → Proceed with standard checks
- **400-599**: Elevated Risk → Enhanced due diligence, may require co-borrower
- **200-399**: High Risk → Manual review queue
- **0-199**: Very High Risk → Auto-decline

### 7 Risk Categories (weighted)

| Category | Weight | Signzy APIs Used | Data Source |
|----------|--------|------------------|-------------|
| **1. Identity Verification** | 20% | PAN Fetch, Phone-to-PAN, Get e-Aadhaar XML, Get Details (Digilocker) | PAN validity, Aadhaar seeding, name consistency, identity docs |
| **2. Financial Stability** | 25% | Hybrid Bank Account Verification, Search Bank by IFSC, Employment Verification, Advanced Employment Verification | Active bank account, employment status, PF filings, job tenure |
| **3. Phone & Digital Trust** | 15% | Phone Intelligence, WhatsApp Presence, Digital Integrity Check, Digital Identity Score | Phone risk score, digital footprint, email validity, IP blocklist |
| **4. Address & Location** | 10% | Phone KYC - Registered Address, Address Geocode Match, Pincode Details, Geo Fencing | Address consistency, pincode risk, geo-match, border proximity |
| **5. Income & Capacity** | 15% | Phone KYC - Phone to Income, Phone to Prefill | Income estimate, FOIR, EMI capacity (combines with existing AA/statement data) |
| **6. Document Integrity** | 5% | Advance Forgery Lite | Forgery score on uploaded documents |
| **7. Device & Behavioral** | 10% | IMEI Fetch, Phone to Alternate Phone, Phone to Identity Details | Device legitimacy, number of linked phones, identity consistency |

---

## Implementation Plan

### Phase 1: Signzy API Integration Layer

#### Step 1.1: Add all Signzy API configs to `constants.js`

Add endpoint configs for all 20 new APIs. Two groups by auth pattern:
- **Group A** (Token auth, `/api/v3`): Bank verification, PAN, e-Aadhaar, IFSC, Phone KYC (all 5), Phone Intelligence, WhatsApp Presence, IMEI, Address Geocode, Pincode, Forgery Lite, Employment Verification, Digital Identity Score, Get Details
- **Group B** (Login auth, `/api/v2/patrons`): Geo Fencing, Digital Integrity Check

```
File: src/config/constants.js
Add: SIGNZY_ENDPOINTS object with all endpoint paths
Add: SIGNZY_V2_CONFIG for patron-based auth APIs (Geo Fencing, Digital Integrity)
```

#### Step 1.2: Expand `signzyService.js` with all API methods

Add methods to `signzyService` for each API:

```javascript
// Banking
verifyBankAccount(accountNumber, ifsc, name, mobile, options)
searchBankByIfsc(ifscCode)

// KYC/Digilocker
getEAadhaarXml(requestId, options)
getDigilockerDetails(requestId)

// Phone KYC Suite
phoneToRegisteredAddress(phoneNumber, firstName, lastName, pan)
phoneToAlternatePhone(phoneNumber, firstName, lastName, pan)
phoneToPrefill(phoneNumber, firstName, lastName, pan)
phoneToIncome(phoneNumber, firstName, dob, address, pincode, lastName, pan)
phoneToIdentityDetails(phoneNumber, firstName, lastName, pan)

// Risk & Fraud
getPhoneIntelligence(phoneNumber, originatingIp, emailAddress, deviceId)
checkWhatsAppPresence(mobile)
checkDigitalIntegrity(email, phone, ip)    // Group B auth
checkGeoFencing(ip, country, state)         // Group B auth

// Device
fetchImeiDetails(imei)

// Address
geocodeAddress(address, latitude, longitude)
getPincodeDetails(pincode)

// Document
checkDocumentForgery(imageUrl, threshold)

// Employment
verifyEmployment(mobile, panNumber)
advancedEmploymentVerification(params)  // mobileNumber, panNumber, uanNumber, etc.

// Scoring
getDigitalIdentityScore(phone, email, name, pincode)
```

#### Step 1.3: Add Group B auth client (patron-based)

Create a second axios instance for `/api/v2/patrons/` endpoints:
- Requires a login call first to get an access token
- Token cached and refreshed on 401
- Used by: Geo Fencing, Digital Integrity Check

```
File: src/services/signzyService.js
Add: signzyV2Api axios instance with login/token management
```

---

### Phase 2: Risk Engine Core

#### Step 2.1: Create `src/services/riskEngine.js`

The core risk engine module with:

```javascript
// Main entry point - orchestrates all API calls and scoring
async function calculateRiskScore(applicantData) → RiskProfile

// Individual category scorers (each returns 0-100)
function scoreIdentityVerification(data) → { score, flags, details }
function scoreFinancialStability(data) → { score, flags, details }
function scorePhoneDigitalTrust(data) → { score, flags, details }
function scoreAddressLocation(data) → { score, flags, details }
function scoreIncomeCapacity(data) → { score, flags, details }
function scoreDocumentIntegrity(data) → { score, flags, details }
function scoreDeviceBehavioral(data) → { score, flags, details }

// Weighted aggregation
function aggregateScore(categoryScores, weights) → finalScore (0-1000)

// Decision engine
function makeDecision(riskProfile) → { decision, reason, requiredActions }
```

#### Step 2.2: API Orchestration Strategy

The engine collects data **progressively** through the loan flow — it doesn't call all 22 APIs at once. Instead, it runs in phases aligned with the existing steps:

```
Phase A (Step 2 - After phone + PAN collected):
  - PAN Fetch (already done)
  - Phone-to-PAN (already done)
  - Phone Intelligence
  - WhatsApp Presence
  - Digital Identity Score
  - Phone to Alternate Phone
  - Phone to Identity Details
  → Produces: PRELIMINARY risk score (Identity + Phone/Digital categories)
  → Gate: If preliminary score < 200 → early decline

Phase B (Step 3 - After income data):
  - Phone to Income
  - Phone to Prefill
  - Employment Verification
  - Advanced Employment Verification
  → Updates: Financial Stability + Income categories
  → Gate: If updated score < 300 → decline

Phase C (Step 4 - After KYC + address):
  - Registered Address (Phone KYC)
  - Address Geocode Match
  - Pincode Details
  - Geo Fencing (using device IP)
  - Digital Integrity Check (email + phone + IP)
  - Get e-Aadhaar XML (if Digilocker method used)
  - Get Details (Digilocker linked docs)
  → Updates: Address + Identity categories
  → Gate: If updated score < 350 → manual review

Phase D (Step 5 - After selfie + bank):
  - Hybrid Bank Account Verification
  - Search Bank by IFSC
  - IMEI Fetch (from device info)
  - Advance Forgery Lite (on uploaded documents/selfie)
  → Updates: Financial Stability + Document + Device categories
  → Final score calculated

Decision Gate (before Step 6):
  - Full risk profile assembled
  - Final decision: approve / manual_review / decline
  - If approved → proceed to eNACH/eSign
  - If manual_review → queue for ops team
  - If declined → show rejection with reason
```

#### Step 2.3: Parallel API calls within each phase

Within each phase, APIs are called concurrently using `Promise.allSettled()` to maximize speed and ensure partial failures don't block the entire phase:

```javascript
// Phase A example
const [phoneIntel, whatsapp, digitalId, altPhone, identity] =
  await Promise.allSettled([
    signzyService.getPhoneIntelligence(phone, ip),
    signzyService.checkWhatsAppPresence(phone),
    signzyService.getDigitalIdentityScore(phone, email, name, pincode),
    signzyService.phoneToAlternatePhone(phone, firstName, lastName),
    signzyService.phoneToIdentityDetails(phone, firstName, lastName),
  ]);
```

Failed API calls get a neutral/default score rather than blocking the flow.

---

### Phase 3: Scoring Logic (detailed)

#### Step 3.1: Category 1 — Identity Verification (20%, score 0-100)

| Signal | Points | Source API |
|--------|--------|-----------|
| PAN is valid | +20 | PAN Fetch |
| PAN status = "VALID" (not fake/deactivated) | +10 | PAN Fetch |
| Aadhaar seeded to PAN | +10 | PAN Fetch |
| Tax compliance = "operative" | +5 | PAN Fetch |
| Phone-to-PAN matches provided PAN | +15 | Phone-to-PAN |
| Name consistency across PAN, KYC, borrower input | +15 | Name matching |
| Identity details found (DL, Voter ID, Passport) | +10 | Phone to Identity Details |
| DigiLocker has linked documents | +10 | Get Details |
| e-Aadhaar digital signature valid | +5 | Get e-Aadhaar XML |

**Red flags (deductions):**
- PAN status FAKE/DEACTIVATED: -50
- Name mismatch > 30%: -20
- No identity documents found: -10
- Individual tax non-compliant: -10

#### Step 3.2: Category 2 — Financial Stability (25%, score 0-100)

| Signal | Points | Source API |
|--------|--------|-----------|
| Bank account active | +25 | Hybrid Bank Verification |
| Bank account name matches borrower | +15 | Hybrid Bank Verification |
| IFSC valid with recognized bank | +5 | Search Bank by IFSC |
| Currently employed (is_employed = true) | +20 | Employment Verification / Advanced |
| Employment > 6 months at current employer | +10 | Advanced Employment Verification |
| PF filings recent (last 3 months) | +10 | Advanced Employment Verification |
| Multiple UAN records (stable work history) | +5 | Advanced Employment Verification |
| Penny drop verified (existing check) | +10 | Existing bankService |

**Red flags:**
- Bank account inactive: -30
- Name mismatch on bank account: -20
- No employment record found: -15
- Date of exit marked (unemployed): -20
- PF not recent: -10

#### Step 3.3: Category 3 — Phone & Digital Trust (15%, score 0-100)

| Signal | Points | Source API |
|--------|--------|-----------|
| Phone risk score < 300 (low risk) | +20 | Phone Intelligence |
| Phone type = mobile (not VOIP/toll-free) | +10 | Phone Intelligence |
| Not on blocklist | +10 | Phone Intelligence |
| Carrier = reputable (not high-risk) | +5 | Phone Intelligence |
| WhatsApp registered | +10 | WhatsApp Presence |
| WhatsApp is personal (not business) | +5 | WhatsApp Presence |
| Email valid + not disposable | +10 | Digital Integrity Check |
| IP not on blocklist | +10 | Digital Integrity Check |
| Digital identity score > 5 | +10 | Digital Identity Score |
| Digital footprint exists (ecom/social) | +10 | Digital Identity Score |

**Red flags:**
- Phone risk score > 700: -30
- VOIP/toll-free/payphone number: -25
- IP on blocklist (tor/vpn/proxy): -20
- Disposable email: -15
- Phone flagged as fraud source: -40
- No digital footprint at all: -10
- Bot-like activity detected: -20

#### Step 3.4: Category 4 — Address & Location (10%, score 0-100)

| Signal | Points | Source API |
|--------|--------|-----------|
| Registered address found | +20 | Phone KYC - Registered Address |
| Address geocode confidence > 0.7 | +15 | Address Geocode Match |
| Pincode valid with population data | +10 | Pincode Details |
| Geo-fence valid (IP matches claimed location) | +20 | Geo Fencing |
| Address consistent across KYC + phone records | +15 | Cross-reference |
| Not in international border area | +10 | Address Geocode Match |
| Distance between KYC address and geocoded < 50km | +10 | Address Geocode Match |

**Red flags:**
- No registered address found: -15
- IP geo doesn't match claimed state: -20
- International border area: -10
- Risky IP detected: -15
- Pincode blacklisted (existing check): -30

#### Step 3.5: Category 5 — Income & Capacity (15%, score 0-100)

| Signal | Points | Source API |
|--------|--------|-----------|
| Income estimate available | +15 | Phone to Income |
| Income estimate >= 2x requested EMI | +20 | Phone to Income |
| FOIR < 0.4 | +20 | Existing calculation |
| FOIR 0.4-0.5 | +10 | Existing calculation |
| Bounce count = 0 | +15 | Existing AA data |
| Prefill data rich (multiple addresses, IDs) | +10 | Phone to Prefill |
| AA data available (consent given) | +10 | Existing bankService |
| Consistent income across sources | +10 | Cross-reference |

**Red flags:**
- FOIR > 0.65: -30
- Multiple bounces (>2): -25
- No income data available: -20
- Income inconsistency between sources > 50%: -15
- EMI capacity < requested EMI: -20

#### Step 3.6: Category 6 — Document Integrity (5%, score 0-100)

| Signal | Points | Source API |
|--------|--------|-----------|
| All documents pass forgery check | +50 | Advance Forgery Lite |
| Forgery score < 0.3 (clean) | +30 | Advance Forgery Lite |
| Forgery score 0.3-0.6 (borderline) | +10 | Advance Forgery Lite |
| Selfie liveness verified | +20 | Existing verification |

**Red flags:**
- Forgery score > 0.6 on any document: -50
- Status = "forged": -80
- Selfie liveness failed: -30

#### Step 3.7: Category 7 — Device & Behavioral (10%, score 0-100)

| Signal | Points | Source API |
|--------|--------|-----------|
| Device IMEI valid (not marked lost) | +25 | IMEI Fetch |
| Device is recent model (< 5 years old) | +10 | IMEI Fetch |
| Single phone number (no suspicious alternates) | +15 | Phone to Alternate Phone |
| Alternate phones ≤ 3 | +10 | Phone to Alternate Phone |
| Identity details consistent (name, gender, DOB) | +20 | Phone to Identity Details |
| Phone-email match confirmed | +10 | Digital Identity Score |
| Phone first seen > 2 years ago | +10 | Digital Identity Score |

**Red flags:**
- IMEI marked lost/stolen: -50
- More than 5 alternate phone numbers: -15
- Device too old (> 8 years) or unknown brand: -10
- Identity inconsistency (DOB/gender mismatch): -25
- Phone first seen < 6 months: -15

---

### Phase 4: Integration into Loan Flow

#### Step 4.1: Create `src/store/RiskContext.js`

New React context to manage risk state across screens:

```javascript
state = {
  currentPhase: 'A' | 'B' | 'C' | 'D' | 'complete',
  preliminaryScore: null,      // After Phase A
  updatedScore: null,           // After Phase B
  fullScore: null,              // After Phase D
  categoryScores: {
    identity: { score, flags, details },
    financial: { score, flags, details },
    phoneDigital: { score, flags, details },
    address: { score, flags, details },
    income: { score, flags, details },
    document: { score, flags, details },
    device: { score, flags, details },
  },
  decision: null,               // approve | manual_review | decline
  apiResults: {},               // Raw API responses for audit
  flags: [],                    // Aggregated red flags
  isCalculating: false,
}
```

#### Step 4.2: Integrate risk phases into existing screens

Each existing screen triggers the appropriate risk phase in the background:

| Screen | Risk Phase | Trigger |
|--------|-----------|---------|
| PanVerificationScreen | Phase A | After PAN verified successfully |
| IncomeVerificationScreen | Phase B | After income data collected |
| KycVerificationScreen | Phase C | After KYC + address obtained |
| BankDetailsScreen | Phase D | After bank details + penny drop |
| EnachEsignScreen | Decision | Before allowing eNACH initiation |

Risk calculation runs **in the background** (non-blocking) during each screen transition. The user sees the normal flow while scores update behind the scenes. At the decision gate (before Step 6), the full score is available.

#### Step 4.3: Update gating logic

Replace current ad-hoc gates with risk-score-based gates:

```javascript
// Current: if (gatingPassed) proceed
// New: if (riskScore >= thresholds.PHASE_A_MIN) proceed

const RISK_THRESHOLDS = {
  PHASE_A_MIN: 200,          // Minimum after Phase A to continue
  PHASE_B_MIN: 300,          // Minimum after Phase B to continue
  PHASE_C_MIN: 350,          // Minimum after Phase C (or manual review)
  AUTO_APPROVE: 800,         // Auto-approve threshold
  MANUAL_REVIEW_MIN: 400,   // Below this → decline, above → manual review
  AUTO_DECLINE: 200,         // Below this → auto-decline at any phase
};
```

#### Step 4.4: Risk dashboard component

Create `src/components/common/RiskIndicator.js`:
- Small visual indicator on screen headers showing current risk phase
- Color-coded: green (800+), yellow (600-799), orange (400-599), red (<400)
- Visible only in admin/debug mode, not to end users

---

### Phase 5: Risk Profile & Audit Trail

#### Step 5.1: Risk profile data structure

Every loan application gets a persisted risk profile:

```javascript
{
  applicationId: "LOAN_xxx",
  finalScore: 742,
  decision: "approve",
  calculatedAt: "2026-03-11T...",
  phases: {
    A: { score: 680, completedAt: "...", apiCallDuration: 2400 },
    B: { score: 710, completedAt: "...", apiCallDuration: 3100 },
    C: { score: 730, completedAt: "...", apiCallDuration: 2800 },
    D: { score: 742, completedAt: "...", apiCallDuration: 3500 },
  },
  categories: { /* 7 category breakdowns */ },
  flags: ["phone_first_seen_recent", "foir_borderline"],
  apiResults: { /* raw responses for audit */ },
}
```

#### Step 5.2: Store risk profile in `LoanContext`

Add `riskProfile` to the existing loan state and a `SET_RISK_PROFILE` action. The risk profile travels with the loan application for downstream decisioning and audit.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/config/constants.js` | Edit | Add all Signzy API endpoint configs, risk thresholds, scoring weights |
| `src/services/signzyService.js` | Edit | Add 20 new API methods + Group B auth client |
| `src/services/riskEngine.js` | **New** | Core risk engine: orchestration, scoring, decision |
| `src/store/RiskContext.js` | **New** | Risk state management across screens |
| `src/store/LoanContext.js` | Edit | Add `riskProfile` to state, `SET_RISK_PROFILE` action |
| `src/screens/loan/education/PanVerificationScreen.js` | Edit | Trigger Phase A after PAN verified |
| `src/screens/loan/education/IncomeVerificationScreen.js` | Edit | Trigger Phase B after income collected |
| `src/screens/loan/education/KycVerificationScreen.js` | Edit | Trigger Phase C after KYC done |
| `src/screens/loan/education/BankDetailsScreen.js` | Edit | Trigger Phase D after bank verified |
| `src/screens/loan/education/EnachEsignScreen.js` | Edit | Check final decision before proceeding |
| `src/components/common/RiskIndicator.js` | **New** | Visual risk score indicator (admin/debug) |
| `App.js` | Edit | Add RiskProvider wrapper |

---

## Implementation Order

1. **Constants & API configs** — Add all endpoint configs and scoring constants
2. **signzyService.js** — Implement all 20 new API methods
3. **riskEngine.js** — Build scoring logic (can be developed/tested independently)
4. **RiskContext.js** — State management for risk data
5. **LoanContext.js** — Add risk profile to loan state
6. **Screen integrations** — Wire up phases to existing screens
7. **RiskIndicator component** — Admin visibility
8. **App.js** — Wire up provider
