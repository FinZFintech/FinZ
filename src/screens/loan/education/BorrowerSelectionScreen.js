import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Header from '../../../components/common/Header';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { COLORS } from '../../../config/constants';
import { loanService } from '../../../services/loanService';
import { useLoan } from '../../../store/LoanContext';
import {
  formatCurrency,
  calculateEmi,
  validateMobile,
  validateEmail,
} from '../../../utils/helpers';

const BorrowerSelectionScreen = ({ navigation }) => {
  const { state, dispatch } = useLoan();
  const student = state.studentDetails;

  const [borrowerType, setBorrowerType] = useState(null);
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [borrowerEmail, setBorrowerEmail] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedTenure, setSelectedTenure] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLoanProducts();
  }, []);

  const fetchLoanProducts = async () => {
    try {
      const data = await loanService.getInstituteLoanProducts(state.instituteDetails?.id);
      setProducts(data.products || []);
    } catch {
      // Mock loan products
      setProducts([
        {
          id: 'p1',
          name: 'Education Loan - Standard',
          interestRate: 14,
          tenures: [6, 9, 12, 18, 24],
          processingFee: '2%',
          foreclosureCharges: '4% of outstanding',
          partPaymentAllowed: true,
          maxAmount: 500000,
          minAmount: 10000,
        },
        {
          id: 'p2',
          name: 'Education Loan - Premium',
          interestRate: 12,
          tenures: [12, 18, 24, 36],
          processingFee: '2.5%',
          foreclosureCharges: '3% of outstanding',
          partPaymentAllowed: true,
          maxAmount: 1000000,
          minAmount: 50000,
        },
      ]);
    }
  };

  const handleSelfBorrower = () => {
    setBorrowerType('self');
    setBorrowerName(student?.studentName || '');
    setBorrowerPhone(student?.phone || '');
    setBorrowerEmail(student?.email || '');
  };

  const handleParentBorrower = () => {
    setBorrowerType('parent');
    setBorrowerName(student?.fatherName || '');
    setBorrowerPhone('');
    setBorrowerEmail('');
  };

  const handleVerifyPhone = () => {
    if (!validateMobile(borrowerPhone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    setShowOtp(true);
    // In production, call authService.sendOtp(borrowerPhone)
  };

  const handleVerifyOtp = () => {
    // Mock OTP verification
    setPhoneVerified(true);
    setShowOtp(false);
  };

  const handleApply = async () => {
    if (!borrowerName.trim()) {
      Alert.alert('Error', 'Please enter borrower name');
      return;
    }
    if (!validateMobile(borrowerPhone)) {
      Alert.alert('Error', 'Please enter valid mobile number');
      return;
    }
    if (!selectedProduct) {
      Alert.alert('Error', 'Please select a loan product');
      return;
    }
    if (!selectedTenure) {
      Alert.alert('Error', 'Please select a tenure');
      return;
    }

    dispatch({ type: 'SET_BORROWER_TYPE', payload: borrowerType });
    dispatch({
      type: 'SET_BORROWER_DETAILS',
      payload: {
        name: borrowerName,
        phone: borrowerPhone,
        email: borrowerEmail,
        phoneVerified,
      },
    });
    dispatch({ type: 'SET_PRODUCT', payload: selectedProduct });
    dispatch({ type: 'SET_TENURE', payload: selectedTenure });
    dispatch({ type: 'SET_STEP', payload: 1 });
    navigation.navigate('PanVerification');
  };

  const loanAmount = student?.balanceFee || 0;

  return (
    <View style={styles.container}>
      <Header
        title="Apply for Loan"
        subtitle={student?.courseName}
        onBack={() => navigation.goBack()}
      />
      <StepIndicator currentStep={1} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Borrower Type Selection */}
        <Card>
          <Text style={styles.sectionTitle}>Who is the Borrower?</Text>
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[styles.option, borrowerType === 'self' && styles.selectedOption]}
              onPress={handleSelfBorrower}
            >
              <Text style={styles.optionIcon}>👤</Text>
              <Text style={[styles.optionText, borrowerType === 'self' && styles.selectedText]}>
                I am the Borrower
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, borrowerType === 'parent' && styles.selectedOption]}
              onPress={handleParentBorrower}
            >
              <Text style={styles.optionIcon}>👨‍👧</Text>
              <Text style={[styles.optionText, borrowerType === 'parent' && styles.selectedText]}>
                Parent is Borrower
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Borrower Details */}
        {borrowerType && (
          <Card>
            <Text style={styles.sectionTitle}>Borrower Details</Text>
            <Input
              label="Borrower Name"
              value={borrowerName}
              onChangeText={setBorrowerName}
              placeholder="Enter full name as per PAN"
              autoCapitalize="words"
            />
            <Input
              label="Mobile Number"
              value={borrowerPhone}
              onChangeText={(t) => {
                setBorrowerPhone(t.replace(/[^0-9]/g, ''));
                setPhoneVerified(false);
              }}
              placeholder="Enter 10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />
            {!phoneVerified && !showOtp && borrowerPhone.length === 10 && (
              <Button
                title="Verify Phone"
                onPress={handleVerifyPhone}
                variant="outline"
                style={styles.verifyBtn}
              />
            )}
            {showOtp && (
              <View style={styles.otpSection}>
                <Input
                  label="Enter OTP"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="6-digit OTP"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Button title="Verify OTP" onPress={handleVerifyOtp} variant="outline" />
              </View>
            )}
            {phoneVerified && (
              <Text style={styles.verifiedText}>✓ Phone Verified</Text>
            )}
            <Input
              label="Email (Optional)"
              value={borrowerEmail}
              onChangeText={setBorrowerEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
            />
          </Card>
        )}

        {/* Loan Products */}
        {borrowerType && (
          <Card>
            <Text style={styles.sectionTitle}>Select Loan Product</Text>
            {products.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.productCard,
                  selectedProduct?.id === product.id && styles.selectedProduct,
                ]}
                onPress={() => {
                  setSelectedProduct(product);
                  setSelectedTenure(null);
                }}
              >
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productRate}>
                  Interest Rate: {product.interestRate}% p.a.
                </Text>
                <Text style={styles.productFee}>
                  Processing Fee: {product.processingFee}
                </Text>
                <Text style={styles.productFee}>
                  Foreclosure: {product.foreclosureCharges}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Tenure Selection */}
        {selectedProduct && (
          <Card>
            <Text style={styles.sectionTitle}>Select Tenure</Text>
            <View style={styles.tenureRow}>
              {selectedProduct.tenures.map((tenure) => (
                <TouchableOpacity
                  key={tenure}
                  style={[
                    styles.tenureChip,
                    selectedTenure === tenure && styles.selectedTenure,
                  ]}
                  onPress={() => setSelectedTenure(tenure)}
                >
                  <Text
                    style={[
                      styles.tenureText,
                      selectedTenure === tenure && styles.selectedTenureText,
                    ]}
                  >
                    {tenure} months
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* EMI Preview */}
        {selectedTenure && (
          <Card style={styles.emiCard}>
            <Text style={styles.sectionTitle}>Repayment Summary</Text>
            <InfoRow label="Loan Amount" value={formatCurrency(loanAmount)} />
            <InfoRow label="Interest Rate" value={`${selectedProduct.interestRate}% p.a.`} />
            <InfoRow label="Tenure" value={`${selectedTenure} months`} />
            <InfoRow
              label="EMI Amount"
              value={formatCurrency(
                calculateEmi(loanAmount, selectedProduct.interestRate, selectedTenure)
              )}
            />
            <InfoRow label="Processing Fee" value={selectedProduct.processingFee} />
            <InfoRow label="Foreclosure Charges" value={selectedProduct.foreclosureCharges} />

            <View style={styles.emiHighlight}>
              <Text style={styles.emiLabel}>Monthly EMI</Text>
              <Text style={styles.emiAmount}>
                {formatCurrency(
                  calculateEmi(loanAmount, selectedProduct.interestRate, selectedTenure)
                )}
              </Text>
              <Text style={styles.emiNote}>
                First EMI due approx. 30 days after disbursement
              </Text>
            </View>
          </Card>
        )}

        {/* Apply Button */}
        {selectedTenure && (
          <Button
            title="Apply for Loan"
            onPress={handleApply}
            loading={loading}
            style={styles.applyButton}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  scrollContent: { paddingBottom: 120 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  optionsRow: { flexDirection: 'row', gap: 12 },
  option: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  selectedOption: {
    borderColor: COLORS.teal,
    backgroundColor: '#E8F8F7',
  },
  optionIcon: { fontSize: 32, marginBottom: 8 },
  optionText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  selectedText: { color: COLORS.teal },
  verifyBtn: { marginTop: -8, marginBottom: 16 },
  otpSection: { marginBottom: 8 },
  verifiedText: {
    color: COLORS.success,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 12,
    marginTop: -8,
  },
  productCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  selectedProduct: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEEDF5',
  },
  productName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  productRate: { fontSize: 13, color: COLORS.primary, marginTop: 4, fontWeight: '600' },
  productFee: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  tenureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tenureChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  selectedTenure: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  tenureText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  selectedTenureText: { color: COLORS.textLight },
  emiCard: {},
  emiHighlight: {
    backgroundColor: COLORS.primary,
    padding: 20,
    borderRadius: 14,
    marginTop: 14,
    alignItems: 'center',
  },
  emiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textTransform: 'uppercase' },
  emiAmount: { fontSize: 32, fontWeight: '900', color: COLORS.textLight, marginTop: 4 },
  emiNote: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  applyButton: { marginTop: 16 },
  bottomSpacer: { height: 100 },
});

export default BorrowerSelectionScreen;
