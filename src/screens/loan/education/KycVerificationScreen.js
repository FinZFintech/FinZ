import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
  AppState,
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

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 45; // ~3 minutes

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
  const [kycErrorMsg, setKycErrorMsg] = useState('');
  const [pincodeBlacklisted, setPincodeBlacklisted] = useState(false);

  // DigiLocker state
  const [digilockerRequestId, setDigilockerRequestId] = useState(null);
  const [digilockerWaiting, setDigilockerWaiting] = useState(false);
  const [digilockerPolling, setDigilockerPolling] = useState(false);
  const pollTimerRef = useRef(null);
  const pollCountRef = useRef(0);

  const tealBg = `${colors.teal}14`;
  const errorBg = `${colors.error}14`;

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // When app returns to foreground while waiting for DigiLocker, start polling
  useEffect(() => {
    if (!digilockerWaiting || !digilockerRequestId) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && digilockerWaiting && digilockerRequestId) {
        pollForDigilockerData(digilockerRequestId);
      }
    });

    return () => subscription.remove();
  }, [digilockerWaiting, digilockerRequestId]);

  const getMockKycData = () => ({
    name: state.borrowerDetails?.name || 'RAHUL SHARMA',
    address: '123, ABC Colony, Bangalore - 560001',
    pincode: '560001',
    dob: '1998-05-15',
    photo: 'base64_photo_data_here',
  });

  // ─── CKYC Flow — simulated for now ──────────────────────────────────────
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

  // ─── DigiLocker Flow — Signzy 2-step integration ────────────────────────

  /**
   * Step 1: Call Signzy createUrl → get DigiLocker consent URL + requestId.
   * Open the URL in device browser for the user to complete consent.
   */
  const handleInitiateDigilocker = async () => {
    setLoading(true);
    setKycErrorMsg('');
    try {
      const { url, requestId } = await kycService.initiateDigilocker({
        internalId: state.borrowerDetails?.phone || '',
      });

      if (!url || !requestId) {
        throw new Error('DigiLocker service returned an invalid response. Please try again.');
      }

      setDigilockerRequestId(requestId);
      setDigilockerWaiting(true);
      setLoading(false);

      // Open DigiLocker consent page in external browser
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open DigiLocker. Please try again.');
        setDigilockerWaiting(false);
      }
    } catch (err) {
      setLoading(false);
      const msg = err?.message || 'Failed to initiate DigiLocker. Please try again.';
      Alert.alert('DigiLocker Error', msg);
    }
  };

  /**
   * Step 2: Poll Signzy geteaadhaarwithxml with requestId.
   * Called when user returns to the app after DigiLocker consent.
   * Retries until data is available or max attempts reached.
   */
  const pollForDigilockerData = useCallback(async (requestId) => {
    if (digilockerPolling) return; // avoid duplicate polling
    setDigilockerPolling(true);
    setLoading(true);
    pollCountRef.current = 0;

    const attempt = async () => {
      pollCountRef.current += 1;

      try {
        const eAadhaar = await kycService.fetchDigilockerEAadhaar(requestId);

        // Success — got data
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        setDigilockerPolling(false);
        setDigilockerWaiting(false);
        setLoading(false);

        // Extract pincode from splitAddress
        const pincode = eAadhaar.splitAddress?.pincode || '';

        await handleKycSuccess({
          name: eAadhaar.name,
          address: eAadhaar.address,
          pincode,
          dob: eAadhaar.dob,
          photo: eAadhaar.photo || eAadhaar.aadhaarJpeg || '',
          uid: eAadhaar.uid,
          gender: eAadhaar.gender,
          aadhaarJpeg: eAadhaar.aadhaarJpeg,
          aadhaarPdf: eAadhaar.aadhaarPdf,
          signatureValid: eAadhaar.signatureValid,
        }, KYC_METHODS.DIGILOCKER);
        return;
      } catch (err) {
        const status = err?.statusCode;
        const reason = err?.signzyError?.reason || '';
        const message = err?.message || '';

        // 401 AUTH_FAIL = user hasn't completed consent yet → keep polling
        if (status === 401 && /auth_fail|not completed/i.test(reason + message)) {
          if (pollCountRef.current < MAX_POLL_ATTEMPTS) {
            pollTimerRef.current = setTimeout(attempt, POLL_INTERVAL_MS);
            return;
          }
        }

        // 404 = requestId not found (expired or wrong)
        if (status === 404) {
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          setDigilockerPolling(false);
          setDigilockerWaiting(false);
          setLoading(false);
          Alert.alert('Session Expired', 'DigiLocker session has expired. Please try again.');
          setDigilockerRequestId(null);
          return;
        }

        // 400 = user denied consent or cancelled
        if (status === 400) {
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          setDigilockerPolling(false);
          setDigilockerWaiting(false);
          setLoading(false);
          Alert.alert(
            'Consent Required',
            'DigiLocker consent was not granted. Please try again or choose CKYC.',
          );
          setDigilockerRequestId(null);
          return;
        }

        // Max attempts reached
        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          setDigilockerPolling(false);
          setDigilockerWaiting(false);
          setLoading(false);
          Alert.alert(
            'Timed Out',
            'DigiLocker verification took too long. Please try again.',
          );
          setDigilockerRequestId(null);
          return;
        }

        // Other errors — retry a few times
        if (pollCountRef.current < MAX_POLL_ATTEMPTS) {
          pollTimerRef.current = setTimeout(attempt, POLL_INTERVAL_MS);
        }
      }
    };

    attempt();
  }, [digilockerPolling]);

  /**
   * Manual "I've completed DigiLocker" button — triggers polling.
   */
  const handleDigilockerReturn = () => {
    if (digilockerRequestId) {
      pollForDigilockerData(digilockerRequestId);
    }
  };

  const handleCancelDigilocker = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setDigilockerPolling(false);
    setDigilockerWaiting(false);
    setDigilockerRequestId(null);
    setLoading(false);
  };

  // ─── Common KYC success handler ─────────────────────────────────────────
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
              {!digilockerWaiting && (
                <TouchableOpacity onPress={() => { handleCancelDigilocker(); setCurrentMethod(null); }}>
                  <Text style={[styles.changeMethod, { color: colors.teal }]}>Change</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Before initiation */}
            {!digilockerWaiting && !digilockerPolling && (
              <>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Verify your identity by linking your Aadhaar through DigiLocker.
                  Your documents will be fetched securely.
                </Text>

                <View style={[styles.stepsCard, { backgroundColor: `${colors.primary}08` }]}>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>1. You will be redirected to DigiLocker</Text>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>2. Login with your Aadhaar number</Text>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>3. Approve consent to share documents</Text>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>4. Return to FinZ — we fetch your KYC automatically</Text>
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
              </>
            )}

            {/* Waiting for user to complete DigiLocker consent */}
            {digilockerWaiting && !digilockerPolling && (
              <>
                <View style={[styles.waitingBanner, { backgroundColor: `${colors.warning}14` }]}>
                  <Text style={[styles.waitingTitle, { color: colors.warning }]}>Waiting for DigiLocker</Text>
                  <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
                    Complete the verification in DigiLocker and return here.
                    Your data will be fetched automatically.
                  </Text>
                </View>

                <Button
                  title="I've Completed DigiLocker"
                  onPress={handleDigilockerReturn}
                  style={styles.btn}
                />
                <Button
                  title="Re-open DigiLocker"
                  onPress={() => {
                    if (digilockerRequestId) {
                      // Re-initiate to get a fresh URL
                      handleInitiateDigilocker();
                    }
                  }}
                  variant="outline"
                  style={styles.btn}
                />
                <Button
                  title="Cancel"
                  onPress={() => { handleCancelDigilocker(); setCurrentMethod(null); }}
                  variant="outline"
                  style={styles.btn}
                />
              </>
            )}

            {/* Polling for eAadhaar data */}
            {digilockerPolling && (
              <View style={styles.pollingWrap}>
                <Text style={[styles.pollingTitle, { color: colors.teal }]}>
                  Fetching your Aadhaar data...
                </Text>
                <Text style={[styles.pollingText, { color: colors.textSecondary }]}>
                  Please wait while we retrieve your verified documents from DigiLocker. This may take a moment.
                </Text>
              </View>
            )}
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
                : kycErrorMsg || 'KYC verification failed. Our team will review your application and contact you.'}
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
  waitingBanner: { padding: 16, borderRadius: 10, marginBottom: 16 },
  waitingTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  waitingText: { fontSize: 13, lineHeight: 20 },
  pollingWrap: { alignItems: 'center', paddingVertical: 20 },
  pollingTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  pollingText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  btn: { marginTop: 12 },
  resultCard: { alignItems: 'center' },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  resultText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default KycVerificationScreen;
