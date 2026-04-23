import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, Alert } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { useTheme } from '../../../store/ThemeContext';
import { kycService } from '../../../services/kycService';
import { signzyService } from '../../../services/signzyService';
import { checkDedupeByPan } from '../../../services/dedupeService';
import { useFBot } from '../../../components/fbot/FBotContext';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';
import { maskPan, validatePan } from '../../../utils/helpers';

const PanVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { state, dispatch } = useLoan();
  const { executePhase, feedCreditBureauData, setExternalData } = useRisk();
  const { registerListener } = useFBot();

  // ── FBot action listener ──
  useEffect(() => {
    return registerListener('panScreen', (action) => {
      if (action.type === 'VERIFY_PAN' && action.value) {
        setPan(action.value);
        setTimeout(() => handleVerifyPan(), 200);
      }
    });
  }, [registerListener]);

  // ── Restore from persisted state so user resumes where they left off ──
  const prevPan = state.panDetails;
  const prevCredit = state.creditScore;
  const [pan, setPan] = useState(prevPan?.panNumber || '');
  const [panFetched, setPanFetched] = useState(!!prevPan?.panNumber);
  const [panVerified, setPanVerified] = useState(!!prevPan);
  const [panDetails, setPanDetails] = useState(prevPan || null);
  const [creditChecking, setCreditChecking] = useState(false);
  const [creditPassed, setCreditPassed] = useState(prevCredit ? (prevCredit.gatingPassed ?? (prevCredit.cibilScore >= 500)) : null);
  const [loading, setLoading] = useState(false);
  const [panName, setPanName] = useState(prevPan?.name || '');
  const [panError, setPanError] = useState(null);
  const [panInputError, setPanInputError] = useState('');
  const [panNotLinked, setPanNotLinked] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [dedupeResult, setDedupeResult] = useState(null);
  const [dedupeLoading, setDedupeLoading] = useState(false);

  useEffect(() => {
    if (!prevPan?.panNumber) fetchPanByMobile();
  }, []);

  // PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
  const sanitizePanInput = (text) => {
    const upper = text.toUpperCase();
    let filtered = '';
    for (let i = 0; i < upper.length && i < 10; i++) {
      const ch = upper[i];
      if (i < 5) {
        // First 5 must be letters
        if (/[A-Z]/.test(ch)) filtered += ch;
      } else if (i < 9) {
        // Next 4 must be digits
        if (/[0-9]/.test(ch)) filtered += ch;
      } else {
        // Last 1 must be a letter
        if (/[A-Z]/.test(ch)) filtered += ch;
      }
    }
    return filtered;
  };

  const getPanInputHint = (value) => {
    if (!value) return '';
    if (value.length < 5) return 'Enter 5 letters (e.g. ABCDE...)';
    if (value.length < 9) return 'Enter 4 digits (e.g. ...1234...)';
    if (value.length < 10) return 'Enter last letter (e.g. ...F)';
    if (!validatePan(value)) return 'Invalid PAN format';
    return '';
  };

  const fetchPanByMobile = async () => {
    setLoading(true);
    try {
      const borrowerName = state.borrowerDetails?.name || '';
      const nameParts = borrowerName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

      const data = await kycService.fetchPanByMobile(
        state.borrowerDetails?.phone,
        firstName,
        lastName,
      );
      if (data.panNumber) {
        setPan(data.panNumber);
        setPanName(data.name || '');
        setPanFetched(true);
        setPanNotLinked(false);
      } else {
        setPanFetched(false);
        setPanNotLinked(true);
      }
    } catch {
      // Phone-to-PAN lookup failed — user can enter PAN manually
      setPanFetched(false);
      setPanNotLinked(true);
    } finally {
      setLoading(false);
    }
  };

  const runCreditCheck = async (panNumber) => {
    // If we have a fresh credit report from dedupe (< 30 days), reuse it
    if (dedupeResult?.creditReport?.isFresh) {
      console.log('[PanVerification] Reusing fresh credit report (', dedupeResult.creditReport.ageDays, 'days old)');
      const reusedScore = dedupeResult.creditReport.data;
      const passed = reusedScore.gatingPassed ?? (reusedScore.cibilScore >= 500);
      setCreditPassed(passed);
      if (!state.creditScore) {
        dispatch({ type: 'SET_CREDIT_SCORE', payload: reusedScore });
      }
      feedCreditBureauData(reusedScore);
      if (passed) dispatch({ type: 'SET_STEP', payload: 2 });
      return;
    }

    setCreditChecking(true);
    try {
      const result = await kycService.softPull({
        pan: panNumber,
        name: state.borrowerDetails?.name,
        phone: state.borrowerDetails?.phone,
        instituteId: state.instituteDetails?.id,
      });
      const passed = result.gatingPassed;
      setCreditPassed(passed);
      dispatch({ type: 'SET_CREDIT_SCORE', payload: result });

      feedCreditBureauData(result);

      if (passed) {
        dispatch({ type: 'SET_STEP', payload: 2 });
      }
    } catch {
      setCreditPassed(false);
      Alert.alert('Error', 'Credit check failed. Please try again.');
    } finally {
      setCreditChecking(false);

      // Trigger Phase A risk scoring in background (non-blocking)
      const borrowerName = state.borrowerDetails?.name || '';
      const nameParts = borrowerName.trim().split(/\s+/);
      const applicant = {
        phone: state.borrowerDetails?.phone,
        firstName: nameParts[0] || '',
        lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
        pan: panNumber,
        email: state.borrowerDetails?.email || '',
        ipAddress: '',
        deviceId: '',
        pincode: '',
        panFetch: panDetails,
      };

      // Seed PAN data already collected
      if (panDetails) {
        setExternalData({ panFetch: panDetails });
      }

      executePhase('A', applicant).catch(() => {
        // Phase A failure is non-blocking — scoring degrades gracefully
      });
    }
  };

  const showPanError = (errorMsg) => {
    setPanError(errorMsg);
    setErrorModalMessage(errorMsg);
    setErrorModalVisible(true);
  };

  const handleVerifyPan = async () => {
    if (!validatePan(pan)) {
      showPanError('Please enter a valid PAN number in format ABCDE1234F.');
      return;
    }
    setLoading(true);
    setPanError(null);
    setPanInputError('');
    try {
      const result = await kycService.validatePan(pan);

      if (!result.isValid) {
        const statusMsg = result.panStatusLabel || result.panStatus || 'INVALID';
        setLoading(false);
        showPanError(`PAN verification failed — status: ${statusMsg}.`);
        return;
      }

      setPanVerified(true);
      setPanDetails(result);
      setPanName(result.name || panName);
      dispatch({
        type: 'SET_PAN',
        payload: {
          panNumber: pan,
          name: result.name || panName,
          panStatus: result.panStatus,
          isIndividual: result.isIndividual,
          aadhaarSeedingStatus: result.aadhaarSeedingStatus,
        },
      });
      setLoading(false);
      runCreditCheck(pan);

      // Background Signzy phone-prefill + FraudShield — pull applicant
      // footprint and fraud-risk score. Fire-and-forget. Both run
      // concurrently via Promise.allSettled so one failure doesn't block
      // the other.
      runPhonePrefill(pan, result.firstName || '', result.lastName || '');
      runFraudShield();
      runDedupeCheck(pan);
    } catch (err) {
      let errorMsg = 'Verification failed. Please try again.';
      if (err?.message) {
        errorMsg = err.message;
      } else if (err?.error?.message) {
        errorMsg = err.error.message;
      } else if (typeof err === 'string') {
        errorMsg = err;
      }
      setLoading(false);
      showPanError(errorMsg);
    }
  };

  const handleRetryPan = () => {
    setPan('');
    setPanName('');
    setPanFetched(false);
    setPanVerified(false);
    setPanDetails(null);
    setPanError(null);
    setPanInputError('');
    setCreditPassed(null);
  };

  const handleProceed = () => {
    navigation.navigate('IncomeVerification');
  };

  const handleRetryDifferentBorrower = () => {
    dispatch({ type: 'RESET' });
    navigation.navigate('InstituteSelection');
  };

  const handleSkipWithTestData = () => {
    const mockPan = 'ABCDE1234F';
    const mockName = state.borrowerDetails?.name || 'RAHUL SHARMA';
    const mockPanDetails = {
      isValid: true,
      name: mockName,
      panStatus: 'E',
      panStatusLabel: 'Existing and Valid',
      isIndividual: true,
      typeOfHolder: 'Individual',
      aadhaarSeedingStatus: 'Y',
      individualTaxComplianceStatus: 'Compliant',
    };
    const mockCreditResult = { score: 720, gatingPassed: true, cibilScore: 720 };

    setPan(mockPan);
    setPanName(mockName);
    setPanFetched(true);
    setPanVerified(true);
    setPanDetails(mockPanDetails);
    setCreditPassed(true);

    dispatch({
      type: 'SET_PAN',
      payload: {
        panNumber: mockPan,
        name: mockName,
        panStatus: 'E',
        isIndividual: true,
        aadhaarSeedingStatus: 'Y',
      },
    });
    dispatch({ type: 'SET_CREDIT_SCORE', payload: mockCreditResult });
    dispatch({ type: 'SET_STATUS', payload: 'pan_verified' });
    dispatch({ type: 'SET_STEP', payload: 2 });
    feedCreditBureauData(mockCreditResult);
  };

  /**
   * Background FraudShield Lite check. Non-blocking — stores the trust
   * score / risk category and the full breakdown under
   * state.signzyVerifications.fraudShieldLite so credit / admin can
   * review the fraud-risk profile from the staff view.
   */
  /**
   * PAN dedupe check — finds existing applications for this PAN
   * and determines if KYC can be skipped, credit report reused, etc.
   */
  const runDedupeCheck = async (panNumber) => {
    setDedupeLoading(true);
    try {
      const result = await checkDedupeByPan(panNumber);
      setDedupeResult(result);
      console.log('[PanVerification] Dedupe:', result.found ? `${result.applications.length} app(s), activeLoan=${result.hasActiveLoan}` : 'no history');

      if (result.found) {
        // Store dedupe result for downstream screens
        dispatch({
          type: 'SET_SIGNZY_VERIFICATION',
          payload: { key: 'panDedupe', status: 'success', result },
        });

        // If credit report is fresh (< 30 days), reuse it
        if (result.creditReport?.isFresh && !state.creditScore) {
          console.log('[PanVerification] Reusing credit report (', result.creditReport.ageDays, 'days old)');
          dispatch({ type: 'SET_CREDIT_SCORE', payload: result.creditReport.data });
        }

        // If active loan exists, pre-populate KYC skip flag
        if (result.canSkipKyc && result.previousKyc) {
          console.log('[PanVerification] Active loan found — KYC can be skipped');
        }
      }
    } catch (err) {
      console.log('[PanVerification] Dedupe check failed:', err?.message);
    } finally {
      setDedupeLoading(false);
    }
  };

  const runFraudShield = async () => {
    const phone = state.borrowerDetails?.phone || '';
    const name = state.borrowerDetails?.name || '';
    const email = state.borrowerDetails?.email || '';
    if (!phone || !name) {
      console.log('[PanVerification] Skipping FraudShield — no phone/name');
      return;
    }

    console.log('[PanVerification] FraudShield Lite →', phone);
    try {
      const result = await signzyService.fraudShieldLite({
        phoneNumber: phone,
        name,
        email,
      });
      dispatch({
        type: 'SET_SIGNZY_VERIFICATION',
        payload: { key: 'fraudShieldLite', status: 'success', result },
      });
      console.log(
        '[PanVerification] FraudShield ok → score =',
        result.trustScore?.score,
        ', risk =',
        result.trustScore?.riskCategory,
      );
    } catch (err) {
      console.log('[PanVerification] FraudShield failed:', err?.message);
      dispatch({
        type: 'SET_SIGNZY_VERIFICATION',
        payload: {
          key: 'fraudShieldLite',
          status: 'failure',
          error: {
            message: err?.message || 'Unknown error',
            statusCode: err?.statusCode ?? err?.response?.status ?? null,
            raw: err?.signzyError || err?.response?.data || null,
          },
        },
      });
    }
  };

  /**
   * Background Signzy phone-prefill. Non-blocking — stores the result
   * (or the failure reason) under state.signzyVerifications.phonePrefill
   * so it shows up on the staff Verifications tab and is available to
   * the KYC screen for address prefill.
   */
  const runPhonePrefill = async (panNumber, firstNameFromPan, lastNameFromPan) => {
    const phone = state.borrowerDetails?.phone || '';
    if (!phone) {
      console.log('[PanVerification] Skipping phone-prefill — no phone on file');
      return;
    }

    // Prefer the verified PAN-fetch name (most authoritative); fall back
    // to the borrower's self-declared name.
    const fullName = state.borrowerDetails?.name || '';
    const parts = fullName.trim().split(/\s+/);
    const firstName = (firstNameFromPan || parts[0] || '').trim();
    const lastName = (lastNameFromPan || (parts.length > 1 ? parts[parts.length - 1] : '') || '').trim();

    if (!firstName) {
      console.log('[PanVerification] Skipping phone-prefill — no first name');
      return;
    }

    console.log('[PanVerification] phone-prefill →', phone, firstName, lastName || '(no lastName)');
    try {
      const result = await signzyService.phonePrefill(phone, firstName, lastName, panNumber);
      dispatch({
        type: 'SET_SIGNZY_VERIFICATION',
        payload: { key: 'phonePrefill', status: 'success', result },
      });
      console.log(
        '[PanVerification] phone-prefill ok →',
        result.addresses?.length || 0,
        'addresses,',
        result.alternatePhones?.length || 0,
        'phones,',
        result.emails?.length || 0,
        'emails',
      );
    } catch (err) {
      console.log('[PanVerification] phone-prefill failed:', err?.message);
      dispatch({
        type: 'SET_SIGNZY_VERIFICATION',
        payload: {
          key: 'phonePrefill',
          status: 'failure',
          error: {
            message: err?.message || 'Unknown error',
            statusCode: err?.statusCode ?? err?.response?.status ?? null,
            raw: err?.signzyError || err?.response?.data || null,
          },
        },
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="PAN & Credit Check"
        onBack={() => navigation.goBack()}
      />
      <StepIndicator currentStep={2} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* PAN Verification */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PAN Verification</Text>
          {panFetched && (
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              PAN linked with your mobile number:
            </Text>
          )}
          {panNotLinked && !panFetched && (
            <Text style={styles.warningText}>
              PAN not linked to phone. Please enter your PAN number manually.
            </Text>
          )}
          <Input
            label="PAN Number"
            value={pan}
            onChangeText={(t) => {
              const sanitized = sanitizePanInput(t);
              setPan(sanitized);
              setPanInputError(getPanInputHint(sanitized));
              setPanVerified(false);
              setPanDetails(null);
              setPanError(null);
              setCreditPassed(null);
            }}
            placeholder="ABCDE1234F"
            maxLength={10}
            autoCapitalize="characters"
            editable={!panVerified}
            error={panInputError}
          />
          {panName ? (
            <InfoRow label="Name on PAN" value={panName} />
          ) : null}

          {/* PAN Verification Details */}
          {panDetails && (
            <View style={styles.panDetailsContainer}>
              <InfoRow label="PAN Status" value={panDetails.panStatusLabel || panDetails.panStatus} />
              {panDetails.typeOfHolder ? (
                <InfoRow label="Holder Type" value={panDetails.typeOfHolder} />
              ) : null}
              {panDetails.aadhaarSeedingStatus ? (
                <InfoRow label="Aadhaar Linked" value={panDetails.aadhaarSeedingStatus} />
              ) : null}
              {panDetails.individualTaxComplianceStatus ? (
                <InfoRow label="Tax Compliance" value={panDetails.individualTaxComplianceStatus} />
              ) : null}
            </View>
          )}

          {!panVerified ? (
            <Button
              title="Verify PAN"
              onPress={handleVerifyPan}
              loading={loading}
              disabled={!validatePan(pan)}
              style={styles.btn}
            />
          ) : (
            <View style={styles.verifiedBadge}>
              <Text style={[styles.verifiedText, { color: colors.teal }]}>✓ PAN Verified</Text>
            </View>
          )}
        </Card>

        {/* Skip with Test Data */}
        {!panVerified && (
          <TouchableOpacity
            style={styles.skipTestBtn}
            onPress={handleSkipWithTestData}
          >
            <Text style={styles.skipTestText}>Skip with Test Data</Text>
            <Text style={styles.skipTestHint}>Uses mock PAN & credit check for testing</Text>
          </TouchableOpacity>
        )}

        {/* PAN Verification Error */}
        {panError && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>Verification Failed</Text>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{panError}</Text>
            <Button
              title="Enter Correct PAN"
              onPress={handleRetryPan}
              style={styles.btn}
            />
          </Card>
        )}

        {/* Credit Check In Progress */}
        {creditChecking && (
          <Card style={styles.checkingCard}>
            <Text style={[styles.checkingTitle, { color: colors.teal }]}>Checking Eligibility...</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Running a soft credit check. This will not affect your credit score.
            </Text>
          </Card>
        )}

        {/* Credit Check Result */}
        {creditPassed === true && (
          <Card style={styles.successCard}>
            <Text style={[styles.successIcon, { color: colors.teal }]}>✓</Text>
            <Text style={[styles.successTitle, { color: colors.teal }]}>Eligible!</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              You have passed the initial credit check. Please proceed to
              income verification.
            </Text>
            <Button
              title="Continue to Income Verification"
              onPress={handleProceed}
              style={styles.btn}
            />
          </Card>
        )}

        {creditPassed === false && (
          <Card style={styles.failCard}>
            <Text style={styles.failIcon}>✕</Text>
            <Text style={[styles.failTitle, { color: colors.error }]}>Not Eligible</Text>
            <Text style={[styles.failText, { color: colors.textSecondary }]}>
              Based on the credit assessment, you are not eligible for this loan.
              You may apply with different borrower details.
            </Text>
            <Button
              title="Apply with Different Details"
              onPress={handleRetryDifferentBorrower}
              variant="outline"
              style={styles.btn}
            />
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Error Popup Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>⚠</Text>
            <Text style={styles.modalTitle}>Verification Failed</Text>
            <Text style={styles.modalMessage}>{errorModalMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <FloatingAssistButton />
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 20,
  },
  btn: { marginTop: 12 },
  btnSecondary: { marginTop: 8 },
  errorCard: { alignItems: 'center', backgroundColor: `${colors.error}14`, borderLeftWidth: 3, borderLeftColor: colors.error },
  errorIcon: { fontSize: 36, marginBottom: 6 },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.error,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  panDetailsContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  verifiedBadge: {
    backgroundColor: `${colors.teal}14`,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  verifiedText: {
    fontWeight: '700',
    fontSize: 15,
  },
  checkingCard: { alignItems: 'center' },
  checkingTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  successCard: { alignItems: 'center', backgroundColor: `${colors.teal}14` },
  successIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  failCard: { alignItems: 'center', backgroundColor: `${colors.error}14` },
  failIcon: { fontSize: 48, color: colors.error, marginBottom: 8 },
  failTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  failText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  warningText: {
    fontSize: 13,
    color: colors.warning,
    marginBottom: 12,
    lineHeight: 20,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  modalIcon: { fontSize: 40, marginBottom: 8 },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.error,
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: colors.teal,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  modalButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
  skipTestBtn: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.warning,
    borderStyle: 'dashed',
    backgroundColor: `${colors.warning}14`,
    alignItems: 'center',
  },
  skipTestText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
  },
  skipTestHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bottomSpacer: { height: 100 },
});

export default PanVerificationScreen;
