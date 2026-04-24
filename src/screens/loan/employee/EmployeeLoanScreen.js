import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Alert, ActivityIndicator,
} from 'react-native';
import Header from '../../../components/common/Header';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import InfoRow from '../../../components/common/InfoRow';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { COLORS } from '../../../config/constants';
import { useTheme } from '../../../store/ThemeContext';
import { loanService } from '../../../services/loanService';
import { useLoan } from '../../../store/LoanContext';
import { formatCurrency } from '../../../utils/helpers';

const EmployeeLoanScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { dispatch } = useLoan();
  const [step, setStep] = useState('company'); // company, employee, details
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [empId, setEmpId] = useState('');
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(false);

  const searchCompanies = async (query) => {
    setSearch(query);
    if (query.length >= 2) {
      try {
        const data = await loanService.getCompanies(query);
        setCompanies(data.companies || []);
      } catch {
        setCompanies([]);
      }
    }
  };

  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setStep('employee');
  };

  const fetchEmployee = async () => {
    if (!empId.trim()) { Alert.alert('Error', 'Enter Employee ID'); return; }
    setLoading(true);
    try {
      const data = await loanService.getEmployeeDetails(selectedCompany.id, empId);
      setEmployeeData(data);
      setStep('details');
    } catch {
      Alert.alert('Error', 'Failed to fetch employee details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    dispatch({
      type: 'SET_BORROWER_DETAILS',
      payload: {
        name: employeeData.name,
        phone: employeeData.mobile,
        email: employeeData.email,
      },
    });
    dispatch({ type: 'SET_BORROWER_TYPE', payload: 'self' });
    // Navigate to PAN verification (reuse education flow from here)
    navigation.navigate('PanVerification');
  };

  // The Employee Loan journey is still being built. Until the company /
  // payroll / BSA pieces are wired end-to-end, customers landing here
  // see a coming-soon placeholder instead of a half-working flow.
  // Flip UNDER_DEVELOPMENT to false when the journey is ready to ship.
  const UNDER_DEVELOPMENT = true;
  if (UNDER_DEVELOPMENT) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Employee Loan" onBack={() => navigation.goBack()} />
        <View style={styles.devContainer}>
          <Card style={styles.devCard}>
            <Text style={styles.devEmoji}>🚧</Text>
            <Text style={[styles.devTitle, { color: colors.textPrimary }]}>
              Coming Soon
            </Text>
            <Text style={[styles.devBody, { color: colors.textSecondary }]}>
              The Employee Loan journey is currently under development. We are
              integrating company verification, payroll-based income checks
              and instant-approval rails — please check back shortly.
            </Text>
            <Text style={[styles.devBody, { color: colors.textSecondary, marginTop: 8 }]}>
              In the meantime, you can apply for an Education or Higher
              Education loan from the home screen.
            </Text>
            <Button
              title="Back to Home"
              onPress={() => navigation.goBack()}
              style={{ marginTop: 16 }}
            />
          </Card>
        </View>
        <FloatingAssistButton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title={step === 'company' ? 'Select Company' : step === 'employee' ? 'Employee ID' : 'Employee Details'}
        onBack={() => {
          if (step === 'details') setStep('employee');
          else if (step === 'employee') setStep('company');
          else navigation.goBack();
        }}
      />
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'company' && (
          <>
            <Input
              placeholder="Search company name..."
              value={search}
              onChangeText={searchCompanies}
              style={styles.searchInput}
            />
            {companies.map(c => (
              <Card key={c.id} onPress={() => handleSelectCompany(c)}>
                <Text style={[styles.companyName, { color: colors.textPrimary }]}>💼 {c.name}</Text>
                <Text style={[styles.companyCity, { color: colors.textSecondary }]}>{c.city}</Text>
              </Card>
            ))}
          </>
        )}

        {step === 'employee' && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{selectedCompany?.name}</Text>
            <Input label="Employee ID" value={empId} onChangeText={setEmpId} placeholder="Enter your Employee ID" />
            <Button title="Fetch Details" onPress={fetchEmployee} loading={loading} />
          </Card>
        )}

        {step === 'details' && employeeData && (
          <>
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Employee Details (from HRMS)</Text>
              <InfoRow label="Name" value={employeeData.name} />
              <InfoRow label="Father's Name" value={employeeData.fatherName} />
              <InfoRow label="Designation" value={employeeData.designation} />
              <InfoRow label="PAN" value={employeeData.pan} />
              <InfoRow label="Mobile" value={employeeData.mobile} />
              <InfoRow label="Email" value={employeeData.email} />
              <InfoRow label="Salary" value={formatCurrency(employeeData.salary)} />
              <InfoRow label="Bank" value={employeeData.bankName} />
            </Card>
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              Details fetched from company HRMS. Verify and proceed.
            </Text>
            <Button title="Apply for Employee Loan" onPress={handleApply} style={styles.applyBtn} />
          </>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <FloatingAssistButton />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  searchInput: { marginTop: 8 },
  companyName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  companyCity: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  note: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  applyBtn: { marginTop: 16 },
  bottomSpacer: { height: 40 },
  devContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 24, alignItems: 'stretch' },
  devCard: { padding: 24, alignItems: 'center' },
  devEmoji: { fontSize: 48, marginBottom: 12 },
  devTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  devBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

export default EmployeeLoanScreen;
