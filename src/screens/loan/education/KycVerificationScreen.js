import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import OtpInput from '../../../components/common/OtpInput';
import { KYC_METHODS } from '../../../config/constants';
import { useTheme } from '../../../store/ThemeContext';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';

const KycVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { executePhase } = useRisk();
  const [currentMethod, setCurrentMethod] = useState(null); // null = selection screen
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [kycCompleted, setKycCompleted] = useState(false);
  const [kycFailed, setKycFailed] = useState(false);
  const [pincodeBlacklisted, setPincodeBlacklisted] = useState(false);

  const tealBg = `${colors.teal}14`;
  const warningBg = `${colors.warning}14`;
  const errorBg = `${colors.error}14`;

  const getMockKycData = () => ({
    name: state.borrowerDetails?.name || 'RAHUL SHARMA',
    address: '123, ABC Colony, Bangalore - 560001',
    pincode: '560001',
    dob: '1998-05-15',
    photo: 'base64_photo_data_here',
  });

  // CKYC Flow — simulated for now
  const handleInitiateCkyc = async () => {
    setLoading(true);
    try {
      await kycService.initiateCkyc({
        pan: state.panDetails?.panNumber,
        phone: state.borrowerDetails?.phone,
        name: state.borrowerDetails?.name,
      });
      setOtpSent(true);
    } catch {
      // TODO: Replace simulation once CKYC API is integrated
      setOtpSent(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCkycOtp = async (otpValue) => {
    const code = otpValue || otp;
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const result = await kycService.verifyCkycOtp({
        pan: state.panDetails?.panNumber,
        otp: code,
      });
      await handleKycSuccess(result, KYC_METHODS.CKYC);
    } catch {
      // TODO: Replace simulation once CKYC API is integrated
      await handleKycSuccess(getMockKycData(), KYC_METHODS.CKYC);
    } finally {
      setLoading(false);
    }
  };

  // DigiLocker Flow — simulated for now
  const handleInitiateDigilocker = async () => {
    setLoading(true);
    try {
      const result = await kycService.initiateDigilocker({
        pan: state.panDetails?.panNumber,
        phone: state.borrowerDetails?.phone,
      });
      if (result.redirectUrl) {
        // In production, open DigiLocker in WebView
        // For now, simulate success
        await handleKycSuccess(getMockKycData(), KYC_METHODS.DIGILOCKER);
      }
    } catch {
      // TODO: Replace simulation once DigiLocker API is integrated
      // Simulate DigiLocker consent + data fetch after brief delay
      setTimeout(async () => {
        await handleKycSuccess(getMockKycData(), KYC_METHODS.DIGILOCKER);
        setLoading(false);
      }, 1200);
      return; // Don't set loading false yet
    }
    setLoading(false);
  };

  // Common KYC success handler
  const handleKycSuccess = async (kycData, method) => {
    // Check pincode blacklist
    try {
      const pincodeResult = await kycService.checkPincode(kycData.pincode);
      if (pincodeResult.blacklisted) {
        setPincodeBlacklisted(true);
        setKycFailed(true);
        return;
      }
    } catch {
      // Mock - pincode OK
    }

    // Name match check
    try {
      const nameMatchResult = await kycService.matchNames({
        panName: state.panDetails?.name,
        kycName: kycData.name,
        borrowerName: state.borrowerDetails?.name,
      });
      if (nameMatchResult.score < 70) {
        dispatch({ type: 'SET_KYC_DATA', payload: { ...kycData, method, nameMatchFailed: true } });
        dispatch({ type: 'SET_KYC_METHOD', payload: method });
        Alert.alert(
          'Under Review',
          'Your application has been routed for manual review due to name mismatch. Our team will contact you shortly.'
        );
        setKycCompleted(true);
        return;
      }
    } catch {
      // Mock - name match OK
    }

    dispatch({ type: 'SET_KYC_DATA', payload: { ...kycData, method } });
    dispatch({ type: 'SET_KYC_METHOD', payload: method });
    dispatch({ type: 'SET_STEP', payload: 4 });
    setKycCompleted(true);

    // Trigger Phase C risk scoring in background
    const borrowerName = state.borrowerDetails?.name || '';
    const nameParts = borrowerName.trim().split(/\s+/);
    const applicant = {
      phone: state.borrowerDetails?.phone,
      firstName: nameParts[0] || '',
      lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
      pan: state.panDetails?.panNumber,
      email: state.borrowerDetails?.email || '',
      ipAddress: '',
      address: kycData.address || '',
      state: '',
      pincode: kycData.pincode || '',
    };

    executePhase('C', applicant).catch(() => {
      // Phase C failure is non-blocking
    });
  };

  const handleProceed = () => {
    navigation.navigate('SelfieVerification');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="KYC Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={4} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Method Selection */}
        {!kycCompleted && !kycFailed && !currentMethod && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Choose KYC Method</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Select how you would like to verify your identity. Both methods are quick and secure.
            </Text>

            <View style={styles.optionsCol}>
              <TouchableOpacity
                style={[styles.methodCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setCurrentMethod(KYC_METHODS.CKYC)}
              >
                <View style={styles.methodHeader}>
                  <View style={[styles.methodIconWrap, { backgroundColor: `${colors.purple}20` }]}>
                    <Text style={styles.methodIcon}>🏛️</Text>
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>CKYC</Text>
                    <Text style={[styles.methodSubtitle, { color: colors.textSecondary }]}>Central KYC Registry</Text>
                  </View>
                  <Text style={[styles.methodArrow, { color: colors.textSecondary }]}>›</Text>
                </View>
                <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
                  Verify via PAN-linked KYC records. OTP will be sent to your registered mobile number.
                </Text>
                <View style={[styles.methodBadge, { backgroundColor: tealBg }]}>
                  <Text style={[styles.methodBadgeText, { color: colors.teal }]}>Recommended</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setCurrentMethod(KYC_METHODS.DIGILOCKER)}
              >
                <View style={styles.methodHeader}>
                  <View style={[styles.methodIconWrap, { backgroundColor: `${colors.teal}20` }]}>
                    <Text style={styles.methodIcon}>📱</Text>
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>DigiLocker</Text>
                    <Text style={[styles.methodSubtitle, { color: colors.textSecondary }]}>Aadhaar-based verification</Text>
                  </View>
                  <Text style={[styles.methodArrow, { color: colors.textSecondary }]}>›</Text>
                </View>
                <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
                  Link your Aadhaar via DigiLocker to fetch verified identity documents instantly.
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* CKYC Flow */}
        {!kycCompleted && !kycFailed && currentMethod === KYC_METHODS.CKYC && (
          <Card>
            <View style={styles.methodHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>CKYC Verification</Text>
              <TouchableOpacity onPress={() => { setCurrentMethod(null); setOtpSent(false); setOtp(''); }}>
                <Text style={[styles.changeMethod, { color: colors.teal }]}>Change</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              We will verify your identity via Central KYC Registry.
              An OTP will be sent to your registered mobile.
            </Text>

            {!otpSent ? (
              <Button
                title="Initiate CKYC"
                onPress={handleInitiateCkyc}
                loading={loading}
              />
            ) : (
              <>
                <View style={[styles.otpBanner, { backgroundColor: tealBg }]}>
                  <Text style={[styles.otpBannerText, { color: colors.teal }]}>
                    OTP sent to {state.borrowerDetails?.phone ? `******${state.borrowerDetails.phone.slice(-4)}` : 'your mobile'}
                  </Text>
                </View>
                <Text style={[styles.otpLabel, { color: colors.textPrimary }]}>Enter OTP:</Text>
                <OtpInput
                  length={6}
                  onComplete={(code) => {
                    setOtp(code);
                    handleVerifyCkycOtp(code);
                  }}
                  style={styles.otpInput}
                />
                <Button
                  title="Verify"
                  onPress={() => handleVerifyCkycOtp()}
                  loading={loading}
                  disabled={otp.length !== 6}
                  style={styles.btn}
                />
                <Button
                  title="Try DigiLocker Instead"
                  onPress={() => { setCurrentMethod(KYC_METHODS.DIGILOCKER); setOtpSent(false); setOtp(''); }}
                  variant="outline"
                  style={styles.btn}
                />
              </>
            )}
          </Card>
        )}

        {/* DigiLocker Flow */}
        {!kycCompleted && !kycFailed && currentMethod === KYC_METHODS.DIGILOCKER && (
          <Card>
            <View style={styles.methodHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>DigiLocker Verification</Text>
              <TouchableOpacity onPress={() => setCurrentMethod(null)}>
                <Text style={[styles.changeMethod, { color: colors.teal }]}>Change</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Verify your identity by linking your Aadhaar through DigiLocker.
              Your documents will be fetched securely.
            </Text>

            <View style={[styles.stepsCard, { backgroundColor: `${colors.primary}08` }]}>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>1. You will be redirected to DigiLocker</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>2. Login with your Aadhaar number</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>3. Approve consent to share documents</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>4. Your KYC will be verified automatically</Text>
            </View>

            <Button
              title="Open DigiLocker"
              onPress={handleInitiateDigilocker}
              loading={loading}
            />
            <Button
              title="Try CKYC Instead"
              onPress={() => setCurrentMethod(KYC_METHODS.CKYC)}
              variant="outline"
              style={styles.btn}
            />
          </Card>
        )}

        {/* KYC Completed */}
        {kycCompleted && !kycFailed && (
          <Card style={[styles.resultCard, { backgroundColor: tealBg }]}>
            <Text style={[styles.resultIcon, { color: colors.teal }]}>✓</Text>
            <Text style={[styles.resultTitle, { color: colors.teal }]}>KYC Verified!</Text>
            <Text style={[styles.resultText, { color: colors.textSecondary }]}>
              Your identity has been successfully verified
              via {currentMethod === KYC_METHODS.CKYC ? 'CKYC' : 'DigiLocker'}.
            </Text>
            <Button title="Continue" onPress={handleProceed} style={styles.btn} />
          </Card>
        )}

        {/* KYC Failed */}
        {kycFailed && (
          <Card style={[styles.resultCard, { backgroundColor: errorBg }]}>
            <Text style={[styles.resultIcon, { color: colors.error }]}>✕</Text>
            <Text style={[styles.resultTitle, { color: colors.error }]}>KYC Failed</Text>
            <Text style={[styles.resultText, { color: colors.textSecondary }]}>
              {pincodeBlacklisted
                ? 'Your pincode is not serviceable at this time.'
                : 'KYC verification failed. Our team will review your application and contact you.'}
            </Text>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  optionsCol: { gap: 12 },
  methodCard: {
    borderWidth: 1.5, borderRadius: 14, padding: 16,
  },
  methodHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  methodIconWrap: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  methodIcon: { fontSize: 22 },
  methodInfo: { flex: 1, marginLeft: 12 },
  methodTitle: { fontSize: 16, fontWeight: '700' },
  methodSubtitle: { fontSize: 12, marginTop: 2 },
  methodArrow: { fontSize: 28, fontWeight: '300' },
  methodDesc: { fontSize: 12, lineHeight: 18 },
  methodBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, marginTop: 10,
  },
  methodBadgeText: { fontSize: 11, fontWeight: '700' },
  methodHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  changeMethod: { fontSize: 14, fontWeight: '600' },
  otpBanner: { padding: 10, borderRadius: 8, marginBottom: 14 },
  otpBannerText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  otpLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  otpInput: { marginBottom: 16 },
  stepsCard: { padding: 14, borderRadius: 10, marginBottom: 16 },
  stepText: { fontSize: 13, lineHeight: 26 },
  btn: { marginTop: 12 },
  resultCard: { alignItems: 'center' },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  resultText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default KycVerificationScreen;
