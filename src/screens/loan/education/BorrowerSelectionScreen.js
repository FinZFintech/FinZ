import React, { useState, useEffect, useRef } from 'react';
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
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { useTheme } from '../../../store/ThemeContext';
import { loanService } from '../../../services/loanService';
import { authService } from '../../../services/authService';
import { smsService } from '../../../services/smsService';
import { signzyService } from '../../../services/signzyService';
import { useLoan } from '../../../store/LoanContext';
import { useAuth } from '../../../store/AuthContext';
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
  const { user } = useAuth();
  const student = state.studentDetails;

  // ── Restore from persisted state so the user resumes where they left off ──
  const prevBorrower = state.borrowerDetails;
  const prevProduct = state.selectedProduct;
  const prevTenure = state.selectedTenure;

  const [borrowerType, setBorrowerType] = useState(state.borrowerType || null);
  const [borrowerName, setBorrowerName] = useState(prevBorrower?.name || '');
  const [borrowerPhone, setBorrowerPhone] = useState(prevBorrower?.phone || '');
  const [borrowerEmail, setBorrowerEmail] = useState(prevBorrower?.email || '');
  const [phoneVerified, setPhoneVerified] = useState(prevBorrower?.phoneVerified || false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSendCount, setOtpSendCount] = useState(0);
  const cooldownRef = useRef(null);

  const MAX_OTP_SENDS = 3;
  const RESEND_COOLDOWN_SECONDS = 30;
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(prevProduct || null);
  const [selectedTenure, setSelectedTenure] = useState(prevTenure || null);
  const [loading, setLoading] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailVerification, setEmailVerification] = useState(prevBorrower?.emailVerification || null);

  // Phone-prefill state — data pulled from Signzy after phone OTP verification
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillDone, setPrefillDone] = useState(!!prevBorrower?.phone && !!prevBorrower?.phoneVerified);
  const [prefillSource, setPrefillSource] = useState(prevBorrower?.prefillSource || {});
  const [borrowerDob, setBorrowerDob] = useState(prevBorrower?.dob || '');
  const [borrowerPan, setBorrowerPan] = useState(prevBorrower?.pan || '');
  const [borrowerAddress, setBorrowerAddress] = useState(prevBorrower?.address || '');
  const [borrowerRelation, setBorrowerRelation] = useState(prevBorrower?.relation || '');

  const RELATION_OPTIONS = ['Father', 'Mother', 'Guardian', 'Spouse', 'Sibling', 'Other'];

  const DEFAULT_LOAN_PRODUCTS = [
    {
      id: 'default_emi',
      name: 'Education Loan - EMI',
      interestRate: 14,
      processingFee: '2% + GST',
      foreclosureCharges: '4% of outstanding',
      tenures: [6, 9, 12, 18, 24],
    },
    {
      id: 'default_bullet',
      name: 'Education Loan - Bullet Repayment',
      interestRate: 12,
      processingFee: '2.5% + GST',
      foreclosureCharges: 'Nil',
      tenures: [3, 6, 9, 12],
    },
  ];

  useEffect(() => {
    fetchLoanProducts();
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startResendCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchLoanProducts = async () => {
    if (state.instituteDetails?.isManual || !state.instituteDetails?.id) {
      setProducts(DEFAULT_LOAN_PRODUCTS);
      return;
    }
    try {
      const data = await loanService.getInstituteLoanProducts(state.instituteDetails.id);
      const fetched = data.products || [];
      setProducts(fetched.length > 0 ? fetched : DEFAULT_LOAN_PRODUCTS);
    } catch {
      setProducts(DEFAULT_LOAN_PRODUCTS);
    }
  };

  const handleSelfBorrower = () => {
    setBorrowerType('self');
    setBorrowerName(student?.studentName || user?.name || '');
    setBorrowerPhone(student?.phone || user?.phone || '');
    setBorrowerEmail('');
    setBorrowerDob('');
    setBorrowerPan('');
    setBorrowerAddress('');
    setBorrowerRelation('');
    setPhoneVerified(false);
    setPrefillDone(false);
    setPrefillSource({});
    setEmailVerification(null);
  };

  const handleParentBorrower = () => {
    setBorrowerType('parent');
    setBorrowerName(student?.fatherName || '');
    setBorrowerPhone('');
    setBorrowerEmail('');
    setBorrowerDob('');
    setBorrowerPan('');
    setBorrowerAddress('');
    setBorrowerRelation('Father');
    setPhoneVerified(false);
    setPrefillDone(false);
    setPrefillSource({});
    setEmailVerification(null);
  };

  const handleVerifyPhone = async () => {
    if (!validateMobile(borrowerPhone)) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number to receive OTP.');
      return;
    }
    if (otpSendCount >= MAX_OTP_SENDS) {
      Alert.alert('OTP Limit Reached', 'You have exceeded the maximum number of OTP attempts. Please try again later.');
      return;
    }
    setSendingOtp(true);
    setOtpError('');
    try {
      await smsService.sendOtp(borrowerPhone);
      setOtpSendCount((prev) => prev + 1);
      setShowOtp(true);
      setOtp('');
      startResendCooldown();
    } catch {
      Alert.alert(
        'OTP Sending Failed',
        'We could not send OTP to this number. Please check the number and try again.',
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      setOtpError('Please enter the complete 6-digit OTP');
      return;
    }
    try {
      smsService.verifyOtp(borrowerPhone, otp);
      setPhoneVerified(true);
      setShowOtp(false);
      setOtpError('');

      // Trigger phone-prefill to auto-fill borrower details
      runPhonePrefillAfterOtp();
    } catch (err) {
      const msg = err.message || '';
      setOtp('');
      if (/expired/i.test(msg)) {
        setOtpError('OTP has expired. Please request a new one.');
      } else if (/too many/i.test(msg)) {
        setOtpError('Too many incorrect attempts. Please request a new OTP.');
        setShowOtp(false);
      } else if (/not found/i.test(msg)) {
        setOtpError('OTP session expired. Please request a new OTP.');
        setShowOtp(false);
      } else {
        setOtpError('Incorrect OTP. Please check and re-enter.');
      }
    }
  };

  /**
   * After phone OTP is verified, run Signzy phone-prefill to auto-fill
   * name, email, DOB, PAN, and primary address. Also auto-verifies
   * the prefilled email so the user doesn't have to tap "Verify Email"
   * manually. Fields are only prefilled when the form field is currently
   * empty — so values the user already typed are never overwritten.
   */
  const runPhonePrefillAfterOtp = async () => {
    // Need at least a first name for the API — use what's already in
    // the form, or the student's name, or the logged-in user's name.
    const currentName = borrowerName || student?.studentName || user?.name || '';
    const parts = currentName.trim().split(/\s+/);
    const firstName = parts[0] || '';
    if (!firstName) {
      console.log('[BorrowerSelection] Skipping prefill — no first name available');
      return;
    }

    setPrefillLoading(true);
    try {
      const result = await signzyService.phonePrefill(
        borrowerPhone,
        firstName,
        parts.length > 1 ? parts[parts.length - 1] : '',
        '', // PAN unknown at this point
      );

      // Store in signzyVerifications for staff view
      dispatch({
        type: 'SET_SIGNZY_VERIFICATION',
        payload: { key: 'phonePrefill', status: 'success', result },
      });

      const sources = {};

      // Prefill name if empty
      const prefillName = result.name?.fullName?.trim() || '';
      if (prefillName && !borrowerName.trim()) {
        setBorrowerName(prefillName);
        sources.name = true;
      }

      // Prefill email if empty
      const prefillEmail = result.primaryEmail || '';
      if (prefillEmail && !borrowerEmail.trim()) {
        setBorrowerEmail(prefillEmail);
        sources.email = true;
        // Auto-verify the prefilled email
        autoVerifyEmail(prefillEmail);
      }

      // Prefill DOB
      const prefillDob = result.dob || '';
      if (prefillDob && !borrowerDob) {
        setBorrowerDob(prefillDob);
        sources.dob = true;
      }

      // Prefill PAN
      const prefillPan = result.pan || '';
      if (prefillPan && !borrowerPan) {
        setBorrowerPan(prefillPan);
        sources.pan = true;
      }

      // Prefill primary address
      const pa = result.primaryAddress;
      if (pa?.address && !borrowerAddress.trim()) {
        const addrStr = [pa.address, pa.state, pa.postal].filter(Boolean).join(', ');
        setBorrowerAddress(addrStr);
        sources.address = true;
      }

      setPrefillSource(sources);
      setPrefillDone(true);
      console.log('[BorrowerSelection] Prefill applied:', Object.keys(sources).join(', ') || 'nothing new');
    } catch (err) {
      console.log('[BorrowerSelection] Phone prefill failed:', err?.message);
      // Non-blocking — user can fill fields manually
      dispatch({
        type: 'SET_SIGNZY_VERIFICATION',
        payload: {
          key: 'phonePrefill',
          status: 'failure',
          error: { message: err?.message || 'Phone prefill failed' },
        },
      });
    } finally {
      setPrefillLoading(false);
    }
  };

  /**
   * Auto-verify an email address without user interaction.
   * Called when email is prefilled from phone-prefill so the user
   * doesn't have to manually tap "Verify Email".
   */
  const autoVerifyEmail = async (email) => {
    if (!email || !validateEmail(email)) return;
    setEmailVerifying(true);
    try {
      const result = await signzyService.verifyEmail(email);
      setEmailVerification(result);
      if (result.isRisky) {
        console.log('[BorrowerSelection] Auto-verified email is risky:', email, result.status);
      } else {
        console.log('[BorrowerSelection] Auto-verified email ok:', email);
      }
    } catch {
      console.log('[BorrowerSelection] Email auto-verify failed for:', email);
    } finally {
      setEmailVerifying(false);
    }
  };

  const getEmailRiskMessage = (result) => {
    const statusMessages = {
      invalid: 'This email address does not exist or is unreachable. Please provide a valid email.',
      spamtrap: 'This email is identified as a spam trap. Please use your genuine email address.',
      abuse: 'This email is associated with abuse reports. Please use a different email.',
      do_not_mail: 'This email cannot receive emails. Please use a different email address.',
      unknown: 'We could not verify this email. Please use a different email address.',
    };
    const subStatusMessages = {
      disposable: 'Temporary/disposable emails are not accepted. Please use a permanent email address.',
      toxic: 'This email is flagged as unsafe. Please use a different email address.',
      role_based: 'Role-based emails (e.g. info@, admin@) are not accepted. Please use a personal email.',
      mailbox_not_found: 'This email mailbox does not exist. Please check the email address.',
      no_dns_entries: 'This email domain is invalid. Please check the email address.',
      possible_typo: 'This email may contain a typo. Please check and correct your email.',
    };
    if (result.subStatus && subStatusMessages[result.subStatus]) {
      return subStatusMessages[result.subStatus];
    }
    return statusMessages[result.status] || 'This email could not be verified. Please use a different email address.';
  };

  const handleVerifyEmail = async () => {
    if (!validateEmail(borrowerEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. name@example.com).');
      return;
    }
    setEmailVerifying(true);
    try {
      const result = await signzyService.verifyEmail(borrowerEmail);
      setEmailVerification(result);
      if (result.didYouMean) {
        Alert.alert(
          'Possible Typo Detected',
          `Did you mean "${result.didYouMean}"?`,
          [
            { text: 'Yes, Use This', onPress: () => { setBorrowerEmail(result.didYouMean); setEmailVerification(null); } },
            { text: 'No, Keep Mine', style: 'cancel' },
          ],
        );
      } else if (result.isRisky) {
        Alert.alert('Email Verification Failed', getEmailRiskMessage(result));
      }
    } catch {
      Alert.alert(
        'Verification Unavailable',
        'We could not verify this email at the moment. Please check your internet connection and try again.',
      );
    } finally {
      setEmailVerifying(false);
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
    if (borrowerEmail && emailVerification?.isRisky) {
      Alert.alert('Email Verification Required', getEmailRiskMessage(emailVerification));
      return;
    }
    if (borrowerEmail && !emailVerification) {
      Alert.alert('Email Not Verified', 'Please verify your email address before proceeding.');
      return;
    }

    dispatch({ type: 'SET_BORROWER_TYPE', payload: borrowerType });
    dispatch({
      type: 'SET_BORROWER_DETAILS',
      payload: {
        name: borrowerName,
        phone: borrowerPhone,
        email: borrowerEmail,
        dob: borrowerDob,
        pan: borrowerPan,
        address: borrowerAddress,
        relation: borrowerType === 'parent' ? borrowerRelation : 'Self',
        phoneVerified,
        emailVerification: emailVerification || null,
        prefillSource,
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

        {/* Step 1: Mobile verification */}
        {borrowerType && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Verify Mobile Number
            </Text>
            <Input
              label="Mobile Number"
              value={borrowerPhone}
              onChangeText={(t) => {
                setBorrowerPhone(t.replace(/[^0-9]/g, ''));
                setPhoneVerified(false);
                setOtpSendCount(0);
                setResendCooldown(0);
                setOtpError('');
                setPrefillDone(false);
                setPrefillSource({});
                if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
              }}
              placeholder="Enter 10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />
            {!phoneVerified && !showOtp && borrowerPhone.length === 10 && (
              <Button
                title={sendingOtp ? 'Sending OTP...' : 'Verify Phone'}
                onPress={handleVerifyPhone}
                variant="outline"
                disabled={sendingOtp}
                style={styles.verifyBtn}
              />
            )}
            {showOtp && (
              <View style={styles.otpSection}>
                <Input
                  label="Enter OTP"
                  value={otp}
                  onChangeText={(t) => { setOtp(t); setOtpError(''); }}
                  placeholder="6-digit OTP sent to your mobile"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {otpError !== '' && (
                  <Text style={styles.otpErrorText}>{otpError}</Text>
                )}
                <View style={styles.otpActions}>
                  <Button title="Verify OTP" onPress={handleVerifyOtp} variant="outline" style={styles.otpActionBtn} />
                  <Button
                    title={
                      sendingOtp ? 'Sending...'
                        : otpSendCount >= MAX_OTP_SENDS ? 'Limit Reached'
                          : resendCooldown > 0 ? `Resend (${resendCooldown}s)`
                            : 'Resend OTP'
                    }
                    onPress={handleVerifyPhone}
                    variant="text"
                    disabled={sendingOtp || resendCooldown > 0 || otpSendCount >= MAX_OTP_SENDS}
                    style={styles.otpActionBtn}
                  />
                </View>
                {otpSendCount > 0 && (
                  <Text style={styles.otpAttemptsText}>
                    {otpSendCount}/{MAX_OTP_SENDS} OTP sent
                  </Text>
                )}
              </View>
            )}
            {!showOtp && otpError !== '' && (
              <Text style={styles.otpErrorText}>{otpError}</Text>
            )}
            {phoneVerified && (
              <Text style={styles.verifiedText}>✓ Phone Verified</Text>
            )}
          </Card>
        )}

        {/* Prefill loading indicator */}
        {phoneVerified && prefillLoading && (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: colors.teal, fontWeight: '600' }}>Fetching your details...</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                We are pulling your records from verified sources to pre-fill the form.
              </Text>
            </View>
          </Card>
        )}

        {/* Step 2: Borrower details (shown after phone verified, may be prefilled) */}
        {borrowerType && phoneVerified && !prefillLoading && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Borrower Details</Text>
            {prefillDone && Object.keys(prefillSource).length > 0 && (
              <View style={{ backgroundColor: `${colors.teal}14`, padding: 10, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ color: colors.teal, fontSize: 12 }}>
                  Fields marked with ★ were auto-filled from verified records. You can edit them if incorrect.
                </Text>
              </View>
            )}
            <Input
              label={`Borrower Name${prefillSource.name ? ' ★' : ''}`}
              value={borrowerName}
              onChangeText={setBorrowerName}
              placeholder="Enter full name as per PAN"
              autoCapitalize="words"
            />
            {borrowerType === 'parent' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>
                  Relation to Student
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {RELATION_OPTIONS.map((rel) => (
                    <TouchableOpacity
                      key={rel}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8, marginBottom: 8,
                        borderColor: borrowerRelation === rel ? colors.teal : colors.border,
                        backgroundColor: borrowerRelation === rel ? `${colors.teal}14` : colors.surface,
                      }}
                      onPress={() => setBorrowerRelation(rel)}
                    >
                      <Text style={{ color: borrowerRelation === rel ? colors.teal : colors.textSecondary, fontSize: 13, fontWeight: borrowerRelation === rel ? '700' : '400' }}>
                        {rel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <Input
              label={`Date of Birth${prefillSource.dob ? ' ★' : ''}`}
              value={borrowerDob}
              onChangeText={setBorrowerDob}
              placeholder="YYYY-MM-DD"
            />
            <Input
              label={`PAN Number${prefillSource.pan ? ' ★' : ''}`}
              value={borrowerPan}
              onChangeText={(t) => setBorrowerPan(t.toUpperCase().slice(0, 10))}
              placeholder="e.g. ABCDE1234F"
              autoCapitalize="characters"
              maxLength={10}
            />
            <Input
              label={`Email${prefillSource.email ? ' ★' : ''}`}
              value={borrowerEmail}
              onChangeText={(t) => {
                setBorrowerEmail(t);
                setEmailVerification(null);
              }}
              placeholder="Enter email address"
              keyboardType="email-address"
            />
            {borrowerEmail.length > 0 && !emailVerification && !emailVerifying && (
              <Button
                title="Verify Email"
                onPress={handleVerifyEmail}
                variant="outline"
                style={styles.verifyBtn}
              />
            )}
            {emailVerifying && (
              <Text style={{ color: colors.teal, fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                Verifying email...
              </Text>
            )}
            {emailVerification && !emailVerification.isRisky && (
              <Text style={styles.verifiedText}>✓ Email verified</Text>
            )}
            {emailVerification?.isRisky && (
              <Text style={styles.riskyEmailText}>
                ✗ Email did not pass verification. Please use a different email address.
              </Text>
            )}
            {emailVerification && !emailVerification.isRisky && emailVerification.freeEmail && (
              <Text style={styles.emailWarningText}>Free email provider detected</Text>
            )}
            <Input
              label={`Address${prefillSource.address ? ' ★' : ''}`}
              value={borrowerAddress}
              onChangeText={setBorrowerAddress}
              placeholder="Enter current address"
              multiline
            />
          </Card>
        )}

        {/* Loan Products — shown after phone verified + borrower name filled + email verified */}
        {borrowerType && phoneVerified && !prefillLoading && borrowerName.trim() && borrowerEmail && emailVerification && !emailVerification.isRisky && (
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
      <FloatingAssistButton />
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
  otpErrorText: {
    color: colors.error,
    fontSize: 13,
    marginBottom: 8,
    marginTop: -4,
  },
  otpActions: { flexDirection: 'row', gap: 10 },
  otpActionBtn: { flex: 1 },
  otpAttemptsText: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 4,
  },
  verifiedText: {
    color: colors.success,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 12,
    marginTop: -8,
  },
  riskyEmailText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 12,
    marginTop: -8,
  },
  emailWarningText: {
    color: colors.warning,
    fontSize: 12,
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
