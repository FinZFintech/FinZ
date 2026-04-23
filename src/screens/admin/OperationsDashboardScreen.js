import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Modal, Alert, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import InfoRow from '../../components/common/InfoRow';
import { loadRealApplications } from '../../utils/loadApplications';
import { saveApplicationToDb } from '../../services/applicationDbService';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { navigationRef } from '../../navigation/navigationRef';
import { formatCurrency, formatDate } from '../../utils/helpers';

// Operations bucket — which statuses belong here and what task is pending.
// Drives the 'task' + 'taskStatus' columns we render on real applications
// so we don't have to ship hand-rolled mocks any more.
const OPS_TASK_BY_STATUS = {
  fully_eligible:      { task: 'eNACH Setup',           taskStatus: 'pending' },
  partially_eligible:  { task: 'eNACH Setup',           taskStatus: 'pending' },
  enach_done:          { task: 'eSign Pending',         taskStatus: 'pending' },
  vkyc_done:           { task: 'eSign Pending',         taskStatus: 'pending' },
  esign_done:          { task: 'Disbursement',          taskStatus: 'pending' },
  submitted:           { task: 'Disbursement',          taskStatus: 'pending' },
  disbursed:           { task: 'Post-Disbursement Check', taskStatus: 'completed' },
  active:              { task: 'Post-Disbursement Check', taskStatus: 'completed' },
  closed:              { task: 'Closed',                taskStatus: 'completed' },
};

const FILTERS = ['All', 'Pending Tasks', 'Disbursement', 'Completed'];

const OperationsDashboardScreen = ({ navigation }) => {
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

  const loadApplications = useCallback(async () => {
    const allApps = await loadRealApplications();
    // Operations bucket is only eligible → disbursed / active / closed.
    // Anything still in the customer / credit stages is not on their plate.
    const opsApps = allApps
      .filter((a) => OPS_TASK_BY_STATUS[a.status])
      .map((a) => ({ ...a, ...OPS_TASK_BY_STATUS[a.status] }));
    console.log('[OperationsDashboard] Apps loaded:', opsApps.length);
    setApplications(opsApps);
  }, []);

  // Re-load whenever the screen comes into focus so status changes from
  // the staff-detail screen (approve / reject / disburse) show up without
  // the user having to pull-to-refresh.
  useFocusEffect(useCallback(() => { loadApplications(); }, [loadApplications]));

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
    if (activeFilter === 'Pending Tasks') return applications.filter(a => a.taskStatus === 'pending');
    if (activeFilter === 'Disbursement') return applications.filter(a => a.status === 'esign_done' || a.status === 'disbursed');
    if (activeFilter === 'Completed') return applications.filter(a => a.taskStatus === 'completed');
    return applications;
  };

  const openAction = (app, type) => {
    setSelectedApp(app);
    setActionType(type);
    setRemarks('');
    setShowActionModal(true);
  };

  const handleAction = async () => {
    let updates = {};
    if (actionType === 'complete_task') {
      updates = { taskStatus: 'completed' };
    } else if (actionType === 'disburse') {
      updates = { status: 'disbursed', taskStatus: 'completed', task: 'Post-Disbursement Check', disbursementDate: new Date().toISOString().split('T')[0] };
    } else if (actionType === 'hold') {
      updates = { taskStatus: 'on_hold' };
    }

    // Optimistic local update → card jumps to the new bucket immediately.
    setApplications(prev =>
      prev.map(a => a.id === selectedApp.id ? { ...a, ...updates, remarks: remarks.trim() || a.remarks } : a)
    );
    setShowActionModal(false);

    // Persist to Firestore for disburse (status transition) so the change
    // survives refresh + is visible to other roles. taskStatus is an ops-
    // internal flag; we only ship it if we also touched `status`.
    if (selectedApp?._rawState && updates.status) {
      try {
        await saveApplicationToDb({
          ...selectedApp._rawState,
          status: updates.status,
          disbursementDate: updates.disbursementDate,
          opsAction: {
            action: actionType,
            by: user?.name || user?.phone || 'operations',
            comment: remarks.trim(),
            at: new Date().toISOString(),
          },
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        console.log('[OperationsDashboard] persist failed:', err?.message);
      }
    }

    const actionLabels = {
      complete_task: 'Task marked as completed',
      disburse: 'Loan marked as disbursed',
      hold: 'Application put on hold',
    };
    Alert.alert('Success', `${actionLabels[actionType]} for ${selectedApp.id}.`);
  };

  const stats = {
    total: applications.length,
    pendingTasks: applications.filter(a => a.taskStatus === 'pending').length,
    disbursed: applications.filter(a => a.status === 'disbursed').length,
    completed: applications.filter(a => a.taskStatus === 'completed').length,
    discarded: applications.filter(a => a.status === 'discarded').length,
  };

  const filteredApps = getFilteredApps();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Operations Dashboard"
        rightAction={() => setShowLogoutModal(true)}
        rightIcon="🚪"
      />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.teal]} />}
      >
        <Text style={[styles.welcome, { color: colors.textPrimary }]}>
          Welcome, {user?.name || 'Operations Officer'}
        </Text>
        <Text style={[styles.role, { color: colors.teal }]}>Operations Team</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: stats.total, color: colors.primary },
            { label: 'Pending', value: stats.pendingTasks, color: colors.warning },
            { label: 'Disbursed', value: stats.disbursed, color: colors.teal },
            { label: 'Completed', value: stats.completed, color: colors.info },
            { label: 'Discarded', value: stats.discarded, color: colors.textSecondary },
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

        {/* Applications */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          My Bucket ({filteredApps.length})
        </Text>

        {filteredApps.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No applications in this category</Text>
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
              <InfoRow label="Amount" value={formatCurrency(app.amount)} />
              <InfoRow label="Applied" value={formatDate(app.appliedDate)} />
              {app.disbursementDate && <InfoRow label="Disbursed On" value={formatDate(app.disbursementDate)} />}

              {/* Task Badge */}
              <View style={[styles.taskBadge, {
                backgroundColor: app.taskStatus === 'completed' ? `${colors.teal}15` : `${colors.warning}15`,
                borderColor: app.taskStatus === 'completed' ? colors.teal : colors.warning,
              }]}>
                <Text style={[styles.taskText, {
                  color: app.taskStatus === 'completed' ? colors.teal : colors.warning,
                }]}>
                  {app.task} — {app.taskStatus === 'completed' ? 'Done' : 'Pending'}
                </Text>
              </View>

              <View style={styles.appActions}>
                <Button
                  title="View Details"
                  onPress={() => navigation.navigate('StaffApplicationDetail', { application: app })}
                  variant="outline"
                  style={styles.actionBtn}
                />
                {app.taskStatus === 'pending' && (
                  <>
                    {app.status === 'esign_done' ? (
                      <Button
                        title="Disburse"
                        onPress={() => openAction(app, 'disburse')}
                        variant="success"
                        style={styles.actionBtn}
                      />
                    ) : (
                      <Button
                        title="Complete"
                        onPress={() => openAction(app, 'complete_task')}
                        variant="success"
                        style={styles.actionBtn}
                      />
                    )}
                    <Button
                      title="Hold"
                      onPress={() => openAction(app, 'hold')}
                      variant="outline"
                      style={styles.actionBtn}
                    />
                  </>
                )}
              </View>
            </Card>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Modal */}
      <Modal visible={showActionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {actionType === 'disburse' ? 'Confirm Disbursement' : actionType === 'hold' ? 'Put On Hold' : 'Complete Task'}
            </Text>
            {selectedApp && (
              <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
                #{selectedApp.id} — {selectedApp.customerName} — {formatCurrency(selectedApp.amount)}
              </Text>
            )}
            <Text style={[styles.remarksLabel, { color: colors.textPrimary }]}>Remarks (Optional)</Text>
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
                title="Confirm"
                onPress={handleAction}
                variant={actionType === 'hold' ? 'secondary' : 'success'}
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
  taskBadge: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginTop: 8,
  },
  taskText: { fontSize: 12, fontWeight: '600' },
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

export default OperationsDashboardScreen;
