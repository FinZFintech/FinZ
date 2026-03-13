import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import Button from '../../components/common/Button';

const SplashScreen = ({ navigation }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { colors, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const role = user.role || 'customer';
      navigation.replace(role === 'customer' ? 'CustomerTabs' : 'AdminTabs');
    }
  }, [isLoading, isAuthenticated]);

  const handleGetStarted = () => {
    navigation.replace('Login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.progressStrip}>
        <View style={[styles.stripSegment, { backgroundColor: colors.teal, flex: 3 }]} />
        <View style={[styles.stripSegment, { backgroundColor: colors.purple, flex: 1 }]} />
        <View style={[styles.stripSegment, { backgroundColor: colors.secondary, flex: 1 }]} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.logoCircle}>
          <LinearGradient
            colors={['#4AEDC4', '#7B6DAF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Text style={[styles.logoText, { color: colors.background }]}>FZ</Text>
          </LinearGradient>
        </View>

        <Text style={[styles.headline, { color: colors.textPrimary }]}>Education financing{'\n'}made simple</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Loans, savings & financial tools{'\n'}for students and parents
        </Text>
      </Animated.View>

      <View style={styles.bottomSection}>
        <Button
          title="Get Started"
          onPress={handleGetStarted}
          style={styles.getStartedBtn}
          textStyle={styles.getStartedText}
        />
        <TouchableOpacity onPress={handleGetStarted} style={styles.signInLink}>
          <Text style={[styles.signInText, { color: colors.textSecondary }]}>
            Already have an account? <Text style={[styles.signInHighlight, { color: colors.teal }]}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: StatusBar.currentHeight || 44,
  },
  progressStrip: {
    flexDirection: 'row',
    height: 3,
  },
  stripSegment: {
    height: 3,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 40,
    overflow: 'hidden',
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  getStartedBtn: {
    borderRadius: 16,
    minHeight: 56,
  },
  getStartedText: {
    fontSize: 17,
    fontWeight: '700',
  },
  signInLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  signInText: {
    fontSize: 14,
  },
  signInHighlight: {
    fontWeight: '600',
  },
});

export default SplashScreen;
