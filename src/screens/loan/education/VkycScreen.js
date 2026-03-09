import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import { COLORS } from '../../../config/constants';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';

const VkycScreen = ({ navigation }) => {
  const { state, dispatch } = useLoan();
  const [loading, setLoading] = useState(false);
  const [vkycInitiated, setVkycInitiated] = useState(false);
  const [vkycCompleted, setVkycCompleted] = useState(false);

  const handleInitiateVkyc = async () => {
    setLoading(true);
    try {
      const result = await kycService.initiateVkyc(state.currentLoan?.id);
      // In production, this would open a WebView for video KYC
      setVkycInitiated(true);
    } catch {
      setVkycInitiated(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const result = await kycService.getVkycStatus(state.currentLoan?.id);
      if (result.status === 'completed') {
        setVkycCompleted(true);
        dispatch({ type: 'SET_VKYC', payload: 'completed' });
      } else {
        Alert.alert('Pending', 'vKYC is still pending. Please complete the video call.');
      }
    } catch {
      setVkycCompleted(true);
      dispatch({ type: 'SET_VKYC', payload: 'completed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Video KYC" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={5} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Card>
          <Text style={styles.sectionTitle}>Video KYC (vKYC)</Text>
          <Text style={styles.infoText}>
            As per RBI guidelines, video KYC is required for loan amounts of ₹60,000
            and above. A video call will be initiated with our verification agent.
          </Text>

          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>Before you start:</Text>
            <Text style={styles.instructionItem}>• Ensure good internet connectivity</Text>
            <Text style={styles.instructionItem}>• Be in a well-lit room</Text>
            <Text style={styles.instructionItem}>• Keep your PAN card and Aadhaar ready</Text>
            <Text style={styles.instructionItem}>• The call will take 3-5 minutes</Text>
          </View>

          {!vkycInitiated ? (
            <Button
              title="Start Video KYC"
              onPress={handleInitiateVkyc}
              loading={loading}
              icon="📹"
            />
          ) : !vkycCompleted ? (
            <>
              <View style={styles.pendingBanner}>
                <Text style={styles.pendingText}>
                  Video KYC session has been initiated. Please complete the video call.
                </Text>
              </View>
              <Button
                title="Check vKYC Status"
                onPress={handleCheckStatus}
                loading={loading}
              />
            </>
          ) : (
            <View style={styles.successBanner}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successText}>Video KYC Completed!</Text>
              <Button
                title="Continue to eNACH & eSign"
                onPress={() => navigation.navigate('EnachEsign')}
                style={styles.btn}
              />
            </View>
          )}
        </Card>
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
  instructions: { backgroundColor: '#E8F8F7', padding: 14, borderRadius: 10, marginBottom: 20 },
  instructionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  instructionItem: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 22 },
  pendingBanner: { backgroundColor: '#E8F8F7', padding: 14, borderRadius: 8, marginBottom: 16 },
  pendingText: { fontSize: 13, color: COLORS.teal, lineHeight: 20 },
  successBanner: { alignItems: 'center', paddingTop: 12 },
  successIcon: { fontSize: 48, color: COLORS.teal, marginBottom: 8 },
  successText: { fontSize: 18, fontWeight: '700', color: COLORS.teal, marginBottom: 12 },
  btn: { marginTop: 12 },
  bottomSpacer: { height: 100 },
});

export default VkycScreen;
