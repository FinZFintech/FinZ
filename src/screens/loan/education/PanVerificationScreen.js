import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
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
      const data = await kycService.fetchPanByMobile(state.borrowerDetails?.phone);
      setPan(data.panNumber || '');
      setPanName(data.name || '');
      setPanFetched(true);
    } catch {
      // Mock - PAN fetched from mobile
      setPan('ABCDE1234F');
      setPanName('RAHUL SHARMA');
      setPanFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPan = async () => {
    if (!validatePan(pan)) {
      Alert.alert('Error', 'Please enter a valid PAN number');
      return;
    }
    setLoading(true);
    try {
      await kycService.validatePan(pan, state.borrowerDetails?.name);
      setPanVerified(true);
      dispatch({ type: 'SET_PAN', payload: { panNumber: pan, name: panName } });
    } catch {
      // Mock verification
      setPanVerified(true);
      dispatch({ type: 'SET_PAN', payload: { panNumber: pan, name: panName } });
    } finally {
      setLoading(false);
    }
  };

  const handleCreditCheck = async () => {
    setCreditChecking(true);
    try {
      const result = await kycService.softPull({
        pan,
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
            }}
            placeholder="Enter PAN (e.g., ABCDE1234F)"
            maxLength={10}
            autoCapitalize="characters"
          />
          {panName && (
            <InfoRow label="Name on PAN" value={panName} />
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

        {/* Credit Check */}
        {panVerified && creditPassed === null && (
          <Card>
            <Text style={styles.sectionTitle}>Credit Assessment</Text>
            <Text style={styles.infoText}>
              We will perform a soft credit check to verify your eligibility.
              This will not affect your credit score.
            </Text>
            <Button
              title="Check Eligibility"
              onPress={handleCreditCheck}
              loading={creditChecking}
              style={styles.btn}
            />
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
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  scrollContent: { paddingBottom: 20 },
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
