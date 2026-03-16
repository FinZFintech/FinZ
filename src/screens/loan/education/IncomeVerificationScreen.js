import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { bankService } from '../../../services/bankService';
import { kycService } from '../../../services/kycService';
import { useLoan } from '../../../store/LoanContext';
import { useRisk } from '../../../store/RiskContext';
import { useTheme } from '../../../store/ThemeContext';
import { formatCurrency, validateIfsc, validateAccountNumber } from '../../../utils/helpers';

const OCCUPATIONS = ['Salaried', 'Self-Employed', 'Business', 'Student', 'Homemaker', 'Retired'];
const ACCOUNT_TYPES = ['Savings', 'Current'];

const IncomeVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { executePhase, feedBankStatementData } = useRisk();

  // Occupation
  const [occupation, setOccupation] = useState('');

  // Bank details
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('');

  // Income method
  const [method, setMethod] = useState(null); // 'aa' or 'statement'
  const [loading, setLoading] = useState(false);
  const [statementFile, setStatementFile] = useState(null);
  const [incomeResult, setIncomeResult] = useState(null);
  const [eligibilityResult, setEligibilityResult] = useState(null);

  // Penny drop
  const [pennyDropDone, setPennyDropDone] = useState(false);
  const [pennyDropResult, setPennyDropResult] = useState(null);

  // Matching results
  const [matchResult, setMatchResult] = useState(null);

  // Bank selection for AA (auto-filled from IFSC)
  const [fipList, setFipList] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [aaInitiated, setAaInitiated] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({});

  const loanAmount = state.studentDetails?.balanceFee || 0;

  // Fetch FIP list on mount so we can auto-match from IFSC
  useEffect(() => {
    bankService.getFIPList().then((res) => {
      setFipList(res.fips || []);
    }).catch(() => {});
  }, []);

  // Auto-match bank name to FIP list for AA
  const matchBankToFip = (name) => {
    if (!name || fipList.length === 0) return;
    const lower = name.toLowerCase();
    const match = fipList.find((fip) =>
      lower.includes(fip.name.toLowerCase()) ||
      fip.name.toLowerCase().includes(lower) ||
      lower.includes(fip.code.toLowerCase())
    );
    if (match) {
      setSelectedBank(match);
      // Auto-select AA method since bank is identified
      if (!method) setMethod('aa');
    }
  };

  const handleIfscLookup = async (ifscCode) => {
    setIfsc(ifscCode.toUpperCase());
    if (ifscCode.length === 11 && validateIfsc(ifscCode.toUpperCase())) {
      try {
        const result = await bankService.validateIfsc(ifscCode.toUpperCase());
        const fetchedBank = result.bank || '';
        const fetchedBranch = result.branch || '';
        setBankName(fetchedBank);
        setBranchName(fetchedBranch);
        matchBankToFip(fetchedBank);
      } catch {
        setBankName('State Bank of India');
        setBranchName('Koramangala Branch');
        matchBankToFip('State Bank of India');
      }
    } else {
      setBankName('');
      setBranchName('');
      setSelectedBank(null);
    }
  };

  const validateBankDetails = () => {
    const newErrors = {};
    if (!occupation) newErrors.occupation = 'Please select occupation';
    if (!validateIfsc(ifsc)) newErrors.ifsc = 'Invalid IFSC code';
    if (!validateAccountNumber(accountNumber)) newErrors.accountNumber = 'Invalid account number';
    if (accountNumber !== confirmAccountNumber) newErrors.confirmAccountNumber = 'Account numbers do not match';
    if (!accountType) newErrors.accountType = 'Please select account type';
    if (method === 'aa' && !selectedBank) newErrors.ifsc = 'Could not identify bank from IFSC. Please check your IFSC code.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Run penny drop and AA fetch simultaneously
  const handleVerifyAndFetch = async () => {
    if (!validateBankDetails()) return;
    setLoading(true);

    const pennyDropPromise = runPennyDrop();
    const incomePromise = method === 'aa' ? runAAFetch() : runStatementUpload();

    try {
      const [pdResult, incResult] = await Promise.all([pennyDropPromise, incomePromise]);

      // Store bank details
      dispatch({
        type: 'SET_BANK_DETAILS',
        payload: { bankName, accountNumber, ifsc, accountType, branchName, occupation },
      });

      // Run matching if both succeeded
      if (pdResult && incResult) {
        runMatching(pdResult, incResult);
      }
    } finally {
      setLoading(false);
    }
  };

  const runPennyDrop = async () => {
    try {
      const result = await bankService.pennyDrop({
        accountNumber,
        ifsc,
        name: state.borrowerDetails?.name,
      });
      setPennyDropResult(result);
      setPennyDropDone(true);
      dispatch({ type: 'SET_PENNY_DROP', payload: result });
      return result;
    } catch {
      // Mock penny drop
      const mockResult = {
        verified: true,
        nameMatch: true,
        accountHolderName: state.borrowerDetails?.name?.toUpperCase() || 'RAHUL SHARMA',
        bankRefNo: 'PD' + Date.now(),
        accountNumberLast4: accountNumber.slice(-4),
      };
      setPennyDropResult(mockResult);
      setPennyDropDone(true);
      dispatch({ type: 'SET_PENNY_DROP', payload: mockResult });
      return mockResult;
    }
  };

  const getMockIncomeData = () => ({
    monthlyIncome: 45000,
    averageBalance: 32000,
    totalCredits: 270000,
    totalDebits: 210000,
    emiObligations: 8000,
    bounceCount: 0,
    accountHolderName: state.borrowerDetails?.name?.toUpperCase() || 'RAHUL SHARMA',
    accountNumberLast4: accountNumber.slice(-4),
  });

  const runAAFetch = async () => {
    try {
      await bankService.initiateAA({
        phone: state.borrowerDetails?.phone,
        pan: state.panDetails?.panNumber,
        fipId: selectedBank.id,
        fipName: selectedBank.name,
      });
      setAaInitiated(true);

      // Simulate AA consent and data fetch
      const result = await bankService.getAAStatus(state.borrowerDetails?.phone);
      if (result.status === 'completed') {
        setIncomeResult(result.income);
        await runEligibilityCheck(result.income);
        return result.income;
      }
    } catch {
      // Mock AA data
    }
    const mockIncome = getMockIncomeData();
    setIncomeResult(mockIncome);
    await runEligibilityCheck(mockIncome);
    return mockIncome;
  };

  const runStatementUpload = async () => {
    if (!statementFile) {
      const mockIncome = getMockIncomeData();
      setIncomeResult(mockIncome);
      await runEligibilityCheck(mockIncome);
      return mockIncome;
    }
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
      return result.income;
    } catch {
      const mockIncome = getMockIncomeData();
      setIncomeResult(mockIncome);
      await runEligibilityCheck(mockIncome);
      return mockIncome;
    }
  };

  // Match name and last 4 digits of account between penny drop and AA response
  const runMatching = (pdResult, aaIncome) => {
    const pdName = (pdResult.accountHolderName || '').trim().toUpperCase();
    const aaName = (aaIncome.accountHolderName || '').trim().toUpperCase();
    const nameMatched = pdName.length > 0 && aaName.length > 0 && pdName === aaName;

    const pdLast4 = (pdResult.accountNumberLast4 || accountNumber.slice(-4));
    const aaLast4 = (aaIncome.accountNumberLast4 || accountNumber.slice(-4));
    const accountMatched = pdLast4 === aaLast4;

    setMatchResult({
      nameMatched,
      accountMatched,
      pdName,
      aaName,
      pdLast4,
      aaLast4,
    });
  };

  // Bank Statement Upload picker
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

  // Eligibility Check
  const runEligibilityCheck = async (income) => {
    try {
      await kycService.hardPull({
        pan: state.panDetails?.panNumber,
        name: state.borrowerDetails?.name,
        phone: state.borrowerDetails?.phone,
      });
    } catch {
      // Mock
    }

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
    } else {
      result = {
        status: 'not_eligible',
        message: 'Unfortunately, you are not eligible at this time. Please try after 6 months.',
      };
    }

    setEligibilityResult(result);
    dispatch({ type: 'SET_INCOME', payload: income });
    dispatch({ type: 'SET_ELIGIBILITY', payload: result });

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

    executePhase('B', applicant).catch(() => {});
  };

  const handleProceed = () => {
    navigation.navigate('KycVerification');
  };

  const handleRetryDifferentBorrower = () => {
    dispatch({ type: 'RESET' });
    navigation.navigate('InstituteSelection');
  };

  const tealBg = `${colors.teal}14`;
  const errorBg = `${colors.error}14`;
  const tealBadgeBg = `${colors.teal}1F`;
  const verificationDone = pennyDropDone && incomeResult;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Income & Bank Verification" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={3} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Occupation */}
        {!verificationDone && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Occupation</Text>
            <View style={styles.chipRow}>
              {OCCUPATIONS.map((occ) => (
                <TouchableOpacity
                  key={occ}
                  style={[
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    occupation === occ && { borderColor: colors.teal, backgroundColor: colors.teal },
                  ]}
                  onPress={() => setOccupation(occ)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: colors.textSecondary },
                    occupation === occ && { color: colors.background },
                  ]}>
                    {occ}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.occupation && <Text style={[styles.errorText, { color: colors.error }]}>{errors.occupation}</Text>}
          </Card>
        )}

        {/* Bank Account Details */}
        {!verificationDone && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bank Account Details</Text>
            <Input
              label="IFSC Code"
              value={ifsc}
              onChangeText={handleIfscLookup}
              placeholder="e.g., SBIN0001234"
              maxLength={11}
              autoCapitalize="characters"
              error={errors.ifsc}
            />
            {bankName ? (
              <>
                <InfoRow label="Bank" value={bankName} />
                {branchName ? <InfoRow label="Branch" value={branchName} /> : null}
              </>
            ) : null}
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
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Account Type</Text>
            <View style={styles.chipRow}>
              {ACCOUNT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    accountType === type && { borderColor: colors.teal, backgroundColor: colors.teal },
                  ]}
                  onPress={() => setAccountType(type)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: colors.textSecondary },
                    accountType === type && { color: colors.background },
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.accountType && <Text style={[styles.errorText, { color: colors.error }]}>{errors.accountType}</Text>}
          </Card>
        )}

        {/* Income Method Selection */}
        {!verificationDone && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Verify Your Income</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Choose a method to verify your income. Bank details will be verified via penny drop simultaneously.
            </Text>

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.option, { borderColor: colors.border }, method === 'aa' && { borderColor: colors.teal, backgroundColor: tealBg }]}
                onPress={() => setMethod('aa')}
              >
                <Text style={styles.optionIcon}>🏦</Text>
                <Text style={[styles.optionTitle, { color: colors.textSecondary }, method === 'aa' && { color: colors.teal }]}>
                  Account Aggregator
                </Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Instant & Secure</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.option, { borderColor: colors.border }, method === 'statement' && { borderColor: colors.teal, backgroundColor: tealBg }]}
                onPress={() => setMethod('statement')}
              >
                <Text style={styles.optionIcon}>📄</Text>
                <Text style={[styles.optionTitle, { color: colors.textSecondary }, method === 'statement' && { color: colors.teal }]}>
                  Bank Statement
                </Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Upload PDF</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* AA - Pre-filled Bank Account Summary & Initiate */}
        {method === 'aa' && !verificationDone && bankName && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account Aggregator</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Your bank has been identified from the IFSC code. Please verify the details below before initiating AA consent.
            </Text>

            {/* Pre-filled Bank Details (read-only) */}
            <View style={[styles.prefillCard, { backgroundColor: tealBg, borderColor: colors.teal }]}>
              {selectedBank && (
                <View style={styles.prefillRow}>
                  <View style={[styles.bankCodeBadge, { backgroundColor: tealBadgeBg }]}>
                    <Text style={[styles.bankCodeText, { color: colors.teal }]}>{selectedBank.code}</Text>
                  </View>
                  <Text style={[styles.prefillBankName, { color: colors.teal }]}>{selectedBank.name}</Text>
                </View>
              )}
              <InfoRow label="Bank" value={bankName} />
              {branchName ? <InfoRow label="Branch" value={branchName} /> : null}
              <InfoRow label="IFSC" value={ifsc} />
              <InfoRow label="Account No." value={`****${accountNumber.slice(-4)}`} />
              <InfoRow label="Account Type" value={accountType} />
            </View>

            {!selectedBank && (
              <Text style={[styles.warnText, { color: colors.error }]}>
                Could not auto-match bank from IFSC. Please verify your IFSC code.
              </Text>
            )}

            <Button
              title="Verify Bank & Fetch Income"
              onPress={handleVerifyAndFetch}
              loading={loading}
              disabled={!selectedBank}
              style={styles.btn}
            />
          </Card>
        )}

        {/* Statement Upload */}
        {method === 'statement' && !verificationDone && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upload Bank Statement</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Upload your latest 6-month bank statement (PDF format).
            </Text>
            <Button
              title={statementFile ? `Selected: ${statementFile.name}` : 'Select Bank Statement'}
              onPress={handlePickStatement}
              variant={statementFile ? 'success' : 'outline'}
            />
            {statementFile && (
              <Button
                title="Verify Bank & Analyze Statement"
                onPress={handleVerifyAndFetch}
                loading={loading}
                style={styles.btn}
              />
            )}
          </Card>
        )}

        {/* Penny Drop Result */}
        {pennyDropDone && (
          <Card style={pennyDropResult?.verified ? { backgroundColor: tealBg } : { backgroundColor: errorBg }}>
            <Text style={[
              styles.verifyTitle,
              { color: pennyDropResult?.verified ? colors.teal : colors.error },
            ]}>
              {pennyDropResult?.verified ? '✓ Bank Account Verified' : '✕ Bank Verification Failed'}
            </Text>
            {pennyDropResult?.verified && (
              <>
                <InfoRow label="Account Holder" value={pennyDropResult.accountHolderName} />
                <InfoRow label="Name Match" value={pennyDropResult.nameMatch ? 'Matched' : 'Mismatch'} />
                <InfoRow label="Ref No." value={pennyDropResult.bankRefNo} />
              </>
            )}
          </Card>
        )}

        {/* Matching Results */}
        {matchResult && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cross-Verification</Text>
            <View style={[styles.matchRow, { backgroundColor: matchResult.nameMatched ? tealBg : errorBg }]}>
              <Text style={[styles.matchIcon, { color: matchResult.nameMatched ? colors.teal : colors.error }]}>
                {matchResult.nameMatched ? '✓' : '✕'}
              </Text>
              <View style={styles.matchInfo}>
                <Text style={[styles.matchLabel, { color: colors.textPrimary }]}>Name Match</Text>
                <Text style={[styles.matchDetail, { color: colors.textSecondary }]}>
                  Penny Drop: {matchResult.pdName}
                </Text>
                <Text style={[styles.matchDetail, { color: colors.textSecondary }]}>
                  AA/Statement: {matchResult.aaName}
                </Text>
              </View>
            </View>
            <View style={[styles.matchRow, { backgroundColor: matchResult.accountMatched ? tealBg : errorBg, marginTop: 8 }]}>
              <Text style={[styles.matchIcon, { color: matchResult.accountMatched ? colors.teal : colors.error }]}>
                {matchResult.accountMatched ? '✓' : '✕'}
              </Text>
              <View style={styles.matchInfo}>
                <Text style={[styles.matchLabel, { color: colors.textPrimary }]}>Account Last 4 Digits</Text>
                <Text style={[styles.matchDetail, { color: colors.textSecondary }]}>
                  Penny Drop: ****{matchResult.pdLast4}
                </Text>
                <Text style={[styles.matchDetail, { color: colors.textSecondary }]}>
                  AA/Statement: ****{matchResult.aaLast4}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Income Summary */}
        {incomeResult && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Income Analysis</Text>
            <View style={styles.incomeGrid}>
              <View style={[styles.incomeItem, { backgroundColor: tealBg }]}>
                <Text style={[styles.incomeLabel, { color: colors.textSecondary }]}>Monthly Income</Text>
                <Text style={[styles.incomeValue, { color: colors.textPrimary }]}>{formatCurrency(incomeResult.monthlyIncome)}</Text>
              </View>
              <View style={[styles.incomeItem, { backgroundColor: tealBg }]}>
                <Text style={[styles.incomeLabel, { color: colors.textSecondary }]}>Avg Balance</Text>
                <Text style={[styles.incomeValue, { color: colors.textPrimary }]}>{formatCurrency(incomeResult.averageBalance)}</Text>
              </View>
              <View style={[styles.incomeItem, { backgroundColor: tealBg }]}>
                <Text style={[styles.incomeLabel, { color: colors.textSecondary }]}>EMI Obligations</Text>
                <Text style={[styles.incomeValue, { color: colors.textPrimary }]}>{formatCurrency(incomeResult.emiObligations)}</Text>
              </View>
              <View style={[styles.incomeItem, { backgroundColor: tealBg }]}>
                <Text style={[styles.incomeLabel, { color: colors.textSecondary }]}>Bounces</Text>
                <Text style={[styles.incomeValue, { color: colors.textPrimary }]}>{incomeResult.bounceCount}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Eligibility Result */}
        {eligibilityResult?.status === 'fully_eligible' && (
          <Card style={[styles.resultCard, { backgroundColor: tealBg }]}>
            <Text style={styles.resultIcon}>🎉</Text>
            <Text style={[styles.resultTitle, { color: colors.teal }]}>Congratulations!</Text>
            <Text style={[styles.resultText, { color: colors.textSecondary }]}>{eligibilityResult.message}</Text>
            <Button title="Continue" onPress={handleProceed} style={styles.btn} />
          </Card>
        )}

        {eligibilityResult?.status === 'not_eligible' && (
          <Card style={[styles.resultCard, { backgroundColor: errorBg }]}>
            <Text style={styles.resultIcon}>😔</Text>
            <Text style={[styles.resultTitle, { color: colors.error }]}>Not Eligible</Text>
            <Text style={[styles.resultText, { color: colors.textSecondary }]}>{eligibilityResult.message}</Text>
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
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  errorText: { fontSize: 12, marginTop: -4, marginBottom: 8 },
  optionsRow: { flexDirection: 'row', gap: 12 },
  option: {
    flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, alignItems: 'center',
  },
  optionIcon: { fontSize: 32, marginBottom: 8 },
  optionTitle: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  optionDesc: { fontSize: 11, marginTop: 2 },
  prefillCard: {
    padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  prefillRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  prefillBankName: { fontSize: 15, fontWeight: '700', marginLeft: 10 },
  warnText: { fontSize: 13, marginBottom: 8 },
  bankCodeBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 48, alignItems: 'center',
  },
  bankCodeText: { fontSize: 11, fontWeight: '700' },
  btn: { marginTop: 12 },
  verifyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  matchRow: { flexDirection: 'row', padding: 12, borderRadius: 8, alignItems: 'flex-start' },
  matchIcon: { fontSize: 20, fontWeight: '700', marginRight: 10, marginTop: 2 },
  matchInfo: { flex: 1 },
  matchLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  matchDetail: { fontSize: 12, lineHeight: 18 },
  incomeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  incomeItem: { width: '47%', padding: 12, borderRadius: 10, alignItems: 'center' },
  incomeLabel: { fontSize: 11, marginBottom: 4 },
  incomeValue: { fontSize: 16, fontWeight: '700' },
  resultCard: { alignItems: 'center' },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  resultText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default IncomeVerificationScreen;
