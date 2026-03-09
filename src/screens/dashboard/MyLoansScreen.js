import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { COLORS } from '../../config/constants';
import { loanService } from '../../services/loanService';
import { formatCurrency, formatDate } from '../../utils/helpers';

const TABS = ['All', 'Active', 'Pending', 'Closed'];

const MyLoansScreen = ({ navigation }) => {
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

  return (
    <View style={styles.container}>
      <Header title="My Loans" onBack={() => navigation.goBack()} />
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filterLoans()}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('LoanDetail', { loanId: item.id })}>
            <View style={styles.loanHeader}>
              <Text style={styles.loanId}>#{item.id}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.loanName}>
              {item.type === 'education' ? '🎓' : '💼'} {item.instituteName || item.companyName}
            </Text>
            <View style={styles.loanRow}>
              <View><Text style={styles.label}>Amount</Text><Text style={styles.value}>{formatCurrency(item.amount)}</Text></View>
              <View><Text style={styles.label}>EMI</Text><Text style={styles.value}>{formatCurrency(item.emi)}</Text></View>
              <View><Text style={styles.label}>Tenure</Text><Text style={styles.value}>{item.tenure}M</Text></View>
            </View>
            {item.nextEmiDate && (
              <Text style={styles.nextEmi}>Next EMI: {formatDate(item.nextEmiDate)}</Text>
            )}
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>No loans found</Text></View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0E0E0', alignItems: 'center' },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  activeTabText: { color: COLORS.textLight },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  loanId: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  loanName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  loanRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 11, color: COLORS.textSecondary },
  value: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  nextEmi: { fontSize: 12, color: COLORS.info, marginTop: 10, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});

export default MyLoansScreen;
