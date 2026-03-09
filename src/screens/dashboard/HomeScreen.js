import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { COLORS, APP_NAME } from '../../config/constants';
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

  const loadData = async () => {
    try {
      const [loanData, tipData] = await Promise.allSettled([
        loanService.getLoans(),
        engagementService.getDailyTip(),
      ]);
      if (loanData.status === 'fulfilled') setLoans(loanData.value.loans || []);
      if (tipData.status === 'fulfilled') setDailyTip(tipData.value);
    } catch {
      // Mock data
      setLoans([
        {
          id: 'L001',
          type: 'education',
          instituteName: 'ABC Institute',
          amount: 250000,
          emi: 22500,
          status: 'active',
          nextEmiDate: '2026-04-05',
          disbursedDate: '2026-01-15',
        },
      ]);
      setDailyTip({
        title: 'Financial Tip of the Day',
        content: 'Paying EMIs on time helps improve your credit score by up to 30 points annually.',
      });
      setCreditScore(720);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <View style={styles.container}>
      <Header
        title={APP_NAME}
        rightAction={() => navigation.navigate('Profile')}
        rightIcon="👤"
      />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('InstituteSelection')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.actionEmoji}>🎓</Text>
            </View>
            <Text style={styles.actionText}>Education Loan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('EmployeeLoan')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.actionEmoji}>💼</Text>
            </View>
            <Text style={styles.actionText}>Employee Loan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('CreditScore')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.actionEmoji}>📊</Text>
            </View>
            <Text style={styles.actionText}>Credit Score</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Referral')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FCE4EC' }]}>
              <Text style={styles.actionEmoji}>🎁</Text>
            </View>
            <Text style={styles.actionText}>Refer & Earn</Text>
          </TouchableOpacity>
        </View>

        {/* Credit Score Widget */}
        {creditScore && (
          <Card
            onPress={() => navigation.navigate('CreditScore')}
            style={styles.creditCard}
          >
            <View style={styles.creditRow}>
              <View>
                <Text style={styles.creditLabel}>Your Credit Score</Text>
                <Text style={styles.creditScore}>{creditScore}</Text>
                <Text style={styles.creditRating}>
                  {creditScore >= 750 ? 'Excellent' : creditScore >= 650 ? 'Good' : 'Fair'}
                </Text>
              </View>
              <View style={styles.creditGauge}>
                <View style={[styles.gaugeBar, { width: `${(creditScore / 900) * 100}%` }]} />
              </View>
            </View>
          </Card>
        )}

        {/* Active Loans */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Loans</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyLoans')}>
            <Text style={styles.viewAll}>View All</Text>
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
            >
              <View style={styles.loanHeader}>
                <Text style={styles.loanType}>
                  {loan.type === 'education' ? '🎓' : '💼'}{' '}
                  {loan.instituteName || loan.companyName}
                </Text>
                <StatusBadge status={loan.status} />
              </View>
              <View style={styles.loanDetails}>
                <View style={styles.loanDetail}>
                  <Text style={styles.loanDetailLabel}>Amount</Text>
                  <Text style={styles.loanDetailValue}>{formatCurrency(loan.amount)}</Text>
                </View>
                <View style={styles.loanDetail}>
                  <Text style={styles.loanDetailLabel}>EMI</Text>
                  <Text style={styles.loanDetailValue}>{formatCurrency(loan.emi)}</Text>
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
          <Card style={styles.tipCard}>
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
  content: { flex: 1 },
  greetingSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  greeting: { fontSize: 14, color: COLORS.textSecondary },
  userName: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  quickActions: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'space-around',
  },
  quickAction: { alignItems: 'center', width: 80 },
  actionIcon: {
    width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  actionEmoji: { fontSize: 26 },
  actionText: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center', fontWeight: '500' },
  creditCard: { marginHorizontal: 16, backgroundColor: COLORS.primary },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  creditLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  creditScore: { fontSize: 36, fontWeight: '900', color: COLORS.textLight },
  creditRating: { fontSize: 13, color: COLORS.secondaryLight, fontWeight: '600' },
  creditGauge: {
    width: 100, height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4,
  },
  gaugeBar: {
    height: 8, backgroundColor: COLORS.secondaryLight, borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  viewAll: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  emptyCard: { marginHorizontal: 16, alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  loanHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  loanType: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  loanDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  loanDetail: { alignItems: 'center' },
  loanDetailLabel: { fontSize: 11, color: COLORS.textSecondary },
  loanDetailValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  tipCard: { marginHorizontal: 16, backgroundColor: '#FFFDE7' },
  tipTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  tipContent: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  bottomSpacer: { height: 100 },
});

export default HomeScreen;
