import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import OtpInput from '../../../components/common/OtpInput';
import { COLORS, KYC_METHODS } from '../../../config/constants';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';

const KycVerificationScreen = ({ navigation }) => {
  const { state, dispatch } = useLoan();
  const { executePhase } = useRisk();
  const [currentMethod, setCurrentMethod] = useState(KYC_METHODS.CKYC);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [kycCompleted, setKycCompleted] = useState(false);
  const [kycFailed, setKycFailed] = useState(false);
  const [ckycFailed, setCkycFailed] = useState(false);
  const [digilockerFailed, setDigilockerFailed] = useState(false);
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [pincodeBlacklisted, setPincodeBlacklisted] = useState(false);

  // CKYC Flow
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
      // Mock - OTP sent
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
      // Mock success
      await handleKycSuccess(
        {
          name: 'RAHUL SHARMA',
          address: '123, ABC Colony, Bangalore - 560001',
          pincode: '560001',
          dob: '1998-05-15',
          photo: 'base64_photo_data_here',
        },
        KYC_METHODS.CKYC
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCkycFailed = () => {
    setCkycFailed(true);
    setCurrentMethod(KYC_METHODS.DIGILOCKER);
    setOtpSent(false);
    setOtp('');
  };

  // DigiLocker Flow
  const handleInitiateDigilocker = async () => {
    setLoading(true);
    try {
      const result = await kycService.initiateDigilocker({
        pan: state.panDetails?.panNumber,
        phone: state.borrowerDetails?.phone,
      });
      // In production, this would open DigiLocker in WebView
      if (result.redirectUrl) {
        Linking.openURL(result.redirectUrl);
      }
    } catch {
      // Mock - show digilocker failed option
      Alert.alert(
        'DigiLocker',
        'DigiLocker verification initiated. For testing, choose result:',
        [
          {
            text: 'Success',
            onPress: () =>
              handleKycSuccess(
                {
                  name: 'RAHUL SHARMA',
                  address: '123, ABC Colony, Bangalore - 560001',
                  pincode: '560001',
                  dob: '1998-05-15',
                  photo: 'base64_photo_data',
                },
                KYC_METHODS.DIGILOCKER
              ),
          },
          { text: 'Failed', onPress: handleDigilockerFailed },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDigilockerFailed = () => {
    setDigilockerFailed(true);
    setCurrentMethod(KYC_METHODS.AADHAAR_XML);
  };

  // Aadhaar XML Flow
  const handlePickAadhaarXml = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/xml', 'application/zip', 'text/xml'],
      });
      if (!result.canceled && result.assets?.[0]) {
        setAadhaarFile(result.assets[0]);
      }
    } catch {
      Alert.alert('Error', 'Could not pick file');
    }
  };

  const handleUploadAadhaarXml = async () => {
    if (!aadhaarFile) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: aadhaarFile.uri,
        type: aadhaarFile.mimeType,
        name: aadhaarFile.name,
      });
      const result = await kycService.uploadAadhaarXml(formData);
      await handleKycSuccess(result, KYC_METHODS.AADHAAR_XML);
    } catch {
      // Mock success
      await handleKycSuccess(
        {
          name: 'RAHUL SHARMA',
          address: '123, ABC Colony, Bangalore - 560001',
          pincode: '560001',
          dob: '1998-05-15',
          photo: 'base64_photo_data',
        },
        KYC_METHODS.AADHAAR_XML
      );
    } finally {
      setLoading(false);
    }
  };

  // Common KYC success handler
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
        // Route to manual queue
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
    <View style={styles.container}>
      <Header title="KYC Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={4} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* CKYC */}
        {!kycCompleted && currentMethod === KYC_METHODS.CKYC && (
          <Card>
            <Text style={styles.sectionTitle}>CKYC Verification</Text>
            <Text style={styles.infoText}>
              We will verify your identity via Central KYC Registry (CKYC).
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
                <Text style={styles.otpLabel}>Enter OTP received:</Text>
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
                  title="Didn't receive OTP? Try DigiLocker"
                  onPress={handleCkycFailed}
                  variant="outline"
                  style={styles.btn}
                />
              </>
            )}
          </Card>
        )}

        {/* DigiLocker */}
        {!kycCompleted && currentMethod === KYC_METHODS.DIGILOCKER && (
          <Card>
            <Text style={styles.sectionTitle}>DigiLocker Verification</Text>
            {ckycFailed && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  CKYC was not successful. Let's try DigiLocker.
                </Text>
              </View>
            )}
            <Text style={styles.infoText}>
              Verify your identity by linking your Aadhaar through DigiLocker.
              You will be redirected to DigiLocker portal.
            </Text>
            <Button
              title="Open DigiLocker"
              onPress={handleInitiateDigilocker}
              loading={loading}
            />
            <Button
              title="DigiLocker not working? Upload Aadhaar XML"
              onPress={handleDigilockerFailed}
              variant="outline"
              style={styles.btn}
            />
          </Card>
        )}

        {/* Aadhaar XML */}
        {!kycCompleted && currentMethod === KYC_METHODS.AADHAAR_XML && (
          <Card>
            <Text style={styles.sectionTitle}>Upload Aadhaar XML</Text>
            {digilockerFailed && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  DigiLocker was not successful. Please upload Aadhaar XML.
                </Text>
              </View>
            )}
            <Text style={styles.infoText}>
              Download your Aadhaar XML from the UIDAI website:
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://myaadhaar.uidai.gov.in')}
            >
              <Text style={styles.linkText}>Visit myaadhaar.uidai.gov.in →</Text>
            </TouchableOpacity>

            <View style={styles.steps}>
              <Text style={styles.stepText}>1. Visit myaadhaar.uidai.gov.in</Text>
              <Text style={styles.stepText}>2. Login with your Aadhaar number</Text>
              <Text style={styles.stepText}>3. Go to "Download Aadhaar" section</Text>
              <Text style={styles.stepText}>4. Download the XML/ZIP file</Text>
              <Text style={styles.stepText}>5. Upload the file below</Text>
            </View>

            <Button
              title={aadhaarFile ? `Selected: ${aadhaarFile.name}` : 'Select Aadhaar XML File'}
              onPress={handlePickAadhaarXml}
              variant={aadhaarFile ? 'success' : 'outline'}
              style={styles.btn}
            />

            {aadhaarFile && (
              <>
                <Input
                  label="Share Code (4-digit password set during download)"
                  placeholder="Enter 4-digit share code"
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Button
                  title="Upload & Verify"
                  onPress={handleUploadAadhaarXml}
                  loading={loading}
                  style={styles.btn}
                />
              </>
            )}
          </Card>
        )}

        {/* KYC Completed */}
        {kycCompleted && !kycFailed && (
          <Card style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>KYC Verified!</Text>
            <Text style={styles.successText}>
              Your identity has been successfully verified.
            </Text>
            <Button title="Continue" onPress={handleProceed} style={styles.btn} />
          </Card>
        )}

        {/* KYC Failed */}
        {kycFailed && (
          <Card style={styles.failCard}>
            <Text style={styles.failIcon}>✕</Text>
            <Text style={styles.failTitle}>KYC Failed</Text>
            <Text style={styles.failText}>
              {pincodeBlacklisted
                ? 'Your pincode is not serviceable at this time.'
                : 'KYC verification failed. Our team will review your application and contact you.'}
            </Text>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 12 },
  otpLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 12 },
  otpInput: { marginBottom: 16 },
  btn: { marginTop: 12 },
  warningBanner: {
    backgroundColor: 'rgba(245,183,49,0.08)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: { fontSize: 13, color: COLORS.warning, fontWeight: '600' },
  linkText: {
    color: COLORS.teal,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textDecorationLine: 'underline',
  },
  steps: { marginBottom: 16 },
  stepText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 24 },
  successCard: { alignItems: 'center', backgroundColor: 'rgba(74,237,196,0.08)' },
  successIcon: { fontSize: 48, color: COLORS.teal, marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: '800', color: COLORS.teal, marginBottom: 8 },
  successText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  failCard: { alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.08)' },
  failIcon: { fontSize: 48, color: COLORS.error, marginBottom: 8 },
  failTitle: { fontSize: 22, fontWeight: '800', color: COLORS.error, marginBottom: 8 },
  failText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default KycVerificationScreen;
