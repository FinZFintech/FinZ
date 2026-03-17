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
  Modal,
  Platform,
} from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import Input from '../../../components/common/Input';
import OtpInput from '../../../components/common/OtpInput';
import * as DocumentPicker from 'expo-document-picker';
import { KYC_METHODS } from '../../../config/constants';
import { useTheme } from '../../../store/ThemeContext';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 45; // ~3 minutes
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

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
  const digilockerPopupRef = useRef(null);
  const popupCheckRef = useRef(null);

  // Session timeout (15 min for DigiLocker / Aadhaar XML)
  const sessionTimerRef = useRef(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Details review state — shown after KYC data is fetched
  const [fetchedKycData, setFetchedKycData] = useState(null);
  const [detailsReviewStep, setDetailsReviewStep] = useState(false);

  // Success popup
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const loanAmount = state.studentDetails?.balanceFee || 0;
  const requiresVkyc = loanAmount >= 60000;

  // Communication address state
  const [sameAsAadhaar, setSameAsAadhaar] = useState(true);
  const [commAddress, setCommAddress] = useState({
    addressLine: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Aadhaar XML upload state
  const [aadhaarXmlFile, setAadhaarXmlFile] = useState(null);
  const [aadhaarShareCode, setAadhaarShareCode] = useState('');

  // Address correction flow (details incorrect)
  const [addressCorrectionStep, setAddressCorrectionStep] = useState(false);
  const [correctedAddress, setCorrectedAddress] = useState({ addressLine: '', city: '', state: '', pincode: '' });
  const [addressProofFile, setAddressProofFile] = useState(null);
  const [addressCorrectionErrors, setAddressCorrectionErrors] = useState({});

  // Check if there's a pending address review from persisted state
  const addressUnderReview = state.addressCorrection?.status === 'pending';
  const addressReviewApproved = state.addressCorrection?.status === 'approved';
  const addressReviewRejected = state.addressCorrection?.status === 'rejected';

  const tealBg = `${colors.teal}14`;
  const errorBg = `${colors.error}14`;
  const warningBg = `${colors.warning || '#F5B731'}14`;

  /**
   * Start 15-minute session timeout for DigiLocker / Aadhaar XML flows.
   * On expiry, cancels any in-flight activity and shows session expired screen.
   */
  const startSessionTimer = () => {
    clearSessionTimer();
    sessionTimerRef.current = setTimeout(() => {
      // Cancel any polling / waiting
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      setDigilockerPolling(false);
      setDigilockerWaiting(false);
      setDigilockerRequestId(null);
      setLoading(false);
      setSessionExpired(true);
    }, SESSION_TIMEOUT_MS);
  };

  const clearSessionTimer = () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  };

  /**
   * Reset session expiry and go back to KYC method selection.
   */
  const handleSessionExpiredRetry = () => {
    setSessionExpired(false);
    setCurrentMethod(null);
    setOtpSent(false);
    setOtp('');
    setKycFailed(false);
    setKycErrorMsg('');
    setFetchedKycData(null);
    setDetailsReviewStep(false);
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
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
      Alert.alert('Error', 'Failed to initiate CKYC. Please try again or use DigiLocker.');
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
      Alert.alert('Error', 'CKYC verification failed. Please try again or use DigiLocker.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Aadhaar XML Upload Flow ────────────────────────────────────────────
  const handleAadhaarXmlUpload = async () => {
    if (!aadhaarXmlFile) {
      Alert.alert('Required', 'Please select your Aadhaar XML or ZIP file.');
      return;
    }
    if (!aadhaarShareCode || aadhaarShareCode.length !== 4) {
      Alert.alert('Required', 'Please enter the 4-digit share code you used when downloading the XML.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: aadhaarXmlFile.uri,
        name: aadhaarXmlFile.name || 'aadhaar.xml',
        type: aadhaarXmlFile.mimeType || 'application/xml',
      });
      formData.append('shareCode', aadhaarShareCode);

      const result = await kycService.uploadAadhaarXml(formData);
      if (!result || !result.verified) {
        Alert.alert('Error', 'Aadhaar XML verification failed. Please check the file and share code.');
        return;
      }
      // Build KYC data from XML result
      const kycData = {
        name: result.name,
        address: result.address,
        dob: result.dob,
        gender: result.gender,
        uid: result.uid,
        photo: result.photo || '',
        pincode: result.pincode || '',
        splitAddress: result.splitAddress || null,
      };
      showDetailsReview(kycData, KYC_METHODS.AADHAAR_XML);
    } catch {
      Alert.alert('Error', 'Failed to process Aadhaar XML. Please try again or use a different method.');
    } finally {
      setLoading(false);
    }
  };

  // ─── DigiLocker Flow ────────────────────────────────────────────────────
  const handleInitiateDigilocker = async () => {
    setLoading(true);
    setKycErrorMsg('');
    try {
      // On web, use a callback page that auto-closes the popup
      const isWeb = Platform.OS === 'web';
      const redirectUrl = isWeb
        ? `${window.location.origin}/digilocker-callback.html`
        : 'finz://kyc/digilocker-callback';

      const { url, requestId } = await kycService.initiateDigilocker({
        internalId: state.borrowerDetails?.phone || '',
        redirectUrl,
      });

      if (!url || !requestId) {
        throw new Error('DigiLocker service returned an invalid response. Please try again.');
      }

      setDigilockerRequestId(requestId);
      setDigilockerWaiting(true);
      setLoading(false);
      startSessionTimer();

      if (isWeb) {
        // Open DigiLocker in a popup window
        const popup = window.open(url, 'digilocker', 'width=600,height=700,scrollbars=yes');
        digilockerPopupRef.current = popup;

        // Monitor popup — when it closes, auto-poll for results
        if (popupCheckRef.current) clearInterval(popupCheckRef.current);
        popupCheckRef.current = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(popupCheckRef.current);
            popupCheckRef.current = null;
            digilockerPopupRef.current = null;
            console.log('[KycVerification] DigiLocker popup closed, polling for data');
            pollForDigilockerData(requestId);
          }
        }, 500);
      } else {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Unable to open DigiLocker. Please try again.');
          setDigilockerWaiting(false);
        }
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
    if (popupCheckRef.current) clearInterval(popupCheckRef.current);
    if (digilockerPopupRef.current && !digilockerPopupRef.current.closed) {
      digilockerPopupRef.current.close();
    }
    digilockerPopupRef.current = null;
    popupCheckRef.current = null;
    clearSessionTimer();
    setDigilockerPolling(false);
    setDigilockerWaiting(false);
    setDigilockerRequestId(null);
    setLoading(false);
  };

  // ─── Details Review Step ────────────────────────────────────────────────
  const showDetailsReview = (kycData, method) => {
    clearSessionTimer();
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
      // Pincode check failed — allow to proceed (non-blocking)
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
      // Name match check failed — allow to proceed (non-blocking)
    }

    dispatch({ type: 'SET_KYC_DATA', payload: { ...kycData, method } });
    dispatch({ type: 'SET_KYC_METHOD', payload: method });
    dispatch({ type: 'SET_STEP', payload: 4 });
    setKycCompleted(true);
    setDetailsReviewStep(false);
    setSuccessModalVisible(true);

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
    setSuccessModalVisible(false);
    if (requiresVkyc) {
      // Loan >= 60K: skip selfie, go directly to eNACH/eSign + VKYC in parallel
      navigation.navigate('EnachEsign');
    } else {
      // Loan < 60K: selfie verification
      navigation.navigate('SelfieVerification');
    }
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
        {!kycCompleted && !kycFailed && !sessionExpired && !currentMethod && !detailsReviewStep && (
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

              <TouchableOpacity
                style={[styles.methodCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setCurrentMethod(KYC_METHODS.AADHAAR_XML)}
              >
                <View style={styles.methodHeader}>
                  <View style={[styles.methodIconWrap, { backgroundColor: `${colors.warning || '#F5B731'}20` }]}>
                    <Text style={styles.methodIcon}>📄</Text>
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>Aadhaar XML</Text>
                    <Text style={[styles.methodSubtitle, { color: colors.textSecondary }]}>Upload Aadhaar XML / ZIP</Text>
                  </View>
                  <Text style={[styles.methodArrow, { color: colors.textSecondary }]}>›</Text>
                </View>
                <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
                  Download your Aadhaar XML from UIDAI and upload it here. Use this if CKYC and DigiLocker are not working.
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* ── CKYC Flow ── */}
        {!kycCompleted && !kycFailed && !sessionExpired && !detailsReviewStep && currentMethod === KYC_METHODS.CKYC && (
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
        {!kycCompleted && !kycFailed && !sessionExpired && !detailsReviewStep && currentMethod === KYC_METHODS.DIGILOCKER && (
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
                  Your documents will be fetched securely by FinZ Finance Pvt Ltd.
                </Text>

                <View style={[styles.stepsCard, { backgroundColor: `${colors.primary}08` }]}>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>1. You will be redirected to DigiLocker</Text>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>2. Login with your Aadhaar number</Text>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>3. Approve consent to share documents with FinZ Finance</Text>
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

        {/* ── Aadhaar XML Upload Flow ── */}
        {!kycCompleted && !kycFailed && !sessionExpired && !detailsReviewStep && !addressCorrectionStep && currentMethod === KYC_METHODS.AADHAAR_XML && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upload Aadhaar XML</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Upload your Aadhaar XML or ZIP file downloaded from the UIDAI website (https://myaadhaar.uidai.gov.in). You will also need the 4-digit share code you set during download.
            </Text>

            <View style={[styles.instructions, { backgroundColor: `${colors.primary || colors.teal}08` }]}>
              <Text style={[styles.instructionTitle, { color: colors.textPrimary }]}>How to get your Aadhaar XML:</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>1. Visit myaadhaar.uidai.gov.in</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>2. Login with your Aadhaar and OTP</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>3. Go to "Download Aadhaar" → "Aadhaar Paperless Offline e-KYC"</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>4. Set a 4-digit share code and download the ZIP/XML file</Text>
            </View>

            {/* File Picker */}
            {aadhaarXmlFile ? (
              <View style={[styles.fileChip, { borderColor: colors.teal, backgroundColor: tealBg }]}>
                <Text style={[styles.fileChipText, { color: colors.teal }]} numberOfLines={1}>
                  {aadhaarXmlFile.name}
                </Text>
                <TouchableOpacity onPress={() => setAadhaarXmlFile(null)}>
                  <Text style={[styles.fileChipRemove, { color: colors.error }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Button
                title="Select Aadhaar XML / ZIP File"
                variant="outline"
                icon="📎"
                onPress={async () => {
                  try {
                    const result = await DocumentPicker.getDocumentAsync({
                      type: ['application/xml', 'text/xml', 'application/zip', 'application/x-zip-compressed', '*/*'],
                    });
                    if (!result.canceled && result.assets?.[0]) {
                      setAadhaarXmlFile(result.assets[0]);
                    }
                  } catch {
                    Alert.alert('Error', 'Could not pick file.');
                  }
                }}
              />
            )}

            {/* Share Code */}
            <Input
              label="4-Digit Share Code"
              value={aadhaarShareCode}
              onChangeText={(t) => setAadhaarShareCode(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="Enter share code"
              keyboardType="number-pad"
              maxLength={4}
              style={{ marginTop: 12 }}
            />

            <Button
              title="Verify Aadhaar XML"
              onPress={handleAadhaarXmlUpload}
              loading={loading}
              disabled={!aadhaarXmlFile || aadhaarShareCode.length !== 4}
              style={styles.btn}
            />
            <Button
              title="Choose Different Method"
              onPress={() => { setCurrentMethod(null); setAadhaarXmlFile(null); setAadhaarShareCode(''); }}
              variant="outline"
              style={styles.btn}
            />
          </Card>
        )}

        {/* ── Details Review + Communication Address ── */}
        {detailsReviewStep && fetchedKycData && !kycCompleted && !kycFailed && !sessionExpired && (
          <>
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Verify Your Details</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Please review the details fetched from {fetchedKycData.method === KYC_METHODS.CKYC ? 'CKYC' : fetchedKycData.method === KYC_METHODS.AADHAAR_XML ? 'Aadhaar XML' : 'DigiLocker'}. Confirm if they are correct.
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
                  setAddressCorrectionStep(true);
                  setDetailsReviewStep(false);
                }}
                variant="outline"
                style={styles.btn}
              />
            </Card>
          </>
        )}

        {/* ── Address Correction (Details Incorrect) ── */}
        {addressCorrectionStep && fetchedKycData && !kycCompleted && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Update Your Address</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              If the address fetched from KYC is incorrect, please provide your current address and upload a valid address proof. Your application will be sent for review by our credit team.
            </Text>

            <Input
              label="Address Line"
              value={correctedAddress.addressLine}
              onChangeText={(t) => setCorrectedAddress((p) => ({ ...p, addressLine: t }))}
              placeholder="House/Flat No., Street, Area"
              multiline
              error={addressCorrectionErrors.addressLine}
            />
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Input
                  label="City"
                  value={correctedAddress.city}
                  onChangeText={(t) => setCorrectedAddress((p) => ({ ...p, city: t }))}
                  placeholder="City"
                  error={addressCorrectionErrors.city}
                />
              </View>
              <View style={styles.halfInput}>
                <Input
                  label="State"
                  value={correctedAddress.state}
                  onChangeText={(t) => setCorrectedAddress((p) => ({ ...p, state: t }))}
                  placeholder="State"
                  error={addressCorrectionErrors.state}
                />
              </View>
            </View>
            <Input
              label="Pincode"
              value={correctedAddress.pincode}
              onChangeText={(t) => setCorrectedAddress((p) => ({ ...p, pincode: t.replace(/[^0-9]/g, '').slice(0, 6) }))}
              placeholder="6-digit pincode"
              keyboardType="number-pad"
              maxLength={6}
              error={addressCorrectionErrors.pincode}
            />

            {/* Address Proof Upload */}
            <Text style={[styles.subTitle, { color: colors.textPrimary, marginTop: 12 }]}>Address Proof</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Upload any one: Electricity bill, Gas bill, Rent agreement, Passport, Voter ID, or Bank statement (not older than 3 months).
            </Text>
            {addressProofFile ? (
              <View style={[styles.fileChip, { borderColor: colors.teal, backgroundColor: tealBg }]}>
                <Text style={[styles.fileChipText, { color: colors.teal }]} numberOfLines={1}>
                  {addressProofFile.name}
                </Text>
                <TouchableOpacity onPress={() => setAddressProofFile(null)}>
                  <Text style={[styles.fileChipRemove, { color: colors.error }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Button
                title="Upload Address Proof"
                variant="outline"
                icon="📎"
                onPress={async () => {
                  try {
                    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
                    if (!result.canceled && result.assets?.[0]) {
                      setAddressProofFile(result.assets[0]);
                    }
                  } catch {
                    Alert.alert('Error', 'Could not pick file');
                  }
                }}
              />
            )}
            {addressCorrectionErrors.proof && (
              <Text style={[styles.errorText, { color: colors.error }]}>{addressCorrectionErrors.proof}</Text>
            )}

            <Button
              title="Submit for Review"
              onPress={() => {
                const errs = {};
                if (!correctedAddress.addressLine || correctedAddress.addressLine.trim().length < 5) errs.addressLine = 'Address is required (min 5 chars)';
                if (!correctedAddress.city || correctedAddress.city.trim().length < 2) errs.city = 'City is required';
                if (!correctedAddress.state || correctedAddress.state.trim().length < 2) errs.state = 'State is required';
                if (!correctedAddress.pincode || correctedAddress.pincode.length !== 6) errs.pincode = 'Valid 6-digit pincode required';
                if (!addressProofFile) errs.proof = 'Please upload an address proof document';
                setAddressCorrectionErrors(errs);
                if (Object.keys(errs).length > 0) return;

                // Save KYC data + address correction as pending review
                dispatch({
                  type: 'SET_KYC_DATA',
                  payload: { ...fetchedKycData, method: fetchedKycData.method || currentMethod, detailsIncorrect: true },
                });
                dispatch({ type: 'SET_KYC_METHOD', payload: fetchedKycData.method || currentMethod });
                dispatch({
                  type: 'SET_ADDRESS_CORRECTION',
                  payload: {
                    address: correctedAddress.addressLine,
                    city: correctedAddress.city,
                    state: correctedAddress.state,
                    pincode: correctedAddress.pincode,
                    proofUri: addressProofFile.uri,
                    proofName: addressProofFile.name,
                    status: 'pending',
                    submittedAt: new Date().toISOString(),
                  },
                });

                setAddressCorrectionStep(false);
                setKycCompleted(true);
                Alert.alert(
                  'Submitted for Review',
                  'Your updated address and proof have been submitted. Our credit team will review and get back to you. You cannot proceed until the review is complete.',
                );
              }}
              style={styles.btn}
              loading={loading}
            />
            <Button
              title="Go Back to Details"
              onPress={() => {
                setAddressCorrectionStep(false);
                setDetailsReviewStep(true);
              }}
              variant="outline"
              style={styles.btn}
            />
          </Card>
        )}

        {/* ── Address Review Status (pending / approved / rejected) ── */}
        {(addressUnderReview || addressReviewRejected) && !addressCorrectionStep && !detailsReviewStep && (
          <Card>
            {addressUnderReview && (
              <View style={[styles.reviewBanner, { backgroundColor: warningBg }]}>
                <Text style={styles.reviewIcon}>⏳</Text>
                <Text style={[styles.reviewTitle, { color: colors.warning || '#F5B731' }]}>Address Under Review</Text>
                <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                  Your updated address and proof document are being reviewed by our credit team. You will be notified once the review is complete. You cannot proceed to further steps until the review is approved.
                </Text>
                <View style={[styles.reviewDetail, { borderColor: colors.border }]}>
                  <InfoRow label="Address" value={state.addressCorrection?.address} />
                  <InfoRow label="City" value={state.addressCorrection?.city} />
                  <InfoRow label="Pincode" value={state.addressCorrection?.pincode} />
                  <InfoRow label="Proof" value={state.addressCorrection?.proofName || 'Uploaded'} />
                </View>
                <Button
                  title="Simulate: Approve Review"
                  onPress={() => {
                    dispatch({
                      type: 'SET_ADDRESS_CORRECTION',
                      payload: { ...state.addressCorrection, status: 'approved' },
                    });
                    Alert.alert('Approved', 'Address review approved by credit team. You may now proceed.');
                  }}
                  style={styles.btn}
                />
              </View>
            )}
            {addressReviewRejected && (
              <View style={[styles.reviewBanner, { backgroundColor: errorBg }]}>
                <Text style={styles.reviewIcon}>✕</Text>
                <Text style={[styles.reviewTitle, { color: colors.error }]}>Address Review Rejected</Text>
                <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                  Your address correction was rejected by the credit team. Please try a different KYC method or contact support.
                </Text>
                <Button
                  title="Try Different Method"
                  onPress={() => {
                    setKycCompleted(false);
                    setFetchedKycData(null);
                    setCurrentMethod(null);
                    dispatch({ type: 'SET_ADDRESS_CORRECTION', payload: null });
                    dispatch({ type: 'SET_KYC_DATA', payload: null });
                    dispatch({ type: 'SET_KYC_METHOD', payload: null });
                  }}
                  variant="outline"
                  style={styles.btn}
                />
              </View>
            )}
          </Card>
        )}

        {/* ── Address Review Approved → Continue ── */}
        {addressReviewApproved && !successModalVisible && (
          <Card>
            <View style={[styles.reviewBanner, { backgroundColor: tealBg }]}>
              <Text style={styles.reviewIcon}>✓</Text>
              <Text style={[styles.reviewTitle, { color: colors.teal }]}>Address Verified</Text>
              <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                Your updated address has been approved by the credit team. You can now continue your application.
              </Text>
              <Button
                title={requiresVkyc ? 'Continue to eNACH & eSign' : 'Continue to Selfie Verification'}
                onPress={() => {
                  dispatch({ type: 'SET_STEP', payload: 4 });
                  if (requiresVkyc) {
                    navigation.navigate('EnachEsign');
                  } else {
                    navigation.navigate('SelfieVerification');
                  }
                }}
                style={styles.btn}
              />
            </View>
          </Card>
        )}

        {/* ── Session Expired ── */}
        {sessionExpired && (
          <Card>
            <View style={styles.sessionExpiredWrap}>
              <Text style={styles.sessionExpiredIcon}>⏱️</Text>
              <Text style={[styles.sessionExpiredTitle, { color: colors.error }]}>Session Expired</Text>
              <Text style={[styles.sessionExpiredText, { color: colors.textSecondary }]}>
                Your KYC session has timed out after 15 minutes of inactivity.
                Please re-initiate the KYC verification process.
              </Text>
              <Button
                title="Re-initiate KYC"
                onPress={handleSessionExpiredRetry}
                style={styles.sessionExpiredBtn}
              />
            </View>
          </Card>
        )}

        {/* ── KYC Failed ── */}
        {kycFailed && !sessionExpired && (
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

      {/* ── KYC Success Popup ── */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={styles.modalSuccessIcon}>✓</Text>
            <Text style={[styles.modalTitle, { color: colors.teal }]}>KYC Verification Done!</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Your identity has been successfully verified
              via {currentMethod === KYC_METHODS.CKYC ? 'CKYC' : 'DigiLocker'}.
            </Text>
            {requiresVkyc && (
              <View style={[styles.modalNote, { backgroundColor: `${colors.warning}14` }]}>
                <Text style={[styles.modalNoteText, { color: colors.warning }]}>
                  Since your loan is ≥ ₹60,000, video KYC (VCIP) will be required along with eNACH & eSign as per RBI guidelines.
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.teal }]}
              onPress={handleProceed}
            >
              <Text style={[styles.modalButtonText, { color: colors.background }]}>
                {requiresVkyc ? 'Continue to eNACH & eSign' : 'Continue to Selfie Verification'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  // Success Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340 },
  modalSuccessIcon: { fontSize: 56, color: '#4AEDC4', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  modalNote: { padding: 12, borderRadius: 8, marginBottom: 16, width: '100%' },
  modalNoteText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  modalButton: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, width: '100%', alignItems: 'center' },
  modalButtonText: { fontWeight: '700', fontSize: 15 },

  // Session Expired
  sessionExpiredWrap: { alignItems: 'center', paddingVertical: 20 },
  sessionExpiredIcon: { fontSize: 56, marginBottom: 12 },
  sessionExpiredTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  sessionExpiredText: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  sessionExpiredBtn: { width: '100%' },

  resultCard: { alignItems: 'center' },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  resultText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bottomSpacer: { height: 100 },

  // Address correction & review styles
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 8,
    gap: 8,
  },
  fileChipText: { flex: 1, fontSize: 13, fontWeight: '600' },
  fileChipRemove: { fontSize: 18, fontWeight: '700', paddingLeft: 8 },
  errorText: { fontSize: 12, marginTop: 2, marginBottom: 4 },
  reviewBanner: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  reviewIcon: { fontSize: 40, marginBottom: 8 },
  reviewTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  reviewText: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  reviewDetail: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 12,
  },
});

export default KycVerificationScreen;
