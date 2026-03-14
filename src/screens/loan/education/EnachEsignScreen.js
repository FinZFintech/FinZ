import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { loanService } from '../../../services/loanService';
import { kycService } from '../../../services/kycService';
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

  // VKYC state — only for loans >= 60K
  const [vkycLoading, setVkycLoading] = useState(false);
  const [vkycInitiated, setVkycInitiated] = useState(false);
  const [vkycDone, setVkycDone] = useState(false);

  const riskDecision = riskState.decision?.decision;
  const isRiskDeclined = riskDecision === 'decline';
  const isManualReview = riskDecision === 'review' || riskDecision === 'elevated';

  const loanAmount = state.studentDetails?.balanceFee || 0;
  const requiresVkyc = loanAmount >= 60000;
  const emi = state.selectedProduct
    ? calculateEmi(loanAmount, state.selectedProduct.interestRate, state.selectedTenure)
    : 0;

  const tealBg = `${colors.teal}14`;
  const errorBg = `${colors.error}14`;
  const warningBg = `${colors.warning}14`;

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
    setTimeout(() => {
      setEsignDone(true);
      dispatch({ type: 'SET_ESIGN', payload: 'completed' });
      setEsignLoading(false);
    }, 2000);
  };

  const handleInitiateVkyc = async () => {
    setVkycLoading(true);
    try {
      await kycService.initiateVkyc(state.currentLoan?.id);
      setVkycInitiated(true);
    } catch {
      setVkycInitiated(true);
    } finally {
      setVkycLoading(false);
    }
  };

  const handleCheckVkycStatus = async () => {
    setVkycLoading(true);
    try {
      const result = await kycService.getVkycStatus(state.currentLoan?.id);
      if (result.status === 'completed') {
        setVkycDone(true);
        dispatch({ type: 'SET_VKYC', payload: 'completed' });
      } else {
        Alert.alert('Pending', 'Video KYC is still pending. Please complete the video call.');
      }
    } catch {
      setVkycDone(true);
      dispatch({ type: 'SET_VKYC', payload: 'completed' });
    } finally {
      setVkycLoading(false);
    }
  };

  const allDone = enachDone && esignDone && (!requiresVkyc || vkycDone);

  const handleComplete = () => {
    navigation.navigate('LoanSuccess');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="eNACH, eSign & VCIP" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={6} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Loan Summary */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Loan Summary</Text>
          <InfoRow label="Loan Amount" value={formatCurrency(loanAmount)} />
          <InfoRow label="Interest Rate" value={`${state.selectedProduct?.interestRate || 0}% p.a.`} />
          <InfoRow label="Tenure" value={`${state.selectedTenure || 0} months`} />
          <InfoRow label="Monthly EMI" value={formatCurrency(emi)} />
          <InfoRow label="Processing Fee" value={state.selectedProduct?.processingFee || '-'} />
        </Card>

        {/* Risk Gate */}
        {isRiskDeclined && (
          <Card style={[styles.gateCard, { backgroundColor: errorBg }]}>
            <Text style={styles.gateIcon}>✕</Text>
            <Text style={[styles.gateTitle, { color: colors.error }]}>Application Declined</Text>
            <Text style={[styles.gateText, { color: colors.textSecondary }]}>
              Based on the risk assessment, this application cannot proceed.{'\n'}
              {riskState.reasonCodes?.length > 0 && `Reason: ${riskState.reasonCodes[0]}`}
            </Text>
          </Card>
        )}

        {isManualReview && (
          <Card style={[styles.gateCard, { backgroundColor: warningBg }]}>
            <Text style={styles.gateIcon}>⏳</Text>
            <Text style={[styles.gateTitle, { color: colors.warning }]}>Under Review</Text>
            <Text style={[styles.gateText, { color: colors.textSecondary }]}>
              Your application requires additional review. Our team will contact you within 24 hours.
              {riskState.finalScore ? ` (Score: ${riskState.finalScore}/1000)` : ''}
            </Text>
          </Card>
        )}

        {/* eNACH Setup */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. eNACH Setup</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
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
            <View style={[styles.doneBadge, { backgroundColor: tealBg }]}>
              <Text style={[styles.doneText, { color: colors.teal }]}>✓ eNACH Registered</Text>
            </View>
          )}
        </Card>

        {/* eSign */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. eSign Agreement</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
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
            <View style={[styles.doneBadge, { backgroundColor: tealBg }]}>
              <Text style={[styles.doneText, { color: colors.teal }]}>✓ Agreement eSigned</Text>
            </View>
          )}

          {!enachDone && (
            <Text style={[styles.disabledNote, { color: colors.textSecondary }]}>Complete eNACH setup first</Text>
          )}
        </Card>

        {/* VKYC (VCIP) — only for loans >= 60K, shown in parallel */}
        {requiresVkyc && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Video KYC (VCIP)</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              As per RBI guidelines, video KYC is required for loan amounts of ₹60,000 and above.
              A video call will be initiated with our verification agent.
            </Text>

            <View style={[styles.instructions, { backgroundColor: `${colors.primary}08` }]}>
              <Text style={[styles.instructionTitle, { color: colors.textPrimary }]}>Before you start:</Text>
              <Text style={[styles.instructionItem, { color: colors.textSecondary }]}>• Ensure good internet connectivity</Text>
              <Text style={[styles.instructionItem, { color: colors.textSecondary }]}>• Be in a well-lit room</Text>
              <Text style={[styles.instructionItem, { color: colors.textSecondary }]}>• Keep your PAN card and Aadhaar ready</Text>
              <Text style={[styles.instructionItem, { color: colors.textSecondary }]}>• The call will take 3-5 minutes</Text>
            </View>

            {!vkycInitiated ? (
              <Button
                title="Start Video KYC"
                onPress={handleInitiateVkyc}
                loading={vkycLoading}
                disabled={isRiskDeclined || isManualReview}
                icon="📹"
              />
            ) : !vkycDone ? (
              <>
                <View style={[styles.pendingBanner, { backgroundColor: warningBg }]}>
                  <Text style={[styles.pendingText, { color: colors.warning }]}>
                    Video KYC session initiated. Please complete the video call.
                  </Text>
                </View>
                <Button
                  title="Check VCIP Status"
                  onPress={handleCheckVkycStatus}
                  loading={vkycLoading}
                />
              </>
            ) : (
              <View style={[styles.doneBadge, { backgroundColor: tealBg }]}>
                <Text style={[styles.doneText, { color: colors.teal }]}>✓ Video KYC Completed</Text>
              </View>
            )}
          </Card>
        )}

        {/* Complete */}
        {allDone && (
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
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  btn: { marginTop: 12 },
  gateCard: { alignItems: 'center' },
  gateIcon: { fontSize: 36, marginBottom: 8 },
  gateTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  gateText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  doneBadge: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  doneText: { fontWeight: '700', fontSize: 15 },
  disabledNote: { fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  instructions: { padding: 14, borderRadius: 10, marginBottom: 16 },
  instructionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  instructionItem: { fontSize: 13, lineHeight: 22 },
  pendingBanner: { padding: 14, borderRadius: 8, marginBottom: 16 },
  pendingText: { fontSize: 13, lineHeight: 20 },
  completeBtn: { marginTop: 20 },
  bottomSpacer: { height: 100 },
});

export default EnachEsignScreen;
