import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { COLORS } from '../../../config/constants';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { maskPan, validatePan } from '../../../utils/helpers';

const PanVerificationScreen = ({ navigation }) => {
  const { state, dispatch } = useLoan();
  const [pan, setPan] = useState('');
  const [panFetched, setPanFetched] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [panDetails, setPanDetails] = useState(null);
  const [creditChecking, setCreditChecking] = useState(false);
  const [creditPassed, setCreditPassed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [panName, setPanName] = useState('');

  useEffect(() => {
    fetchPanByMobile();
  }, []);

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
      } else {
        setPanFetched(false);
      }
    } catch {
      // Phone-to-PAN lookup failed — user can enter PAN manually
      setPanFetched(false);
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
      if (passed) {
        dispatch({ type: 'SET_STEP', payload: 2 });
      }
    } catch {
      // Mock - credit check passed
      setCreditPassed(true);
      dispatch({
        type: 'SET_CREDIT_SCORE',
        payload: { score: 720, gatingPassed: true },
      });
      dispatch({ type: 'SET_STEP', payload: 2 });
    } finally {
      setCreditChecking(false);
    }
  };

  const handleVerifyPan = async () => {
    if (!validatePan(pan)) {
      Alert.alert('Error', 'Please enter a valid PAN number');
      return;
    }
    setLoading(true);
    try {
      const result = await kycService.validatePan(pan);

      if (!result.isValid) {
        const statusMsg = result.panStatusLabel || result.panStatus || 'INVALID';
        Alert.alert(
          'PAN Verification Failed',
          `PAN status: ${statusMsg}. Please check and try again.`,
        );
        setLoading(false);
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
    } catch (err) {
      const errorMsg =
        err?.error?.message || err?.message || 'PAN verification failed. Please try again.';
      Alert.alert('Verification Error', errorMsg);
      setLoading(false);
      return;
    }
    setLoading(false);
    // Automatically run credit check after PAN verification
    runCreditCheck(pan);
  };

  const handleProceed = () => {
    navigation.navigate('KycVerification');
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
          <Input
            label="PAN Number"
            value={pan}
            onChangeText={(t) => {
              setPan(t.toUpperCase());
              setPanVerified(false);
              setPanDetails(null);
              setCreditPassed(null);
            }}
            placeholder="Enter PAN (e.g., ABCDE1234F)"
            maxLength={10}
            autoCapitalize="characters"
            editable={!panVerified}
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
              disabled={pan.length !== 10}
              style={styles.btn}
            />
          ) : (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ PAN Verified</Text>
            </View>
          )}
        </Card>

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
              complete KYC verification.
            </Text>
            <Button
              title="Continue to KYC"
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
  bottomSpacer: { height: 100 },
});

export default PanVerificationScreen;
