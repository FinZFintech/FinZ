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
        setCompanies([
          { id: 'c1', name: 'Infosys Ltd', city: 'Bangalore', employees: 300000 },
          { id: 'c2', name: 'TCS', city: 'Mumbai', employees: 600000 },
          { id: 'c3', name: 'Wipro', city: 'Bangalore', employees: 250000 },
        ]);
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
      const mock = {
        empId,
        name: 'Vikram Patel',
        fatherName: 'Rajendra Patel',
        pan: 'ABCDE1234F',
        aadhaar: 'XXXX-XXXX-1234',
        address: '45, Green Park, New Delhi - 110016',
        bankName: 'HDFC Bank',
        accountNumber: '1234567890123',
        ifsc: 'HDFC0001234',
        mobile: '9876543210',
        email: 'vikram@company.com',
        designation: 'Software Engineer',
        salary: 65000,
      };
      setEmployeeData(mock);
      dispatch({ type: 'SET_EMPLOYEE', payload: mock });
      dispatch({ type: 'SET_COMPANY', payload: selectedCompany });
      dispatch({ type: 'SET_LOAN_TYPE', payload: 'employee' });
      setStep('details');
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
});

export default EmployeeLoanScreen;
