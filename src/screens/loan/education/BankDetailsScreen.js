import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Header from '../../../components/common/Header';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { useTheme } from '../../../store/ThemeContext';

// Bank details capture has been moved to IncomeVerificationScreen.
// This screen redirects to EnachEsign if navigated to directly.
const BankDetailsScreen = ({ navigation }) => {
  const { colors } = useTheme();

  useEffect(() => {
    navigation.replace('EnachEsign');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Bank Details" onBack={() => navigation.goBack()} />
      <View style={styles.center}>
        <Text style={[styles.text, { color: colors.textSecondary }]}>Redirecting...</Text>
      </View>
      <FloatingAssistButton />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 14 },
});

export default BankDetailsScreen;
