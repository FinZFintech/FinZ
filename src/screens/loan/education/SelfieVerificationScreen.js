import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useTheme } from '../../../store/ThemeContext';

const SelfieVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();

  // Flow states: 'intro' → 'loading' → 'liveness' → 'verifying' → 'result'
  const [step, setStep] = useState('intro');
  const [livenessUrl, setLivenessUrl] = useState('');
  const [livenessToken, setLivenessToken] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [captureTimestamp, setCaptureTimestamp] = useState(null);
  const iframeRef = useRef(null);

  const kycPhoto = state.kycData?.photo;
  const hasValidKycPhoto = !!(kycPhoto && (
    kycPhoto.startsWith('http') ||
    kycPhoto.startsWith('data:image') ||
    kycPhoto.length > 100
  ));
  const kycCompleted = !!(state.kycData && hasValidKycPhoto);

  // ─── Geolocation ────────────────────────────────────────────────────
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // ─── Listen for Signzy liveness WebView completion ──────────────────
  useEffect(() => {
    if (step !== 'liveness') return;

    const handleMessage = (event) => {
      try {
        const msg = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        console.log('[SelfieVerification] postMessage from liveness:', msg);

        // Signzy posts "Verification Done" or similar when user completes
        if (
          msg.includes('Verification Done') ||
          msg.includes('verification_done') ||
          msg.includes('SUCCESS') ||
          msg.includes('success')
        ) {
          setCaptureTimestamp(new Date());
          fetchLocation();
          handleFetchResults();
        }

        // Handle failure/error messages
        if (msg.includes('FAILED') || msg.includes('failed') || msg.includes('ERROR')) {
          setError('Liveness verification was not successful. Please try again.');
          setStep('intro');
        }
      } catch (e) {
        // Ignore non-parseable messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [step, livenessToken]);

  // ─── Start Liveness Flow ───────────────────────────────────────────
  const handleStartLiveness = async () => {
    if (!kycCompleted) {
      Alert.alert('KYC Required', 'Please complete KYC verification before selfie verification.');
      return;
    }

    setStep('loading');
    setError('');

    try {
      const matchImages = kycPhoto ? [kycPhoto] : [];
      const result = await kycService.createLivenessUrl(matchImages);

      if (!result.videoUrl) {
        throw new Error('Failed to get liveness verification URL');
      }

      setLivenessUrl(result.videoUrl);
      setLivenessToken(result.token);
      setStep('liveness');
    } catch (err) {
      console.log('[SelfieVerification] createLivenessUrl error:', err.message);
      setError(err.message || 'Failed to start verification. Please try again.');
      setStep('intro');
    }
  };

  // ─── Fetch Results ─────────────────────────────────────────────────
  const handleFetchResults = async () => {
    setStep('verifying');

    try {
      const data = await kycService.getLivenessData(livenessToken);
      console.log('[SelfieVerification] livenessGetData result:', JSON.stringify(data));

      const faceMatch = data.faceMatch || {};
      const liveness = data.passiveLiveliness || {};

      const result = {
        verified: faceMatch.verified ?? false,
        matchPercentage: faceMatch.matchPercentage || '0.00%',
        message: faceMatch.message || '',
        liveness: liveness.liveness ?? false,
        livenessScore: liveness.score ?? 0,
        capturedImage: data.capturedImage || '',
      };

      setVerificationResult(result);

      const isVerified = result.verified && result.liveness;

      dispatch({
        type: 'SET_SELFIE',
        payload: {
          uri: result.capturedImage || '',
          matched: result.verified,
          livenessVerified: result.liveness,
          faceMatchPercentage: result.matchPercentage,
          timestamp: captureTimestamp?.toISOString() || new Date().toISOString(),
          location: location
            ? `${location.latitude}, ${location.longitude}`
            : 'Unavailable',
        },
      });

      setStep('result');
    } catch (err) {
      console.log('[SelfieVerification] getLivenessData error:', err.message);
      setError(err.message || 'Failed to get verification results. Please try again.');
      setStep('intro');
    }
  };

  // ─── Manual "I'm Done" button (fallback if postMessage doesn't fire)
  const handleManualComplete = () => {
    setCaptureTimestamp(new Date());
    fetchLocation();
    handleFetchResults();
  };

  // ─── Reset ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setLivenessUrl('');
    setLivenessToken('');
    setVerificationResult(null);
    setCaptureTimestamp(null);
    setError('');
    setStep('intro');
  };

  const handleProceed = () => {
    navigation.navigate('EnachEsign');
  };

  // ─── Helpers ────────────────────────────────────────────────────────
  const formatTimestamp = (date) => {
    if (!date) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  };

  const isVerified = verificationResult?.verified && verificationResult?.liveness;

  // KYC photo source helper
  const kycPhotoSource = kycPhoto
    ? kycPhoto.startsWith('http')
      ? { uri: kycPhoto }
      : kycPhoto.startsWith('data:image')
        ? { uri: kycPhoto }
        : { uri: `data:image/jpeg;base64,${kycPhoto}` }
    : null;

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Selfie Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={5} />

      {/* ── Signzy Liveness WebView (iframe on web) ── */}
      {step === 'liveness' && livenessUrl && (
        <ScrollView style={styles.livenessContainer} contentContainerStyle={styles.livenessContentContainer}>
          <View style={styles.iframeWrapper}>
            {Platform.OS === 'web' ? (
              <iframe
                ref={iframeRef}
                src={livenessUrl}
                style={iframeStyle}
                allow="camera;microphone"
                title="Liveness Verification"
              />
            ) : (
              <Text style={[styles.infoText, { color: colors.textSecondary, padding: 20 }]}>
                WebView not available. Please use the web version.
              </Text>
            )}
          </View>
          {/* ── Guidance messages below selfie area ── */}
          <View style={[styles.guidanceContainer, { backgroundColor: colors.surface || '#F8F9FA' }]}>
            <View style={styles.guidanceRow}>
              <Text style={[styles.guidanceBullet, { color: colors.teal }]}>1.</Text>
              <Text style={[styles.guidanceText, { color: colors.textPrimary }]}>
                Keep your face inside the circle
              </Text>
            </View>
            <View style={styles.guidanceRow}>
              <Text style={[styles.guidanceBullet, { color: colors.teal }]}>2.</Text>
              <Text style={[styles.guidanceText, { color: colors.textPrimary }]}>
                Ensure your selfie overlaps the reference image properly
              </Text>
            </View>
            <View style={styles.guidanceRow}>
              <Text style={[styles.guidanceBullet, { color: colors.teal }]}>3.</Text>
              <Text style={[styles.guidanceText, { color: colors.textPrimary }]}>
                Your full face must be clearly visible — no part should be cut off
              </Text>
            </View>
          </View>

          <View style={styles.livenessControls}>
            <Button
              title="Cancel"
              onPress={handleReset}
              variant="outline"
              style={styles.controlBtn}
            />
            <Button
              title="I've Completed Verification"
              onPress={handleManualComplete}
              style={styles.controlBtn}
            />
          </View>
        </ScrollView>
      )}

      {/* ── Scrollable content for other steps ── */}
      {step !== 'liveness' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>

          {/* KYC Not Done Guard */}
          {!kycCompleted && step === 'intro' && (
            <Card>
              <View style={styles.guardSection}>
                <Text style={styles.guardIcon}>⚠️</Text>
                <Text style={[styles.guardTitle, { color: colors.error }]}>KYC Not Completed</Text>
                <Text style={[styles.guardText, { color: colors.textSecondary }]}>
                  You need to complete KYC verification before selfie verification.
                  Your Aadhaar photo is required for face matching.
                </Text>
                <Button
                  title="Go to KYC Verification"
                  onPress={() => navigation.navigate('KycVerification')}
                  variant="outline"
                  style={styles.guardBtn}
                />
              </View>
            </Card>
          )}

          {/* ── Intro / Start ── */}
          {kycCompleted && step === 'intro' && (
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Live Selfie & Face Match
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                We'll open a secure verification page where you'll take a live selfie.
                Your selfie will be verified for liveness and matched against your KYC photo.
                Please ensure:
              </Text>
              <View style={styles.tipsList}>
                {[
                  'Good lighting on your face',
                  'No hat, mask, or sunglasses',
                  'Look directly at the camera',
                  'Allow camera permission when prompted',
                ].map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <Text style={[styles.tipBullet, { color: colors.teal }]}>•</Text>
                    <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
                  </View>
                ))}
              </View>

              {/* KYC Photo Preview */}
              <View style={styles.kycPhotoSection}>
                <Text style={[styles.kycPhotoLabel, { color: colors.textSecondary }]}>
                  Your KYC Photo
                </Text>
                {kycPhotoSource && (
                  <Image
                    source={kycPhotoSource}
                    style={[styles.kycPhoto, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                )}
              </View>

              {error ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              ) : null}

              <Button
                title="Start Verification"
                onPress={handleStartLiveness}
                icon="📷"
                style={styles.startBtn}
              />
            </Card>
          )}

          {/* ── Loading: Creating liveness URL ── */}
          {step === 'loading' && (
            <Card>
              <View style={styles.centeredSection}>
                <ActivityIndicator size="large" color={colors.teal} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Preparing verification...
                </Text>
              </View>
            </Card>
          )}

          {/* ── Verifying: Fetching results ── */}
          {step === 'verifying' && (
            <Card>
              <View style={styles.centeredSection}>
                <ActivityIndicator size="large" color={colors.teal} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Fetching verification results...
                </Text>
              </View>
            </Card>
          )}

          {/* ── Result: Show verification scores ── */}
          {step === 'result' && verificationResult && (
            <>
              <Card>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultIcon}>{isVerified ? '✅' : '❌'}</Text>
                  <Text style={[styles.resultTitle, { color: isVerified ? colors.teal : colors.error }]}>
                    {isVerified ? 'Verification Successful' : 'Verification Failed'}
                  </Text>
                </View>

                {/* Captured selfie from liveness */}
                {verificationResult.capturedImage ? (
                  <View style={styles.resultImageContainer}>
                    <Image
                      source={{ uri: verificationResult.capturedImage }}
                      style={styles.resultImage}
                      resizeMode="cover"
                    />
                    <View style={styles.overlayContainer}>
                      <Text style={styles.overlayText}>FinZ Finance Pvt Ltd</Text>
                      {location && (
                        <Text style={styles.overlayText}>
                          Lat: {location.latitude}, Lng: {location.longitude}
                        </Text>
                      )}
                      {captureTimestamp && (
                        <Text style={styles.overlayText}>
                          {formatTimestamp(captureTimestamp)}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : null}

                {/* ── Verification Scores ── */}
                <Text style={[styles.scoresTitle, { color: colors.textPrimary }]}>
                  Verification Results
                </Text>

                <View style={styles.resultDetails}>
                  <InfoRow
                    label="Face Match"
                    value={verificationResult.verified ? 'Matched' : 'Not Matched'}
                    valueColor={verificationResult.verified ? colors.teal : colors.error}
                  />
                  <InfoRow
                    label="Match Score"
                    value={verificationResult.matchPercentage || 'N/A'}
                    valueColor={colors.textPrimary}
                  />
                  <InfoRow
                    label="Liveness"
                    value={verificationResult.liveness ? 'Live' : 'Not Live'}
                    valueColor={verificationResult.liveness ? colors.teal : colors.error}
                  />
                  <InfoRow
                    label="Liveness Score"
                    value={
                      verificationResult.livenessScore != null
                        ? `${(verificationResult.livenessScore * 100).toFixed(1)}%`
                        : 'N/A'
                    }
                    valueColor={colors.textPrimary}
                  />
                  <InfoRow
                    label="Timestamp"
                    value={captureTimestamp ? formatTimestamp(captureTimestamp) : 'N/A'}
                  />
                  <InfoRow
                    label="Location"
                    value={
                      location
                        ? `${location.latitude}, ${location.longitude}`
                        : 'Unavailable'
                    }
                  />
                </View>

                {verificationResult.message && !isVerified && (
                  <Text style={[styles.failureHint, { color: colors.textSecondary }]}>
                    {verificationResult.message}
                  </Text>
                )}

                {/* KYC Photo for reference */}
                {kycPhotoSource && (
                  <>
                    <Text style={[styles.scoresTitle, { color: colors.textPrimary, marginTop: 8 }]}>
                      KYC Reference Photo
                    </Text>
                    <View style={styles.kycPhotoSection}>
                      {kycPhotoSource && (
                        <Image
                          source={kycPhotoSource}
                          style={[styles.kycPhoto, { borderColor: colors.border }]}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  </>
                )}
              </Card>

              {isVerified ? (
                <Button
                  title="Continue to eNACH & eSign"
                  onPress={handleProceed}
                  style={styles.proceedBtn}
                />
              ) : (
                <Button
                  title="Retry Verification"
                  onPress={handleReset}
                  variant="outline"
                  icon="🔄"
                  style={styles.proceedBtn}
                />
              )}
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
      <FloatingAssistButton />
    </View>
  );
};

// Plain object for iframe (web only) — not a StyleSheet value
const iframeStyle = {
  width: '100%',
  height: '100%',
  border: 'none',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 12 },

  // Tips
  tipsList: { marginBottom: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  tipBullet: { fontSize: 16, marginRight: 8, marginTop: -1 },
  tipText: { fontSize: 13, lineHeight: 20, flex: 1 },

  // KYC Photo
  kycPhotoSection: { alignItems: 'center', marginBottom: 16 },
  kycPhotoLabel: {
    fontSize: 12, fontWeight: '600', marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  kycPhoto: { width: 100, height: 130, borderRadius: 10, borderWidth: 2 },

  // Error
  errorText: { fontSize: 13, marginBottom: 12, textAlign: 'center' },

  // Buttons
  startBtn: { marginTop: 8 },

  // Guard
  guardSection: { alignItems: 'center', paddingVertical: 24 },
  guardIcon: { fontSize: 48, marginBottom: 12 },
  guardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  guardText: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  guardBtn: { width: '100%' },

  // Liveness WebView
  livenessContainer: { flex: 1 },
  livenessContentContainer: { flexGrow: 1 },
  iframeWrapper: { height: 580, minHeight: 580 },
  guidanceContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  guidanceBullet: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
    minWidth: 18,
  },
  guidanceText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  livenessControls: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  controlBtn: { flex: 1 },

  // Loading
  centeredSection: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 14, marginTop: 16, textAlign: 'center' },

  // Overlay
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Result
  resultHeader: { alignItems: 'center', marginBottom: 16 },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 20, fontWeight: '700' },
  resultImageContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  scoresTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  resultDetails: { marginBottom: 16 },
  failureHint: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 4, marginBottom: 12 },

  proceedBtn: { marginTop: 16 },
  bottomSpacer: { height: 100 },
});

export default SelfieVerificationScreen;
