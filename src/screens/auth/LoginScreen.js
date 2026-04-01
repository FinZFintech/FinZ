import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '../../config/constants';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import OtpInput from '../../components/common/OtpInput';
import { authService } from '../../services/authService';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { validateMobile } from '../../utils/helpers';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const [mobile, setMobile] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form state when screen comes into focus (e.g. after logout)
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setMobile('');
      setShowOtp(false);
      setOtp('');
      setLoading(false);
      setError('');
    });
    return unsubscribe;
  }, [navigation]);

  const handleSendOtp = async () => {
    if (!validateMobile(mobile)) {
      setError('Please enter a valid 10-digit mobile number (starting with 6-9)');
      return;
    }
    setError('');
    setLoading(true);
    try {
      console.log('[Login] Sending OTP to', mobile);
      await authService.sendOtp(mobile);
      console.log('[Login] OTP sent successfully');
      setShowOtp(true);
    } catch (err) {
      console.log('[Login] Send OTP error:', err);
      const msg =
        err?.message || (typeof err === 'string' ? err : 'Failed to send OTP. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (otpValue) => {
    const code = otpValue || otp;
    if (code.length !== 6) return;

    setError('');
    setLoading(true);
    try {
      console.log('[Login] Verifying OTP for', mobile);
      // login() sets isAuthenticated=true which triggers navigator to switch screens automatically
      await login(mobile, code);
      console.log('[Login] Login successful');
    } catch (err) {
      console.log('[Login] Verify OTP error:', err);
      const msg =
        err?.message || (typeof err === 'string' ? err : 'Invalid OTP. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    welcomeText: { color: colors.textPrimary },
    subText: { color: colors.textSecondary },
    otpInfoBox: { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
    otpInfo: { color: colors.textSecondary },
    terms: { color: colors.textSecondary },
    link: { color: colors.teal },
    toggleTrack: {
      backgroundColor: isDark ? 'rgba(74,237,196,0.2)' : 'rgba(0,0,0,0.1)',
      borderColor: isDark ? 'rgba(74,237,196,0.3)' : 'rgba(0,0,0,0.15)',
    },
    toggleThumb: {
      backgroundColor: isDark ? colors.teal : colors.primary,
      left: isDark ? 22 : 2,
    },
    toggleLabel: { color: colors.textSecondary },
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dynamicStyles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Theme toggle */}
        <View style={styles.themeToggleRow}>
          <Text style={[styles.toggleLabel, dynamicStyles.toggleLabel]}>
            {isDark ? '🌙' : '☀️'}
          </Text>
          <TouchableOpacity
            style={[styles.toggleTrack, dynamicStyles.toggleTrack]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleThumb, dynamicStyles.toggleThumb]} />
          </TouchableOpacity>
          <Text style={[styles.toggleLabel, dynamicStyles.toggleLabel]}>
            {isDark ? 'Dark' : 'Light'}
          </Text>
        </View>

        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.welcomeText, dynamicStyles.welcomeText]}>
            {showOtp ? 'Verify OTP' : 'Welcome! Login to continue'}
          </Text>
          <Text style={[styles.subText, dynamicStyles.subText]}>
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
                  setMobile(text.replace(/[^0-9]/g, '').slice(0, 10));
                  setError('');
                }}
                placeholder="Enter 10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                prefix="+91"
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
              <View style={[styles.otpInfoBox, dynamicStyles.otpInfoBox]}>
                <Text style={[styles.otpInfo, dynamicStyles.otpInfo]}>
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
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
                  setError('');
                }}
                variant="outline"
                style={styles.changeButton}
              />
            </>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.colorBar}>
            <View style={[styles.colorSegment, { backgroundColor: colors.primary, flex: 3 }]} />
            <View style={[styles.colorSegment, { backgroundColor: colors.purple, flex: 1 }]} />
            <View style={[styles.colorSegment, { backgroundColor: colors.teal, flex: 2 }]} />
            <View style={[styles.colorSegment, { backgroundColor: colors.secondary, flex: 1 }]} />
          </View>
          <Text style={[styles.terms, dynamicStyles.terms]}>
            By continuing, you agree to our{' '}
            <Text style={[styles.link, dynamicStyles.link]}>Terms of Service</Text> and{' '}
            <Text style={[styles.link, dynamicStyles.link]}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 16,
    marginBottom: 8,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoWrap: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logoImage: {
    width: 200,
    height: 70,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
  },
  subText: {
    fontSize: 14,
    marginTop: 6,
  },
  form: {
    marginBottom: 32,
  },
  otpInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
    borderWidth: 1,
  },
  otpInfo: {
    fontSize: 14,
    fontWeight: '500',
  },
  otpInput: {
    marginBottom: 24,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 12,
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
    lineHeight: 18,
  },
  link: {
    fontWeight: '600',
  },
});

export default LoginScreen;
