/**
 * Customer Risk Segmentation
 *
 * Segments customers into High / Medium / Low risk based on
 * KYC method and loan amount:
 *
 *   Low Risk    — vKYC completed (any amount)
 *   Medium Risk — CKYC or DigiLocker done AND amount < ₹60,000
 *   High Risk   — vKYC not done AND amount >= ₹60,000
 */

export const RISK_SEGMENTS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export function computeCustomerRiskSegment(application) {
  const vkycDone =
    application.vkycStatus?.completed === true ||
    application.status === 'vkyc_done';

  const kycDone =
    !!application.kycData &&
    !!application.kycMethod;

  const amount =
    application.amount ||
    application.studentDetails?.balanceFee ||
    0;

  if (vkycDone) {
    return {
      segment: RISK_SEGMENTS.LOW,
      reason: 'Video KYC completed — identity verified via live video.',
      color: 'teal',
    };
  }

  if (kycDone && amount < 60000) {
    return {
      segment: RISK_SEGMENTS.MEDIUM,
      reason: `KYC verified via ${application.kycMethod || 'CKYC/DigiLocker'} and loan amount (₹${amount.toLocaleString('en-IN')}) is under ₹60,000.`,
      color: 'warning',
    };
  }

  if (!vkycDone && amount >= 60000) {
    return {
      segment: RISK_SEGMENTS.HIGH,
      reason: `Video KYC not completed and loan amount (₹${amount.toLocaleString('en-IN')}) is ₹60,000 or above.`,
      color: 'error',
    };
  }

  // Default for incomplete applications
  return {
    segment: RISK_SEGMENTS.MEDIUM,
    reason: 'KYC or loan amount information is incomplete.',
    color: 'warning',
  };
}
