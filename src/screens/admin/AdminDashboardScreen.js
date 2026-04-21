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
import { loadRealApplications, mergeWithMocks } from '../../utils/loadApplications';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { adminService } from '../../services/adminService';
import { navigationRef } from '../../navigation/navigationRef';
import { formatCurrency, formatDate } from '../../utils/helpers';

// All applications visible to admin
const MOCK_ALL_APPS = [
  {
    id: 'APP_001', customerName: 'Rahul Sharma', customerPhone: '9876543210',
    instituteName: 'IIT Bombay', amount: 250000, status: 'manual_review',
    creditScore: 720, riskScore: 680, reason: 'Name mismatch (PAN vs Aadhaar)',
    appliedDate: '2026-03-28', assignedTo: 'credit', category: 'Education',
  },
  {
    id: 'APP_002', customerName: 'Priya Singh', customerPhone: '9876543211',
    instituteName: 'BITS Pilani', amount: 180000, status: 'kyc_completed',
    creditScore: 750, riskScore: 740,
    appliedDate: '2026-03-27', assignedTo: 'operations', category: 'Education',
  },
  {
    id: 'APP_003', customerName: 'Amit Kumar', customerPhone: '9876543212',
    instituteName: 'VIT Vellore', amount: 120000, status: 'draft',
    creditScore: null, riskScore: null,
    appliedDate: '2026-03-30', assignedTo: 'sales', category: 'Education',
  },
  {
    id: 'APP_004', customerName: 'Sneha Patel', customerPhone: '9876543213',
    instituteName: 'NIT Trichy', amount: 350000, status: 'fully_eligible',
    creditScore: 680, riskScore: 620,
    appliedDate: '2026-03-25', assignedTo: 'operations', category: 'Education',
  },
  {
    id: 'APP_005', customerName: 'Raj Verma', customerPhone: '9876543214',
    instituteName: 'SRM University', amount: 200000, status: 'disbursed',
    creditScore: 760, riskScore: 780,
    appliedDate: '2026-03-10', assignedTo: 'operations', category: 'Education',
    disbursementDate: '2026-03-20',
  },
  {
    id: 'APP_006', customerName: 'Meera Joshi', customerPhone: '9876543215',
    instituteName: 'Christ University', amount: 150000, status: 'credit_check_failed',
    creditScore: 420, riskScore: 280, reason: 'Low credit score',
    appliedDate: '2026-03-22', assignedTo: 'credit', category: 'Education',
  },
];

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
    const realApps = await loadRealApplications();
    console.log('[AdminDashboard] Real apps loaded:', realApps.length, realApps.map(a => a.id).join(', '));
    const allApps = mergeWithMocks(realApps, MOCK_ALL_APPS);
    console.log('[AdminDashboard] Total apps after merge:', allApps.length);
    setApplications(allApps);

    setStats({
      totalApplications: allApps.length,
      pendingReview: allApps.filter(a => a.status === 'manual_review').length,
      inProgress: allApps.filter(a => !['draft', 'disbursed', 'credit_check_failed', 'not_eligible'].includes(a.status)).length,
      disbursed: allApps.filter(a => a.status === 'disbursed').length,
      rejected: allApps.filter(a => a.status === 'credit_check_failed' || a.status === 'not_eligible').length,
      totalDisbursedAmount: allApps.filter(a => a.status === 'disbursed').reduce((sum, a) => sum + a.amount, 0),
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

        {/* All Applications */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          All Applications ({filteredApps.length})
        </Text>

        {filteredApps.map(app => (
          <Card key={app.id} style={styles.appCard}>
            <View style={styles.appHeader}>
              <Text style={[styles.appId, { color: colors.textPrimary }]}>#{app.id}</Text>
              <StatusBadge status={app.status} />
            </View>
            <InfoRow label="Customer" value={app.customerName} />
            <InfoRow label="Phone" value={app.customerPhone} />
            <InfoRow label="Institute" value={app.instituteName} />
            <InfoRow label="Amount" value={formatCurrency(app.amount)} />
            <InfoRow label="Applied" value={formatDate(app.appliedDate)} />
            <InfoRow label="Assigned To" value={app.assignedTo.charAt(0).toUpperCase() + app.assignedTo.slice(1)} />

            {(app.creditScore || app.riskScore) && (
              <View style={styles.scoreRow}>
                {app.creditScore && (
                  <View style={styles.scoreItem}>
                    <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>CIBIL</Text>
                    <Text style={[styles.scoreValue, { color: getRiskColor(app.creditScore) }]}>{app.creditScore}</Text>
                  </View>
                )}
                {app.riskScore && (
                  <View style={styles.scoreItem}>
                    <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Risk</Text>
                    <Text style={[styles.scoreValue, { color: getRiskColor(app.riskScore) }]}>{app.riskScore}</Text>
                  </View>
                )}
              </View>
            )}

            {app.reason && (
              <View style={[styles.reasonBanner, { backgroundColor: `${colors.warning}10` }]}>
                <Text style={[styles.reasonText, { color: colors.warning }]}>{app.reason}</Text>
              </View>
            )}

            {/* Admin actions — all actions available */}
            <View style={styles.appActions}>
              <Button title="View Details" onPress={() => navigation.navigate('StaffApplicationDetail', { application: app })} variant="outline" style={styles.actionBtn} />
              {app.status !== 'disbursed' && app.status !== 'credit_check_failed' && app.status !== 'not_eligible' && (
                <>
                  <Button title="Approve" onPress={() => openAction(app, 'approve')} variant="success" style={styles.actionBtn} />
                  <Button title="Reject" onPress={() => openAction(app, 'reject')} variant="danger" style={styles.actionBtn} />
                </>
              )}
              {(app.status === 'fully_eligible' || app.status === 'esign_done') && (
                <Button title="Disburse" onPress={() => openAction(app, 'disburse')} style={styles.actionBtn} />
              )}
            </View>

            {/* Reassign */}
            {app.status !== 'disbursed' && app.status !== 'credit_check_failed' && (
              <View style={styles.reassignRow}>
                <Text style={[styles.reassignLabel, { color: colors.textSecondary }]}>Reassign:</Text>
                {['sales', 'credit', 'operations'].filter(r => r !== app.assignedTo).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reassignChip, { borderColor: colors.border }]}
                    onPress={() => openAction(app, `reassign_${r.substring(0, r === 'operations' ? 3 : r.length)}`)}
                  >
                    <Text style={[styles.reassignText, { color: colors.teal }]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        ))}

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
