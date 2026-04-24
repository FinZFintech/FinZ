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
import Header from '../../components/common/Header';
import StatusBadge from '../../components/common/StatusBadge';
import { COLORS } from '../../config/constants';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useLoan } from '../../store/LoanContext';
import { loanService } from '../../services/loanService';
import { engagementService } from '../../services/engagementService';
import { formatCurrency, formatDate } from '../../utils/helpers';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { hasSavedApplication, savedApplications, getResumeInfoForApp, switchApplication, discardApplication, startNewApplication } = useLoan();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        greeting={getGreeting()}
        title={user?.name || 'User'}
        rightAction={() => navigation.navigate('ProfileTab')}
        rightIcon={(user?.name || 'U').charAt(0).toUpperCase()}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.teal]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {[
            { key: 'edu', label: 'Education\nLoan', icon: '🎓', screen: 'InstituteSelection' },
            { key: 'highered', label: 'Higher\nEducation', icon: '🎒', screen: 'HigherEducationSelection' },
            { key: 'emp', label: 'Employee\nLoan', icon: '💼', screen: 'EmployeeLoan' },
            { key: 'credit', label: 'Credit\nScore', icon: '📊', screen: 'CreditScore' },
            { key: 'refer', label: 'Refer &\nEarn', icon: '🎁', screen: 'Referral' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.quickAction}
              onPress={() => {
                // For loan screens, start a fresh application without overriding existing ones
                if (item.screen === 'InstituteSelection'
                    || item.screen === 'EmployeeLoan'
                    || item.screen === 'HigherEducationSelection') {
                  startNewApplication();
                }
                navigation.navigate(item.screen);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <Text style={styles.actionEmoji}>{item.icon}</Text>
              </View>
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Resume Application Banner — show most recent draft */}
        {hasSavedApplication && (() => {
          // Pick the most recently updated draft
          const resumable = savedApplications
            .map((app) => getResumeInfoForApp(app))
            .filter(Boolean)
            .sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
          const info = resumable[0];
          if (!info) return null;
          const timeAgo = info.lastUpdated
            ? Math.round((Date.now() - new Date(info.lastUpdated).getTime()) / 60000)
            : null;
          const timeLabel = timeAgo != null
            ? timeAgo < 60 ? `${timeAgo}m ago` : timeAgo < 1440 ? `${Math.round(timeAgo / 60)}h ago` : `${Math.round(timeAgo / 1440)}d ago`
            : '';
          return (
            <Card
              accent={colors.teal}
              style={styles.resumeCard}
              onPress={() => {
                switchApplication(info.applicationId);
                navigation.navigate(info.screen);
              }}
            >
              <View style={styles.resumeHeader}>
                <View style={styles.resumeLeft}>
                  <Text style={[styles.resumeTitle, { color: colors.textPrimary }]}>
                    Resume Application
                  </Text>
                  <Text style={[styles.resumeSub, { color: colors.textSecondary }]}>
                    {info.instituteName || info.loanType || 'Loan'} — {info.statusLabel}
                  </Text>
                  {timeLabel ? (
                    <Text style={[styles.resumeTime, { color: colors.textSecondary }]}>
                      Last updated {timeLabel}
                    </Text>
                  ) : null}
                  {resumable.length > 1 && (
                    <Text style={[styles.resumeTime, { color: colors.teal }]}>
                      +{resumable.length - 1} more application{resumable.length > 2 ? 's' : ''} in progress
                    </Text>
                  )}
                </View>
                <View style={[styles.resumeArrow, { backgroundColor: colors.teal }]}>
                  <Text style={styles.resumeArrowText}>→</Text>
                </View>
              </View>
              {/* Progress bar */}
              <View style={styles.resumeProgress}>
                <View style={[styles.resumeProgressBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.resumeProgressFill, { width: `${Math.min(100, ((info.step + 1) / 7) * 100)}%`, backgroundColor: colors.teal }]} />
                </View>
                <Text style={[styles.resumeStepLabel, { color: colors.textSecondary }]}>
                  Step {info.step + 1} of 7
                </Text>
              </View>
              <TouchableOpacity
                style={styles.resumeDiscard}
                onPress={(e) => {
                  e.stopPropagation?.();
                  discardApplication(info.applicationId);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.resumeDiscardText, { color: colors.error }]}>Discard</Text>
              </TouchableOpacity>
            </Card>
          );
        })()}

        {/* Credit Score Widget */}
        {creditScore && (
          <Card
            onPress={() => navigation.navigate('CreditScore')}
            style={{ borderColor: 'rgba(74,237,196,0.15)' }}
          >
            <View style={styles.creditRow}>
              <View>
                <Text style={[styles.creditLabel, { color: colors.textSecondary }]}>CIBIL Score</Text>
                <Text style={[styles.creditScoreNum, { color: colors.textPrimary }]}>{creditScore}</Text>
                <Text style={[styles.creditRating, { color: colors.teal }]}>
                  {creditScore >= 750 ? 'Excellent' : creditScore >= 650 ? 'Good' : 'Fair'}
                </Text>
              </View>
              <View style={styles.creditRight}>
                <View style={styles.creditGauge}>
                  <View style={[styles.gaugeBar, { width: `${(creditScore / 900) * 100}%`, backgroundColor: colors.teal }]} />
                </View>
                <View style={styles.gaugeLabels}>
                  <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>300</Text>
                  <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>900</Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Active Loans */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Your Loans</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyLoans')}>
            <Text style={[styles.viewAll, { color: colors.teal }]}>View All →</Text>
          </TouchableOpacity>
        </View>

        {loans.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No loans yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Apply for a loan to get started</Text>
          </Card>
        ) : (
          loans.map((loan) => (
            <Card
              key={loan.id}
              onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}
              accent={colors.teal}
              style={styles.loanCard}
            >
              <View style={styles.loanHeader}>
                <View style={styles.loanLeft}>
                  <Text style={[styles.loanType, { color: colors.textPrimary }]}>
                    {loan.type === 'education' ? '🎓' : '💼'}{' '}
                    {loan.instituteName || loan.companyName}
                  </Text>
                  <Text style={[styles.loanId, { color: colors.textSecondary }]}>#{loan.id}</Text>
                </View>
                <StatusBadge status={loan.status} />
              </View>
              <View style={[styles.loanDivider, { backgroundColor: colors.border }]} />
              <View style={styles.loanDetails}>
                <View style={styles.loanDetail}>
                  <Text style={[styles.loanDetailLabel, { color: colors.textSecondary }]}>Amount</Text>
                  <Text style={[styles.loanDetailValue, { color: colors.textPrimary }]}>{formatCurrency(loan.amount)}</Text>
                </View>
                <View style={[styles.loanDetail, styles.loanDetailCenter]}>
                  <Text style={[styles.loanDetailLabel, { color: colors.textSecondary }]}>Monthly EMI</Text>
                  <Text style={[styles.loanDetailValue, { color: colors.teal }]}>
                    {formatCurrency(loan.emi)}
                  </Text>
                </View>
                <View style={styles.loanDetail}>
                  <Text style={[styles.loanDetailLabel, { color: colors.textSecondary }]}>Next EMI</Text>
                  <Text style={[styles.loanDetailValue, { color: colors.textPrimary }]}>{formatDate(loan.nextEmiDate)}</Text>
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Daily Tip */}
        {dailyTip && (
          <Card accent={colors.secondary} style={{ backgroundColor: 'rgba(245,183,49,0.08)', borderColor: 'rgba(245,183,49,0.15)' }}>
            <Text style={[styles.tipTitle, { color: colors.textPrimary }]}>💡 {dailyTip.title}</Text>
            <Text style={[styles.tipContent, { color: colors.textSecondary }]}>{dailyTip.content}</Text>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    borderWidth: 1,
  },
  actionEmoji: { fontSize: 24 },
  actionText: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 14,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditLabel: { fontSize: 11, letterSpacing: 1, fontWeight: '600' },
  creditScoreNum: { fontSize: 40, fontWeight: '900', marginVertical: 2 },
  creditRating: { fontSize: 13, fontWeight: '700' },
  creditRight: { alignItems: 'flex-end' },
  creditGauge: {
    width: 110,
    height: 6,
    backgroundColor: 'rgba(128,128,128,0.2)',
    borderRadius: 3,
  },
  gaugeBar: {
    height: 6,
    borderRadius: 3,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 110,
    marginTop: 3,
  },
  gaugeLabel: { fontSize: 9 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  viewAll: { fontSize: 13, fontWeight: '600' },
  emptyCard: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, marginTop: 4 },
  loanCard: { marginBottom: 2 },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loanLeft: { flex: 1, marginRight: 8 },
  loanType: { fontSize: 15, fontWeight: '700' },
  loanId: { fontSize: 11, marginTop: 2 },
  loanDivider: {
    height: 1,
    marginVertical: 12,
  },
  loanDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  loanDetail: {},
  loanDetailCenter: { alignItems: 'center' },
  loanDetailLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  loanDetailValue: { fontSize: 15, fontWeight: '700', marginTop: 3 },
  tipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  tipContent: { fontSize: 13, lineHeight: 20 },
  // Resume banner
  resumeCard: { marginBottom: 4 },
  resumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resumeLeft: { flex: 1, marginRight: 12 },
  resumeTitle: { fontSize: 15, fontWeight: '700' },
  resumeSub: { fontSize: 12, marginTop: 2 },
  resumeTime: { fontSize: 10, marginTop: 2 },
  resumeArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeArrowText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  resumeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumeProgressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  resumeProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  resumeStepLabel: { fontSize: 10, fontWeight: '600' },
  resumeDiscard: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resumeDiscardText: { fontSize: 11, fontWeight: '600' },

  bottomSpacer: { height: 100 },
});

export default HomeScreen;
