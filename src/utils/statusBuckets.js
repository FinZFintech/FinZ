/**
 * Shared status-bucket helpers.
 *
 * The admin / credit / sales / operations dashboards all needed to ask
 * "is this application pending review?" / "is it in progress?" / "is
 * it in my bucket?" — and they all had slightly different, drifting
 * answers. This module is the single source of truth so the counts
 * agree across dashboards and stay in sync with the customer funnel
 * documented in src/store/LoanContext.js.
 *
 * Every helper takes a status string (or an object with `.status`) and
 * returns a boolean. Use the set constants directly for Array.filter.
 */

// ─── Terminal ────────────────────────────────────────────────────────────────
// The loan has reached a state where no further customer action is
// possible AND the app is not awaiting disbursement. We deliberately
// exclude `submitted` here — the customer signed everything but the
// loan hasn't been disbursed yet, so it's still in-progress for ops.
export const TERMINAL_STATUSES = new Set([
  'disbursed', 'active', 'closed',
]);

// "Completed" for dashboards / queue counts. Same set — kept as a
// separate alias so call-sites that mean "Completed (disbursed+)"
// read literally.
export const COMPLETED_STATUSES = TERMINAL_STATUSES;

// ─── Rejected ────────────────────────────────────────────────────────────────
// Application failed a gate and cannot continue. "Rejected" is either
// auto (system hit a rule — CIBIL too low, FOIR too high, KYC name
// mismatch) or manual (admin / credit officer clicked Reject on the
// staff-detail screen, which stamps adminAction.action = 'reject').
// Use isAutoRejected / isManuallyRejected below to distinguish.
export const REJECTED_STATUSES = new Set([
  'credit_check_failed', 'not_eligible', 'kyc_failed',
]);

/**
 * An application was rejected by a human reviewer — credit / admin
 * tapped Reject on the staff detail screen, which stamps
 * adminAction.action = 'reject' before updating status.
 */
export const isManuallyRejected = (a) => {
  if (!a) return false;
  const status = typeof a === 'string' ? a : a.status;
  if (!REJECTED_STATUSES.has(status)) return false;
  return a.adminAction?.action === 'reject';
};

/**
 * An application was rejected by the system — no manual reviewer touch.
 * Use this to populate the "Auto Rejected" bucket on the dashboards so
 * sales / credit / ops can see which rejections they might want to
 * follow up on (override, ask the customer to retry, etc.) vs the
 * manual rejections which are closed decisions.
 */
export const isAutoRejected = (a) => {
  if (!a) return false;
  const status = typeof a === 'string' ? a : a.status;
  if (!REJECTED_STATUSES.has(status)) return false;
  return a.adminAction?.action !== 'reject';
};

// ─── Discarded ───────────────────────────────────────────────────────────────
// Customer explicitly threw the draft away.
export const DISCARDED_STATUSES = new Set(['discarded']);

// ─── Awaiting review by a human reviewer (credit / admin) ────────────────────
// These apps have passed the automated gates but need a manual decision.
export const PENDING_REVIEW_STATUSES = new Set([
  'manual_review', 'kyc_address_review',
]);

// ─── Credit bucket ───────────────────────────────────────────────────────────
// Apps credit should look at. ONLY apps that need a human reviewer to
// make a call — system-approved apps (credit_check_passed /
// income_verified / bank_verified / fully_eligible) flow on their own
// and are NOT parked for credit.
//   manual_review       → system deferred decision to credit
//   kyc_address_review  → KYC address mismatch, needs human check
// A future "parked_to_credit" flag (on state.parkedToCredit) is also
// honoured so ops / sales can explicitly send an app for review.
export const CREDIT_PENDING_STATUSES = new Set([
  'manual_review',
  'kyc_address_review',
]);

// Apps that sales / ops explicitly parked to credit via the staff-detail
// action. Checked alongside the status set above.
export const isParkedToCredit = (app) => !!app?.parkedToCredit
  || !!app?._rawState?.parkedToCredit;

// Credit decided "approve" — fully or partially.
export const CREDIT_APPROVED_STATUSES = new Set([
  'fully_eligible', 'partially_eligible',
]);

// Credit / KYC decided "reject".
export const CREDIT_REJECTED_STATUSES = new Set([
  'credit_check_failed', 'not_eligible', 'kyc_failed',
]);

// ─── Sales bucket ────────────────────────────────────────────────────────────
// Draft = pre-borrower-selection. The user is still setting up the app.
export const SALES_DRAFT_STATUSES = new Set([
  'draft', 'institute_verified', 'student_details_done',
]);

// Submitted (from the user's POV) — application has crossed the
// e-sign / submission line. 'submitted' is awaiting disbursement,
// the rest are post-disbursement. Used for sales success counts.
export const SALES_SUBMITTED_STATUSES = new Set([
  'submitted', 'disbursed', 'active', 'closed',
]);

// ─── Operations bucket ───────────────────────────────────────────────────────
// Apps ops should work on — eligibility decided, paperwork in flight,
// or disbursed but needing post-check.
export const OPS_PENDING_STATUSES = new Set([
  'fully_eligible', 'partially_eligible',
  'enach_done', 'vkyc_done', 'esign_done',
]);

export const OPS_DISBURSED_STATUSES = new Set(['disbursed']);

export const OPS_COMPLETED_STATUSES = new Set(['active', 'closed']);

// Every status that falls somewhere in the ops remit, so ops dashboards
// can annotate just those apps with task/taskStatus fields.
export const OPS_ALL_STATUSES = new Set([
  ...OPS_PENDING_STATUSES,
  ...OPS_DISBURSED_STATUSES,
  ...OPS_COMPLETED_STATUSES,
  'submitted',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusOf = (s) => (typeof s === 'string' ? s : s?.status);

export const isTerminal = (s) => TERMINAL_STATUSES.has(statusOf(s));
export const isRejected = (s) => REJECTED_STATUSES.has(statusOf(s));
export const isDiscarded = (s) => DISCARDED_STATUSES.has(statusOf(s));
export const isDead = (s) => isTerminal(s) || isRejected(s) || isDiscarded(s);

// "In progress" = alive and still being worked through the funnel
// (everything except draft + dead states).
export const isInProgress = (s) => {
  const st = statusOf(s);
  if (!st) return false;
  if (st === 'draft') return false;
  return !isDead(st);
};
