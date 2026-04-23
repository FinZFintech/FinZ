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
import { adminService } from '../../services/adminService';
import { navigationRef } from '../../navigation/navigationRef';
import { formatCurrency, formatDate } from '../../utils/helpers';

const FILTERS = ['All', 'Sales', 'Credit', 'Operations', 'Completed'];

const AdminDashboardScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch {
      // Use mock data
    }
    const allApps = await loadRealApplications();
    console.log('[AdminDashboard] Apps loaded:', allApps.length);
    setApplications(allApps);

    setStats({
      totalApplications: allApps.length,
      pendingReview: allApps.filter(a => a.status === 'manual_review').length,
      inProgress: allApps.filter(a => !['draft', 'disbursed', 'credit_check_failed', 'not_eligible', 'discarded'].includes(a.status)).length,
      disbursed: allApps.filter(a => a.status === 'disbursed').length,
      rejected: allApps.filter(a => a.status === 'credit_check_failed' || a.status === 'not_eligible').length,
      discarded: allApps.filter(a => a.status === 'discarded').length,
      totalDisbursedAmount: allApps.filter(a => a.status === 'disbursed').reduce((sum, a) => sum + (a.amount || 0), 0),
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const getFilteredApps = () => {
    if (activeFilter === 'All') return applications;
    if (activeFilter === 'Sales') return applications.filter(a => a.assignedTo === 'sales');
    if (activeFilter === 'Credit') return applications.filter(a => a.assignedTo === 'credit');
    if (activeFilter === 'Operations') return applications.filter(a => a.assignedTo === 'operations');
    if (activeFilter === 'Completed') return applications.filter(a => a.status === 'disbursed' || a.status === 'credit_check_failed' || a.status === 'not_eligible');
    return applications;
  };

  const openAction = (app, type) => {
    setSelectedApp(app);
    setActionType(type);
    setRemarks('');
    setShowActionModal(true);
  };

  const handleAction = () => {
    const statusMap = {
      approve: 'fully_eligible',
      reject: 'credit_check_failed',
      disburse: 'disbursed',
      reassign_sales: 'draft',
      reassign_credit: 'credit_check_passed',
      reassign_ops: 'fully_eligible',
    };

    const assignMap = {
      approve: 'operations',
      reject: 'credit',
      disburse: 'operations',
      reassign_sales: 'sales',
      reassign_credit: 'credit',
      reassign_ops: 'operations',
    };

    const newStatus = statusMap[actionType] || selectedApp.status;
    const newAssign = assignMap[actionType] || selectedApp.assignedTo;

    setApplications(prev =>
      prev.map(a => a.id === selectedApp.id ? {
        ...a, status: newStatus, assignedTo: newAssign,
        remarks: remarks.trim() || a.remarks,
        ...(actionType === 'disburse' ? { disbursementDate: new Date().toISOString().split('T')[0] } : {}),
      } : a)
    );
    setShowActionModal(false);
    Alert.alert('Success', `Action completed for ${selectedApp.id}.`);
  };

  const filteredApps = getFilteredApps();

  const getRiskColor = (score) => {
    if (!score) return colors.textSecondary;
    if (score >= 700) return colors.teal;
    if (score >= 500) return colors.warning;
    return colors.error;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Admin Dashboard"
        rightAction={() => setShowLogoutModal(true)}
        rightIcon="🚪"
      />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.welcome, { color: colors.textPrimary }]}>Welcome, {user?.name || 'Admin'}</Text>
        <Text style={[styles.role, { color: colors.teal }]}>Administrator</Text>

        {/* Stats Grid */}
        {stats && (
          <>
            <View style={styles.statsGrid}>
              {[
                { label: 'Total', value: stats.totalApplications, color: colors.primary, icon: '📋' },
                { label: 'Pending Review', value: stats.pendingReview, color: colors.warning, icon: '👁️' },
                { label: 'In Progress', value: stats.inProgress, color: colors.info, icon: '⏳' },
                { label: 'Disbursed', value: stats.disbursed, color: colors.teal, icon: '✅' },
                { label: 'Rejected', value: stats.rejected, color: colors.error, icon: '❌' },
                { label: 'Discarded', value: stats.discarded || 0, color: colors.textSecondary, icon: '🗑️' },
              ].map(card => (
                <TouchableOpacity
                  key={card.label}
                  style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor: card.color }]}
                >
                  <Text style={styles.statIcon}>{card.icon}</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{card.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{card.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Card>
              <Text style={[styles.disbursedLabel, { color: colors.textSecondary }]}>Total Disbursed Amount</Text>
              <Text style={[styles.disbursedAmount, { color: colors.textPrimary }]}>
                {formatCurrency(stats.totalDisbursedAmount)}
              </Text>
            </Card>
          </>
        )}

        {/* Quick Actions */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
          {[
            { label: 'Risk Dashboard', icon: '📊', screen: 'RiskDashboard' },
            { label: 'API Health Monitor', icon: '🔌', screen: 'ApiHealthMonitor' },
            { label: 'Audit Trail', icon: '📜', screen: 'AuditTrailViewer' },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={[styles.quickActionItem, { borderBottomColor: colors.border }]}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>
                {item.icon} {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Quick link to Queue */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Applications</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
            View, search, filter and manage all loan applications from the Queue tab.
          </Text>
          <Button
            title={`View All Applications (${applications.length})`}
            onPress={() => navigation.navigate('LoanQueue')}
          />
        </Card>

        {/* Vendor Configuration (BCP) */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Vendor Configuration</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
            Switch between primary and alternate API/SMS vendors. Enable failover for business continuity.
          </Text>
          <Button
            title="Manage Vendors (BCP)"
            onPress={() => navigation.navigate('VendorConfig')}
            variant="outline"
          />
        </Card>

        {/* User Management */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Staff Management</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
            Create, enable, or disable sales, credit, and operations users. Staff members log in via OTP.
          </Text>
          <Button
            title="Manage Staff Users"
            onPress={() => navigation.navigate('UserManagement')}
            variant="outline"
          />
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Modal */}
      <Modal visible={showActionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {actionType === 'approve' ? 'Approve Application' :
               actionType === 'reject' ? 'Reject Application' :
               actionType === 'disburse' ? 'Confirm Disbursement' :
               'Reassign Application'}
            </Text>
            {selectedApp && (
              <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
                #{selectedApp.id} — {selectedApp.customerName} — {formatCurrency(selectedApp.amount)}
              </Text>
            )}
            <Text style={[styles.remarksLabel, { color: colors.textPrimary }]}>Remarks</Text>
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
              <Button title="Cancel" onPress={() => setShowActionModal(false)} variant="outline" style={styles.modalActionBtn} />
              <Button title="Confirm" onPress={handleAction} style={styles.modalActionBtn} />
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: {
    width: '48%', borderRadius: 12, padding: 14,
    borderLeftWidth: 4, borderWidth: 1,
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 12, marginTop: 2 },
  disbursedLabel: { fontSize: 13 },
  disbursedAmount: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  quickActionItem: { paddingVertical: 14, borderBottomWidth: 0.5 },
  quickActionText: { fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 8, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  filterText: { fontSize: 12, fontWeight: '600' },
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
  reassignRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  reassignLabel: { fontSize: 12 },
  reassignChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  reassignText: { fontSize: 11, fontWeight: '600' },
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

export default AdminDashboardScreen;
