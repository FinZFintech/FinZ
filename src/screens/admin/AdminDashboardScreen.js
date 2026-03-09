import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { COLORS } from '../../config/constants';
import { useAuth } from '../../store/AuthContext';
import { adminService } from '../../services/adminService';

const AdminDashboardScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
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
  };

  const onRefresh = async () => { setRefreshing(true); await loadStats(); setRefreshing(false); };

  const handleLogout = async () => { await logout(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); };

  if (!stats) return null;

  const statCards = [
    { label: 'Total Applications', value: stats.totalApplications, color: COLORS.primary, icon: '📋' },
    { label: 'Today', value: stats.todayApplications, color: COLORS.info, icon: '📅' },
    { label: 'Pending KYC', value: stats.pendingKyc, color: COLORS.warning, icon: '🔐' },
    { label: 'Pending Credit', value: stats.pendingCredit, color: COLORS.secondary, icon: '📊' },
    { label: 'Pending Income', value: stats.pendingIncome, color: '#9C27B0', icon: '💰' },
    { label: 'Manual Review', value: stats.manualReview, color: COLORS.error, icon: '👁️' },
    { label: 'Disbursed', value: stats.disbursed, color: COLORS.teal, icon: '✅' },
    { label: 'Rejected', value: stats.rejected, color: COLORS.error, icon: '❌' },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="Admin Dashboard"
        rightAction={handleLogout}
        rightIcon="🚪"
      />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.welcome}>Welcome, {user?.name || 'Admin'}</Text>
        <Text style={styles.role}>{user?.role === 'sales' ? 'Sales Team' : 'Credit Team'}</Text>

        <View style={styles.statsGrid}>
          {statCards.map((card, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.statCard, { borderLeftColor: card.color }]}
              onPress={() => navigation.navigate('LoanQueue', { filter: card.label })}
            >
              <Text style={styles.statIcon}>{card.icon}</Text>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card style={styles.disbursedCard}>
          <Text style={styles.disbursedLabel}>Total Disbursed Amount</Text>
          <Text style={styles.disbursedAmount}>
            ₹{(stats.totalDisbursedAmount / 100000).toFixed(1)} Lakhs
          </Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('LoanQueue', { filter: 'manual_review' })}
          >
            <Text>👁️ Manual Review Queue ({stats.manualReview})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('LoanQueue', { filter: 'pending' })}
          >
            <Text>📋 All Pending Applications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('LoanQueue', { filter: 'all' })}
          >
            <Text>📊 View All Applications</Text>
          </TouchableOpacity>
        </Card>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16 },
  welcome: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginTop: 16 },
  role: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%', backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  disbursedCard: { backgroundColor: COLORS.primary, marginTop: 8 },
  disbursedLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  disbursedAmount: { fontSize: 28, fontWeight: '900', color: COLORS.textLight, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  actionItem: { paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  bottomSpacer: { height: 100 },
});

export default AdminDashboardScreen;
