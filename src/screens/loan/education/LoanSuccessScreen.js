import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from '../../../components/common/Button';
import Header from '../../../components/common/Header';
import { COLORS, APP_NAME } from '../../../config/constants';
import { useLoan } from '../../../store/LoanContext';
import { formatCurrency, calculateEmi } from '../../../utils/helpers';
import { useTheme } from '../../../store/ThemeContext';

const LoanSuccessScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const loanAmount = state.studentDetails?.balanceFee || 0;
  const emi = state.selectedProduct
    ? calculateEmi(loanAmount, state.selectedProduct.interestRate, state.selectedTenure)
    : 0;

  const handleGoHome = () => {
    dispatch({ type: 'RESET' });
    navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Application Complete" />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🎉</Text>
        </View>
        <Text style={styles.title}>Application Complete!</Text>
        <Text style={styles.subtitle}>
          Your loan application has been submitted successfully.
          {'\n'}Disbursement will happen within 24-48 hours.
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Loan Amount</Text>
            <Text style={styles.summaryValue}>{formatCurrency(loanAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Monthly EMI</Text>
            <Text style={styles.summaryValue}>{formatCurrency(emi)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tenure</Text>
            <Text style={styles.summaryValue}>{state.selectedTenure} months</Text>
          </View>
        </View>

        <Text style={styles.note}>
          You can track your loan status from the {APP_NAME} dashboard.
          We will notify you via SMS/WhatsApp once the loan is disbursed.
        </Text>

        <Button title="Go to Dashboard" onPress={handleGoHome} variant="secondary" style={styles.btn} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(74,237,196,0.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  icon: { fontSize: 50 },
  title: {
    fontSize: 28, fontWeight: '800', color: COLORS.teal, marginBottom: 12,
  },
  subtitle: {
    fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22,
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 16, width: '100%', marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  summaryValue: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  note: {
    fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20,
    marginBottom: 32,
  },
  btn: { width: '100%' },
});

export default LoanSuccessScreen;
