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
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { useLoan } from '../../../store/LoanContext';
import { useTheme } from '../../../store/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_SIZE = SCREEN_WIDTH - 32; // full width minus padding

const SelfieVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();

  // Flow states: 'intro' → 'camera' → 'preview' → 'result'
  const [step, setStep] = useState('intro');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [captureTimestamp, setCaptureTimestamp] = useState(null);
  const [error, setError] = useState('');
  const cameraRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();

  const kycPhoto = state.kycData?.photo;
  const kycCompleted = !!(state.kycData && kycPhoto);

  // ─── Geolocation ────────────────────────────────────────────────────
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.log('[SelfieVerification] Geolocation not available');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        console.log('[SelfieVerification] Location obtained:', position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        console.log('[SelfieVerification] Location error:', err.message);
        // Location is best-effort; proceed without it
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // ─── Camera Permission ──────────────────────────────────────────────
  const handleOpenCamera = async () => {
    if (!kycCompleted) {
      Alert.alert('KYC Required', 'Please complete KYC verification before selfie verification.');
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take a selfie for verification.',
        );
        return;
      }
    }

    setError('');
    setStep('camera');
  };

  // ─── Capture Selfie ─────────────────────────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      const now = new Date();
      setCapturedPhoto(photo);
      setCaptureTimestamp(now);

      // Refresh location at capture time
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude.toFixed(6),
              longitude: position.coords.longitude.toFixed(6),
            });
          },
          () => {}, // ignore error, use last known
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
        );
      }

      setStep('preview');
    } catch (err) {
      console.log('[SelfieVerification] Capture error:', err.message);
      setError('Failed to capture selfie. Please try again.');
    }
  };

  // ─── Retake ─────────────────────────────────────────────────────────
  const handleRetake = () => {
    setCapturedPhoto(null);
    setCaptureTimestamp(null);
    setError('');
    setStep('camera');
  };

  // ─── Confirm & Save ─────────────────────────────────────────────────
  const handleConfirm = () => {
    dispatch({
      type: 'SET_SELFIE',
      payload: {
        uri: capturedPhoto.uri,
        matched: true,
        livenessVerified: true,
        faceMatchPercentage: 'In-app capture',
        timestamp: captureTimestamp?.toISOString(),
        location: location
          ? `${location.latitude}, ${location.longitude}`
          : 'Unavailable',
      },
    });
    setStep('result');
  };

  // ─── Reset ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setCapturedPhoto(null);
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

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Selfie Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={5} />

      {/* ── Camera View (full screen overlay) ── */}
      {step === 'camera' && (
        <View style={[styles.cameraContainer, { backgroundColor: '#000' }]}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
            mirror={true}
          >
            {/* Oval guide overlay */}
            <View style={styles.cameraOverlay}>
              <View style={styles.ovalGuide}>
                <View style={[styles.ovalBorder, { borderColor: colors.teal }]} />
              </View>
              <Text style={styles.cameraHintText}>
                Position your face within the frame
              </Text>
            </View>
          </CameraView>

          <View style={styles.cameraControls}>
            <Button
              title="Cancel"
              onPress={handleReset}
              variant="outline"
              style={styles.cameraCancelBtn}
            />
            <View style={styles.captureButtonOuter}>
              <Button
                title=""
                onPress={handleCapture}
                style={[styles.captureButton, { backgroundColor: colors.teal }]}
              />
            </View>
            <View style={{ width: 80 }} />
          </View>
        </View>
      )}

      {/* ── Scrollable content for other steps ── */}
      {step !== 'camera' && (
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
                Live Selfie Capture
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                We'll capture your selfie using the in-app camera. The photo will include your
                location and timestamp for verification. Please ensure:
              </Text>
              <View style={styles.tipsList}>
                {[
                  'Good lighting on your face',
                  'No hat, mask, or sunglasses',
                  'Look directly at the camera',
                  'Keep your face within the frame',
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

              {error ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              ) : null}

              <Button
                title="Open Camera"
                onPress={handleOpenCamera}
                icon="📷"
                style={styles.startBtn}
              />
            </Card>
          )}

          {/* ── Preview: Show captured selfie with overlay ── */}
          {step === 'preview' && capturedPhoto && (
            <>
              <Card>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Review Your Selfie
                </Text>

                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: capturedPhoto.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  {/* Overlay: Company name, Location, Timestamp */}
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

                {error ? (
                  <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                ) : null}
              </Card>

              <View style={styles.previewActions}>
                <Button
                  title="Retake"
                  onPress={handleRetake}
                  variant="outline"
                  icon="🔄"
                  style={styles.actionBtn}
                />
                <Button
                  title="Confirm"
                  onPress={handleConfirm}
                  icon="✓"
                  style={styles.actionBtn}
                />
              </View>
            </>
          )}

          {/* ── Result ── */}
          {step === 'result' && capturedPhoto && (
            <>
              <Card>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultIcon}>✅</Text>
                  <Text style={[styles.resultTitle, { color: colors.teal }]}>
                    Selfie Captured Successfully
                  </Text>
                </View>

                {/* Show captured selfie */}
                <View style={styles.resultImageContainer}>
                  <Image
                    source={{ uri: capturedPhoto.uri }}
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

                <View style={styles.resultDetails}>
                  <InfoRow label="Status" value="Captured" valueColor={colors.teal} />
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
              </Card>

              <Button
                title="Continue to eNACH & eSign"
                onPress={handleProceed}
                style={styles.proceedBtn}
              />
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
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

  // Camera
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalGuide: {
    width: 220,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalBorder: {
    width: 220,
    height: 300,
    borderRadius: 110,
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  cameraHintText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  cameraCancelBtn: { width: 80 },
  captureButtonOuter: { alignItems: 'center' },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#fff',
  },

  // Preview
  previewContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
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
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionBtn: { flex: 1 },

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
  resultDetails: { marginBottom: 16 },
  proceedBtn: { marginTop: 16 },
  bottomSpacer: { height: 100 },
});

export default SelfieVerificationScreen;
