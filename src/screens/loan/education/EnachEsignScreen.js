import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, TouchableOpacity, Clipboard, Platform, Modal } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { loanService } from '../../../services/loanService';
import { kycService } from '../../../services/kycService';
import { digitapService } from '../../../services/digitapService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';
import { formatCurrency, calculateEmi } from '../../../utils/helpers';
import { useTheme } from '../../../store/ThemeContext';
import useFocusScroller from '../../../hooks/useFocusScroller';

const RELATION_OPTIONS = ['Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Friend', 'Colleague', 'Other'];

// Digitap vKYC links remain valid for 72 hours after creation. After
// that the lead expires upstream and any further status check returns
// "no session" — so we treat a stored link as expired client-side and
// prompt the customer to initiate vKYC again.
const VKYC_LINK_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * Returns true when the persisted vKYC lead is still within its 72-hr
 * window. Defensive: an entry without `initiatedAt` is assumed live
 * (best effort) so we don't accidentally invalidate legacy records.
 */
function isVkycLeadFresh(detail) {
  if (!detail || !detail.initiatedAt) return true;
  const at = new Date(detail.initiatedAt).getTime();
  if (!Number.isFinite(at)) return true;
  return (Date.now() - at) < VKYC_LINK_TTL_MS;
}

const EnachEsignScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { state: riskState, executePhase } = useRisk();
  const { scrollRef, anchorProps, scrollToAnchor } = useFocusScroller();
  const [enachLoading, setEnachLoading] = useState(false);
  const [esignLoading, setEsignLoading] = useState(false);
  const [enachDone, setEnachDone] = useState(false);
  const [esignDone, setEsignDone] = useState(false);

  // VKYC state — only for loans >= 60K (Digitap integration)
  const [vkycLoading, setVkycLoading] = useState(false);
  const [vkycInitiated, setVkycInitiated] = useState(false);
  const [vkycDone, setVkycDone] = useState(false);
  const [vkycUrl, setVkycUrl] = useState(null);
  const [vkycStatusText, setVkycStatusText] = useState(null);
  // Rich vKYC status detail (tone / label / message) — rendered as an
  // inline status card. Rehydrated from state.vkycStatusDetail on
  // mount so a page refresh keeps the last-known status visible.
  const [vkycStatusDetail, setVkycStatusDetail] = useState(null);
  // Missing-Aadhaar-fields modal (shown when KYC didn't yield every
  // field Digitap's external-Aadhaar vKYC needs).
  const [missingKycModal, setMissingKycModal] = useState({ visible: false, fields: [] });

  // References (two required)
  const emptyRef = { name: '', phone: '', address: '', relation: '' };
  const [ref1, setRef1] = useState({ ...emptyRef });
  const [ref2, setRef2] = useState({ ...emptyRef });
  const [refErrors, setRefErrors] = useState({});

  // Restore references from persisted state
  useEffect(() => {
    if (state.references?.[0]) setRef1(state.references[0]);
    if (state.references?.[1]) setRef2(state.references[1]);
    // Rehydrate the last-seen vKYC status so a page refresh doesn't
    // blank the status card or drop the user back to "Initiate vKYC"
    // after a link has already been sent. The persisted
    // vkycStatusDetail holds the URL + initiated flag (stashed on
    // initiate) AND the most recent tone/label/message (stashed on
    // every status check). Sales / credit see the same link on the
    // admin detail screen.
    const detail = state.vkycStatusDetail;
    if (detail) {
      const stillFresh = isVkycLeadFresh(detail);
      if (stillFresh) {
        if (detail.label) setVkycStatusText(detail.label);
        setVkycStatusDetail(detail);
        if (detail.vkycUrl) setVkycUrl(detail.vkycUrl);
        if (detail.initiated) setVkycInitiated(true);
      } else if (detail.vkycUrl || detail.initiated) {
        // Expired (>72 h since initiate). Drop the stored link and
        // surface a clear "create a new link" banner so the customer
        // doesn't keep tapping the dead URL.
        const expiredDetail = {
          tone: 'pending',
          label: 'Link expired',
          message: 'Your previous Video KYC link expired (72-hour validity). Tap "Initiate vKYC" to generate a fresh one.',
          vkycUrl: '',
          initiated: false,
          lastCheckedAt: new Date().toISOString(),
        };
        setVkycStatusText(expiredDetail.label);
        setVkycStatusDetail(expiredDetail);
        setVkycUrl(null);
        setVkycInitiated(false);
        dispatch({ type: 'SET_VKYC_STATUS_DETAIL', payload: expiredDetail });
      }
    }
    // Keep the existing `vkycStatus === 'completed'` semantics in
    // sync — if that flag is set, skip straight to the done state.
    if (state.vkycStatus === 'completed' || state.vkycStatus?.completed) {
      setVkycDone(true);
      setVkycInitiated(true);
    }
    // Rehydrate eNACH + eSign from persisted state so a refresh /
    // resume doesn't re-show the action buttons for mandates / signs
    // the customer already completed. Accepts both the legacy
    // 'completed' string and the new object shape carrying mandateId
    // / sessionId / redirectUrl / completedAt.
    const enachDoneNow = state.enachStatus === 'completed' || state.enachStatus?.completed === true;
    if (enachDoneNow) setEnachDone(true);
    const esignDoneNow = state.esignStatus === 'completed' || state.esignStatus?.completed === true;
    if (esignDoneNow) setEsignDone(true);
  }, []);

  const riskDecision = riskState.decision?.decision;
  // Eligibility is the customer-facing gate: once the AA / bank-
  // statement analysis says "eligible", the risk engine's advisory
  // decline is a reviewer flag, not a hard block. Only hard-block when
  // eligibility itself said no (state.eligibilityResult.eligible ===
  // false), which the IncomeVerification screen sets explicitly.
  const eligibilityPassed = state.eligibilityResult?.eligible === true;
  const eligibilityFailed = state.eligibilityResult?.eligible === false;
  const isRiskDeclined = !eligibilityPassed && (riskDecision === 'decline' || eligibilityFailed);
  const isManualReview = !eligibilityPassed && (riskDecision === 'review' || riskDecision === 'elevated');

  const loanAmount = state.studentDetails?.balanceFee || 0;
  const requiresVkyc = loanAmount >= 60000;
  const emi = state.selectedProduct
    ? calculateEmi(loanAmount, state.selectedProduct.interestRate, state.selectedTenure)
    : 0;

  // When the final gate actually declines (eligibility failed OR risk
  // said decline without eligibility's override), persist the verdict
  // on the application so the auto-rejected bucket on the admin /
  // credit / sales / ops dashboards picks it up. Previously the
  // decline only rendered a banner, leaving status at fully_eligible
  // which kept the app in the in-progress bucket forever.
  useEffect(() => {
    if (!isRiskDeclined) return;
    if (state.eligibilityResult?.eligible === false) return; // already not_eligible
    dispatch({
      type: 'SET_ELIGIBILITY',
      payload: {
        status: 'not_eligible',
        eligible: false,
        source: 'risk_engine',
        reason: riskState.reasonCodes?.[0] || 'Risk assessment declined',
        reasonCodes: riskState.reasonCodes || [],
        riskScore: riskState.finalScore || null,
        finalisedAt: new Date().toISOString(),
        // Keep whatever foir / emiCapacity we already had so downstream
        // screens and dashboards don't lose those numbers.
        ...(state.eligibilityResult || {}),
        eligible: false,
      },
    });
  }, [isRiskDeclined]);

  const tealBg = `${colors.teal}14`;
  const errorBg = `${colors.error}14`;
  const warningBg = `${colors.warning}14`;

  const handleEnach = async () => {
    setEnachLoading(true);
    let enachResult;
    try {
      enachResult = await loanService.initiateEnach(state.currentLoan?.id, {
        accountNumber: state.bankDetails?.accountNumber,
        ifsc: state.bankDetails?.ifsc,
        emiAmount: emi,
        frequency: 'monthly',
      });
      // Persist the mandate + redirect URL immediately so a refresh /
      // resume doesn't lose the in-progress mandate. Status 'initiated'
      // flips to 'completed' after the 2-second mock settlement below.
      dispatch({
        type: 'SET_ENACH',
        payload: {
          status: 'initiated',
          mandateId: enachResult?.mandateId || '',
          redirectUrl: enachResult?.url || enachResult?.redirectUrl || '',
          accountNumber: state.bankDetails?.accountNumber || '',
          accountNumberLast4: (state.bankDetails?.accountNumber || '').slice(-4),
          ifsc: state.bankDetails?.ifsc || '',
          bankName: state.bankDetails?.bankName || '',
          emiAmount: emi,
          frequency: 'monthly',
          initiatedAt: new Date().toISOString(),
        },
      });
      if (enachResult?.redirectUrl || enachResult?.url) {
        Linking.openURL(enachResult.redirectUrl || enachResult.url);
      }
    } catch {
      setEnachLoading(false);
      Alert.alert('Error', 'eNACH setup failed. Please try again.');
      return;
    }
    setTimeout(() => {
      setEnachDone(true);
      dispatch({
        type: 'SET_ENACH',
        payload: {
          status: 'completed',
          completed: true,
          completedAt: new Date().toISOString(),
          mandateId: enachResult?.mandateId || '',
          bankRefNo: enachResult?.bankRefNo || enachResult?.mandateId || '',
        },
      });
      setEnachLoading(false);
      // eNACH done — eSign is the next gated action.
      scrollToAnchor('esign');
    }, 2000);
  };

  const handleEsign = async () => {
    setEsignLoading(true);
    let esignResult;
    // Build the final signer list from main applicant + co-applicants
    // so the admin detail can show every signature slot.
    const signers = [
      { role: 'main', name: state.borrowerDetails?.name || 'Main applicant', pan: state.panDetails?.panNumber || state.borrowerDetails?.pan || '' },
      ...(state.coBorrowers || []).map((cb, i) => ({
        role: 'co_applicant',
        index: i + 1,
        name: cb.name || `Co-applicant ${i + 1}`,
        pan: cb.pan || cb.panDetails?.panNumber || '',
      })),
    ];
    try {
      esignResult = await loanService.initiateEsign(state.currentLoan?.id);
      // Persist the session + redirect URL on initiation so staff can
      // share the link and customer can resume without a fresh request.
      dispatch({
        type: 'SET_ESIGN',
        payload: {
          status: 'initiated',
          sessionId: esignResult?.sessionId || '',
          redirectUrl: esignResult?.url || esignResult?.redirectUrl || '',
          signers,
          initiatedAt: new Date().toISOString(),
        },
      });
      if (esignResult?.redirectUrl || esignResult?.url) {
        Linking.openURL(esignResult.redirectUrl || esignResult.url);
      }
    } catch {
      setEsignLoading(false);
      Alert.alert('Error', 'eSign initiation failed. Please try again.');
      return;
    }
    setTimeout(() => {
      setEsignDone(true);
      dispatch({
        type: 'SET_ESIGN',
        payload: {
          status: 'completed',
          completed: true,
          completedAt: new Date().toISOString(),
          sessionId: esignResult?.sessionId || '',
          signers: signers.map((s) => ({ ...s, signedAt: new Date().toISOString() })),
        },
      });
      setEsignLoading(false);
      // eSign done — references / vKYC are next.
      scrollToAnchor(requiresVkyc ? 'vkyc' : 'references');
    }, 2000);
  };

  const handleInitiateVkyc = async () => {
    setVkycLoading(true);
    try {
      const borrowerName = (state.borrowerDetails?.name || '').trim();
      const nameParts = borrowerName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const kycData = state.kycData || {};

      // All six of the external-Aadhaar fields are mandatory for Digitap's
      // create-lead API — sending any of them empty raises
      // "All external Aadhaar fields must be provided" (400).
      // Map CKYC's field names (fatherName / uid / photo / address) onto
      // the Aadhaar-shaped payload; strip 'X' from CKYC's masked UID so
      // we always hand over 4 real digits.
      // Father / guardian name fallback chain — CKYC first (most
      // authoritative), then the value the borrower entered during
      // bot / form onboarding (state.borrowerDetails.fatherName), then
      // the manual entry on the StudentDetails screen. Without this
      // chain Digitap rejects the call with the "All external Aadhaar
      // fields must be provided" 400.
      const guardianNameAsPerAadhaar =
        kycData.guardianName
        || kycData.fatherName
        || state.borrowerDetails?.fatherName
        || state.studentDetails?.fatherName
        || '';
      const uidDigits = String(kycData.uid || '').replace(/[^0-9]/g, '');
      const aadhaarLastFourDigits = uidDigits.slice(-4);
      const addressAsPerAadhaar = kycData.address
        || kycData.addressLine
        || [kycData.permanentAddress?.addressLine, kycData.correspondenceAddress?.addressLine].filter(Boolean)[0]
        || '';
      // Digitap wants YYYY-MM-DDTHH:MM:SS (local, no timezone).
      const rawFetched = kycData.fetchedAt || kycData.validatedAt || new Date().toISOString();
      const dateOfAadhaarFetch = String(rawFetched).replace(/\..*$/, '').replace(/Z$/, '');

      // Pure base64 photograph is required. Source can be:
      //  • CKYC: raw base64 in kycData.photo
      //  • DigiLocker: Signzy may return either raw base64 OR a hosted
      //    URL (https://...). Digitap rejects URLs with
      //    "Invalid Base64 Aadhaar image provided".
      //  • Post-Cloudinary upload: kycData.photo is replaced with a
      //    secure_url, again a URL not base64.
      // Resolve in this order: explicit base64 sources → fall back to
      // any URL we have and fetch+encode it to base64.
      let imageOfUserBase64 = '';
      const candidates = [
        kycData.photoBase64,
        kycData.aadhaarJpeg,        // DigiLocker eAadhaar JPEG (raw base64)
        kycData.photograph,         // CKYC alternate field name
        kycData.photo,
        // Last resort: digilocker images array, picking the photograph.
        ...(Array.isArray(kycData.images)
          ? kycData.images.filter((i) => i?.code === '03' || /jp/i.test(i?.mime || '')).map((i) => i.data)
          : []),
      ].filter(Boolean).map((v) => String(v));

      for (const v of candidates) {
        // Strip data: URI prefix if present.
        const stripped = v.replace(/^data:image\/[a-z]+;base64,/i, '');
        // A real base64 photo is always >1KB. Anything smaller is a
        // sentinel ("[not-uploaded]") or a corrupt fragment — skip.
        if (!stripped.startsWith('http') && stripped.length > 1000) {
          imageOfUserBase64 = stripped;
          break;
        }
      }

      // If we still don't have base64 but do have an HTTPS URL (e.g.
      // Cloudinary already swallowed the original blob), fetch it and
      // re-encode so Digitap is happy.
      if (!imageOfUserBase64) {
        const url = [kycData.photoStorageUrl, kycData.photo, kycData.aadhaarJpeg]
          .filter(Boolean)
          .map(String)
          .find((v) => v.startsWith('http'));
        if (url) {
          try {
            const blob = await (await fetch(url)).blob();
            imageOfUserBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = String(reader.result || '');
                resolve(result.replace(/^data:image\/[a-z]+;base64,/i, ''));
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (fetchErr) {
            console.log('[EnachEsign] Failed to fetch + base64 the KYC photo:', fetchErr?.message);
          }
        }
      }

      // Quick validation before we fire the network call, so the user
      // sees an actionable message instead of a generic 400.
      const missing = [];
      if (!(kycData.name || borrowerName)) missing.push('name');
      if (!guardianNameAsPerAadhaar) missing.push('father / guardian name');
      if (!addressAsPerAadhaar) missing.push('address');
      if (!aadhaarLastFourDigits || aadhaarLastFourDigits.length < 4) missing.push('Aadhaar last 4 digits');
      if (!imageOfUserBase64 || imageOfUserBase64.length < 100) missing.push('photograph');
      if (missing.length > 0) {
        console.log('[EnachEsign] vKYC blocked — missing fields:', missing, { kycData });
        // Show the in-app modal instead of Alert.alert (which is a
        // no-op on react-native-web) so the user sees exactly which
        // Aadhaar fields the vKYC partner rejected, with a CTA to
        // redo KYC from the top.
        setMissingKycModal({ visible: true, fields: missing });
        setVkycLoading(false);
        return;
      }

      // Build verification questions from application state
      const verificationQuestions = digitapService.buildVerificationQuestions(state);

      const result = await kycService.initiateVkyc({
        firstName,
        lastName,
        uniqueId: state.applicationId,
        mobile: state.borrowerDetails?.phone || '',
        email: state.borrowerDetails?.email || '',
        nameAsPerAadhaar: kycData.name || borrowerName,
        guardianNameAsPerAadhaar,
        addressAsPerAadhaar,
        aadhaarLastFourDigits,
        dateOfAadhaarFetch,
        imageOfUserBase64,
        redirectionUrl: 'https://finz.app/vkyc/complete',
        verificationQuestions,
      });

      setVkycUrl(result.url);
      setVkycInitiated(true);

      // Persist the lead (url + initiatedAt) on the application so a
      // page refresh / resume can re-hydrate it instead of dropping
      // the user back to "Initiate vKYC". Sales / credit see the same
      // link on the admin detail screen.
      dispatch({
        type: 'SET_VKYC_STATUS_DETAIL',
        payload: {
          vkycUrl: result.url || '',
          leadId: result.leadId || result.sessionId || '',
          initiated: true,
          initiatedAt: new Date().toISOString(),
          tone: result.vkycCompleted ? 'ok' : 'pending',
          label: result.vkycCompleted ? 'Approved' : 'vKYC link sent',
          message: result.vkycCompleted
            ? 'Video KYC was already completed for this application. You can proceed with the rest of the flow.'
            : 'A Video KYC link has been sent to your registered mobile and email. Open it any time within the next 72 hours to start the call.',
        },
      });

      if (result.vkycCompleted) {
        setVkycDone(true);
        dispatch({ type: 'SET_VKYC', payload: 'completed' });
        Alert.alert('Already Completed', 'Video KYC was already completed for this application.');
      } else {
        Alert.alert(
          'vKYC Initiated',
          'A vKYC link has been sent to your registered mobile and email. You can also open the link below to start the video KYC call.',
        );
      }
    } catch (err) {
      console.log('[EnachEsign] vKYC initiation error:', err.message);
      Alert.alert('Error', 'Video KYC initiation failed. Please try again.');
    } finally {
      setVkycLoading(false);
    }
  };

  const handleOpenVkycUrl = () => {
    if (vkycUrl) {
      Linking.openURL(vkycUrl).catch(() => {
        Alert.alert('Error', 'Could not open the vKYC link. Please copy and open it in your browser.');
      });
    }
  };

  const handleCopyVkycUrl = () => {
    if (vkycUrl) {
      if (Platform.OS === 'web') {
        navigator.clipboard?.writeText(vkycUrl);
      } else {
        Clipboard.setString(vkycUrl);
      }
      Alert.alert('Copied', 'vKYC link copied to clipboard.');
    }
  };

  /**
   * Decode the Digitap vKYC status into a customer-facing tone (ok /
   * pending / review / rejected / error), a short label and a longer
   * explanation. Sales / credit / ops see the same values on the
   * admin detail screen, so keeping the mapping in one place avoids
   * drift.
   */
  const decodeVkycStatus = (result) => {
    if (!result) {
      return { tone: 'error', label: 'Error', message: 'We could not check vKYC right now. Please try again in a minute.' };
    }
    if (result.status === 'completed' && result.verified) {
      return {
        tone: 'ok',
        label: 'Approved',
        message: 'Video KYC has been approved. You can proceed with the rest of your application.',
      };
    }
    if (result.status === 'rejected') {
      return {
        tone: 'rejected',
        label: 'Rejected',
        message: result.rejectionReason
          ? `Video KYC was rejected — reason: ${result.rejectionReason}. Please re-initiate and retry.`
          : 'Video KYC was rejected. Please re-initiate and retry.',
      };
    }
    // Pending — use reason / callStatus to render a precise message.
    if (result.reason === 'no_session' || result.vkycStatus === 'NOT_STARTED') {
      return {
        tone: 'pending',
        label: 'Not started',
        message: 'No Video KYC session exists yet. Tap "Initiate vKYC" to create one — the link is valid for 72 hours.',
      };
    }
    const raw = String(result.vkycStatus || '').toUpperCase();
    if (raw === 'IN_REVIEW' || raw === 'INREVIEW' || raw === 'UNDER_REVIEW') {
      return {
        tone: 'review',
        label: 'Under review',
        message: 'The Video KYC call is complete and is currently being reviewed by our compliance team. You will be notified as soon as the decision is finalised (typically within a few hours).',
      };
    }
    if (raw === 'INCOMPLETE' || raw === 'EXPIRED') {
      return {
        tone: 'pending',
        label: raw === 'EXPIRED' ? 'Link expired' : 'Incomplete',
        message: raw === 'EXPIRED'
          ? 'The Video KYC link has expired. Please tap "Initiate vKYC" again to get a fresh link.'
          : 'Video KYC was not completed on the last attempt. Please re-open the link and finish the video call.',
      };
    }
    if (result.callStatus === 'AGENT_NOT_PICKED') {
      return {
        tone: 'pending',
        label: 'Agent busy',
        message: 'All agents are currently busy. Please try again in a few minutes, or use a different time slot.',
      };
    }
    if (result.callInitiated) {
      return {
        tone: 'review',
        label: 'Call in progress',
        message: 'Video KYC call is live or waiting to be reviewed. Do not close this page while the call is ongoing.',
      };
    }
    return {
      tone: 'pending',
      label: raw || 'Pending',
      message: 'Video KYC is still pending. Please open the link to start the video call.',
    };
  };

  const handleCheckVkycStatus = async () => {
    setVkycLoading(true);
    try {
      const result = await kycService.getVkycStatus(state.applicationId);
      const decoded = decodeVkycStatus(result);

      // Surface the decoded status inline (no more Alert pop-ups —
      // they're easy to miss and don't leave an audit trail).
      setVkycStatusText(decoded.label);
      setVkycStatusDetail(decoded);

      // Persist the full Digitap payload + decoded summary so admin /
      // credit / sales / ops see identical messaging on the detail
      // screen.
      dispatch({
        type: 'SET_VKYC_STATUS_DETAIL',
        payload: {
          tone: decoded.tone,
          label: decoded.label,
          message: decoded.message,
          digitapStatus: result?.vkycStatus || null,
          sessionId: result?.sessionId || null,
          callStatus: result?.callStatus || null,
          callInitiated: !!result?.callInitiated,
          rejectionReason: result?.rejectionReason || null,
          reason: result?.reason || null,
          lastCheckedAt: result?.checkedAt || new Date().toISOString(),
        },
      });

      if (decoded.tone === 'ok') {
        setVkycDone(true);
        dispatch({ type: 'SET_VKYC', payload: 'completed' });
      } else if (decoded.tone === 'rejected') {
        // Rejected → drop the persisted lead too so the next render
        // shows "Initiate vKYC" again instead of an orphaned link.
        setVkycInitiated(false);
        setVkycUrl(null);
        dispatch({
          type: 'SET_VKYC_STATUS_DETAIL',
          payload: { vkycUrl: '', initiated: false },
        });
      } else if (result?.reason === 'no_session' && (vkycInitiated || vkycUrl)) {
        // Status check came back NOT_STARTED but we had a link
        // locally — Digitap dropped the session (typically because
        // the 72-hour validity elapsed). Clear the stale link and
        // ask the customer to re-initiate.
        setVkycInitiated(false);
        setVkycUrl(null);
        dispatch({
          type: 'SET_VKYC_STATUS_DETAIL',
          payload: {
            vkycUrl: '',
            initiated: false,
            tone: 'pending',
            label: 'Link expired',
            message: 'Your previous Video KYC link has expired (72-hour validity). Tap "Initiate vKYC" to generate a fresh one.',
          },
        });
      }
    } catch (err) {
      console.log('[EnachEsign] vKYC status check error:', err.message);
      const decoded = {
        tone: 'error',
        label: 'Check failed',
        message: 'We could not reach the Video KYC service right now. Please try again in a minute — your vKYC link is still valid.',
      };
      setVkycStatusText(decoded.label);
      setVkycStatusDetail(decoded);
      dispatch({
        type: 'SET_VKYC_STATUS_DETAIL',
        payload: {
          ...decoded,
          errorMessage: err?.message || '',
          lastCheckedAt: new Date().toISOString(),
        },
      });
    } finally {
      setVkycLoading(false);
    }
  };

  const validateReferences = () => {
    const errs = {};
    [ref1, ref2].forEach((r, i) => {
      const p = `ref${i + 1}`;
      if (!r.name || r.name.trim().length < 2) errs[`${p}_name`] = 'Name is required';
      if (!r.phone || !/^[6-9]\d{9}$/.test(r.phone)) errs[`${p}_phone`] = 'Valid 10-digit mobile required';
      if (!r.address || r.address.trim().length < 5) errs[`${p}_address`] = 'Address is required (min 5 chars)';
      if (!r.relation) errs[`${p}_relation`] = 'Please select relation';
    });
    // Both references must be different people
    if (ref1.phone && ref2.phone && ref1.phone === ref2.phone) {
      errs.ref2_phone = 'Must be a different person from Reference 1';
    }
    setRefErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const refsComplete = ref1.name && ref1.phone && ref1.address && ref1.relation
    && ref2.name && ref2.phone && ref2.address && ref2.relation;

  const allDone = enachDone && esignDone && (!requiresVkyc || vkycDone) && refsComplete;

  const [submitLoading, setSubmitLoading] = useState(false);

  const handleSubmit = async () => {
    if (!validateReferences()) {
      Alert.alert('References Required', 'Please fill in both references correctly before submitting.');
      return;
    }
    dispatch({ type: 'SET_REFERENCES', payload: [ref1, ref2] });
    setSubmitLoading(true);
    try {
      const result = await loanService.submitApplication({
        applicationId: state.applicationId,
        loanType: state.loanType,
        instituteDetails: state.instituteDetails,
        studentDetails: state.studentDetails,
        borrowerDetails: state.borrowerDetails,
        selectedProduct: state.selectedProduct,
        selectedTenure: state.selectedTenure,
        panDetails: state.panDetails,
        kycMethod: state.kycMethod,
        bankDetails: state.bankDetails,
        references: [ref1, ref2],
      });
      dispatch({ type: 'SET_SUBMITTED', payload: result.submittedAt });
      navigation.navigate('LoanSuccess');
    } catch {
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="eNACH, eSign & VCIP" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={6} />
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Loan Summary */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Loan Summary</Text>
          <InfoRow label="Loan Amount" value={formatCurrency(loanAmount)} />
          <InfoRow label="Interest Rate" value={`${state.selectedProduct?.interestRate || 0}% p.a.`} />
          <InfoRow label="Tenure" value={`${state.selectedTenure || 0} months`} />
          <InfoRow label="Monthly EMI" value={formatCurrency(emi)} />
          <InfoRow label="Processing Fee" value={state.selectedProduct?.processingFee || '-'} />
        </Card>

        {/* Risk Gate */}
        {isRiskDeclined && (
          <Card style={[styles.gateCard, { backgroundColor: errorBg }]}>
            <Text style={styles.gateIcon}>✕</Text>
            <Text style={[styles.gateTitle, { color: colors.error }]}>Application Declined</Text>
            <Text style={[styles.gateText, { color: colors.textSecondary }]}>
              Based on the risk assessment, this application cannot proceed.{'\n'}
              {riskState.reasonCodes?.length > 0 && `Reason: ${riskState.reasonCodes[0]}`}
            </Text>
          </Card>
        )}

        {isManualReview && (
          <Card style={[styles.gateCard, { backgroundColor: warningBg }]}>
            <Text style={styles.gateIcon}>⏳</Text>
            <Text style={[styles.gateTitle, { color: colors.warning }]}>Under Review</Text>
            <Text style={[styles.gateText, { color: colors.textSecondary }]}>
              Your application requires additional review. Our team will contact you within 24 hours.
              {riskState.finalScore ? ` (Score: ${riskState.finalScore}/1000)` : ''}
            </Text>
          </Card>
        )}

        {/* eNACH Setup */}
        <View {...anchorProps('enach')} />
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. eNACH Setup</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Set up auto-debit (eNACH) for automatic EMI payments from your bank account.
          </Text>
          <InfoRow label="Bank" value={state.bankDetails?.bankName || '-'} />
          <InfoRow label="EMI Amount" value={formatCurrency(emi)} />
          <InfoRow label="Frequency" value="Monthly" />

          {!enachDone ? (
            <Button
              title="Setup eNACH"
              onPress={handleEnach}
              loading={enachLoading}
              disabled={isRiskDeclined || isManualReview}
              style={styles.btn}
            />
          ) : (
            <View style={[styles.doneBadge, { backgroundColor: tealBg }]}>
              <Text style={[styles.doneText, { color: colors.teal }]}>✓ eNACH Registered</Text>
            </View>
          )}
        </Card>

        {/* eSign */}
        <View {...anchorProps('esign')} />
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. eSign Agreement</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Digitally sign your loan agreement document using Aadhaar eSign.
          </Text>

          {/* Signer list — main applicant + any co-applicants on the
              application. The agreement is legally binding only when
              every signer has eSigned. The per-signer eSign launcher
              is a follow-up (requires the eSign API to accept a
              signer context); for now this panel shows the required-
              signers state so reviewers / user know the scope. */}
          {(state.coBorrowers || []).length > 0 ? (
            <View style={{ marginTop: 12, marginBottom: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                Required signers
              </Text>
              {[
                { label: state.borrowerDetails?.name || 'Main applicant', done: esignDone, isMain: true },
                ...(state.coBorrowers || []).map((cb, i) => ({
                  label: cb.name || `Co-applicant ${i + 1}`,
                  done: cb.esignStatus === 'completed',
                  isMain: false,
                })),
              ].map((s, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
                    backgroundColor: s.done ? tealBg : `${colors.warning || '#F5B731'}14`,
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                    {s.isMain ? '👤 ' : '👥 '}{s.label}
                  </Text>
                  <Text style={{
                    fontSize: 11, fontWeight: '700',
                    color: s.done ? colors.teal : (colors.warning || '#F5B731'),
                  }}>
                    {s.done ? '✓ SIGNED' : 'PENDING'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {!esignDone ? (
            <Button
              title="eSign Agreement"
              onPress={handleEsign}
              loading={esignLoading}
              disabled={!enachDone || isRiskDeclined || isManualReview}
              style={styles.btn}
            />
          ) : (
            <View style={[styles.doneBadge, { backgroundColor: tealBg }]}>
              <Text style={[styles.doneText, { color: colors.teal }]}>✓ Agreement eSigned</Text>
            </View>
          )}

          {!enachDone && (
            <Text style={[styles.disabledNote, { color: colors.textSecondary }]}>Complete eNACH setup first</Text>
          )}
        </Card>

        {/* VKYC (VCIP) — only for loans >= 60K, shown in parallel */}
        <View {...anchorProps('vkyc')} />
        {requiresVkyc && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Video KYC (VCIP)</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              As per RBI guidelines, video KYC is required for loan amounts of ₹60,000 and above.
              A video call will be initiated with our verification agent.
            </Text>

            <View style={[styles.instructions, { backgroundColor: `${colors.primary}08` }]}>
              <Text style={[styles.instructionTitle, { color: colors.textPrimary }]}>Before you start:</Text>
              <Text style={[styles.instructionItem, { color: colors.textSecondary }]}>• Ensure good internet connectivity</Text>
              <Text style={[styles.instructionItem, { color: colors.textSecondary }]}>• Be in a well-lit room</Text>
              <Text style={[styles.instructionItem, { color: colors.textSecondary }]}>• Keep your PAN card and Aadhaar ready</Text>
              <Text style={[styles.instructionItem, { color: colors.textSecondary }]}>• The call will take 3-5 minutes</Text>
            </View>

            {!vkycInitiated ? (
              <Button
                title="Initiate vKYC"
                onPress={handleInitiateVkyc}
                loading={vkycLoading}
                disabled={isRiskDeclined || isManualReview}
                icon="📹"
              />
            ) : !vkycDone ? (
              <>
                <View style={[styles.pendingBanner, { backgroundColor: warningBg }]}>
                  <Text style={[styles.pendingText, { color: colors.warning }]}>
                    vKYC link has been sent to your mobile and email. You can also open it directly from here.
                  </Text>
                </View>

                {/* Themed status card — tone drives the accent colour
                    and icon so the customer can tell at a glance
                    whether vKYC is waiting, in review, rejected, or
                    errored. Sales / credit / ops see the same text on
                    the admin detail screen via state.vkycStatusDetail. */}
                {vkycStatusDetail ? (() => {
                  const tone = vkycStatusDetail.tone || 'pending';
                  const palette = {
                    ok:       { bg: tealBg,   fg: colors.teal,    icon: '✓',  hdr: 'Approved' },
                    pending:  { bg: warningBg,fg: colors.warning, icon: '⏳', hdr: 'In progress' },
                    review:   { bg: warningBg,fg: colors.warning, icon: '🔎', hdr: 'Under review' },
                    rejected: { bg: errorBg,  fg: colors.error,   icon: '✕',  hdr: 'Rejected' },
                    error:    { bg: errorBg,  fg: colors.error,   icon: '⚠️', hdr: 'Check failed' },
                  }[tone] || { bg: warningBg, fg: colors.warning, icon: '⏳', hdr: 'Pending' };
                  const ts = vkycStatusDetail.lastCheckedAt
                    ? new Date(vkycStatusDetail.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : null;
                  return (
                    <View style={{
                      marginTop: 10, padding: 14, borderRadius: 10,
                      backgroundColor: palette.bg, borderLeftWidth: 4, borderLeftColor: palette.fg,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 16, marginRight: 6 }}>{palette.icon}</Text>
                        <Text style={{ color: palette.fg, fontWeight: '700', fontSize: 13 }}>
                          {vkycStatusDetail.label || palette.hdr}
                        </Text>
                        {ts ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 8 }}>
                            checked at {ts}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 18 }}>
                        {vkycStatusDetail.message}
                      </Text>
                      {vkycStatusDetail.rejectionReason ? (
                        <Text style={{ color: colors.error, fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                          Rejection reason: {vkycStatusDetail.rejectionReason}
                        </Text>
                      ) : null}
                    </View>
                  );
                })() : null}

                {/* vKYC URL actions */}
                {vkycUrl && (
                  <View style={styles.vkycUrlSection}>
                    <Text style={[styles.vkycUrlLabel, { color: colors.textSecondary }]}>
                      vKYC Link:
                    </Text>
                    <TouchableOpacity onPress={handleOpenVkycUrl}>
                      <Text style={[styles.vkycUrlText, { color: colors.teal }]} numberOfLines={2}>
                        {vkycUrl}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.vkycUrlActions}>
                      <Button
                        title="Open vKYC Link"
                        onPress={handleOpenVkycUrl}
                        icon="🔗"
                        style={{ flex: 1 }}
                      />
                      <TouchableOpacity
                        style={[styles.copyBtn, { borderColor: colors.teal }]}
                        onPress={handleCopyVkycUrl}
                      >
                        <Text style={[styles.copyBtnText, { color: colors.teal }]}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Button
                  title="Check vKYC Status"
                  onPress={handleCheckVkycStatus}
                  loading={vkycLoading}
                  variant="outline"
                  style={{ marginTop: 8 }}
                />
              </>
            ) : (
              <View style={[styles.doneBadge, { backgroundColor: tealBg }]}>
                <Text style={[styles.doneText, { color: colors.teal }]}>✓ Video KYC Approved</Text>
              </View>
            )}
          </Card>
        )}

        {/* References (2 required) */}
        <View {...anchorProps('references')} />
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {requiresVkyc ? '4' : '3'}. References
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Please provide two personal references. They should not be the same person.
          </Text>

          {[
            { label: 'Reference 1', data: ref1, setter: setRef1, prefix: 'ref1' },
            { label: 'Reference 2', data: ref2, setter: setRef2, prefix: 'ref2' },
          ].map(({ label, data, setter, prefix }) => (
            <View key={prefix} style={[styles.refBlock, { borderColor: colors.border }]}>
              <Text style={[styles.refLabel, { color: colors.teal }]}>{label}</Text>
              <Input
                label="Full Name"
                value={data.name}
                onChangeText={(t) => setter({ ...data, name: t })}
                placeholder="Enter full name"
                error={refErrors[`${prefix}_name`]}
              />
              <Input
                label="Mobile Number"
                value={data.phone}
                onChangeText={(t) => setter({ ...data, phone: t.replace(/[^0-9]/g, '') })}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                error={refErrors[`${prefix}_phone`]}
              />
              <Input
                label="Address"
                value={data.address}
                onChangeText={(t) => setter({ ...data, address: t })}
                placeholder="Full address"
                multiline
                error={refErrors[`${prefix}_address`]}
              />
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Relation</Text>
              <View style={styles.relationRow}>
                {RELATION_OPTIONS.map((rel) => (
                  <TouchableOpacity
                    key={rel}
                    style={[
                      styles.relationChip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      data.relation === rel && { borderColor: colors.teal, backgroundColor: colors.teal },
                    ]}
                    onPress={() => setter({ ...data, relation: rel })}
                  >
                    <Text style={[
                      styles.relationChipText,
                      { color: colors.textSecondary },
                      data.relation === rel && { color: colors.background },
                    ]}>
                      {rel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {refErrors[`${prefix}_relation`] && (
                <Text style={[styles.errorText, { color: colors.error }]}>{refErrors[`${prefix}_relation`]}</Text>
              )}
            </View>
          ))}
        </Card>

        {/* Submit Application */}
        <View {...anchorProps('submit')} />
        {allDone && (
          <Button
            title="Submit Application"
            onPress={handleSubmit}
            loading={submitLoading}
            style={styles.completeBtn}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      <FloatingAssistButton />

      {/* Missing-Aadhaar-fields modal — shown when pre-flight catches
          an incomplete kycData payload. Matches the app's modal style
          (card-over-overlay, teal primary CTA, themed colors). */}
      <Modal
        visible={missingKycModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setMissingKycModal({ visible: false, fields: [] })}
      >
        <View style={styles.missingModalOverlay}>
          <View style={[styles.missingModalCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>⚠️</Text>
            <Text style={[styles.missingModalTitle, { color: colors.textPrimary }]}>
              KYC is incomplete
            </Text>
            <Text style={[styles.missingModalBody, { color: colors.textSecondary }]}>
              Video KYC needs the following from your Aadhaar to continue:
            </Text>
            <View style={[styles.missingModalList, { backgroundColor: `${colors.warning || '#F5B731'}14`, borderColor: colors.warning || '#F5B731' }]}>
              {missingKycModal.fields.map((f) => (
                <Text key={f} style={[styles.missingModalItem, { color: colors.textPrimary }]}>
                  • {f}
                </Text>
              ))}
            </View>
            <Text style={[styles.missingModalBody, { color: colors.textSecondary, marginTop: 12 }]}>
              Please redo KYC so we can capture these details.
            </Text>
            <View style={styles.missingModalActions}>
              <TouchableOpacity
                style={[styles.missingModalBtnGhost, { borderColor: colors.border }]}
                onPress={() => setMissingKycModal({ visible: false, fields: [] })}
              >
                <Text style={[styles.missingModalBtnGhostText, { color: colors.textSecondary }]}>
                  Not now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.missingModalBtnPrimary, { backgroundColor: colors.teal }]}
                onPress={() => {
                  setMissingKycModal({ visible: false, fields: [] });
                  // Wipe the incomplete kycData so the KYC screen starts
                  // fresh instead of auto-forwarding on the stale state,
                  // then navigate the user to the KYC step.
                  dispatch({ type: 'SET_KYC_DATA', payload: null });
                  dispatch({ type: 'SET_KYC_METHOD', payload: null });
                  navigation.navigate('KycVerification');
                }}
              >
                <Text style={styles.missingModalBtnPrimaryText}>Redo KYC</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  btn: { marginTop: 12 },
  gateCard: { alignItems: 'center' },
  gateIcon: { fontSize: 36, marginBottom: 8 },
  gateTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  gateText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  doneBadge: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  doneText: { fontWeight: '700', fontSize: 15 },
  disabledNote: { fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  instructions: { padding: 14, borderRadius: 10, marginBottom: 16 },
  instructionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  instructionItem: { fontSize: 13, lineHeight: 22 },
  pendingBanner: { padding: 14, borderRadius: 8, marginBottom: 16 },
  pendingText: { fontSize: 13, lineHeight: 20 },
  // vKYC URL section
  vkycUrlSection: { marginBottom: 12 },
  vkycUrlLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  vkycUrlText: { fontSize: 12, lineHeight: 18, marginBottom: 8, textDecorationLine: 'underline' },
  vkycUrlActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  copyBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  copyBtnText: { fontSize: 13, fontWeight: '700' },
  // References
  refBlock: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  refLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  relationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  relationChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  relationChipText: { fontSize: 12, fontWeight: '500' },
  errorText: { fontSize: 12, color: '#FF6B6B', marginTop: -2, marginBottom: 8 },

  completeBtn: { marginTop: 20 },
  bottomSpacer: { height: 100 },

  // Missing-Aadhaar-fields modal styles
  missingModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  missingModalCard: {
    width: '100%', maxWidth: 420, borderRadius: 16, padding: 24, borderWidth: 1,
  },
  missingModalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  missingModalBody: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  missingModalList: {
    marginTop: 14, padding: 12, borderRadius: 10, borderWidth: 1,
  },
  missingModalItem: { fontSize: 14, lineHeight: 22, fontWeight: '500' },
  missingModalActions: { flexDirection: 'row', marginTop: 20, gap: 10 },
  missingModalBtnGhost: {
    flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  missingModalBtnGhostText: { fontSize: 14, fontWeight: '600' },
  missingModalBtnPrimary: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  missingModalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default EnachEsignScreen;
