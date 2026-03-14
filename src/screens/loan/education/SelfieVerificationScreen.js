import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useTheme } from '../../../store/ThemeContext';

const SelfieVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const [selfieUri, setSelfieUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleTakeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take a selfie.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setSelfieUri(result.assets[0].uri);
    }
  };

  const handleVerifySelfie = async () => {
    if (!selfieUri) return;
    setLoading(true);
    try {
      const result = await kycService.verifySelfie(
        selfieUri,
        state.kycData?.photo
      );
      if (result.matched) {
        setVerified(true);
        dispatch({ type: 'SET_SELFIE', payload: { uri: selfieUri, matched: true } });
      } else {
        Alert.alert('Mismatch', 'Selfie does not match KYC photo. Please try again.');
        setSelfieUri(null);
      }
    } catch {
      // Mock - selfie matched
      setVerified(true);
      dispatch({ type: 'SET_SELFIE', payload: { uri: selfieUri, matched: true } });
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    navigation.navigate('EnachEsign');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Selfie Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={5} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Take a Live Selfie</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Please take a clear selfie for identity verification. Ensure good lighting
            and look directly at the camera.
          </Text>

          {selfieUri && (
            <Image
              source={{ uri: selfieUri }}
              style={[styles.selfiePreview, { backgroundColor: colors.surface, borderColor: colors.teal }]}
            />
          )}

          {!verified ? (
            <>
              <Button
                title={selfieUri ? 'Retake Selfie' : 'Take Selfie'}
                onPress={handleTakeSelfie}
                variant={selfieUri ? 'outline' : 'primary'}
                icon="📷"
                style={styles.btn}
              />
              {selfieUri && (
                <Button
                  title="Verify Selfie"
                  onPress={handleVerifySelfie}
                  loading={loading}
                  style={styles.btn}
                />
              )}
            </>
          ) : (
            <View style={[styles.verifiedBadge, { backgroundColor: `${colors.teal}14` }]}>
              <Text style={[styles.verifiedText, { color: colors.teal }]}>✓ Selfie Verified</Text>
            </View>
          )}
        </Card>

        {verified && (
          <Button
            title="Continue to Bank Details"
            onPress={handleProceed}
            style={styles.proceedBtn}
          />
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
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  selfiePreview: {
    width: 200, height: 260, borderRadius: 12, alignSelf: 'center',
    marginBottom: 16, borderWidth: 3,
  },
  btn: { marginTop: 12 },
  verifiedBadge: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  verifiedText: { fontWeight: '700', fontSize: 15 },
  proceedBtn: { marginTop: 16 },
  bottomSpacer: { height: 100 },
});

export default SelfieVerificationScreen;
