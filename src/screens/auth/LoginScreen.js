import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { COLORS } from '../../config/constants';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import OtpInput from '../../components/common/OtpInput';
import Logo from '../../components/common/Logo';
import { authService } from '../../services/authService';
import { useAuth } from '../../store/AuthContext';
import { validateMobile } from '../../utils/helpers';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (!validateMobile(mobile)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authService.sendOtp(mobile);
      setShowOtp(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (otpValue) => {
    const code = otpValue || otp;
    if (code.length !== 6) return;

    setLoading(true);
    try {
      const response = await login(mobile, code);
      const role = response.user?.role || 'customer';
      if (role === 'customer') {
        navigation.replace('CustomerTabs');
      } else {
        navigation.replace('AdminTabs');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Logo size="medium" />
          </View>
          <Text style={styles.welcomeText}>
            {showOtp ? 'Verify OTP' : 'Welcome! Login to continue'}
          </Text>
          <Text style={styles.subText}>
            {showOtp
              ? 'Enter the 6-digit code sent to your mobile'
              : 'Enter your mobile number to get started'}
          </Text>
        </View>

        <View style={styles.form}>
          {!showOtp ? (
            <>
              <Input
                label="Mobile Number"
                value={mobile}
                onChangeText={(text) => {
                  setMobile(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                placeholder="Enter 10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                error={error}
              />
              <Button
                title="Send OTP"
                onPress={handleSendOtp}
                loading={loading}
                disabled={mobile.length !== 10}
              />
            </>
          ) : (
            <>
              <View style={styles.otpInfoBox}>
                <Text style={styles.otpInfo}>
                  OTP sent to +91 {mobile.slice(0, 2)}XXXXXX{mobile.slice(-2)}
                </Text>
              </View>
              <OtpInput
                length={6}
                onComplete={(code) => {
                  setOtp(code);
                  handleVerifyOtp(code);
                }}
                style={styles.otpInput}
              />
              <Button
                title="Verify OTP"
                onPress={() => handleVerifyOtp()}
                loading={loading}
                disabled={otp.length !== 6}
                style={styles.verifyButton}
              />
              <Button
                title="Change Number"
                onPress={() => {
                  setShowOtp(false);
                  setOtp('');
                }}
                variant="outline"
                style={styles.changeButton}
              />
            </>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.colorBar}>
            <View style={[styles.colorSegment, { backgroundColor: COLORS.primary, flex: 3 }]} />
            <View style={[styles.colorSegment, { backgroundColor: COLORS.purple, flex: 1 }]} />
            <View style={[styles.colorSegment, { backgroundColor: COLORS.teal, flex: 2 }]} />
            <View style={[styles.colorSegment, { backgroundColor: COLORS.secondary, flex: 1 }]} />
          </View>
          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoWrap: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  subText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  form: {
    marginBottom: 32,
  },
  otpInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
  },
  otpInfo: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  otpInput: {
    marginBottom: 24,
  },
  verifyButton: {
    marginTop: 8,
  },
  changeButton: {
    marginTop: 12,
  },
  footer: {
    alignItems: 'center',
  },
  colorBar: {
    flexDirection: 'row',
    height: 3,
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  colorSegment: {
    height: 3,
  },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  link: {
    color: COLORS.teal,
    fontWeight: '600',
  },
});

export default LoginScreen;
