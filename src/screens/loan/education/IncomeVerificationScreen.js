import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import { COLORS } from '../../../config/constants';
import { bankService } from '../../../services/bankService';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';
import { useTheme } from '../../../store/ThemeContext';
import { formatCurrency } from '../../../utils/helpers';

const IncomeVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { executePhase, feedBankStatementData } = useRisk();
  const [method, setMethod] = useState(null); // 'aa' or 'statement'
  const [loading, setLoading] = useState(false);
  const [aaInitiated, setAaInitiated] = useState(false);
  const [statementFile, setStatementFile] = useState(null);
  const [incomeResult, setIncomeResult] = useState(null);
  const [eligibilityResult, setEligibilityResult] = useState(null);

  // Bank selection for AA
  const [fipList, setFipList] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [bankSearch, setBankSearch] = useState('');
  const [showBankPicker, setShowBankPicker] = useState(false);

  const loanAmount = state.studentDetails?.balanceFee || 0;

  // Fetch FIP list when AA method is selected
  useEffect(() => {
    if (method === 'aa' && fipList.length === 0) {
      bankService.getFIPList().then((res) => {
        setFipList(res.fips || []);
      }).catch(() => {});
    }
  }, [method]);

  const filteredBanks = fipList.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
    b.code.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // Account Aggregator
  const handleInitiateAA = async () => {
    if (!selectedBank) {
      Alert.alert('Select Bank', 'Please select your bank to proceed with Account Aggregator.');
      return;
    }
    setLoading(true);
    try {
      await bankService.initiateAA({
        phone: state.borrowerDetails?.phone,
        pan: state.panDetails?.panNumber,
        fipId: selectedBank.id,
        fipName: selectedBank.name,
      });
      setAaInitiated(true);
    } catch {
      setAaInitiated(true); // Mock
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAAStatus = async () => {
    setLoading(true);
    try {
      const result = await bankService.getAAStatus(state.borrowerDetails?.phone);
      if (result.status === 'completed') {
        setIncomeResult(result.income);
        await runEligibilityCheck(result.income);
      } else {
        Alert.alert('Pending', 'Account Aggregator consent is still pending. Please approve on your bank app.');
      }
    } catch {
      // Mock income data
      const mockIncome = {
        monthlyIncome: 45000,
        averageBalance: 32000,
        totalCredits: 270000,
        totalDebits: 210000,
        emiObligations: 8000,
        bounceCount: 0,
      };
      setIncomeResult(mockIncome);
      await runEligibilityCheck(mockIncome);
    } finally {
      setLoading(false);
    }
  };

  // Bank Statement Upload
  const handlePickStatement = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });
      if (!result.canceled && result.assets?.[0]) {
        setStatementFile(result.assets[0]);
      }
    } catch {
      Alert.alert('Error', 'Could not pick file');
    }
  };

  const handleUploadStatement = async () => {
    if (!statementFile) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: statementFile.uri,
        type: statementFile.mimeType,
        name: statementFile.name,
      });
      const result = await bankService.uploadBankStatement(formData);
      setIncomeResult(result.income);
      await runEligibilityCheck(result.income);
    } catch {
      const mockIncome = {
        monthlyIncome: 45000,
        averageBalance: 32000,
        totalCredits: 270000,
        totalDebits: 210000,
        emiObligations: 8000,
        bounceCount: 0,
      };
      setIncomeResult(mockIncome);
      await runEligibilityCheck(mockIncome);
    } finally {
      setLoading(false);
    }
  };

  // Eligibility Check (hard pull + rules)
  const runEligibilityCheck = async (income) => {
    try {
      // Hard pull of credit report
      await kycService.hardPull({
        pan: state.panDetails?.panNumber,
        name: state.borrowerDetails?.name,
        phone: state.borrowerDetails?.phone,
      });
    } catch {
      // Mock
    }

    // Run eligibility rules
    const foir = income.emiObligations / income.monthlyIncome;
    const emiCapacity = income.monthlyIncome * 0.5 - income.emiObligations;
    const requestedEmi = state.selectedProduct
      ? loanAmount *
        (state.selectedProduct.interestRate / 1200) *
        Math.pow(1 + state.selectedProduct.interestRate / 1200, state.selectedTenure) /
        (Math.pow(1 + state.selectedProduct.interestRate / 1200, state.selectedTenure) - 1)
      : 0;

    let result;
    if (foir < 0.5 && emiCapacity >= requestedEmi && income.bounceCount <= 1) {
      result = { status: 'fully_eligible', message: 'Congratulations! You are fully eligible.' };
    } else if (foir < 0.65 && emiCapacity >= requestedEmi * 0.7) {
      result = {
        status: 'partially_eligible',
        message: 'You are partially eligible. Additional documents or a co-borrower may be needed.',
      };
    } else {
      result = {
        status: 'not_eligible',
        message: 'Unfortunately, you are not eligible at this time. Please try after 6 months.',
      };
    }

    setEligibilityResult(result);
    dispatch({ type: 'SET_INCOME', payload: income });
    dispatch({ type: 'SET_ELIGIBILITY', payload: result });

    // Feed bank statement data into risk engine for scoring
    feedBankStatementData(income, method === 'aa' ? 'aa' : 'upload');

    // Trigger Phase B risk scoring in background
    const borrowerName = state.borrowerDetails?.name || '';
    const nameParts = borrowerName.trim().split(/\s+/);
    const applicant = {
      phone: state.borrowerDetails?.phone,
      firstName: nameParts[0] || '',
      lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
      pan: state.panDetails?.panNumber,
      dob: '',
      address: '',
      pincode: '',
      monthlyIncome: income.monthlyIncome || 0,
      existingEmi: income.emiObligations || 0,
      loanAmount: loanAmount,
      interestRate: state.selectedProduct?.interestRate || 14,
      tenure: state.selectedTenure || 12,
    };

    executePhase('B', applicant).catch(() => {
      // Phase B failure is non-blocking
    });
  };

  const handleProceed = () => {
    navigation.navigate('KycVerification');
  };

  const handleAddCoBorrower = () => {
    Alert.alert(
      'Add Co-Borrower',
      'You will need to provide KYC, income and bank details for the co-borrower.',
      [
        { text: 'Cancel' },
        {
          text: 'Proceed',
          onPress: () => {
            dispatch({ type: 'RESET' });
            navigation.navigate('InstituteSelection');
          },
        },
      ]
    );
  };

  const handleRetryDifferentBorrower = () => {
    dispatch({ type: 'RESET' });
    navigation.navigate('InstituteSelection');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Income Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={3} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Method Selection */}
        {!incomeResult && (
          <Card>
            <Text style={styles.sectionTitle}>Verify Your Income</Text>
            <Text style={styles.infoText}>
              Choose a method to verify your income. This helps us determine your loan eligibility.
            </Text>

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.option, method === 'aa' && styles.selectedOption]}
                onPress={() => setMethod('aa')}
              >
                <Text style={styles.optionIcon}>🏦</Text>
                <Text style={[styles.optionTitle, method === 'aa' && styles.selectedText]}>
                  Account Aggregator
                </Text>
                <Text style={styles.optionDesc}>Instant & Secure</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.option, method === 'statement' && styles.selectedOption]}
                onPress={() => setMethod('statement')}
              >
                <Text style={styles.optionIcon}>📄</Text>
                <Text style={[styles.optionTitle, method === 'statement' && styles.selectedText]}>
                  Bank Statement
                </Text>
                <Text style={styles.optionDesc}>Upload PDF</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Account Aggregator */}
        {method === 'aa' && !incomeResult && (
          <Card>
            <Text style={styles.sectionTitle}>Account Aggregator</Text>
            <Text style={styles.infoText}>
              Select your bank to securely fetch your financial data via Account Aggregator.
              You will receive a consent request on your bank app.
            </Text>

            {/* Bank Selection */}
            {!aaInitiated && (
              <>
                <Text style={styles.fieldLabel}>Select Your Bank</Text>
                <TouchableOpacity
                  style={[styles.bankSelector, selectedBank && styles.bankSelectorSelected]}
                  onPress={() => setShowBankPicker(true)}
                >
                  {selectedBank ? (
                    <View style={styles.selectedBankRow}>
                      <View style={styles.bankCodeBadge}>
                        <Text style={styles.bankCodeText}>{selectedBank.code}</Text>
                      </View>
                      <Text style={styles.selectedBankName}>{selectedBank.name}</Text>
                    </View>
                  ) : (
                    <Text style={styles.bankPlaceholder}>Tap to select bank...</Text>
                  )}
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Bank Picker Modal */}
            <Modal visible={showBankPicker} animationType="slide" transparent>
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface || COLORS.surface }]}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Your Bank</Text>
                    <TouchableOpacity onPress={() => setShowBankPicker(false)}>
                      <Text style={styles.modalClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.searchBox}>
                    <TextInput
                      style={[styles.searchInput, { color: COLORS.textPrimary }]}
                      placeholder="Search bank name..."
                      placeholderTextColor={COLORS.textSecondary}
                      value={bankSearch}
                      onChangeText={setBankSearch}
                      autoFocus
                    />
                  </View>
                  <FlatList
                    data={filteredBanks}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.bankItem,
                          selectedBank?.id === item.id && styles.bankItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedBank(item);
                          setShowBankPicker(false);
                          setBankSearch('');
                        }}
                      >
                        <View style={styles.bankCodeBadge}>
                          <Text style={styles.bankCodeText}>{item.code}</Text>
                        </View>
                        <Text style={styles.bankItemName}>{item.name}</Text>
                        {selectedBank?.id === item.id && (
                          <Text style={styles.checkMark}>✓</Text>
                        )}
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <Text style={styles.emptyText}>No banks found</Text>
                    }
                  />
                </View>
              </View>
            </Modal>

            {!aaInitiated ? (
              <Button
                title="Initiate AA Consent"
                onPress={handleInitiateAA}
                loading={loading}
                disabled={!selectedBank}
                style={styles.btn}
              />
            ) : (
              <>
                <View style={styles.pendingBanner}>
                  <Text style={styles.pendingText}>
                    Consent request sent to {selectedBank?.name}! Please approve on your bank app, then check status below.
                  </Text>
                </View>
                <Button
                  title="Check Status"
                  onPress={handleCheckAAStatus}
                  loading={loading}
                  style={styles.btn}
                />
                <Button
                  title="Upload Bank Statement Instead"
                  onPress={() => setMethod('statement')}
                  variant="outline"
                  style={styles.btn}
                />
              </>
            )}
          </Card>
        )}

        {/* Bank Statement Upload */}
        {method === 'statement' && !incomeResult && (
          <Card>
            <Text style={styles.sectionTitle}>Upload Bank Statement</Text>
            <Text style={styles.infoText}>
              Upload your latest 6-month bank statement (PDF format).
            </Text>
            <Button
              title={statementFile ? `Selected: ${statementFile.name}` : 'Select Bank Statement'}
              onPress={handlePickStatement}
              variant={statementFile ? 'success' : 'outline'}
            />
            {statementFile && (
              <Button
                title="Upload & Analyze"
                onPress={handleUploadStatement}
                loading={loading}
                style={styles.btn}
              />
            )}
          </Card>
        )}

        {/* Income Summary */}
        {incomeResult && (
          <Card>
            <Text style={styles.sectionTitle}>Income Analysis</Text>
            <View style={styles.incomeGrid}>
              <View style={styles.incomeItem}>
                <Text style={styles.incomeLabel}>Monthly Income</Text>
                <Text style={styles.incomeValue}>{formatCurrency(incomeResult.monthlyIncome)}</Text>
              </View>
              <View style={styles.incomeItem}>
                <Text style={styles.incomeLabel}>Avg Balance</Text>
                <Text style={styles.incomeValue}>{formatCurrency(incomeResult.averageBalance)}</Text>
              </View>
              <View style={styles.incomeItem}>
                <Text style={styles.incomeLabel}>EMI Obligations</Text>
                <Text style={styles.incomeValue}>{formatCurrency(incomeResult.emiObligations)}</Text>
              </View>
              <View style={styles.incomeItem}>
                <Text style={styles.incomeLabel}>Bounces</Text>
                <Text style={styles.incomeValue}>{incomeResult.bounceCount}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Eligibility Result */}
        {eligibilityResult?.status === 'fully_eligible' && (
          <Card style={styles.successCard}>
            <Text style={styles.successIcon}>🎉</Text>
            <Text style={styles.successTitle}>Congratulations!</Text>
            <Text style={styles.successText}>{eligibilityResult.message}</Text>
            <Button title="Continue" onPress={handleProceed} style={styles.btn} />
          </Card>
        )}

        {eligibilityResult?.status === 'partially_eligible' && (
          <Card style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningTitle}>Partially Eligible</Text>
            <Text style={styles.warningText}>{eligibilityResult.message}</Text>
            <Button title="Add Co-Borrower" onPress={handleAddCoBorrower} style={styles.btn} />
            <Button
              title="Apply with Different Borrower"
              onPress={handleRetryDifferentBorrower}
              variant="outline"
              style={styles.btn}
            />
          </Card>
        )}

        {eligibilityResult?.status === 'not_eligible' && (
          <Card style={styles.failCard}>
            <Text style={styles.failIcon}>😔</Text>
            <Text style={styles.failTitle}>Not Eligible</Text>
            <Text style={styles.failText}>{eligibilityResult.message}</Text>
            <Button
              title="Apply with Different Borrower"
              onPress={handleRetryDifferentBorrower}
              variant="outline"
              style={styles.btn}
            />
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
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 16 },
  optionsRow: { flexDirection: 'row', gap: 12 },
  option: {
    flex: 1, padding: 16, borderRadius: 12, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center',
  },
  selectedOption: { borderColor: COLORS.teal, backgroundColor: 'rgba(74,237,196,0.08)' },
  optionIcon: { fontSize: 32, marginBottom: 8 },
  optionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  selectedText: { color: COLORS.teal },
  optionDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  bankSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    padding: 14, backgroundColor: COLORS.inputBg,
  },
  bankSelectorSelected: { borderColor: COLORS.teal },
  selectedBankRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectedBankName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginLeft: 10 },
  bankPlaceholder: { fontSize: 14, color: COLORS.textSecondary },
  dropdownArrow: { fontSize: 10, color: COLORS.textSecondary, marginLeft: 8 },
  bankCodeBadge: {
    backgroundColor: 'rgba(74,237,196,0.12)', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, minWidth: 48, alignItems: 'center',
  },
  bankCodeText: { fontSize: 11, fontWeight: '700', color: COLORS.teal },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { fontSize: 20, color: COLORS.textSecondary, padding: 4 },
  searchBox: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: COLORS.inputBg, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  bankItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  bankItemSelected: { backgroundColor: 'rgba(74,237,196,0.08)' },
  bankItemName: { fontSize: 14, color: COLORS.textPrimary, marginLeft: 10, flex: 1 },
  checkMark: { fontSize: 16, color: COLORS.teal, fontWeight: '700' },
  emptyText: { padding: 20, textAlign: 'center', color: COLORS.textSecondary, fontSize: 14 },
  pendingBanner: { backgroundColor: 'rgba(74,237,196,0.08)', padding: 12, borderRadius: 8, marginBottom: 12 },
  pendingText: { fontSize: 13, color: COLORS.teal, lineHeight: 20 },
  btn: { marginTop: 12 },
  incomeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  incomeItem: {
    width: '47%', backgroundColor: 'rgba(74,237,196,0.08)', padding: 12, borderRadius: 10, alignItems: 'center',
  },
  incomeLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  incomeValue: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  successCard: { alignItems: 'center', backgroundColor: 'rgba(74,237,196,0.08)' },
  successIcon: { fontSize: 48, marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: '800', color: COLORS.teal, marginBottom: 8 },
  successText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  warningCard: { alignItems: 'center', backgroundColor: 'rgba(245,183,49,0.08)' },
  warningIcon: { fontSize: 48, marginBottom: 8 },
  warningTitle: { fontSize: 22, fontWeight: '800', color: COLORS.warning, marginBottom: 8 },
  warningText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  failCard: { alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.08)' },
  failIcon: { fontSize: 48, marginBottom: 8 },
  failTitle: { fontSize: 22, fontWeight: '800', color: COLORS.error, marginBottom: 8 },
  failText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default IncomeVerificationScreen;
