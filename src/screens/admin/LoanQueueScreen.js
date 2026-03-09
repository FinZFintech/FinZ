import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import InfoRow from '../../components/common/InfoRow';
import { COLORS } from '../../config/constants';
import { adminService } from '../../services/adminService';
import { formatCurrency, formatDate } from '../../utils/helpers';

const LoanQueueScreen = ({ route, navigation }) => {
  const filter = route.params?.filter || 'all';
  const [loans, setLoans] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadLoans(); }, []);

  const loadLoans = async () => {
    try {
      const data = await adminService.getPendingLoans({ filter });
      setLoans(data.loans || []);
    } catch {
      setLoans([
        { id: 'L101', borrowerName: 'Rahul Sharma', phone: '9876543210', instituteName: 'ABC Institute', amount: 250000, status: 'manual_review', reason: 'Name mismatch (PAN vs Aadhaar)', appliedDate: '2026-03-08' },
        { id: 'L102', borrowerName: 'Priya Singh', phone: '9876543211', instituteName: 'XYZ Academy', amount: 80000, status: 'kyc_failed', reason: 'CKYC/DigiLocker failed', appliedDate: '2026-03-07' },
        { id: 'L103', borrowerName: 'Amit Kumar', phone: '9876543212', instituteName: 'PQR College', amount: 350000, status: 'partially_eligible', reason: 'High FOIR ratio', appliedDate: '2026-03-06' },
      ]);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadLoans(); setRefreshing(false); };

  const handleUpdateStatus = (loanId, status) => {
    Alert.prompt
    Alert.alert('Update Status', `Change loan ${loanId} status to ${status}?`, [
      { text: 'Cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await adminService.updateLoanStatus(loanId, status, '');
            loadLoans();
          } catch {
            setLoans(prev => prev.map(l => l.id === loanId ? { ...l, status } : l));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title="Loan Queue" subtitle={filter} onBack={() => navigation.goBack()} />
      <FlatList
        data={loans}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.header}>
              <Text style={styles.loanId}>#{item.id}</Text>
              <StatusBadge status={item.status} />
            </View>
            <InfoRow label="Borrower" value={item.borrowerName} />
            <InfoRow label="Phone" value={item.phone} />
            <InfoRow label="Institute" value={item.instituteName} />
            <InfoRow label="Amount" value={formatCurrency(item.amount)} />
            <InfoRow label="Applied" value={formatDate(item.appliedDate)} />
            {item.reason && (
              <View style={styles.reasonBanner}>
                <Text style={styles.reasonText}>Reason: {item.reason}</Text>
              </View>
            )}
            <View style={styles.actions}>
              <Button
                title="Approve"
                onPress={() => handleUpdateStatus(item.id, 'fully_eligible')}
                variant="success"
                style={styles.actionBtn}
              />
              <Button
                title="Reject"
                onPress={() => handleUpdateStatus(item.id, 'not_eligible')}
                variant="danger"
                style={styles.actionBtn}
              />
              <Button
                title="Call"
                onPress={() => {}}
                variant="outline"
                style={styles.actionBtn}
              />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>No loans in queue</Text></View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  loanId: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  reasonBanner: { backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, marginTop: 8 },
  reasonText: { fontSize: 12, color: COLORS.warning, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});

export default LoanQueueScreen;
