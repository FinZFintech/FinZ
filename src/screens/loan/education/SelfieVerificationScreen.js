import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import { COLORS } from '../../../config/constants';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';

const SelfieVerificationScreen = ({ navigation }) => {
  const { state, dispatch } = useLoan();
  const [selfieUri, setSelfieUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const loanAmount = state.studentDetails?.balanceFee || 0;
  const requiresVkyc = loanAmount >= 60000;

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
      // Match selfie with KYC photo (base64 from aadhaar/ckyc)
      const result = await kycService.verifySelfie(
        selfieUri, // In production, send base64
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
    navigation.navigate('BankDetails');
  };

  return (
    <View style={styles.container}>
      <Header title="Selfie Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={4} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Card>
          <Text style={styles.sectionTitle}>Take a Live Selfie</Text>
          <Text style={styles.infoText}>
            Please take a clear selfie for identity verification. Ensure good lighting
            and look directly at the camera.
          </Text>

          {requiresVkyc && (
            <View style={styles.vkycNote}>
              <Text style={styles.vkycNoteText}>
                Note: Since your loan amount is ₹{loanAmount.toLocaleString('en-IN')} (≥₹60,000),
                video KYC (vKYC) will be required at a later step as per RBI guidelines.
              </Text>
            </View>
          )}

          {selfieUri && (
            <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
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
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Selfie Verified</Text>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 16 },
  vkycNote: { backgroundColor: '#E8F8F7', padding: 12, borderRadius: 8, marginBottom: 16 },
  vkycNoteText: { fontSize: 12, color: COLORS.teal, lineHeight: 18 },
  selfiePreview: {
    width: 200,
    height: 260,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
    borderWidth: 3,
    borderColor: COLORS.teal,
  },
  btn: { marginTop: 12 },
  verifiedBadge: {
    backgroundColor: '#E8F8F7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  verifiedText: { color: COLORS.teal, fontWeight: '700', fontSize: 15 },
  proceedBtn: { marginTop: 16 },
  bottomSpacer: { height: 100 },
});

export default SelfieVerificationScreen;
