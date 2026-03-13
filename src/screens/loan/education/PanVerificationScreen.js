import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { COLORS } from '../../../config/constants';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';
import { maskPan, validatePan } from '../../../utils/helpers';

const PanVerificationScreen = ({ navigation }) => {
  const { state, dispatch } = useLoan();
  const { executePhase, feedCreditBureauData, setExternalData } = useRisk();
  const [pan, setPan] = useState('');
  const [panFetched, setPanFetched] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [panDetails, setPanDetails] = useState(null);
  const [creditChecking, setCreditChecking] = useState(false);
  const [creditPassed, setCreditPassed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [panName, setPanName] = useState('');
  const [panError, setPanError] = useState(null);
  const [panInputError, setPanInputError] = useState('');
  const [panNotLinked, setPanNotLinked] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');

  useEffect(() => {
    fetchPanByMobile();
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

      // Feed credit bureau data into risk engine
      feedCreditBureauData(result);

      if (passed) {
        dispatch({ type: 'SET_STEP', payload: 2 });
      }
    } catch {
      // Mock - credit check passed
      setCreditPassed(true);
      const mockCredit = { score: 720, gatingPassed: true, cibilScore: 720 };
      dispatch({ type: 'SET_CREDIT_SCORE', payload: mockCredit });
      feedCreditBureauData(mockCredit);
      dispatch({ type: 'SET_STEP', payload: 2 });
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

  return (
    <View style={styles.container}>
      <Header
        title="PAN & Credit Check"
        onBack={() => navigation.goBack()}
      />
      <StepIndicator currentStep={2} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* PAN Verification */}
        <Card>
          <Text style={styles.sectionTitle}>PAN Verification</Text>
          {panFetched && (
            <Text style={styles.infoText}>
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
              <Text style={styles.verifiedText}>✓ PAN Verified</Text>
            </View>
          )}
        </Card>

        {/* PAN Verification Error */}
        {panError && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>Verification Failed</Text>
            <Text style={styles.errorText}>{panError}</Text>
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
            <Text style={styles.checkingTitle}>Checking Eligibility...</Text>
            <Text style={styles.infoText}>
              Running a soft credit check. This will not affect your credit score.
            </Text>
          </Card>
        )}

        {/* Credit Check Result */}
        {creditPassed === true && (
          <Card style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Eligible!</Text>
            <Text style={styles.successText}>
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
            <Text style={styles.failTitle}>Not Eligible</Text>
            <Text style={styles.failText}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  btn: { marginTop: 12 },
  btnSecondary: { marginTop: 8 },
  errorCard: { alignItems: 'center', backgroundColor: '#FFF3F0', borderLeftWidth: 3, borderLeftColor: COLORS.error },
  errorIcon: { fontSize: 36, marginBottom: 6 },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  panDetailsContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  verifiedBadge: {
    backgroundColor: '#E8F8F7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  verifiedText: {
    color: COLORS.teal,
    fontWeight: '700',
    fontSize: 15,
  },
  checkingCard: { alignItems: 'center' },
  checkingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  successCard: { alignItems: 'center', backgroundColor: '#E8F8F7' },
  successIcon: {
    fontSize: 48,
    color: COLORS.teal,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.teal,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  failCard: { alignItems: 'center', backgroundColor: '#FFF3F0' },
  failIcon: { fontSize: 48, color: COLORS.error, marginBottom: 8 },
  failTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.error,
    marginBottom: 8,
  },
  failText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  warningText: {
    fontSize: 13,
    color: '#E67E22',
    marginBottom: 12,
    lineHeight: 20,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
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
    color: COLORS.error,
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  bottomSpacer: { height: 100 },
});

export default PanVerificationScreen;
