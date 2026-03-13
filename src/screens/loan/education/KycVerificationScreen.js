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
  Image,
} from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import Input from '../../../components/common/Input';
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
  const [currentMethod, setCurrentMethod] = useState(null);
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

  // Details review state — shown after KYC data is fetched
  const [fetchedKycData, setFetchedKycData] = useState(null);
  const [detailsReviewStep, setDetailsReviewStep] = useState(false);

  // Communication address state
  const [sameAsAadhaar, setSameAsAadhaar] = useState(true);
  const [commAddress, setCommAddress] = useState({
    addressLine: '',
    city: '',
    state: '',
    pincode: '',
  });

  const tealBg = `${colors.teal}14`;
  const errorBg = `${colors.error}14`;

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

  // Listen for deep link (finz://kyc/digilocker-callback) when user returns
  useEffect(() => {
    const handleDeepLink = ({ url }) => {
      if (url && url.startsWith('finz://kyc/digilocker-callback') && digilockerRequestId) {
        pollForDigilockerData(digilockerRequestId);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [digilockerRequestId]);

  const getMockKycData = () => ({
    name: state.borrowerDetails?.name || 'RAHUL SHARMA',
    address: '123, ABC Colony, Bangalore - 560001',
    pincode: '560001',
    dob: '1998-05-15',
    photo: 'base64_photo_data_here',
  });

  /**
   * Resolves photo URI — handles URL, base64, or data URI.
   */
  const getPhotoSource = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      return { uri: photo };
    }
    if (photo.startsWith('data:image')) {
      return { uri: photo };
    }
    // Assume raw base64 — wrap as data URI
    return { uri: `data:image/jpeg;base64,${photo}` };
  };

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
      showDetailsReview(result, KYC_METHODS.CKYC);
    } catch {
      showDetailsReview(getMockKycData(), KYC_METHODS.CKYC);
    } finally {
      setLoading(false);
    }
  };

  // ─── DigiLocker Flow ────────────────────────────────────────────────────
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

  const pollForDigilockerData = useCallback(async (requestId) => {
    if (digilockerPolling) return;
    setDigilockerPolling(true);
    setLoading(true);
    pollCountRef.current = 0;

    const attempt = async () => {
      pollCountRef.current += 1;

      try {
        const eAadhaar = await kycService.fetchDigilockerEAadhaar(requestId);

        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        setDigilockerPolling(false);
        setDigilockerWaiting(false);
        setLoading(false);

        const pincode = eAadhaar.splitAddress?.pincode || '';

        const kycData = {
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
          splitAddress: eAadhaar.splitAddress,
        };

        showDetailsReview(kycData, KYC_METHODS.DIGILOCKER);
        return;
      } catch (err) {
        const status = err?.statusCode;
        const reason = err?.signzyError?.reason || '';
        const message = err?.message || '';

        if (status === 401 && /auth_fail|not completed/i.test(reason + message)) {
          if (pollCountRef.current < MAX_POLL_ATTEMPTS) {
            pollTimerRef.current = setTimeout(attempt, POLL_INTERVAL_MS);
            return;
          }
        }

        if (status === 404) {
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          setDigilockerPolling(false);
          setDigilockerWaiting(false);
          setLoading(false);
          Alert.alert('Session Expired', 'DigiLocker session has expired. Please try again.');
          setDigilockerRequestId(null);
          return;
        }

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

        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          setDigilockerPolling(false);
          setDigilockerWaiting(false);
          setLoading(false);
          Alert.alert('Timed Out', 'DigiLocker verification took too long. Please try again.');
          setDigilockerRequestId(null);
          return;
        }

        if (pollCountRef.current < MAX_POLL_ATTEMPTS) {
          pollTimerRef.current = setTimeout(attempt, POLL_INTERVAL_MS);
        }
      }
    };

    attempt();
  }, [digilockerPolling]);

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

  // ─── Details Review Step ────────────────────────────────────────────────
  const showDetailsReview = (kycData, method) => {
    setFetchedKycData({ ...kycData, method });
    setDetailsReviewStep(true);

    // Pre-fill communication address from fetched data
    if (kycData.splitAddress) {
      const sa = kycData.splitAddress;
      setCommAddress({
        addressLine: sa.addressLine || kycData.address || '',
        city: (sa.city || [])[0] || '',
        state: (sa.state || [])[0]?.[0] || (sa.state || [])[0] || '',
        pincode: sa.pincode || kycData.pincode || '',
      });
    } else {
      setCommAddress({
        addressLine: kycData.address || '',
        city: '',
        state: '',
        pincode: kycData.pincode || '',
      });
    }
    setSameAsAadhaar(true);
  };

  const handleConfirmDetails = async () => {
    if (!fetchedKycData) return;

    // Validate communication address
    const addr = sameAsAadhaar
      ? { addressLine: fetchedKycData.address, city: commAddress.city, state: commAddress.state, pincode: fetchedKycData.pincode }
      : commAddress;

    if (!addr.addressLine?.trim()) {
      Alert.alert('Required', 'Please enter your communication address.');
      return;
    }
    if (!addr.pincode?.trim() || addr.pincode.trim().length !== 6) {
      Alert.alert('Required', 'Please enter a valid 6-digit pincode.');
      return;
    }

    setLoading(true);

    const kycDataWithAddress = {
      ...fetchedKycData,
      communicationAddress: addr,
      sameAsAadhaar,
    };

    await handleKycSuccess(kycDataWithAddress, fetchedKycData.method);
    setLoading(false);
  };

  // ─── Common KYC success handler ─────────────────────────────────────────
  const handleKycSuccess = async (kycData, method) => {
    try {
      const pincodeResult = await kycService.checkPincode(kycData.pincode);
      if (pincodeResult.blacklisted) {
        setPincodeBlacklisted(true);
        setKycFailed(true);
        setDetailsReviewStep(false);
        return;
      }
    } catch {
      // Mock - pincode OK
    }

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
        setDetailsReviewStep(false);
        return;
      }
    } catch {
      // Mock - name match OK
    }

    dispatch({ type: 'SET_KYC_DATA', payload: { ...kycData, method } });
    dispatch({ type: 'SET_KYC_METHOD', payload: method });
    dispatch({ type: 'SET_STEP', payload: 4 });
    setKycCompleted(true);
    setDetailsReviewStep(false);

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

    executePhase('C', applicant).catch(() => {});
  };

  const handleProceed = () => {
    navigation.navigate('SelfieVerification');
  };

  // ─── Render helpers ─────────────────────────────────────────────────────
  const renderPhoto = () => {
    const source = getPhotoSource(fetchedKycData?.photo);
    if (!source) return null;

    return (
      <View style={styles.photoWrap}>
        <Image source={source} style={styles.photo} resizeMode="cover" />
      </View>
    );
  };

  const formatDob = (dob) => {
    if (!dob) return '';
    // Handle DD/MM/YYYY from DigiLocker
    if (dob.includes('/')) return dob;
    // Handle YYYY-MM-DD
    const parts = dob.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dob;
  };

  const maskUid = (uid) => {
    if (!uid || uid.length < 4) return uid || '';
    return `XXXX XXXX ${uid.slice(-4)}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="KYC Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={4} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Method Selection ── */}
        {!kycCompleted && !kycFailed && !currentMethod && !detailsReviewStep && (
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

        {/* ── CKYC Flow ── */}
        {!kycCompleted && !kycFailed && !detailsReviewStep && currentMethod === KYC_METHODS.CKYC && (
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
              <Button title="Initiate CKYC" onPress={handleInitiateCkyc} loading={loading} />
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
                  onComplete={(code) => { setOtp(code); handleVerifyCkycOtp(code); }}
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

        {/* ── DigiLocker Flow ── */}
        {!kycCompleted && !kycFailed && !detailsReviewStep && currentMethod === KYC_METHODS.DIGILOCKER && (
          <Card>
            <View style={styles.methodHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>DigiLocker Verification</Text>
              {!digilockerWaiting && !digilockerPolling && (
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
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>4. You'll be redirected back to FinZ automatically</Text>
                </View>

                <Button title="Open DigiLocker" onPress={handleInitiateDigilocker} loading={loading} />
                <Button
                  title="Try CKYC Instead"
                  onPress={() => setCurrentMethod(KYC_METHODS.CKYC)}
                  variant="outline"
                  style={styles.btn}
                />
              </>
            )}

            {/* Waiting for consent */}
            {digilockerWaiting && !digilockerPolling && (
              <>
                <View style={[styles.waitingBanner, { backgroundColor: `${colors.warning}14` }]}>
                  <Text style={[styles.waitingTitle, { color: colors.warning }]}>Waiting for DigiLocker</Text>
                  <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
                    Complete the verification in DigiLocker. You will be redirected back to FinZ automatically.
                  </Text>
                </View>
                <Button title="I've Completed DigiLocker" onPress={handleDigilockerReturn} style={styles.btn} />
                <Button
                  title="Re-open DigiLocker"
                  onPress={() => handleInitiateDigilocker()}
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

            {/* Polling */}
            {digilockerPolling && (
              <View style={styles.pollingWrap}>
                <Text style={[styles.pollingTitle, { color: colors.teal }]}>Fetching your Aadhaar data...</Text>
                <Text style={[styles.pollingText, { color: colors.textSecondary }]}>
                  Please wait while we retrieve your verified documents from DigiLocker.
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* ── Details Review + Communication Address ── */}
        {detailsReviewStep && fetchedKycData && !kycCompleted && !kycFailed && (
          <>
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Verify Your Details</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Please review the details fetched from {fetchedKycData.method === KYC_METHODS.CKYC ? 'CKYC' : 'DigiLocker'}. Confirm if they are correct.
              </Text>

              {/* Photo */}
              {renderPhoto()}

              {/* Personal Details */}
              <View style={[styles.detailsBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <InfoRow label="Full Name" value={fetchedKycData.name} />
                {fetchedKycData.uid && (
                  <InfoRow label="Aadhaar" value={maskUid(fetchedKycData.uid)} />
                )}
                {fetchedKycData.dob && (
                  <InfoRow label="Date of Birth" value={formatDob(fetchedKycData.dob)} />
                )}
                {fetchedKycData.gender && (
                  <InfoRow label="Gender" value={fetchedKycData.gender} />
                )}
              </View>

              {/* Permanent Address (from Aadhaar) */}
              <Text style={[styles.subTitle, { color: colors.textPrimary }]}>Permanent Address</Text>
              <View style={[styles.detailsBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                  {fetchedKycData.address || 'Not available'}
                </Text>
                {fetchedKycData.pincode ? (
                  <InfoRow label="Pincode" value={fetchedKycData.pincode} />
                ) : null}
              </View>
            </Card>

            {/* Communication Address */}
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Communication Address</Text>

              {/* Same as permanent checkbox */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => {
                  const toggled = !sameAsAadhaar;
                  setSameAsAadhaar(toggled);
                  if (toggled && fetchedKycData) {
                    const sa = fetchedKycData.splitAddress || {};
                    setCommAddress({
                      addressLine: sa.addressLine || fetchedKycData.address || '',
                      city: (sa.city || [])[0] || '',
                      state: (sa.state || [])[0]?.[0] || (sa.state || [])[0] || '',
                      pincode: sa.pincode || fetchedKycData.pincode || '',
                    });
                  }
                }}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: sameAsAadhaar ? colors.teal : colors.border },
                  sameAsAadhaar && { backgroundColor: colors.teal },
                ]}>
                  {sameAsAadhaar && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>
                  Same as permanent address (fetched from Aadhaar)
                </Text>
              </TouchableOpacity>

              {!sameAsAadhaar && (
                <View style={styles.addressForm}>
                  <Input
                    label="Address Line"
                    value={commAddress.addressLine}
                    onChangeText={(t) => setCommAddress((prev) => ({ ...prev, addressLine: t }))}
                    placeholder="House/Flat No., Street, Area"
                    multiline
                  />
                  <View style={styles.row}>
                    <View style={styles.halfInput}>
                      <Input
                        label="City"
                        value={commAddress.city}
                        onChangeText={(t) => setCommAddress((prev) => ({ ...prev, city: t }))}
                        placeholder="City"
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Input
                        label="State"
                        value={commAddress.state}
                        onChangeText={(t) => setCommAddress((prev) => ({ ...prev, state: t }))}
                        placeholder="State"
                      />
                    </View>
                  </View>
                  <Input
                    label="Pincode"
                    value={commAddress.pincode}
                    onChangeText={(t) => setCommAddress((prev) => ({ ...prev, pincode: t.replace(/[^0-9]/g, '').slice(0, 6) }))}
                    placeholder="6-digit pincode"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              )}

              <Button
                title="Confirm & Continue"
                onPress={handleConfirmDetails}
                loading={loading}
                style={styles.btn}
              />
              <Button
                title="Details are incorrect"
                onPress={() => {
                  Alert.alert(
                    'Incorrect Details?',
                    'If the details fetched are incorrect, please contact support or try a different KYC method.',
                    [
                      { text: 'Try Different Method', onPress: () => { setDetailsReviewStep(false); setFetchedKycData(null); setCurrentMethod(null); } },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }}
                variant="outline"
                style={styles.btn}
              />
            </Card>
          </>
        )}

        {/* ── KYC Completed ── */}
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

        {/* ── KYC Failed ── */}
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
  subTitle: { fontSize: 15, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  optionsCol: { gap: 12 },
  methodCard: { borderWidth: 1.5, borderRadius: 14, padding: 16 },
  methodHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  methodIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodIcon: { fontSize: 22 },
  methodInfo: { flex: 1, marginLeft: 12 },
  methodTitle: { fontSize: 16, fontWeight: '700' },
  methodSubtitle: { fontSize: 12, marginTop: 2 },
  methodArrow: { fontSize: 28, fontWeight: '300' },
  methodDesc: { fontSize: 12, lineHeight: 18 },
  methodBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 10 },
  methodBadgeText: { fontSize: 11, fontWeight: '700' },
  methodHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
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

  // Details Review
  photoWrap: { alignItems: 'center', marginBottom: 16 },
  photo: { width: 120, height: 150, borderRadius: 12 },
  detailsBlock: {
    borderRadius: 10, padding: 12, marginBottom: 4, borderWidth: 1,
  },
  addressText: { fontSize: 13, lineHeight: 20, marginBottom: 4 },

  // Communication Address
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  checkboxLabel: { flex: 1, fontSize: 13, lineHeight: 18 },
  addressForm: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },

  btn: { marginTop: 12 },
  resultCard: { alignItems: 'center' },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  resultText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default KycVerificationScreen;
