import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Modal, Alert, FlatList,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import StatusBadge from '../../components/common/StatusBadge';
import InfoRow from '../../components/common/InfoRow';
import { loadRealApplications, mergeWithMocks } from '../../utils/loadApplications';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { navigationRef } from '../../navigation/navigationRef';
import { formatCurrency, formatDate, validateMobile } from '../../utils/helpers';

// Mock applications assigned to sales
const MOCK_APPLICATIONS = [
  {
    id: 'APP_S001', customerName: 'Rahul Sharma', customerPhone: '9876543210',
    instituteName: 'IIT Bombay', loanType: 'education', amount: 250000,
    status: 'institute_verified', category: 'Education', appliedDate: '2026-03-28',
    assignedTo: 'sales',
  },
  {
    id: 'APP_S002', customerName: 'Priya Singh', customerPhone: '9876543211',
    instituteName: 'BITS Pilani', loanType: 'education', amount: 180000,
    status: 'student_details_done', category: 'Education', appliedDate: '2026-03-27',
    assignedTo: 'sales',
  },
  {
    id: 'APP_S003', customerName: 'Amit Kumar', customerPhone: '9876543212',
    instituteName: 'VIT Vellore', loanType: 'education', amount: 120000,
    status: 'draft', category: 'Education', appliedDate: '2026-03-30',
    assignedTo: 'sales',
  },
  {
    id: 'APP_S004', customerName: 'Sneha Patel', customerPhone: '9876543213',
    instituteName: 'SRM University', loanType: 'education', amount: 300000,
    status: 'pan_verified', category: 'Education', appliedDate: '2026-03-25',
    assignedTo: 'sales',
  },
];

const STATUS_LABELS = {
  draft: 'Draft',
  institute_verified: 'Institute Verified',
  student_details_done: 'Student Details Done',
  borrower_selected: 'Borrower Selected',
  pan_verified: 'PAN Verified',
  credit_check_passed: 'Credit Passed',
  bank_verified: 'Bank Verified',
  income_verified: 'Income Verified',
  kyc_completed: 'KYC Done',
  selfie_verified: 'Selfie Verified',
  submitted: 'Submitted',
  disbursed: 'Disbursed',
};

const FILTERS = ['All', 'Draft', 'In Progress', 'Submitted'];

const SalesDashboardScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [applications, setApplications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = useCallback(async () => {
    const realApps = await loadRealApplications();
    const allApps = mergeWithMocks(realApps, MOCK_APPLICATIONS);
    setApplications(allApps);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadApplications();
    setRefreshing(false);
  }, [loadApplications]);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const getFilteredApps = () => {
    if (activeFilter === 'All') return applications;
    if (activeFilter === 'Draft') return applications.filter(a => a.status === 'draft');
    if (activeFilter === 'Submitted') return applications.filter(a => a.status === 'submitted' || a.status === 'disbursed');
    // In Progress = everything else
    return applications.filter(a => a.status !== 'draft' && a.status !== 'submitted' && a.status !== 'disbursed');
  };

  const handleInitiateApplication = () => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }
    if (!validateMobile(customerPhone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    const newApp = {
      id: 'APP_S' + Date.now(),
      customerName: customerName.trim(),
      customerPhone,
      instituteName: 'Pending Selection',
      loanType: 'education',
      amount: 0,
      status: 'draft',
      category: 'Education',
      appliedDate: new Date().toISOString().split('T')[0],
      assignedTo: 'sales',
      initiatedBy: user?.phone,
    };

    setApplications(prev => [newApp, ...prev]);
    setShowInitiateModal(false);
    setCustomerPhone('');
    setCustomerName('');
    Alert.alert('Success', `Application initiated for ${newApp.customerName}. You can now assist them through the loan process.`);
  };

  const handleAssist = (app) => {
    Alert.alert(
      'Assist Application',
      `Contact ${app.customerName} at ${app.customerPhone} to help them proceed with their ${STATUS_LABELS[app.status] || app.status} stage.`,
      [
        { text: 'Cancel' },
        { text: 'Call Customer', onPress: () => {} },
      ]
    );
  };

  const stats = {
    total: applications.length,
    draft: applications.filter(a => a.status === 'draft').length,
    inProgress: applications.filter(a => a.status !== 'draft' && a.status !== 'submitted' && a.status !== 'disbursed').length,
    submitted: applications.filter(a => a.status === 'submitted' || a.status === 'disbursed').length,
  };

  const filteredApps = getFilteredApps();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Sales Dashboard"
        rightAction={() => setShowLogoutModal(true)}
        rightIcon="🚪"
      />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.teal]} />}
      >
        <Text style={[styles.welcome, { color: colors.textPrimary }]}>
          Welcome, {user?.name || 'Sales Executive'}
        </Text>
        <Text style={[styles.role, { color: colors.teal }]}>Sales Team</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: stats.total, color: colors.primary },
            { label: 'Draft', value: stats.draft, color: colors.warning },
            { label: 'In Progress', value: stats.inProgress, color: colors.info },
            { label: 'Submitted', value: stats.submitted, color: colors.teal },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor: s.color }]}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Initiate Application Button */}
        <Button
          title="+ Initiate Application on Customer Behalf"
          onPress={() => setShowInitiateModal(true)}
          style={styles.initiateBtn}
        />

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                { borderColor: colors.border, backgroundColor: colors.cardBg },
                activeFilter === f && { borderColor: colors.teal, backgroundColor: `${colors.teal}14` },
              ]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[
                styles.filterText, { color: colors.textSecondary },
                activeFilter === f && { color: colors.teal },
              ]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Applications List */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          My Applications ({filteredApps.length})
        </Text>

        {filteredApps.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No applications in this category
            </Text>
          </Card>
        ) : (
          filteredApps.map(app => (
            <Card key={app.id} style={styles.appCard}>
              <View style={styles.appHeader}>
                <Text style={[styles.appId, { color: colors.textPrimary }]}>#{app.id}</Text>
                <StatusBadge status={app.status} />
              </View>
              <InfoRow label="Customer" value={app.customerName} />
              <InfoRow label="Phone" value={app.customerPhone} />
              <InfoRow label="Institute" value={app.instituteName} />
              {app.amount > 0 && <InfoRow label="Amount" value={formatCurrency(app.amount)} />}
              <InfoRow label="Applied" value={formatDate(app.appliedDate)} />
              <InfoRow label="Stage" value={STATUS_LABELS[app.status] || app.status} />

              <View style={styles.appActions}>
                <Button
                  title="View Details"
                  onPress={() => navigation.navigate('StaffApplicationDetail', { application: app })}
                  style={styles.actionBtn}
                />
                <Button
                  title="Assist"
                  onPress={() => handleAssist(app)}
                  variant="outline"
                  style={styles.actionBtn}
                />
              </View>
            </Card>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Initiate Application Modal */}
      <Modal visible={showInitiateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Initiate Application on Customer Behalf
            </Text>
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
              Enter customer details to start a new loan application for them.
            </Text>
            <Input
              label="Customer Name"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer's full name"
              autoCapitalize="words"
            />
            <Input
              label="Customer Mobile"
              value={customerPhone}
              onChangeText={(t) => setCustomerPhone(t.replace(/[^0-9]/g, ''))}
              placeholder="Enter 10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
              prefix="+91"
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => { setShowInitiateModal(false); setCustomerPhone(''); setCustomerName(''); }}
                variant="outline"
                style={styles.modalActionBtn}
              />
              <Button
                title="Initiate"
                onPress={handleInitiateApplication}
                style={styles.modalActionBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Logout</Text>
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>Are you sure you want to logout?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLogoutModal(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalLogoutBtn} onPress={handleLogout}>
                <Text style={[styles.modalLogoutText, { color: colors.error }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  welcome: { fontSize: 22, fontWeight: '800', marginTop: 16 },
  role: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', borderRadius: 12, padding: 14,
    borderLeftWidth: 4, borderWidth: 1,
  },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 12, marginTop: 2 },
  initiateBtn: { marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  appCard: { marginBottom: 4 },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  appId: { fontSize: 14, fontWeight: '700' },
  appActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1 },
  emptyCard: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14 },
  bottomSpacer: { height: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalSubtext: { fontSize: 13, marginBottom: 20, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalActionBtn: { flex: 1 },
  modalCancelBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalLogoutBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
  modalLogoutText: { fontSize: 14, fontWeight: '700' },
});

export default SalesDashboardScreen;
