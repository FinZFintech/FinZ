import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { COLORS } from '../../config/constants';
import { useTheme } from '../../store/ThemeContext';
import { useLoan } from '../../store/LoanContext';
import { loanService } from '../../services/loanService';
import { formatCurrency, formatDate } from '../../utils/helpers';

const TABS = ['All', 'Active', 'Pending', 'Closed'];

const MyLoansScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { hasSavedApplication, getResumeInfo, dispatch: loanDispatch } = useLoan();
  const [activeTab, setActiveTab] = useState('All');
  const [loans, setLoans] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLoans();
  }, [activeTab]);

  const loadLoans = async () => {
    try {
      const data = await loanService.getLoans({ status: activeTab === 'All' ? undefined : activeTab.toLowerCase() });
      setLoans(data.loans || []);
    } catch {
      setLoans([
        { id: 'L001', type: 'education', instituteName: 'ABC Institute', amount: 250000, emi: 22500, status: 'active', nextEmiDate: '2026-04-05', tenure: 12 },
        { id: 'L002', type: 'education', instituteName: 'XYZ Coaching', amount: 80000, emi: 14200, status: 'pan_verified', nextEmiDate: null, tenure: 6 },
        { id: 'L003', type: 'education', instituteName: 'PQR College', amount: 150000, emi: 13800, status: 'closed', nextEmiDate: null, tenure: 12 },
      ]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLoans();
    setRefreshing(false);
  };

  const filterLoans = () => {
    if (activeTab === 'All') return loans;
    if (activeTab === 'Active') return loans.filter(l => ['active', 'disbursed'].includes(l.status));
    if (activeTab === 'Pending') return loans.filter(l => !['active', 'disbursed', 'closed'].includes(l.status));
    if (activeTab === 'Closed') return loans.filter(l => l.status === 'closed');
    return loans;
  };

  // Show draft application in "All" and "Pending" tabs
  const showDraft = hasSavedApplication && (activeTab === 'All' || activeTab === 'Pending');
  const resumeInfo = showDraft ? getResumeInfo() : null;

  const renderDraftCard = () => {
    if (!resumeInfo) return null;
    const timeAgo = resumeInfo.lastUpdated
      ? Math.round((Date.now() - new Date(resumeInfo.lastUpdated).getTime()) / 60000)
      : null;
    const timeLabel = timeAgo != null
      ? timeAgo < 60 ? `${timeAgo}m ago` : timeAgo < 1440 ? `${Math.round(timeAgo / 60)}h ago` : `${Math.round(timeAgo / 1440)}d ago`
      : '';

    return (
      <Card
        onPress={() => navigation.navigate(resumeInfo.screen)}
        accent={colors.teal}
        style={styles.draftCard}
      >
        <View style={styles.loanHeader}>
          <Text style={[styles.loanId, { color: colors.textSecondary }]}>
            #{resumeInfo.applicationId}
          </Text>
          <StatusBadge status={resumeInfo.status} />
        </View>
        <Text style={[styles.loanName, { color: colors.textPrimary }]}>
          🎓 {resumeInfo.instituteName || resumeInfo.loanType || 'Loan Application'}
        </Text>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${Math.min(100, ((resumeInfo.step + 1) / 7) * 100)}%`, backgroundColor: colors.teal }]} />
          </View>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Step {resumeInfo.step + 1}/7
          </Text>
        </View>

        {timeLabel ? (
          <Text style={[styles.draftTime, { color: colors.textSecondary }]}>
            Last updated {timeLabel}
          </Text>
        ) : null}

        <View style={styles.draftActions}>
          <TouchableOpacity
            style={[styles.resumeBtn, { backgroundColor: colors.teal }]}
            onPress={() => navigation.navigate(resumeInfo.screen)}
          >
            <Text style={[styles.resumeBtnText, { color: colors.background }]}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.discardBtn, { borderColor: colors.error }]}
            onPress={() => loanDispatch({ type: 'RESET' })}
          >
            <Text style={[styles.discardBtnText, { color: colors.error }]}>Discard</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="My Loans" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { backgroundColor: colors.teal, borderColor: colors.teal }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === tab && { color: colors.background }]}>
              {tab}
              {tab === 'Pending' && resumeInfo ? ' •' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filterLoans()}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.teal]} />}
        ListHeaderComponent={renderDraftCard}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('LoanDetail', { loanId: item.id })}>
            <View style={styles.loanHeader}>
              <Text style={[styles.loanId, { color: colors.textSecondary }]}>#{item.id}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={[styles.loanName, { color: colors.textPrimary }]}>
              {item.type === 'education' ? '🎓' : '💼'} {item.instituteName || item.companyName}
            </Text>
            <View style={styles.loanRow}>
              <View><Text style={[styles.label, { color: colors.textSecondary }]}>Amount</Text><Text style={[styles.value, { color: colors.textPrimary }]}>{formatCurrency(item.amount)}</Text></View>
              <View><Text style={[styles.label, { color: colors.textSecondary }]}>EMI</Text><Text style={[styles.value, { color: colors.textPrimary }]}>{formatCurrency(item.emi)}</Text></View>
              <View><Text style={[styles.label, { color: colors.textSecondary }]}>Tenure</Text><Text style={[styles.value, { color: colors.textPrimary }]}>{item.tenure}M</Text></View>
            </View>
            {item.nextEmiDate && (
              <Text style={[styles.nextEmi, { color: colors.teal }]}>Next EMI: {formatDate(item.nextEmiDate)}</Text>
            )}
          </Card>
        )}
        ListEmptyComponent={
          !resumeInfo ? (
            <View style={styles.empty}><Text style={[styles.emptyText, { color: colors.textSecondary }]}>No loans found</Text></View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  activeTab: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  activeTabText: { color: COLORS.background },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  loanId: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  loanName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  loanRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 11, color: COLORS.textSecondary },
  value: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  nextEmi: { fontSize: 12, color: COLORS.teal, marginTop: 10, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },

  // Draft application card
  draftCard: { marginBottom: 4 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressLabel: { fontSize: 10, fontWeight: '600' },
  draftTime: { fontSize: 10, marginBottom: 10 },
  draftActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resumeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resumeBtnText: { fontSize: 13, fontWeight: '700' },
  discardBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  discardBtnText: { fontSize: 13, fontWeight: '600' },
});

export default MyLoansScreen;
