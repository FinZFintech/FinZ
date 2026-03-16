import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useTheme } from '../../../store/ThemeContext';

const SelfieVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const webViewRef = useRef(null);

  // Flow states: 'intro' → 'loading' → 'liveness' → 'verifying' → 'result'
  const [step, setStep] = useState('intro');
  const [livenessUrl, setLivenessUrl] = useState('');
  const [livenessToken, setLivenessToken] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const kycPhoto = state.kycData?.photo;

  /**
   * Resolve KYC photo to a publicly accessible URL for Signzy matchImage.
   * If the photo is already a URL, use it directly.
   * If it's base64, convert to a data URI that Signzy can process.
   */
  const getMatchImageUrl = useCallback(() => {
    if (!kycPhoto) return null;
    if (kycPhoto.startsWith('http://') || kycPhoto.startsWith('https://')) {
      return kycPhoto;
    }
    if (kycPhoto.startsWith('data:image')) {
      return kycPhoto;
    }
    // Raw base64 — wrap as data URI
    return `data:image/jpeg;base64,${kycPhoto}`;
  }, [kycPhoto]);

  /**
   * Step 1: Call createUrl to get a liveness verification URL from Signzy.
   */
  const handleStartLiveness = async () => {
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
      });

      if (!response.videoUrl || !response.token) {
        throw new Error('Invalid response from liveness service');
      }

      setLivenessToken(response.token);
      setLivenessUrl(response.videoUrl);
      setStep('liveness');
    } catch (err) {
      console.log('[SelfieVerification] createUrl error:', err.message);
      setError(err.message || 'Failed to start selfie verification. Please try again.');
      setStep('intro');
    }
  };

  /**
   * Step 2: Handle WebView messages — listen for "Verification Done".
   */
  const handleWebViewMessage = async (event) => {
    const message = event.nativeEvent.data;
    console.log('[SelfieVerification] WebView message:', message);

    if (message === 'Verification Done') {
      setStep('verifying');
      await fetchLivenessResults();
    }
  };

  /**
   * Step 3: Fetch liveness results from Signzy getData API.
   */
  const fetchLivenessResults = async () => {
    try {
      const data = await kycService.getLivenessData(livenessToken);
      setResult(data);

      if (data.status && data.faceMatch?.verified && data.passiveLiveliness?.liveness) {
        // Selfie verified — store in context
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
      } else {
        // Verification failed
        setStep('result');
      }
    } catch (err) {
      console.log('[SelfieVerification] getData error:', err.message);
      setError(err.message || 'Failed to fetch verification results.');
      setStep('intro');
    }
  };

  const isVerified = result?.status && result?.faceMatch?.verified && result?.passiveLiveliness?.liveness;

  const handleRetry = () => {
    setResult(null);
    setError('');
    setLivenessUrl('');
    setLivenessToken('');
    setStep('intro');
  };

  const handleProceed = () => {
    navigation.navigate('EnachEsign');
  };

  /**
   * JS to inject into WebView to forward postMessage events to React Native.
   */
  const injectedJs = `
    (function() {
      window.addEventListener('message', function(event) {
        if (event.data === 'Verification Done') {
          window.ReactNativeWebView.postMessage('Verification Done');
        }
      }, false);
      true;
    })();
  `;

  // ─── Render: Liveness WebView (full-screen overlay) ─────────────────
  if (step === 'liveness') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          title="Selfie Verification"
          onBack={() => {
            Alert.alert(
              'Cancel Verification?',
              'Are you sure you want to cancel the selfie verification?',
              [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', onPress: handleRetry },
              ],
            );
          }}
        />
        <WebView
          ref={webViewRef}
          source={{ uri: livenessUrl }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grant"
          injectedJavaScript={injectedJs}
          onMessage={handleWebViewMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.webViewLoading, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={colors.teal} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading camera...</Text>
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('[SelfieVerification] WebView error:', nativeEvent);
            setError('Camera failed to load. Please check permissions and try again.');
            setStep('intro');
          }}
        />
      </View>
    );
  }

  // ─── Render: Main screen (intro / loading / verifying / result) ─────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Selfie Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={5} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>

        {/* Intro / Start */}
        {step === 'intro' && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Live Selfie & Face Match</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              We'll verify your identity by capturing a live selfie and matching it against your KYC photo.
              Please ensure:
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
            {kycPhoto && (
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
            )}

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
  centeredSection: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 14, marginTop: 16 },
  // WebView
  webView: { flex: 1 },
  webViewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
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
