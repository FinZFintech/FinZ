import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { COLORS } from '../../../config/constants';
import { bankService } from '../../../services/bankService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';
import { validateIfsc, validateAccountNumber } from '../../../utils/helpers';

const OCCUPATIONS = ['Salaried', 'Self-Employed', 'Business', 'Student', 'Homemaker', 'Retired'];
const ACCOUNT_TYPES = ['Savings', 'Current'];

const BankDetailsScreen = ({ navigation }) => {
  const { state, dispatch } = useLoan();
  const { executePhase } = useRisk();
  const [occupation, setOccupation] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountType, setAccountType] = useState('');
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pennyDropDone, setPennyDropDone] = useState(false);
  const [pennyDropResult, setPennyDropResult] = useState(null);
  const [errors, setErrors] = useState({});

  const handleIfscLookup = async (ifscCode) => {
    setIfsc(ifscCode.toUpperCase());
    if (ifscCode.length === 11 && validateIfsc(ifscCode.toUpperCase())) {
      try {
        const result = await bankService.validateIfsc(ifscCode.toUpperCase());
        setBankName(result.bank || '');
        setBranchName(result.branch || '');
      } catch {
        // Mock IFSC lookup
        setBankName('State Bank of India');
        setBranchName('Koramangala Branch');
      }
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!occupation) newErrors.occupation = 'Please select occupation';
    if (!bankName.trim()) newErrors.bankName = 'Bank name is required';
    if (!validateAccountNumber(accountNumber)) newErrors.accountNumber = 'Invalid account number';
    if (accountNumber !== confirmAccountNumber) newErrors.confirmAccountNumber = 'Account numbers do not match';
    if (!validateIfsc(ifsc)) newErrors.ifsc = 'Invalid IFSC code';
    if (!accountType) newErrors.accountType = 'Please select account type';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePennyDrop = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await bankService.pennyDrop({
        accountNumber,
        ifsc,
        name: state.borrowerDetails?.name,
      });
      setPennyDropResult(result);
      setPennyDropDone(true);

      if (result.verified && result.nameMatch) {
        dispatch({
          type: 'SET_BANK_DETAILS',
          payload: { bankName, accountNumber, ifsc, accountType, branchName, occupation },
        });
        dispatch({ type: 'SET_PENNY_DROP', payload: result });
        triggerPhaseD();
      }
    } catch {
      // Mock penny drop
      const mockResult = {
        verified: true,
        nameMatch: true,
        accountHolderName: state.borrowerDetails?.name?.toUpperCase() || 'RAHUL SHARMA',
        bankRefNo: 'PD' + Date.now(),
      };
      setPennyDropResult(mockResult);
      setPennyDropDone(true);
      dispatch({
        type: 'SET_BANK_DETAILS',
        payload: { bankName, accountNumber, ifsc, accountType, branchName, occupation },
      });
      dispatch({ type: 'SET_PENNY_DROP', payload: mockResult });
      triggerPhaseD();
    } finally {
      setLoading(false);
    }
  };

  const triggerPhaseD = () => {
    const borrowerName = state.borrowerDetails?.name || '';
    const nameParts = borrowerName.trim().split(/\s+/);
    const applicant = {
      accountNumber,
      ifsc,
      firstName: nameParts[0] || '',
      lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
      phone: state.borrowerDetails?.phone,
      imei: '',
      documentImageUrl: null,
    };

    executePhase('D', applicant).then((result) => {
      // Store final risk profile in loan context
      dispatch({ type: 'SET_RISK_PROFILE', payload: result });
    }).catch(() => {
      // Phase D failure is non-blocking
    });
  };

  const loanAmount = state.studentDetails?.balanceFee || 0;
  const requiresVkyc = loanAmount >= 60000;

  const handleProceed = () => {
    if (requiresVkyc) {
      navigation.navigate('VkycScreen');
    } else {
      navigation.navigate('EnachEsign');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Bank Details" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={5} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Occupation */}
        <Card>
          <Text style={styles.sectionTitle}>Occupation</Text>
          <View style={styles.chipRow}>
            {OCCUPATIONS.map((occ) => (
              <TouchableOpacity
                key={occ}
                style={[styles.chip, occupation === occ && styles.selectedChip]}
                onPress={() => setOccupation(occ)}
              >
                <Text style={[styles.chipText, occupation === occ && styles.selectedChipText]}>
                  {occ}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.occupation && <Text style={styles.errorText}>{errors.occupation}</Text>}
        </Card>

        {/* Bank Details */}
        <Card>
          <Text style={styles.sectionTitle}>Bank Account Details</Text>
          <Input
            label="IFSC Code"
            value={ifsc}
            onChangeText={handleIfscLookup}
            placeholder="e.g., SBIN0001234"
            maxLength={11}
            autoCapitalize="characters"
            error={errors.ifsc}
          />
          {bankName && (
            <>
              <InfoRow label="Bank" value={bankName} />
              {branchName && <InfoRow label="Branch" value={branchName} />}
            </>
          )}
          <Input
            label="Account Number"
            value={accountNumber}
            onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ''))}
            placeholder="Enter account number"
            keyboardType="number-pad"
            maxLength={18}
            error={errors.accountNumber}
          />
          <Input
            label="Confirm Account Number"
            value={confirmAccountNumber}
            onChangeText={(t) => setConfirmAccountNumber(t.replace(/[^0-9]/g, ''))}
            placeholder="Re-enter account number"
            keyboardType="number-pad"
            maxLength={18}
            error={errors.confirmAccountNumber}
          />
          <Text style={styles.fieldLabel}>Account Type</Text>
          <View style={styles.chipRow}>
            {ACCOUNT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, accountType === type && styles.selectedChip]}
                onPress={() => setAccountType(type)}
              >
                <Text style={[styles.chipText, accountType === type && styles.selectedChipText]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.accountType && <Text style={styles.errorText}>{errors.accountType}</Text>}
        </Card>

        {/* Penny Drop */}
        {!pennyDropDone ? (
          <Button
            title="Verify Bank Account"
            onPress={handlePennyDrop}
            loading={loading}
            style={styles.verifyBtn}
          />
        ) : (
          <Card style={pennyDropResult?.verified ? styles.successCard : styles.failCard}>
            <Text style={pennyDropResult?.verified ? styles.successTitle : styles.failTitle}>
              {pennyDropResult?.verified ? '✓ Bank Account Verified' : '✕ Verification Failed'}
            </Text>
            {pennyDropResult?.verified && (
              <>
                <InfoRow label="Account Holder" value={pennyDropResult.accountHolderName} />
                <InfoRow label="Name Match" value={pennyDropResult.nameMatch ? 'Matched' : 'Mismatch'} />
                <Button title="Continue" onPress={handleProceed} style={styles.btn} />
              </>
            )}
            {!pennyDropResult?.verified && (
              <Text style={styles.failText}>
                Bank account could not be verified. Please check details and try again.
              </Text>
            )}
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  selectedChip: { borderColor: COLORS.teal, backgroundColor: COLORS.teal },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  selectedChipText: { color: COLORS.background },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: -4, marginBottom: 8 },
  verifyBtn: { marginTop: 8 },
  btn: { marginTop: 12 },
  successCard: { backgroundColor: 'rgba(74,237,196,0.08)' },
  successTitle: { fontSize: 16, fontWeight: '700', color: COLORS.teal, marginBottom: 8 },
  failCard: { backgroundColor: 'rgba(255,107,107,0.08)' },
  failTitle: { fontSize: 16, fontWeight: '700', color: COLORS.error, marginBottom: 8 },
  failText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default BankDetailsScreen;
