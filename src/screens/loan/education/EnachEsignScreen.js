import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { COLORS } from '../../../config/constants';
import { loanService } from '../../../services/loanService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';
import { formatCurrency, calculateEmi } from '../../../utils/helpers';
import { useTheme } from '../../../store/ThemeContext';

const EnachEsignScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { state: riskState } = useRisk();
  const [enachLoading, setEnachLoading] = useState(false);
  const [esignLoading, setEsignLoading] = useState(false);
  const [enachDone, setEnachDone] = useState(false);
  const [esignDone, setEsignDone] = useState(false);

  // Check if risk engine has declined the application
  const riskDecision = riskState.decision?.decision;
  const isRiskDeclined = riskDecision === 'decline';
  const isManualReview = riskDecision === 'review' || riskDecision === 'elevated';

  const loanAmount = state.studentDetails?.balanceFee || 0;
  const emi = state.selectedProduct
    ? calculateEmi(loanAmount, state.selectedProduct.interestRate, state.selectedTenure)
    : 0;

  const handleEnach = async () => {
    setEnachLoading(true);
    try {
      const result = await loanService.initiateEnach(state.currentLoan?.id, {
        accountNumber: state.bankDetails?.accountNumber,
        ifsc: state.bankDetails?.ifsc,
        emiAmount: emi,
        frequency: 'monthly',
      });
      if (result.redirectUrl) {
        Linking.openURL(result.redirectUrl);
      }
    } catch {
      // Mock
    }
    // Mock success after timeout
    setTimeout(() => {
      setEnachDone(true);
      dispatch({ type: 'SET_ENACH', payload: 'completed' });
      setEnachLoading(false);
    }, 2000);
  };

  const handleEsign = async () => {
    setEsignLoading(true);
    try {
      const result = await loanService.initiateEsign(state.currentLoan?.id);
      if (result.redirectUrl) {
        Linking.openURL(result.redirectUrl);
      }
    } catch {
      // Mock
    }
    // Mock success after timeout
    setTimeout(() => {
      setEsignDone(true);
      dispatch({ type: 'SET_ESIGN', payload: 'completed' });
      setEsignLoading(false);
    }, 2000);
  };

  const handleComplete = () => {
    navigation.navigate('LoanSuccess');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="eNACH & eSign" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={6} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Loan Summary */}
        <Card>
          <Text style={styles.sectionTitle}>Loan Summary</Text>
          <InfoRow label="Loan Amount" value={formatCurrency(loanAmount)} />
          <InfoRow label="Interest Rate" value={`${state.selectedProduct?.interestRate || 0}% p.a.`} />
          <InfoRow label="Tenure" value={`${state.selectedTenure || 0} months`} />
          <InfoRow label="Monthly EMI" value={formatCurrency(emi)} />
          <InfoRow label="Processing Fee" value={state.selectedProduct?.processingFee || '-'} />
        </Card>

        {/* Risk Gate */}
        {isRiskDeclined && (
          <Card style={{ backgroundColor: '#FFF3F0', alignItems: 'center' }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>✕</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.error, marginBottom: 8 }}>Application Declined</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              Based on the risk assessment, this application cannot proceed.{'\n'}
              {riskState.reasonCodes?.length > 0 && `Reason: ${riskState.reasonCodes[0]}`}
            </Text>
          </Card>
        )}

        {isManualReview && (
          <Card style={{ backgroundColor: '#FFF8E1', alignItems: 'center' }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>⏳</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.warning, marginBottom: 8 }}>Under Review</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              Your application requires additional review. Our team will contact you within 24 hours.
              {riskState.finalScore ? ` (Score: ${riskState.finalScore}/1000)` : ''}
            </Text>
          </Card>
        )}

        {/* eNACH Setup */}
        <Card>
          <Text style={styles.sectionTitle}>1. eNACH Setup</Text>
          <Text style={styles.infoText}>
            Set up auto-debit (eNACH) for automatic EMI payments from your bank account.
          </Text>
          <InfoRow label="Bank" value={state.bankDetails?.bankName || '-'} />
          <InfoRow label="EMI Amount" value={formatCurrency(emi)} />
          <InfoRow label="Frequency" value="Monthly" />

          {!enachDone ? (
            <Button
              title="Setup eNACH"
              onPress={handleEnach}
              loading={enachLoading}
              disabled={isRiskDeclined || isManualReview}
              style={styles.btn}
            />
          ) : (
            <View style={styles.doneBadge}>
              <Text style={styles.doneText}>✓ eNACH Registered</Text>
            </View>
          )}
        </Card>

        {/* eSign */}
        <Card>
          <Text style={styles.sectionTitle}>2. eSign Agreement</Text>
          <Text style={styles.infoText}>
            Digitally sign your loan agreement document using Aadhaar eSign.
          </Text>

          {!esignDone ? (
            <Button
              title="eSign Agreement"
              onPress={handleEsign}
              loading={esignLoading}
              disabled={!enachDone || isRiskDeclined || isManualReview}
              style={styles.btn}
            />
          ) : (
            <View style={styles.doneBadge}>
              <Text style={styles.doneText}>✓ Agreement eSigned</Text>
            </View>
          )}

          {!enachDone && (
            <Text style={styles.disabledNote}>Complete eNACH setup first</Text>
          )}
        </Card>

        {/* Complete */}
        {enachDone && esignDone && (
          <Button
            title="Complete Application"
            onPress={handleComplete}
            style={styles.completeBtn}
          />
        )}

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
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 12 },
  btn: { marginTop: 12 },
  doneBadge: {
    backgroundColor: 'rgba(74,237,196,0.08)', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12,
  },
  doneText: { color: COLORS.teal, fontWeight: '700', fontSize: 15 },
  disabledNote: {
    fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, fontStyle: 'italic',
  },
  completeBtn: { marginTop: 20 },
  bottomSpacer: { height: 100 },
});

export default EnachEsignScreen;
