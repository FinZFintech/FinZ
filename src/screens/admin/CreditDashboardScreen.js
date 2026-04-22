import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Modal, Alert, TextInput,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import InfoRow from '../../components/common/InfoRow';
import { loadRealApplications } from '../../utils/loadApplications';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { navigationRef } from '../../navigation/navigationRef';
import { formatCurrency, formatDate } from '../../utils/helpers';

const FILTERS = ['All', 'Pending Review', 'Approved', 'Rejected'];

const CreditDashboardScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [applications, setApplications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = useCallback(async () => {
    const allApps = await loadRealApplications();
    console.log('[CreditDashboard] Apps loaded:', allApps.length);
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
    if (activeFilter === 'Pending Review') return applications.filter(a => a.status === 'manual_review' || a.status === 'credit_check_passed' || a.status === 'income_verified');
    if (activeFilter === 'Approved') return applications.filter(a => a.status === 'fully_eligible');
    if (activeFilter === 'Rejected') return applications.filter(a => a.status === 'credit_check_failed' || a.status === 'not_eligible');
    return applications;
  };

  const openAction = (app, type) => {
    setSelectedApp(app);
    setActionType(type);
    setRemarks('');
    setShowActionModal(true);
  };

  const handleAction = () => {
    if (!remarks.trim() && actionType === 'reject') {
      Alert.alert('Error', 'Please provide remarks for rejection');
      return;
    }

    const newStatus = actionType === 'approve' ? 'fully_eligible' : 'credit_check_failed';
    setApplications(prev =>
      prev.map(a => a.id === selectedApp.id ? { ...a, status: newStatus, remarks: remarks.trim() } : a)
    );
    setShowActionModal(false);
    Alert.alert(
      'Success',
      `Application ${selectedApp.id} has been ${actionType === 'approve' ? 'approved' : 'rejected'}.`
    );
  };

  const stats = {
    total: applications.length,
    pendingReview: applications.filter(a => a.status === 'manual_review' || a.status === 'credit_check_passed' || a.status === 'income_verified').length,
    approved: applications.filter(a => a.status === 'fully_eligible').length,
    rejected: applications.filter(a => a.status === 'credit_check_failed' || a.status === 'not_eligible').length,
  };

  const filteredApps = getFilteredApps();

  const getRiskColor = (score) => {
    if (score >= 700) return colors.teal;
    if (score >= 500) return colors.warning;
    return colors.error;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Credit Dashboard"
        rightAction={() => setShowLogoutModal(true)}
        rightIcon="🚪"
      />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.teal]} />}
      >
        <Text style={[styles.welcome, { color: colors.textPrimary }]}>
          Welcome, {user?.name || 'Credit Officer'}
        </Text>
        <Text style={[styles.role, { color: colors.teal }]}>Credit Team</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: stats.total, color: colors.primary },
            { label: 'Pending', value: stats.pendingReview, color: colors.warning },
            { label: 'Approved', value: stats.approved, color: colors.teal },
            { label: 'Rejected', value: stats.rejected, color: colors.error },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor: s.color }]}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

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

        {/* Quick link to Queue */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Applications</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
            View, search, and review all loan applications in the Bucket tab.
          </Text>
          <Button
            title={`View Applications (${applications.length})`}
            onPress={() => navigation.navigate('LoanQueue')}
          />
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Modal */}
      <Modal visible={showActionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {actionType === 'approve' ? 'Approve Application' : 'Reject Application'}
            </Text>
            {selectedApp && (
              <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
                #{selectedApp.id} — {selectedApp.customerName} — {formatCurrency(selectedApp.amount)}
              </Text>
            )}
            <Text style={[styles.remarksLabel, { color: colors.textPrimary }]}>
              Remarks {actionType === 'reject' ? '(Required)' : '(Optional)'}
            </Text>
            <TextInput
              style={[styles.remarksInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter remarks..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowActionModal(false)}
                variant="outline"
                style={styles.modalActionBtn}
              />
              <Button
                title={actionType === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                onPress={handleAction}
                variant={actionType === 'approve' ? 'success' : 'danger'}
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
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  filterText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  appCard: { marginBottom: 4 },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  appId: { fontSize: 14, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', gap: 24, marginTop: 8, marginBottom: 4 },
  scoreItem: { alignItems: 'center' },
  scoreLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  reasonBanner: { padding: 10, borderRadius: 8, marginTop: 8 },
  reasonText: { fontSize: 12, fontWeight: '500' },
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
  modalSubtext: { fontSize: 13, marginBottom: 16, lineHeight: 20 },
  remarksLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  remarksInput: {
    borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14,
    minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
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

export default CreditDashboardScreen;
