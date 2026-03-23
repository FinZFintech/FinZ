import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, TouchableOpacity, Clipboard, Platform } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { loanService } from '../../../services/loanService';
import { kycService } from '../../../services/kycService';
import { digitapService } from '../../../services/digitapService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';
import { formatCurrency, calculateEmi } from '../../../utils/helpers';
import { useTheme } from '../../../store/ThemeContext';

const RELATION_OPTIONS = ['Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Friend', 'Colleague', 'Other'];

const EnachEsignScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { state: riskState, executePhase } = useRisk();
  const [enachLoading, setEnachLoading] = useState(false);
  const [esignLoading, setEsignLoading] = useState(false);
  const [enachDone, setEnachDone] = useState(false);
  const [esignDone, setEsignDone] = useState(false);

  // VKYC state — only for loans >= 60K (Digitap integration)
  const [vkycLoading, setVkycLoading] = useState(false);
  const [vkycInitiated, setVkycInitiated] = useState(false);
  const [vkycDone, setVkycDone] = useState(false);
  const [vkycUrl, setVkycUrl] = useState(null);
  const [vkycStatusText, setVkycStatusText] = useState(null);

  // References (two required)
  const emptyRef = { name: '', phone: '', address: '', relation: '' };
  const [ref1, setRef1] = useState({ ...emptyRef });
  const [ref2, setRef2] = useState({ ...emptyRef });
  const [refErrors, setRefErrors] = useState({});

  // Restore references from persisted state
  useEffect(() => {
    if (state.references?.[0]) setRef1(state.references[0]);
    if (state.references?.[1]) setRef2(state.references[1]);
  }, []);

  const riskDecision = riskState.decision?.decision;
  const isRiskDeclined = riskDecision === 'decline';
  const isManualReview = riskDecision === 'review' || riskDecision === 'elevated';

  const loanAmount = state.studentDetails?.balanceFee || 0;
  const requiresVkyc = loanAmount >= 60000;
  const emi = state.selectedProduct
    ? calculateEmi(loanAmount, state.selectedProduct.interestRate, state.selectedTenure)
    : 0;

  // Trigger Phase D risk scoring on mount (mocked as approved for testing)
  useEffect(() => {
    const mockApproval = {
      decision: { decision: 'approve', label: 'AUTO-APPROVE', reason: null },
      finalScore: 850,
      gate: 'pass',
      completedAt: new Date().toISOString(),
    };
    dispatch({ type: 'SET_RISK_PROFILE', payload: mockApproval });
  }, []);

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
      setEnachLoading(false);
      Alert.alert('Error', 'eNACH setup failed. Please try again.');
      return;
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
      setEsignLoading(false);
      Alert.alert('Error', 'eSign initiation failed. Please try again.');
      return;
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
      const borrowerName = (state.borrowerDetails?.name || '').trim();
      const nameParts = borrowerName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const kycData = state.kycData || {};

      // Build verification questions from application state
      const verificationQuestions = digitapService.buildVerificationQuestions(state);

      const result = await kycService.initiateVkyc({
        firstName,
        lastName,
        uniqueId: state.applicationId,
        mobile: state.borrowerDetails?.phone || '',
        email: state.borrowerDetails?.email || '',
        nameAsPerAadhaar: kycData.name || borrowerName,
        guardianNameAsPerAadhaar: kycData.guardianName || '',
        addressAsPerAadhaar: kycData.address || '',
        aadhaarLastFourDigits: (kycData.uid || '').replace(/[^0-9]/g, '').slice(-4),
        dateOfAadhaarFetch: kycData.fetchedAt || new Date().toISOString(),
        imageOfUserBase64: kycData.photo || '',
        redirectionUrl: 'https://finz.app/vkyc/complete',
        verificationQuestions,
      });

      setVkycUrl(result.url);
      setVkycInitiated(true);

      if (result.vkycCompleted) {
        setVkycDone(true);
        dispatch({ type: 'SET_VKYC', payload: 'completed' });
        Alert.alert('Already Completed', 'Video KYC was already completed for this application.');
      } else {
        Alert.alert(
          'vKYC Initiated',
          'A vKYC link has been sent to your registered mobile and email. You can also open the link below to start the video KYC call.',
        );
      }
    } catch (err) {
      console.log('[EnachEsign] vKYC initiation error:', err.message);
      Alert.alert('Error', 'Video KYC initiation failed. Please try again.');
    } finally {
      setVkycLoading(false);
    }
  };

  const handleOpenVkycUrl = () => {
    if (vkycUrl) {
      Linking.openURL(vkycUrl).catch(() => {
        Alert.alert('Error', 'Could not open the vKYC link. Please copy and open it in your browser.');
      });
    }
  };

  const handleCopyVkycUrl = () => {
    if (vkycUrl) {
      if (Platform.OS === 'web') {
        navigator.clipboard?.writeText(vkycUrl);
      } else {
        Clipboard.setString(vkycUrl);
      }
      Alert.alert('Copied', 'vKYC link copied to clipboard.');
    }
  };

  const handleCheckVkycStatus = async () => {
    setVkycLoading(true);
    try {
      const result = await kycService.getVkycStatus(state.applicationId);
      if (result.status === 'completed' && result.verified) {
        setVkycDone(true);
        setVkycStatusText('APPROVED');
        dispatch({ type: 'SET_VKYC', payload: 'completed' });
        Alert.alert('Verified', 'Video KYC has been approved.');
      } else if (result.status === 'rejected') {
        setVkycStatusText('REJECTED');
        Alert.alert('Rejected', 'Video KYC was rejected. Please re-initiate and try again.');
        setVkycInitiated(false);
        setVkycUrl(null);
      } else {
        const statusMsg = result.callStatus === 'AGENT_NOT_PICKED'
          ? 'Waiting for an agent. Please try again in a few minutes.'
          : result.callInitiated
            ? 'Video KYC call is in progress or waiting for review.'
            : 'Video KYC is still pending. Please open the link to start the video call.';
        setVkycStatusText(result.vkycStatus || 'PENDING');
        Alert.alert('Pending', statusMsg);
      }
    } catch (err) {
      console.log('[EnachEsign] vKYC status check error:', err.message);
      Alert.alert('Error', 'Failed to check vKYC status. Please try again.');
    } finally {
      setVkycLoading(false);
    }
  };

  const validateReferences = () => {
    const errs = {};
    [ref1, ref2].forEach((r, i) => {
      const p = `ref${i + 1}`;
      if (!r.name || r.name.trim().length < 2) errs[`${p}_name`] = 'Name is required';
      if (!r.phone || !/^[6-9]\d{9}$/.test(r.phone)) errs[`${p}_phone`] = 'Valid 10-digit mobile required';
      if (!r.address || r.address.trim().length < 5) errs[`${p}_address`] = 'Address is required (min 5 chars)';
      if (!r.relation) errs[`${p}_relation`] = 'Please select relation';
    });
    // Both references must be different people
    if (ref1.phone && ref2.phone && ref1.phone === ref2.phone) {
      errs.ref2_phone = 'Must be a different person from Reference 1';
    }
    setRefErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const refsComplete = ref1.name && ref1.phone && ref1.address && ref1.relation
    && ref2.name && ref2.phone && ref2.address && ref2.relation;

  const allDone = enachDone && esignDone && (!requiresVkyc || vkycDone) && refsComplete;

  const [submitLoading, setSubmitLoading] = useState(false);

  const handleSubmit = async () => {
    if (!validateReferences()) {
      Alert.alert('References Required', 'Please fill in both references correctly before submitting.');
      return;
    }
    dispatch({ type: 'SET_REFERENCES', payload: [ref1, ref2] });
    setSubmitLoading(true);
    try {
      const result = await loanService.submitApplication({
        applicationId: state.applicationId,
        loanType: state.loanType,
        instituteDetails: state.instituteDetails,
        studentDetails: state.studentDetails,
        borrowerDetails: state.borrowerDetails,
        selectedProduct: state.selectedProduct,
        selectedTenure: state.selectedTenure,
        panDetails: state.panDetails,
        kycMethod: state.kycMethod,
        bankDetails: state.bankDetails,
        references: [ref1, ref2],
      });
      dispatch({ type: 'SET_SUBMITTED', payload: result.submittedAt });
      navigation.navigate('LoanSuccess');
    } catch {
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
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
                title="Initiate vKYC"
                onPress={handleInitiateVkyc}
                loading={vkycLoading}
                disabled={isRiskDeclined || isManualReview}
                icon="📹"
              />
            ) : !vkycDone ? (
              <>
                <View style={[styles.pendingBanner, { backgroundColor: warningBg }]}>
                  <Text style={[styles.pendingText, { color: colors.warning }]}>
                    vKYC link has been sent to your mobile and email. You can also open it directly from here.
                  </Text>
                  {vkycStatusText && (
                    <Text style={[styles.pendingText, { color: colors.textSecondary, marginTop: 4, fontSize: 12 }]}>
                      Status: {vkycStatusText}
                    </Text>
                  )}
                </View>

                {/* vKYC URL actions */}
                {vkycUrl && (
                  <View style={styles.vkycUrlSection}>
                    <Text style={[styles.vkycUrlLabel, { color: colors.textSecondary }]}>
                      vKYC Link:
                    </Text>
                    <TouchableOpacity onPress={handleOpenVkycUrl}>
                      <Text style={[styles.vkycUrlText, { color: colors.teal }]} numberOfLines={2}>
                        {vkycUrl}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.vkycUrlActions}>
                      <Button
                        title="Open vKYC Link"
                        onPress={handleOpenVkycUrl}
                        icon="🔗"
                        style={{ flex: 1 }}
                      />
                      <TouchableOpacity
                        style={[styles.copyBtn, { borderColor: colors.teal }]}
                        onPress={handleCopyVkycUrl}
                      >
                        <Text style={[styles.copyBtnText, { color: colors.teal }]}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Button
                  title="Check vKYC Status"
                  onPress={handleCheckVkycStatus}
                  loading={vkycLoading}
                  variant="outline"
                  style={{ marginTop: 8 }}
                />
              </>
            ) : (
              <View style={[styles.doneBadge, { backgroundColor: tealBg }]}>
                <Text style={[styles.doneText, { color: colors.teal }]}>✓ Video KYC Approved</Text>
              </View>
            )}
          </Card>
        )}

        {/* References (2 required) */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {requiresVkyc ? '4' : '3'}. References
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Please provide two personal references. They should not be the same person.
          </Text>

          {[
            { label: 'Reference 1', data: ref1, setter: setRef1, prefix: 'ref1' },
            { label: 'Reference 2', data: ref2, setter: setRef2, prefix: 'ref2' },
          ].map(({ label, data, setter, prefix }) => (
            <View key={prefix} style={[styles.refBlock, { borderColor: colors.border }]}>
              <Text style={[styles.refLabel, { color: colors.teal }]}>{label}</Text>
              <Input
                label="Full Name"
                value={data.name}
                onChangeText={(t) => setter({ ...data, name: t })}
                placeholder="Enter full name"
                error={refErrors[`${prefix}_name`]}
              />
              <Input
                label="Mobile Number"
                value={data.phone}
                onChangeText={(t) => setter({ ...data, phone: t.replace(/[^0-9]/g, '') })}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                error={refErrors[`${prefix}_phone`]}
              />
              <Input
                label="Address"
                value={data.address}
                onChangeText={(t) => setter({ ...data, address: t })}
                placeholder="Full address"
                multiline
                error={refErrors[`${prefix}_address`]}
              />
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Relation</Text>
              <View style={styles.relationRow}>
                {RELATION_OPTIONS.map((rel) => (
                  <TouchableOpacity
                    key={rel}
                    style={[
                      styles.relationChip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      data.relation === rel && { borderColor: colors.teal, backgroundColor: colors.teal },
                    ]}
                    onPress={() => setter({ ...data, relation: rel })}
                  >
                    <Text style={[
                      styles.relationChipText,
                      { color: colors.textSecondary },
                      data.relation === rel && { color: colors.background },
                    ]}>
                      {rel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {refErrors[`${prefix}_relation`] && (
                <Text style={[styles.errorText, { color: colors.error }]}>{refErrors[`${prefix}_relation`]}</Text>
              )}
            </View>
          ))}
        </Card>

        {/* Submit Application */}
        {allDone && (
          <Button
            title="Submit Application"
            onPress={handleSubmit}
            loading={submitLoading}
            style={styles.completeBtn}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      <FloatingAssistButton />
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
  // vKYC URL section
  vkycUrlSection: { marginBottom: 12 },
  vkycUrlLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  vkycUrlText: { fontSize: 12, lineHeight: 18, marginBottom: 8, textDecorationLine: 'underline' },
  vkycUrlActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  copyBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  copyBtnText: { fontSize: 13, fontWeight: '700' },
  // References
  refBlock: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  refLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  relationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  relationChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  relationChipText: { fontSize: 12, fontWeight: '500' },
  errorText: { fontSize: 12, color: '#FF6B6B', marginTop: -2, marginBottom: 8 },

  completeBtn: { marginTop: 20 },
  bottomSpacer: { height: 100 },
});

export default EnachEsignScreen;
