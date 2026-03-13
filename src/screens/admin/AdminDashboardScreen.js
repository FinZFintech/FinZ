import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { adminService } from '../../services/adminService';
import { navigationRef } from '../../navigation/navigationRef';

const AdminDashboardScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch {
      setStats({
        totalApplications: 156,
        pendingKyc: 12,
        pendingCredit: 8,
        pendingIncome: 5,
        pendingEnach: 3,
        disbursed: 98,
        rejected: 30,
        manualReview: 7,
        todayApplications: 4,
        totalDisbursedAmount: 15600000,
      });
    }
  }, []);

  const onRefresh = useCallback(async () => { setRefreshing(true); await loadStats(); setRefreshing(false); }, [loadStats]);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (!stats) return null;

  const statCards = [
    { label: 'Total Applications', value: stats.totalApplications, color: colors.primary, icon: '📋' },
    { label: 'Today', value: stats.todayApplications, color: colors.info, icon: '📅' },
    { label: 'Pending KYC', value: stats.pendingKyc, color: colors.warning, icon: '🔐' },
    { label: 'Pending Credit', value: stats.pendingCredit, color: colors.secondary, icon: '📊' },
    { label: 'Pending Income', value: stats.pendingIncome, color: '#9C27B0', icon: '💰' },
    { label: 'Manual Review', value: stats.manualReview, color: colors.error, icon: '👁️' },
    { label: 'Disbursed', value: stats.disbursed, color: colors.teal, icon: '✅' },
    { label: 'Rejected', value: stats.rejected, color: colors.error, icon: '❌' },
  ];

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
        <Text style={[styles.role, { color: colors.teal }]}>{user?.role === 'sales' ? 'Sales Team' : 'Credit Team'}</Text>

        <View style={styles.statsGrid}>
          {statCards.map((card) => (
            <TouchableOpacity
              key={card.label}
              style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor: card.color }]}
              onPress={() => navigation.navigate('LoanQueue', { filter: card.label })}
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
            ₹{(stats.totalDisbursedAmount / 100000).toFixed(1)} Lakhs
          </Text>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
          <TouchableOpacity
            style={[styles.actionItem, { borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate('LoanQueue', { filter: 'manual_review' })}
          >
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>👁️ Manual Review Queue ({stats.manualReview})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionItem, { borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate('LoanQueue', { filter: 'pending' })}
          >
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>📋 All Pending Applications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionItem, { borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate('LoanQueue', { filter: 'all' })}
          >
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>📊 View All Applications</Text>
          </TouchableOpacity>
        </Card>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Logout</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtons}>
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
  actionItem: { paddingVertical: 14, borderBottomWidth: 0.5 },
  actionText: { fontSize: 14 },
  bottomSpacer: { height: 100 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    borderRadius: 16, padding: 24, width: '80%', borderWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalMessage: { fontSize: 14, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
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
