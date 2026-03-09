import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Card from '../../components/common/Card';
import Logo from '../../components/common/Logo';
import StatusBadge from '../../components/common/StatusBadge';
import { COLORS } from '../../config/constants';
import { useAuth } from '../../store/AuthContext';
import { loanService } from '../../services/loanService';
import { engagementService } from '../../services/engagementService';
import { formatCurrency, formatDate } from '../../utils/helpers';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [dailyTip, setDailyTip] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creditScore, setCreditScore] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [loanData, tipData] = await Promise.allSettled([
        loanService.getLoans(),
        engagementService.getDailyTip(),
      ]);
      if (loanData.status === 'fulfilled') setLoans(loanData.value.loans || []);
      if (tipData.status === 'fulfilled') setDailyTip(tipData.value);
    } catch {
      setLoans([
        {
          id: 'L001',
          type: 'education',
          instituteName: 'ABC Institute of Technology',
          amount: 250000,
          emi: 22500,
          status: 'active',
          nextEmiDate: '2026-04-05',
          disbursedDate: '2026-01-15',
        },
      ]);
      setDailyTip({
        title: 'Tip of the Day',
        content: 'Paying EMIs on time helps improve your credit score by up to 30 points annually.',
      });
      setCreditScore(720);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <View style={styles.container}>
      {/* Custom Home Header with Logo */}
      <View style={styles.homeHeader}>
        <View style={styles.homeHeaderTop}>
          <View style={styles.logoBg}>
            <Logo size="small" />
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileInitial}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.teal]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {[
            { key: 'edu', label: 'Education\nLoan', icon: '🎓', bg: '#EEEDF5', screen: 'InstituteSelection' },
            { key: 'emp', label: 'Employee\nLoan', icon: '💼', bg: '#E8F8F7', screen: 'EmployeeLoan' },
            { key: 'credit', label: 'Credit\nScore', icon: '📊', bg: '#F0EDF5', screen: 'CreditScore' },
            { key: 'refer', label: 'Refer &\nEarn', icon: '🎁', bg: '#FFF5DC', screen: 'Referral' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.quickAction}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: item.bg }]}>
                <Text style={styles.actionEmoji}>{item.icon}</Text>
              </View>
              <Text style={styles.actionText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Credit Score Widget */}
        {creditScore && (
          <Card
            onPress={() => navigation.navigate('CreditScore')}
            style={styles.creditCard}
          >
            <View style={styles.creditRow}>
              <View>
                <Text style={styles.creditLabel}>CIBIL Score</Text>
                <Text style={styles.creditScoreNum}>{creditScore}</Text>
                <Text style={styles.creditRating}>
                  {creditScore >= 750 ? 'Excellent' : creditScore >= 650 ? 'Good' : 'Fair'}
                </Text>
              </View>
              <View style={styles.creditRight}>
                <View style={styles.creditGauge}>
                  <View style={[styles.gaugeBar, { width: `${(creditScore / 900) * 100}%` }]} />
                </View>
                <View style={styles.gaugeLabels}>
                  <Text style={styles.gaugeLabel}>300</Text>
                  <Text style={styles.gaugeLabel}>900</Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Active Loans */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Loans</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyLoans')}>
            <Text style={styles.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>

        {loans.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No loans yet</Text>
            <Text style={styles.emptySubtext}>Apply for a loan to get started</Text>
          </Card>
        ) : (
          loans.map((loan) => (
            <Card
              key={loan.id}
              onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}
              accent={COLORS.teal}
              style={styles.loanCard}
            >
              <View style={styles.loanHeader}>
                <View style={styles.loanLeft}>
                  <Text style={styles.loanType}>
                    {loan.type === 'education' ? '🎓' : '💼'}{' '}
                    {loan.instituteName || loan.companyName}
                  </Text>
                  <Text style={styles.loanId}>#{loan.id}</Text>
                </View>
                <StatusBadge status={loan.status} />
              </View>
              <View style={styles.loanDivider} />
              <View style={styles.loanDetails}>
                <View style={styles.loanDetail}>
                  <Text style={styles.loanDetailLabel}>Amount</Text>
                  <Text style={styles.loanDetailValue}>{formatCurrency(loan.amount)}</Text>
                </View>
                <View style={[styles.loanDetail, styles.loanDetailCenter]}>
                  <Text style={styles.loanDetailLabel}>Monthly EMI</Text>
                  <Text style={[styles.loanDetailValue, { color: COLORS.teal }]}>
                    {formatCurrency(loan.emi)}
                  </Text>
                </View>
                <View style={styles.loanDetail}>
                  <Text style={styles.loanDetailLabel}>Next EMI</Text>
                  <Text style={styles.loanDetailValue}>{formatDate(loan.nextEmiDate)}</Text>
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Daily Tip */}
        {dailyTip && (
          <Card accent={COLORS.secondary} style={styles.tipCard}>
            <Text style={styles.tipTitle}>💡 {dailyTip.title}</Text>
            <Text style={styles.tipContent}>{dailyTip.content}</Text>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  homeHeader: {
    backgroundColor: COLORS.primary,
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  homeHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBg: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textLight,
  },
  greetingSection: {},
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: 26, fontWeight: '800', color: COLORS.textLight, marginTop: 2 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionEmoji: { fontSize: 24 },
  actionText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 14,
  },
  creditCard: {
    backgroundColor: COLORS.primary,
    borderColor: 'transparent',
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, fontWeight: '600' },
  creditScoreNum: { fontSize: 40, fontWeight: '900', color: COLORS.textLight, marginVertical: 2 },
  creditRating: { fontSize: 13, color: COLORS.teal, fontWeight: '700' },
  creditRight: { alignItems: 'flex-end' },
  creditGauge: {
    width: 110,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
  },
  gaugeBar: {
    height: 6,
    backgroundColor: COLORS.teal,
    borderRadius: 3,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 110,
    marginTop: 3,
  },
  gaugeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.4)' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  viewAll: { fontSize: 13, color: COLORS.teal, fontWeight: '600' },
  emptyCard: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  loanCard: { marginBottom: 2 },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loanLeft: { flex: 1, marginRight: 8 },
  loanType: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  loanId: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  loanDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  loanDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  loanDetail: {},
  loanDetailCenter: { alignItems: 'center' },
  loanDetailLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  loanDetailValue: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 3 },
  tipCard: { backgroundColor: '#FFFDF5' },
  tipTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  tipContent: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default HomeScreen;
