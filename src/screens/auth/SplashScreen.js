import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../config/constants';
import { useAuth } from '../../store/AuthContext';
import Logo from '../../components/common/Logo';

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
        <Logo size="large" />
        <Text style={styles.tagline}>Smart Financing, Simplified</Text>
      </View>
      <ActivityIndicator size="large" color={COLORS.teal} style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    marginBottom: 16,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  loader: {
    position: 'absolute',
    bottom: 80,
  },
});

export default SplashScreen;
