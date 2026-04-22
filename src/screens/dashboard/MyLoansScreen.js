import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { COLORS } from '../../config/constants';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useLoan } from '../../store/LoanContext';
import { loanService } from '../../services/loanService';
import { getLoansForGuardian } from '../../services/userProfileService';
import { formatCurrency, formatDate } from '../../utils/helpers';

const TABS = ['All', 'Active', 'Pending', 'Closed'];

const MyLoansScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { linkedWards, user: authUser } = useAuth();
  const { hasSavedApplication, savedApplications, getResumeInfoForApp, switchApplication, discardApplication } = useLoan();
  const [activeTab, setActiveTab] = useState('All');
  const [loans, setLoans] = useState([]);
  const [wardLoans, setWardLoans] = useState([]);
  const [showWardLoans, setShowWardLoans] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasWards = linkedWards && linkedWards.length > 0;

  useEffect(() => {
    loadLoans();
    if (hasWards) loadWardLoans();
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

  const loadWardLoans = async () => {
    try {
      // Load real loans from Firestore via guardian links
      const phone = authUser?.phone || '';
      if (phone) {
        const firestoreLoans = await getLoansForGuardian(phone);
        if (firestoreLoans.length > 0) {
          setWardLoans(firestoreLoans.map((app) => ({
            id: app.applicationId,
            type: app.loanType || 'education',
            instituteName: app.instituteDetails?.name || '',
            amount: app.studentDetails?.balanceFee || 0,
            emi: 0,
            status: app.status,
            nextEmiDate: null,
            tenure: app.selectedTenure || 0,
            wardName: app.borrowerDetails?.name || app.studentDetails?.studentName || '',
            wardRelation: app.borrowerDetails?.relation || 'Ward',
          })));
          return;
        }
      }
      // Fallback to API
      const allWardLoans = [];
      for (const ward of linkedWards) {
        const data = await loanService.getLoans({ userId: ward.userId });
        const loans = (data.loans || []).map(l => ({ ...l, wardName: ward.name, wardRelation: ward.relation }));
        allWardLoans.push(...loans);
      }
      setWardLoans(allWardLoans);
    } catch {
      setWardLoans([]);
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

  // Show all draft applications in "All" and "Pending" tabs
  const showDrafts = hasSavedApplication && (activeTab === 'All' || activeTab === 'Pending');
  const draftApps = showDrafts ? savedApplications.filter((app) => {
    const info = getResumeInfoForApp(app);
    return info !== null;
  }) : [];

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  // Navigate to a loan flow screen (which lives in the Home tab stack)
  const navigateToLoanScreen = (screen, applicationId) => {
    switchApplication(applicationId);
    // Loan flow screens are in the Home tab stack, so navigate cross-tab
    navigation.navigate('Home', { screen });
  };

  const renderDraftCards = () => {
    if (draftApps.length === 0) return null;
    return draftApps.map((app) => {
      const info = getResumeInfoForApp(app);
      if (!info) return null;
      const timeLabel = formatTimeAgo(info.lastUpdated);

      return (
        <Card
          key={info.applicationId}
          onPress={() => navigateToLoanScreen(info.screen, info.applicationId)}
          accent={colors.teal}
          style={styles.draftCard}
        >
          <View style={styles.loanHeader}>
            <Text style={[styles.loanId, { color: colors.textSecondary }]}>
              #{info.applicationId}
            </Text>
            <StatusBadge status={info.status} />
          </View>
          <Text style={[styles.loanName, { color: colors.textPrimary }]}>
            {info.loanType === 'education' ? '🎓' : '💼'} {info.instituteName || info.loanType || 'Loan Application'}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${Math.min(100, ((info.step + 1) / 7) * 100)}%`, backgroundColor: colors.teal }]} />
            </View>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              Step {info.step + 1}/7
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
              onPress={() => navigateToLoanScreen(info.screen, info.applicationId)}
            >
              <Text style={[styles.resumeBtnText, { color: colors.background }]}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.discardBtn, { borderColor: colors.error }]}
              onPress={() => discardApplication(info.applicationId)}
            >
              <Text style={[styles.discardBtnText, { color: colors.error }]}>Discard</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    });
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
              {tab === 'Pending' && draftApps.length > 0 ? ` (${draftApps.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Ward Loans Toggle */}
      {hasWards && wardLoans.length > 0 && (
        <TouchableOpacity
          style={[styles.wardToggle, { backgroundColor: showWardLoans ? colors.teal : colors.cardBg, borderColor: colors.teal }]}
          onPress={() => setShowWardLoans(!showWardLoans)}
        >
          <Text style={[styles.wardToggleText, { color: showWardLoans ? colors.background : colors.teal }]}>
            {showWardLoans ? 'Showing Ward Loans' : `View Ward Loans (${wardLoans.length})`}
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={showWardLoans ? wardLoans : filterLoans()}
        keyExtractor={item => item.id + (item.wardName || '')}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.teal]} />}
        ListHeaderComponent={!showWardLoans ? renderDraftCards : null}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('LoanDetail', { loanId: item.id })}>
            <View style={styles.loanHeader}>
              <Text style={[styles.loanId, { color: colors.textSecondary }]}>#{item.id}</Text>
              <StatusBadge status={item.status} />
            </View>
            {item.wardName && (
              <View style={[styles.wardBadge, { backgroundColor: `${colors.info}20`, borderColor: colors.info }]}>
                <Text style={[styles.wardBadgeText, { color: colors.info }]}>
                  {item.wardName} ({item.wardRelation})
                </Text>
              </View>
            )}
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
          draftApps.length === 0 && !showWardLoans ? (
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
  wardToggle: {
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5, alignItems: 'center',
  },
  wardToggleText: { fontSize: 13, fontWeight: '700' },
  wardBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, marginBottom: 6,
  },
  wardBadgeText: { fontSize: 11, fontWeight: '600' },
});

export default MyLoansScreen;
