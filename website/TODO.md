# Placeholders &amp; Follow-ups

All items below must be completed before the site is considered launch-ready.
Search the codebase with `grep -rn "{{" website/` to find every placeholder.

## 1. Brand assets to drop in `/website/assets/images/`

| File                      | Purpose                                  | Recommended size |
|---------------------------|------------------------------------------|------------------|
| `logo.png`                | Header logo (the attached finZ finance mark) | 160 × 44 (2× = 320×88) |
| `favicon.png`             | Browser tab icon                         | 192 × 192        |
| `apple-touch-icon.png`    | iOS home-screen icon                     | 512 × 512        |
| `og-banner.png`           | Social share preview (LinkedIn / X / WA) | 1200 × 630       |

The header has a graceful fallback to a text "fin**Z** finance" mark if `logo.png` is missing, so the site is visually acceptable until the image is added.

## 2. Product-detail placeholders (see `rates-and-fees.html`, `products/*.html`)

Education Loan
- `{{EDU_LOAN_MIN}}` / `{{EDU_LOAN_MAX}}` — loan amount range
- `{{EDU_TENURE_MIN}}` / `{{EDU_TENURE_MAX}}` — tenure in months
- `{{EDU_APR_MIN}}` / `{{EDU_APR_MAX}}` — APR % range
- `{{EDU_PF_MAX}}` — processing fee max %

Higher Education Loan
- `{{HE_LOAN_MIN}}` / `{{HE_LOAN_MAX}}`
- `{{HE_TENURE_MIN}}` / `{{HE_TENURE_MAX}}`
- `{{HE_APR_MIN}}` / `{{HE_APR_MAX}}`
- `{{HE_PF_MAX}}`
- `{{HE_MORATORIUM}}` — max moratorium months

Employee Loan
- `{{EMP_LOAN_MIN}}` / `{{EMP_LOAN_MAX}}`
- `{{EMP_TENURE_MIN}}` / `{{EMP_TENURE_MAX}}`
- `{{EMP_APR_MIN}}` / `{{EMP_APR_MAX}}`
- `{{EMP_PF_MAX}}`
- `{{EMP_MIN_SALARY}}` — minimum in-hand salary

Generic charges
- `{{PF_MAX}}` — generic max processing fee
- `{{BOUNCE_FEE}}` — EMI bounce charge
- `{{NOC_FEE}}` — duplicate NOC / statement fee
- `{{FC_MAX}}` — foreclosure charge % for fixed-rate loans
- `{{MANDATE_FEE}}` — cheque swap / mandate change fee
- `{{RATES_LAST_REVIEWED}}` — date interest-rate policy was last reviewed by Board

## 3. People on `about.html`

- `{{DIRECTOR_1_NAME}}` / `{{DIRECTOR_1_DESIGNATION}}` / `{{DIRECTOR_1_DIN}}`
- `{{DIRECTOR_2_NAME}}` / `{{DIRECTOR_2_DESIGNATION}}` / `{{DIRECTOR_2_DIN}}`
- `{{DIRECTOR_3_NAME}}` / `{{DIRECTOR_3_DESIGNATION}}` / `{{DIRECTOR_3_DIN}}` (add/remove rows as needed)
- `{{CS_NAME}}` / `{{CS_MEMBERSHIP}}` — Company Secretary
- `{{CFO_NAME}}` — Chief Financial Officer

## 4. Policy-review dates on `policies.html`

- `{{FPC_REVIEWED}}`, `{{IRP_REVIEWED}}`, `{{KYC_REVIEWED}}`, `{{GR_REVIEWED}}`, `{{RP_REVIEWED}}`, `{{OP_REVIEWED}}`, `{{IS_REVIEWED}}`, `{{CP_REVIEWED}}`, `{{CS_REVIEWED}}`, `{{WB_REVIEWED}}`, `{{RF_REVIEWED}}`, `{{MLA_REVIEWED}}`, `{{KFS_REVIEWED}}`
- `{{FPC_LAST_REVIEWED}}` on `fair-practices-code.html`
- `{{PRIVACY_LAST_UPDATED}}` on `privacy-policy.html`
- `{{TERMS_LAST_UPDATED}}` on `terms.html`
- `{{AGENCY_LIST_UPDATED}}` on `collection-agencies.html`
- `{{FY_YEAR}}` on `policies.html` (e.g. 2025-26)

## 5. Policy PDFs to drop in `/website/assets/policies/`

Naming convention: `<slug>-<lang>.pdf` where `<lang>` is `en`, `hi`, `ta`, `te`, `kn`, `ml`, `bn`, `mr`.

Required:
- `fair-practices-code-en.pdf`, `fair-practices-code-hi.pdf`, and regional variants
- `interest-rate-policy-en.pdf`, `interest-rate-policy-hi.pdf`
- `kyc-aml-policy-en.pdf`, `kyc-aml-policy-hi.pdf`
- `grievance-redressal-policy-en.pdf`, `grievance-redressal-policy-hi.pdf`, regional variants
- `recovery-policy-en.pdf`, `recovery-policy-hi.pdf`
- `outsourcing-policy-en.pdf`
- `infosec-privacy-policy-en.pdf`, `infosec-privacy-policy-hi.pdf`
- `credit-policy-summary-en.pdf`
- `cyber-security-policy-en.pdf`
- `whistle-blower-policy-en.pdf`
- `resolution-framework-en.pdf`
- `model-loan-agreement-en.pdf`, `model-loan-agreement-hi.pdf`
- `kfs-sample-en.pdf`, `kfs-sample-hi.pdf`
- `annual-report-<FY>.pdf` (e.g. annual-report-2025-26.pdf)
- `statutory-disclosures-<FY>.pdf`

If any filename differs, update the corresponding `<a href>` in `policies.html`.

## 6. Domain / DNS routing

- Decide where the marketing site is served: the apex (`https://finz.finance/`) or a subdomain (`https://www.finz.finance/`).
- The existing Expo app in this repo is wired to deploy the apex via `vercel.json`. Options:
  1. Move the Expo app to `app.finz.finance` and keep the marketing site at the apex (recommended for SEO).
  2. Keep the apex for the Expo app and put the marketing site on `www.finz.finance`.
- Update the `<link rel="canonical">` and `og:url` values across the HTML if the apex is not used.

## 7. Optional enhancements (post-launch)

- **Cookie consent banner** — required under DPDP Act once analytics is added. Use a minimal first-party banner; no 3rd-party scripts.
- **Analytics** — GA4 / Plausible. Load only after consent.
- **hreflang tags** — add once multilingual page variants are published.
- **Open Graph image** — produce a branded 1200×630 graphic.
- **Verify logo image** — the attached image did not render on my side. Confirm `logo.png` looks correct in the header before launch.
- **Form handler** — `contact.html` currently uses `mailto:` as a fallback. Replace with a back-end endpoint (e.g. serverless function) when available; add honeypot / reCAPTCHA for spam.
- **Service worker** — optional PWA install prompt (manifest is already present).

## 8. RBI-specific items to confirm before going live

- Exact date of CoR issue in the footer and ribbon (currently "5 September 2025" per your message).
- Ensure the company name on the site **exactly** matches the name on the RBI CoR. The NBFC app says "FinZ Fintech Private Limited" but the new NBFC appears to be "FinZ Finance Private Limited". Pick the correct one based on the CoR document and update globally if needed.
- Add the specific list of Credit Information Companies (CICs) you report to (currently listed as all four).
- Upload the signed Fair Practices Code PDF (a scanned Board-approved copy is usually expected by RBI inspection).
- Display of the CoR certificate image/PDF on `about.html` is sometimes expected — consider adding a download link.
