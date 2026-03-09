import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, APP_NAME } from '../../config/constants';
import { useAuth } from '../../store/AuthContext';

const SplashScreen = ({ navigation }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        const role = user.role || 'customer';
        if (role === 'customer') {
          navigation.replace('CustomerTabs');
        } else {
          navigation.replace('AdminTabs');
        }
      } else {
        navigation.replace('Login');
      }
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>FZ</Text>
        </View>
        <Text style={styles.appName}>{APP_NAME}</Text>
        <Text style={styles.tagline}>Smart Financing, Simplified</Text>
      </View>
      <ActivityIndicator size="large" color={COLORS.textLight} style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: COLORS.textLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.primary,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  loader: {
    position: 'absolute',
    bottom: 80,
  },
});

export default SplashScreen;
