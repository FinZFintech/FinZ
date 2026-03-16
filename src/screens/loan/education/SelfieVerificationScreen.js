import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
  AppState,
} from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useTheme } from '../../../store/ThemeContext';

const REDIRECT_URL = 'finz://selfie/verification-callback';

const SelfieVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();

  // Flow states: 'intro' → 'loading' → 'browser' → 'verifying' → 'result'
  const [step, setStep] = useState('intro');
  const [livenessToken, setLivenessToken] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const appStateRef = useRef(AppState.currentState);

  const kycPhoto = state.kycData?.photo;
  const kycCompleted = !!(state.kycData && kycPhoto);

  /**
   * Resolve KYC photo to a URL for Signzy matchImage.
   */
  const getMatchImageUrl = useCallback(() => {
    if (!kycPhoto) return null;
    if (kycPhoto.startsWith('http://') || kycPhoto.startsWith('https://')) {
      return kycPhoto;
    }
    if (kycPhoto.startsWith('data:image')) {
      return kycPhoto;
    }
    return `data:image/jpeg;base64,${kycPhoto}`;
  }, [kycPhoto]);

  /**
   * When user returns from browser (app comes to foreground while in 'browser' step),
   * automatically fetch liveness results.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        step === 'browser' &&
        livenessToken
      ) {
        console.log('[SelfieVerification] App foregrounded, fetching results...');
        setStep('verifying');
        fetchLivenessResults();
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, [step, livenessToken]);

  /**
   * Listen for deep link redirect from Signzy liveness.
   */
  useEffect(() => {
    const handleDeepLink = ({ url }) => {
      if (url && url.startsWith('finz://selfie/verification-callback') && livenessToken) {
        console.log('[SelfieVerification] Deep link received, fetching results...');
        setStep('verifying');
        fetchLivenessResults();
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [livenessToken]);

  /**
   * Step 1: Call createUrl to get a liveness verification URL, then open in browser.
   */
  const handleStartLiveness = async () => {
    if (!kycCompleted) {
      Alert.alert('KYC Required', 'Please complete KYC verification before proceeding with selfie verification.');
      return;
    }

    setError('');
    setStep('loading');

    try {
      const matchImageUrl = getMatchImageUrl();
      if (!matchImageUrl) {
        setError('KYC photo not available. Please complete KYC verification first.');
        setStep('intro');
        return;
      }

      const response = await kycService.createLivenessUrl([matchImageUrl], {
        languageCode: 'en',
        faceMatchThreshold: 0.6,
        redirectUrl: REDIRECT_URL,
      });

      if (!response.videoUrl || !response.token) {
        throw new Error('Invalid response from liveness service');
      }

      setLivenessToken(response.token);

      // Open liveness URL in device browser
      const canOpen = await Linking.canOpenURL(response.videoUrl);
      if (canOpen) {
        await Linking.openURL(response.videoUrl);
        setStep('browser');
      } else {
        throw new Error('Unable to open verification page. Please try again.');
      }
    } catch (err) {
      console.log('[SelfieVerification] createUrl error:', err.message);
      setError(err.message || 'Failed to start selfie verification. Please try again.');
      setStep('intro');
    }
  };

  /**
   * Step 2: Fetch liveness results from Signzy getData API.
   */
  const fetchLivenessResults = async () => {
    try {
      const data = await kycService.getLivenessData(livenessToken);
      setResult(data);

      if (data.status && data.faceMatch?.verified && data.passiveLiveliness?.liveness) {
        dispatch({
          type: 'SET_SELFIE',
          payload: {
            uri: data.capturedImage || '',
            matched: true,
            livenessVerified: true,
            faceMatchPercentage: data.faceMatch.matchPercentage,
            token: livenessToken,
          },
        });
        setStep('result');
      } else if (data.isUsed === 0) {
        // Journey not yet completed — user may have come back before finishing
        setError('Selfie verification was not completed. Please try again.');
        setStep('intro');
      } else {
        setStep('result');
      }
    } catch (err) {
      console.log('[SelfieVerification] getData error:', err.message);
      setError(err.message || 'Failed to fetch verification results. Please try again.');
      setStep('intro');
    }
  };

  const isVerified = result?.status && result?.faceMatch?.verified && result?.passiveLiveliness?.liveness;

  const handleRetry = () => {
    setResult(null);
    setError('');
    setLivenessToken('');
    setStep('intro');
  };

  const handleProceed = () => {
    navigation.navigate('EnachEsign');
  };

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Selfie Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={5} />
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

        {/* Intro / Start */}
        {kycCompleted && step === 'intro' && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Live Selfie & Face Match</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              We'll verify your identity by capturing a live selfie and matching it against your KYC photo.
              You will be redirected to a secure verification page. Please ensure:
            </Text>
            <View style={styles.tipsList}>
              {['Good lighting on your face', 'No hat, mask, or sunglasses', 'Look directly at the camera', 'Keep your face within the frame'].map((tip) => (
                <View key={tip} style={styles.tipRow}>
                  <Text style={[styles.tipBullet, { color: colors.teal }]}>•</Text>
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* KYC Photo Preview */}
            <View style={styles.kycPhotoSection}>
              <Text style={[styles.kycPhotoLabel, { color: colors.textSecondary }]}>Your KYC Photo</Text>
              <Image
                source={
                  kycPhoto.startsWith('http')
                    ? { uri: kycPhoto }
                    : kycPhoto.startsWith('data:image')
                      ? { uri: kycPhoto }
                      : { uri: `data:image/jpeg;base64,${kycPhoto}` }
                }
                style={[styles.kycPhoto, { borderColor: colors.border }]}
                resizeMode="cover"
              />
            </View>

            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

            <Button
              title="Start Selfie Verification"
              onPress={handleStartLiveness}
              icon="📷"
              style={styles.startBtn}
            />
          </Card>
        )}

        {/* Loading: Creating liveness URL */}
        {step === 'loading' && (
          <Card>
            <View style={styles.centeredSection}>
              <ActivityIndicator size="large" color={colors.teal} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Preparing selfie verification...
              </Text>
            </View>
          </Card>
        )}

        {/* Browser: User is in external browser */}
        {step === 'browser' && (
          <Card>
            <View style={styles.centeredSection}>
              <Text style={styles.browserIcon}>🌐</Text>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: 'center' }]}>
                Verification In Progress
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary, textAlign: 'center' }]}>
                Complete the selfie verification in your browser.{'\n'}
                You'll be brought back here automatically once done.
              </Text>
              <ActivityIndicator size="small" color={colors.teal} style={{ marginBottom: 16 }} />
              <Button
                title="I've Completed Verification"
                onPress={() => {
                  setStep('verifying');
                  fetchLivenessResults();
                }}
                style={styles.startBtn}
              />
              <Button
                title="Cancel"
                onPress={handleRetry}
                variant="outline"
                style={styles.cancelBtn}
              />
            </View>
          </Card>
        )}

        {/* Verifying: Fetching results */}
        {step === 'verifying' && (
          <Card>
            <View style={styles.centeredSection}>
              <ActivityIndicator size="large" color={colors.teal} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Verifying your selfie...
              </Text>
            </View>
          </Card>
        )}

        {/* Result */}
        {step === 'result' && result && (
          <>
            <Card>
              <View style={styles.resultHeader}>
                <Text style={styles.resultIcon}>{isVerified ? '✅' : '❌'}</Text>
                <Text style={[styles.resultTitle, { color: isVerified ? colors.teal : colors.error }]}>
                  {isVerified ? 'Selfie Verified' : 'Verification Failed'}
                </Text>
              </View>

              <View style={styles.resultDetails}>
                <InfoRow
                  label="Face Match"
                  value={result.faceMatch?.verified ? 'Matched' : 'Not Matched'}
                  valueColor={result.faceMatch?.verified ? colors.teal : colors.error}
                />
                <InfoRow
                  label="Match Score"
                  value={result.faceMatch?.matchPercentage || 'N/A'}
                />
                <InfoRow
                  label="Liveness"
                  value={result.passiveLiveliness?.liveness ? 'Live' : 'Not Live'}
                  valueColor={result.passiveLiveliness?.liveness ? colors.teal : colors.error}
                />
                {result.additionalChecks && (
                  <>
                    <InfoRow
                      label="Checks Passed"
                      value={result.additionalChecks.status ? 'Yes' : 'No'}
                      valueColor={result.additionalChecks.status ? colors.teal : colors.error}
                    />
                    {result.additionalChecks.failedChecks?.length > 0 && (
                      <InfoRow
                        label="Issues"
                        value={result.additionalChecks.failedChecks.join(', ')}
                        valueColor={colors.warning}
                      />
                    )}
                  </>
                )}
              </View>

              {!isVerified && (
                <Text style={[styles.failureHint, { color: colors.textSecondary }]}>
                  {result.faceMatch?.message || 'Please ensure your face is clearly visible and matches your KYC photo.'}
                </Text>
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
                onPress={handleRetry}
                variant="outline"
                icon="🔄"
                style={styles.proceedBtn}
              />
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  tipsList: { marginBottom: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  tipBullet: { fontSize: 16, marginRight: 8, marginTop: -1 },
  tipText: { fontSize: 13, lineHeight: 20, flex: 1 },
  kycPhotoSection: { alignItems: 'center', marginBottom: 16 },
  kycPhotoLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  kycPhoto: { width: 100, height: 130, borderRadius: 10, borderWidth: 2 },
  errorText: { fontSize: 13, marginBottom: 12, textAlign: 'center' },
  startBtn: { marginTop: 8 },
  cancelBtn: { marginTop: 10 },
  centeredSection: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 14, marginTop: 16 },
  browserIcon: { fontSize: 48, marginBottom: 12 },
  // Guard
  guardSection: { alignItems: 'center', paddingVertical: 24 },
  guardIcon: { fontSize: 48, marginBottom: 12 },
  guardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  guardText: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  guardBtn: { width: '100%' },
  // Result
  resultHeader: { alignItems: 'center', marginBottom: 20 },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 20, fontWeight: '700' },
  resultDetails: { marginBottom: 16 },
  failureHint: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  proceedBtn: { marginTop: 16 },
  bottomSpacer: { height: 100 },
});

export default SelfieVerificationScreen;
