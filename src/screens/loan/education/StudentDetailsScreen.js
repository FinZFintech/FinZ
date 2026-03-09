import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
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
import { formatCurrency } from '../../../utils/helpers';

const StudentDetailsScreen = ({ navigation }) => {
  const { state, dispatch } = useLoan();
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [fetched, setFetched] = useState(false);

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

  const handleProceed = () => {
    dispatch({ type: 'SET_STUDENT', payload: studentData });
    navigation.navigate('BorrowerSelection');
  };

  return (
    <View style={styles.container}>
      <Header
        title="Student Details"
        subtitle={state.instituteDetails?.name}
        onBack={() => navigation.goBack()}
      />
      <StepIndicator currentStep={0} />
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
        <Card>
          <Text style={styles.sectionTitle}>Enter Registration Number</Text>
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

        {fetched && studentData && (
          <Card style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Student Information</Text>
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
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  scrollContent: { paddingBottom: 20 },
  bottomSpacer: { height: 100 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  detailsCard: { marginTop: 8 },
  feeHighlight: {
    backgroundColor: COLORS.primary,
    padding: 20,
    borderRadius: 14,
    marginTop: 16,
    alignItems: 'center',
  },
  feeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textTransform: 'uppercase' },
  feeAmount: { fontSize: 32, fontWeight: '900', color: COLORS.textLight, marginTop: 6 },
  proceedButton: { marginTop: 20 },
});

export default StudentDetailsScreen;
