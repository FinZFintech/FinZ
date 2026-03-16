import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Header from '../../../components/common/Header';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { useTheme } from '../../../store/ThemeContext';
import { loanService } from '../../../services/loanService';
import { authService } from '../../../services/authService';
import { useLoan } from '../../../store/LoanContext';
import {
  formatCurrency,
  calculateEmi,
  validateMobile,
  validateEmail,
} from '../../../utils/helpers';

const BorrowerSelectionScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
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
      setProducts([]);
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

  const handleVerifyOtp = async () => {
    try {
      await authService.verifyOtp(borrowerPhone, otp);
      setPhoneVerified(true);
      setShowOtp(false);
    } catch {
      Alert.alert('Error', 'OTP verification failed. Please try again.');
    }
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Apply for Loan"
        subtitle={student?.courseName}
        onBack={() => navigation.goBack()}
      />
      <StepIndicator currentStep={1} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Borrower Type Selection */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Who is the Borrower?</Text>
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[styles.option, borrowerType === 'self' && styles.selectedOption]}
              onPress={handleSelfBorrower}
            >
              <Text style={styles.optionIcon}>👤</Text>
              <Text style={[styles.optionText, { color: colors.textSecondary }, borrowerType === 'self' && { color: colors.teal }]}>
                I am the Borrower
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, borrowerType === 'parent' && styles.selectedOption]}
              onPress={handleParentBorrower}
            >
              <Text style={styles.optionIcon}>👨‍👧</Text>
              <Text style={[styles.optionText, { color: colors.textSecondary }, borrowerType === 'parent' && { color: colors.teal }]}>
                Parent is Borrower
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Borrower Details */}
        {borrowerType && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Borrower Details</Text>
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
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Select Loan Product</Text>
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
                <Text style={[styles.productName, { color: colors.textPrimary }]}>{product.name}</Text>
                <Text style={[styles.productRate, { color: colors.teal }]}>
                  Interest Rate: {product.interestRate}% p.a.
                </Text>
                <Text style={[styles.productFee, { color: colors.textSecondary }]}>
                  Processing Fee: {product.processingFee}
                </Text>
                <Text style={[styles.productFee, { color: colors.textSecondary }]}>
                  Foreclosure: {product.foreclosureCharges}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Tenure Selection */}
        {selectedProduct && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Select Tenure</Text>
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
                      { color: colors.textSecondary },
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
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Repayment Summary</Text>
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
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionsRow: { flexDirection: 'row', gap: 12 },
  option: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  selectedOption: {
    borderColor: colors.teal,
    backgroundColor: `${colors.teal}14`,
  },
  optionIcon: { fontSize: 32, marginBottom: 8 },
  optionText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  selectedText: { color: colors.teal },
  verifyBtn: { marginTop: -8, marginBottom: 16 },
  otpSection: { marginBottom: 8 },
  verifiedText: {
    color: colors.success,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 12,
    marginTop: -8,
  },
  productCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 10,
  },
  selectedProduct: {
    borderColor: colors.teal,
    backgroundColor: `${colors.teal}14`,
  },
  productName: { fontSize: 15, fontWeight: '700' },
  productRate: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  productFee: { fontSize: 12, marginTop: 2 },
  tenureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tenureChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  selectedTenure: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  tenureText: { fontSize: 13, fontWeight: '600' },
  selectedTenureText: { color: colors.background },
  emiCard: {},
  emiHighlight: {
    backgroundColor: colors.teal,
    padding: 20,
    borderRadius: 14,
    marginTop: 14,
    alignItems: 'center',
  },
  emiLabel: { fontSize: 11, color: colors.background, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.8 },
  emiAmount: { fontSize: 32, fontWeight: '900', color: colors.background, marginTop: 4 },
  emiNote: { fontSize: 11, color: colors.background, marginTop: 6, opacity: 0.7 },
  applyButton: { marginTop: 16 },
  bottomSpacer: { height: 100 },
});

export default BorrowerSelectionScreen;
