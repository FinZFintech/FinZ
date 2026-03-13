import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Header from '../../../components/common/Header';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import StepIndicator from '../../../components/common/StepIndicator';
import InfoRow from '../../../components/common/InfoRow';
import { useTheme } from '../../../store/ThemeContext';
import { loanService } from '../../../services/loanService';
import { useLoan } from '../../../store/LoanContext';
import { formatCurrency } from '../../../utils/helpers';

const StudentDetailsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { state, dispatch } = useLoan();
  const isManualInstitute = state.instituteDetails?.isManual === true;
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [fetched, setFetched] = useState(false);

  // Manual entry fields
  const [manualStudentName, setManualStudentName] = useState('');
  const [manualFatherName, setManualFatherName] = useState('');
  const [manualCourseName, setManualCourseName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualBalanceFee, setManualBalanceFee] = useState('');

  const fetchStudent = async () => {
    if (!regNo.trim()) {
      Alert.alert('Error', 'Please enter registration number');
      return;
    }
    setLoading(true);
    try {
      const data = await loanService.getStudentDetails(state.instituteDetails.id, regNo);
      setStudentData(data);
      dispatch({ type: 'SET_STUDENT', payload: data });
      setFetched(true);
    } catch {
      // Mock data
      const mock = {
        regNo,
        studentName: 'Rahul Sharma',
        fatherName: 'Rajesh Sharma',
        courseName: 'B.Tech Computer Science',
        instituteName: state.instituteDetails?.name || 'ABC Institute',
        phone: '9876543210',
        email: 'rahul@example.com',
        balanceFee: 250000,
      };
      setStudentData(mock);
      dispatch({ type: 'SET_STUDENT', payload: mock });
      setFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualStudentName.trim()) {
      Alert.alert('Error', 'Please enter student name');
      return;
    }
    if (!manualFatherName.trim()) {
      Alert.alert('Error', "Please enter father's name");
      return;
    }
    if (!manualCourseName.trim()) {
      Alert.alert('Error', 'Please enter course name');
      return;
    }
    if (!manualPhone.trim() || manualPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    const fee = parseInt(manualBalanceFee, 10);
    if (!fee || fee <= 0) {
      Alert.alert('Error', 'Please enter a valid fee amount');
      return;
    }

    const data = {
      regNo: regNo || 'MANUAL',
      studentName: manualStudentName.trim(),
      fatherName: manualFatherName.trim(),
      courseName: manualCourseName.trim(),
      instituteName: state.instituteDetails?.name || '',
      phone: manualPhone.trim(),
      email: manualEmail.trim(),
      balanceFee: fee,
      isManual: true,
    };
    setStudentData(data);
    dispatch({ type: 'SET_STUDENT', payload: data });
    setFetched(true);
  };

  const handleProceed = () => {
    dispatch({ type: 'SET_STUDENT', payload: studentData });
    navigation.navigate('BorrowerSelection');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Student Details"
        subtitle={state.instituteDetails?.name}
        onBack={() => navigation.goBack()}
      />
      <StepIndicator currentStep={0} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isManualInstitute ? (
          /* API-based flow */
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Enter Registration Number</Text>
            <Input
              label="Registration / Enrollment Number"
              value={regNo}
              onChangeText={setRegNo}
              placeholder="Enter your registration number"
              autoCapitalize="characters"
            />
            <Button
              title="Fetch Details"
              onPress={fetchStudent}
              loading={loading}
              disabled={!regNo.trim()}
            />
          </Card>
        ) : !fetched ? (
          /* Manual entry flow */
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Enter Student Details</Text>
            <Text style={[styles.manualHint, { color: colors.textSecondary }]}>
              Since your institute is not in our system, please fill in the details manually.
            </Text>
            <Input
              label="Registration / Enrollment Number (Optional)"
              value={regNo}
              onChangeText={setRegNo}
              placeholder="Enter registration number if available"
              autoCapitalize="characters"
            />
            <Input
              label="Student Name"
              value={manualStudentName}
              onChangeText={setManualStudentName}
              placeholder="Enter full name"
              autoCapitalize="words"
            />
            <Input
              label="Father's Name"
              value={manualFatherName}
              onChangeText={setManualFatherName}
              placeholder="Enter father's full name"
              autoCapitalize="words"
            />
            <Input
              label="Course Name"
              value={manualCourseName}
              onChangeText={setManualCourseName}
              placeholder="e.g., B.Tech Computer Science"
              autoCapitalize="words"
            />
            <Input
              label="Phone Number"
              value={manualPhone}
              onChangeText={(t) => setManualPhone(t.replace(/[^0-9]/g, ''))}
              placeholder="Enter 10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Input
              label="Email (Optional)"
              value={manualEmail}
              onChangeText={setManualEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
            />
            <Input
              label="Balance Fee / Loan Amount Required"
              value={manualBalanceFee}
              onChangeText={(t) => setManualBalanceFee(t.replace(/[^0-9]/g, ''))}
              placeholder="Enter amount in rupees"
              keyboardType="number-pad"
            />
            <Button
              title="Submit Details"
              onPress={handleManualSubmit}
              style={styles.proceedButton}
            />
          </Card>
        ) : null}

        {fetched && studentData && (
          <Card style={styles.detailsCard}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Student Information</Text>
            <InfoRow label="Student Name" value={studentData.studentName} />
            <InfoRow label="Father's Name" value={studentData.fatherName} />
            <InfoRow label="Course" value={studentData.courseName} />
            <InfoRow label="Institute" value={studentData.instituteName} />
            <InfoRow label="Phone" value={studentData.phone || 'Not available'} />
            <InfoRow label="Email" value={studentData.email || 'Not available'} />
            <InfoRow
              label="Balance Fee"
              value={formatCurrency(studentData.balanceFee)}
            />

            <View style={styles.feeHighlight}>
              <Text style={styles.feeLabel}>Amount to be Financed</Text>
              <Text style={styles.feeAmount}>
                {formatCurrency(studentData.balanceFee)}
              </Text>
            </View>

            <Button
              title="Proceed to Apply"
              onPress={handleProceed}
              style={styles.proceedButton}
            />
          </Card>
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
  bottomSpacer: { height: 100 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  manualHint: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsCard: { marginTop: 8 },
  feeHighlight: {
    backgroundColor: colors.teal,
    padding: 20,
    borderRadius: 14,
    marginTop: 16,
    alignItems: 'center',
  },
  feeLabel: { fontSize: 12, color: colors.background, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.8 },
  feeAmount: { fontSize: 32, fontWeight: '900', color: colors.background, marginTop: 6 },
  proceedButton: { marginTop: 20 },
});

export default StudentDetailsScreen;
