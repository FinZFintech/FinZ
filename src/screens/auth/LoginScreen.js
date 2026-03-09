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
import { COLORS, APP_NAME } from '../../config/constants';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import OtpInput from '../../components/common/OtpInput';
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
          <View style={styles.logo}>
            <Text style={styles.logoText}>FZ</Text>
          </View>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.welcomeText}>
            {showOtp ? 'Verify OTP' : 'Welcome! Login to continue'}
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
              <Text style={styles.otpInfo}>
                OTP sent to +91 {mobile.slice(0, 4)}XXXXXX
              </Text>
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

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.textLight,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  otpInfo: {
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
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
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default LoginScreen;
