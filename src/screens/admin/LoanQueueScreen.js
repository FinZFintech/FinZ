import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
  TextInput, ScrollView, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import InfoRow from '../../components/common/InfoRow';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { formatCurrency, formatDate, getStatusLabel } from '../../utils/helpers';
import { loadRealApplications } from '../../utils/loadApplications';
import { assignApplication, moveToWorkflowBucket, requestRejection } from '../../services/userService';
import { isFirebaseConfigured } from '../../config/firebase';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'In Progress' },
  { key: 'review', label: 'Under Review' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'completed', label: 'Completed' },
  { key: 'discarded', label: 'Discarded' },
];

const REJECTED_STATUSES = new Set([
  'credit_check_failed', 'kyc_failed', 'not_eligible',
]);
// Completed = disbursed and beyond. The application is only marked
// "complete" once money has actually moved (or the loan has matured /
// closed). Submitted / eSign-done / eNACH-done / vKYC-done are
// pre-disbursement milestones — they belong in the In-Progress bucket
// so the dashboard and the queue agree on the same definition.
const COMPLETED_STATUSES = new Set([
  'disbursed', 'active', 'closed',
]);
const REVIEW_STATUSES = new Set([
  'manual_review', 'kyc_address_review',
]);
// Pending = anything pre-decision the customer is still working
// through. Keep submitted / eSign / eNACH / vKYC here (they're
// pre-disbursement) so the queue's In-Progress count matches the
// dashboard's.
const PENDING_STATUSES = new Set([
  'draft', 'institute_verified', 'student_details_done', 'borrower_selected',
  'pan_verified', 'credit_check_passed', 'bank_verified', 'income_verified',
  'kyc_completed', 'selfie_verified', 'fully_eligible', 'partially_eligible',
  'vkyc_done', 'enach_done', 'esign_done', 'submitted',
]);

const LoanQueueScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const userRole = user?.role || 'customer';
  const initialFilter = route.params?.filter || 'pending';

  const [applications, setApplications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const apps = await loadRealApplications();
      setApplications(apps);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the queue comes into focus so status changes made
  // on the detail screen (approve / reject / reassign) reflect in the
  // list + counts without requiring a pull-to-refresh.
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filteredApps = useMemo(() => {
    let list = applications;

    // Status filter
    if (activeFilter === 'pending') {
      list = list.filter((a) => PENDING_STATUSES.has(a.status));
    } else if (activeFilter === 'rejected') {
      list = list.filter((a) => REJECTED_STATUSES.has(a.status));
    } else if (activeFilter === 'completed') {
      list = list.filter((a) => COMPLETED_STATUSES.has(a.status));
    } else if (activeFilter === 'review') {
      list = list.filter((a) => REVIEW_STATUSES.has(a.status));
    } else if (activeFilter === 'discarded') {
      list = list.filter((a) => a.status === 'discarded');
    } else if (activeFilter === 'active') {
      list = list.filter(
        (a) => !REJECTED_STATUSES.has(a.status) && !COMPLETED_STATUSES.has(a.status) && a.status !== 'discarded',
      );
    }

    // Search by PAN, phone, name, or application ID
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.customerName || '').toLowerCase().includes(q) ||
          (a.customerPhone || '').includes(q) ||
          (a.panNumber || '').toLowerCase().includes(q) ||
          (a.id || '').toLowerCase().includes(q),
      );
    }

    return list;
  }, [applications, activeFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter((a) => PENDING_STATUSES.has(a.status)).length,
    active: applications.filter((a) => !REJECTED_STATUSES.has(a.status) && !COMPLETED_STATUSES.has(a.status) && a.status !== 'discarded').length,
    review: applications.filter((a) => REVIEW_STATUSES.has(a.status)).length,
    rejected: applications.filter((a) => REJECTED_STATUSES.has(a.status)).length,
    completed: applications.filter((a) => COMPLETED_STATUSES.has(a.status)).length,
    discarded: applications.filter((a) => a.status === 'discarded').length,
  }), [applications]);

  const renderItem = useCallback(({ item }) => (
    <Card style={{ marginBottom: 12 }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.appId, { color: colors.textPrimary }]}>
            #{item.id}
          </Text>
          <Text style={[styles.customerName, { color: colors.textPrimary }]}>
            {item.customerName || 'Unknown'}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <InfoRow label="Phone" value={item.customerPhone || '—'} />
      <InfoRow label="Institute" value={item.instituteName || '—'} />
      <InfoRow label="Amount" value={item.amount ? formatCurrency(item.amount) : '—'} />
      {item.panNumber ? <InfoRow label="PAN" value={item.panNumber} /> : null}
      {item.creditScore ? <InfoRow label="CIBIL" value={String(item.creditScore)} /> : null}
      <InfoRow label="Status" value={getStatusLabel(item.status)} />
      <InfoRow label="Applied" value={item.appliedDate ? formatDate(item.appliedDate) : '—'} />

      {item.reason ? (
        <View style={[styles.reasonBanner, { backgroundColor: `${colors.warning}10` }]}>
          <Text style={[styles.reasonText, { color: colors.warning }]}>{item.reason}</Text>
        </View>
      ) : null}

      {/* Workflow bucket + assigned to */}
      {(item.workflowBucket || item.assignedTo) ? (
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          {item.workflowBucket ? (
            <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '600', marginRight: 12 }}>
              Bucket: {item.workflowBucket}
            </Text>
          ) : null}
          {item.assignedTo ? (
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
              Assigned: {item.assignedTo}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="View Details"
          onPress={() => navigation.navigate('StaffApplicationDetail', { application: item })}
          style={styles.actionBtn}
        />
        {/* Workflow actions based on role */}
        {userRole === 'admin' && !item.assignedTo && (
          <Button
            title="Assign"
            variant="outline"
            onPress={() => {
              const name = Platform.OS === 'web'
                ? window.prompt('Assign to (phone or name):')
                : null;
              if (name) {
                assignApplication(item.id, name, user?.name || '');
                loadData();
              }
            }}
            style={styles.actionBtn}
          />
        )}
        {userRole === 'sales' && item.status !== 'discarded' && (
          <Button
            title="Park to Credit"
            variant="outline"
            onPress={() => {
              moveToWorkflowBucket(item.id, 'credit', user?.name || '', 'Sales complete');
              Alert.alert('Done', 'Application parked to credit bucket.');
              loadData();
            }}
            style={styles.actionBtn}
          />
        )}
        {userRole === 'sales' && item.status !== 'discarded' && !item.rejectionRequested && (
          <Button
            title="Request Reject"
            variant="outline"
            onPress={() => {
              const reason = Platform.OS === 'web'
                ? window.prompt('Reason for rejection request:')
                : null;
              if (reason) {
                requestRejection(item.id, user?.name || '', reason);
                Alert.alert('Done', 'Rejection request submitted for review.');
                loadData();
              }
            }}
            style={styles.actionBtn}
          />
        )}
      </View>
    </Card>
  ), [colors, navigation, userRole, user]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Loan Queue"
        subtitle={`${filteredApps.length} application(s)`}
        onBack={() => navigation.goBack()}
      />

      {/* Stats bar */}
      <View style={[styles.statsBar, { borderBottomColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.teal }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{stats.review}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Review</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.error }]}>{stats.rejected}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rejected</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.teal }]}>{stats.completed}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Done</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary, borderColor: colors.border }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, phone, PAN, or App ID..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map((f) => {
          const count = f.key === 'all' ? stats.total
            : f.key === 'pending' ? stats.pending
            : f.key === 'active' ? stats.active
            : f.key === 'review' ? stats.review
            : f.key === 'rejected' ? stats.rejected
            : f.key === 'discarded' ? stats.discarded
            : stats.completed;
          const isActive = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                { borderColor: colors.border, backgroundColor: colors.surface },
                isActive && { borderColor: colors.teal, backgroundColor: `${colors.teal}14` },
              ]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[
                styles.filterText,
                { color: colors.textSecondary },
                isActive && { color: colors.teal, fontWeight: '700' },
              ]}>
                {f.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Application list */}
      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>
              {loading ? '⏳' : searchQuery ? '🔍' : '📋'}
            </Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {loading
                ? 'Loading applications...'
                : searchQuery
                  ? 'No matching applications'
                  : activeFilter === 'rejected'
                    ? 'No rejected applications'
                    : 'No applications in queue'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {loading
                ? 'Fetching from database...'
                : searchQuery
                  ? `No applications match "${searchQuery}". Try a different search.`
                  : 'Applications will appear here as customers apply.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2 },
  searchBar: { paddingHorizontal: 16, paddingVertical: 8 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  filterScroll: { minHeight: 48, maxHeight: 48 },
  filterContent: { paddingHorizontal: 12, alignItems: 'center', paddingVertical: 6 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterText: { fontSize: 12 },
  list: { padding: 16, paddingBottom: 80 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  appId: { fontSize: 11, fontWeight: '600', opacity: 0.6 },
  customerName: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  reasonBanner: { padding: 10, borderRadius: 8, marginTop: 8 },
  reasonText: { fontSize: 12, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

export default LoanQueueScreen;
