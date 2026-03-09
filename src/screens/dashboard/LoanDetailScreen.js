import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import InfoRow from '../../components/common/InfoRow';
import { COLORS } from '../../config/constants';
import { loanService } from '../../services/loanService';
import { formatCurrency, formatDate } from '../../utils/helpers';

const LoanDetailScreen = ({ route, navigation }) => {
  const { loanId } = route.params;
  const [loan, setLoan] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLoanDetails();
  }, []);

  const loadLoanDetails = async () => {
    try {
      const [loanData, scheduleData] = await Promise.all([
        loanService.getLoanDetails(loanId),
        loanService.getRepaymentSchedule(loanId),
      ]);
      setLoan(loanData);
      setSchedule(scheduleData.schedule || []);
    } catch {
      setLoan({
        id: loanId,
        type: 'education',
        instituteName: 'ABC Institute',
        courseName: 'B.Tech CS',
        studentName: 'Rahul Sharma',
        borrowerName: 'Rajesh Sharma',
        amount: 250000,
        emi: 22500,
        interestRate: 14,
        tenure: 12,
        status: 'active',
        disbursedDate: '2026-01-15',
        nextEmiDate: '2026-04-05',
        paidEmis: 2,
        outstandingAmount: 208000,
        processingFee: '2%',
      });
      setSchedule([
        { emiNo: 1, date: '2026-02-05', amount: 22500, status: 'paid' },
        { emiNo: 2, date: '2026-03-05', amount: 22500, status: 'paid' },
        { emiNo: 3, date: '2026-04-05', amount: 22500, status: 'upcoming' },
        { emiNo: 4, date: '2026-05-05', amount: 22500, status: 'pending' },
      ]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLoanDetails();
    setRefreshing(false);
  };

  if (!loan) return null;

  const isActive = ['active', 'disbursed'].includes(loan.status);

  return (
    <View style={styles.container}>
      <Header title={`Loan #${loanId}`} onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusLoanName}>
              {loan.type === 'education' ? '🎓' : '💼'} {loan.instituteName}
            </Text>
            <StatusBadge status={loan.status} />
          </View>
          {loan.courseName && <Text style={styles.courseName}>{loan.courseName}</Text>}
        </Card>

        {/* Loan Details */}
        <Card>
          <Text style={styles.sectionTitle}>Loan Details</Text>
          <InfoRow label="Loan Amount" value={formatCurrency(loan.amount)} />
          <InfoRow label="Interest Rate" value={`${loan.interestRate}% p.a.`} />
          <InfoRow label="Tenure" value={`${loan.tenure} months`} />
          <InfoRow label="Monthly EMI" value={formatCurrency(loan.emi)} />
          <InfoRow label="Processing Fee" value={loan.processingFee} />
          {loan.disbursedDate && <InfoRow label="Disbursed On" value={formatDate(loan.disbursedDate)} />}
          {isActive && (
            <>
              <InfoRow label="Outstanding" value={formatCurrency(loan.outstandingAmount)} />
              <InfoRow label="EMIs Paid" value={`${loan.paidEmis} / ${loan.tenure}`} />
            </>
          )}
        </Card>

        {/* Borrower Info */}
        <Card>
          <Text style={styles.sectionTitle}>Borrower Details</Text>
          <InfoRow label="Student" value={loan.studentName} />
          <InfoRow label="Borrower" value={loan.borrowerName} />
        </Card>

        {/* Repayment Schedule */}
        {schedule.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Repayment Schedule</Text>
            {schedule.map((emi) => (
              <View key={emi.emiNo} style={styles.emiRow}>
                <View style={styles.emiLeft}>
                  <Text style={styles.emiNo}>EMI {emi.emiNo}</Text>
                  <Text style={styles.emiDate}>{formatDate(emi.date)}</Text>
                </View>
                <Text style={styles.emiAmount}>{formatCurrency(emi.amount)}</Text>
                <View
                  style={[
                    styles.emiStatusBadge,
                    {
                      backgroundColor:
                        emi.status === 'paid' ? '#E8F8F7' :
                        emi.status === 'upcoming' ? '#E8F8F7' : '#F5F5F5',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.emiStatusText,
                      {
                        color:
                          emi.status === 'paid' ? COLORS.teal :
                          emi.status === 'upcoming' ? COLORS.info : COLORS.textSecondary,
                      },
                    ]}
                  >
                    {emi.status === 'paid' ? '✓ Paid' :
                     emi.status === 'upcoming' ? 'Upcoming' : 'Pending'}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Service Actions */}
        {isActive && (
          <Card>
            <Text style={styles.sectionTitle}>Loan Servicing</Text>
            <Button
              title="Pay EMI Before Due Date"
              onPress={() => navigation.navigate('Prepayment', { loanId, type: 'emi' })}
              variant="outline"
              style={styles.serviceBtn}
            />
            <Button
              title="Part/Pre Payment"
              onPress={() => navigation.navigate('Prepayment', { loanId, type: 'part' })}
              variant="outline"
              style={styles.serviceBtn}
            />
            <Button
              title="Foreclosure"
              onPress={() => navigation.navigate('Prepayment', { loanId, type: 'foreclosure' })}
              variant="outline"
              style={styles.serviceBtn}
            />
            <Button
              title="Request NOC"
              onPress={() => navigation.navigate('NocRequest', { loanId })}
              variant="outline"
              style={styles.serviceBtn}
            />
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  statusCard: { backgroundColor: COLORS.primary },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanName: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  statusLoanName: { fontSize: 17, fontWeight: '700', color: COLORS.textLight },
  courseName: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  emiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  emiLeft: { flex: 1 },
  emiNo: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  emiDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  emiAmount: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginRight: 12 },
  emiStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  emiStatusText: { fontSize: 11, fontWeight: '600' },
  serviceBtn: { marginTop: 8 },
  bottomSpacer: { height: 100 },
});

export default LoanDetailScreen;
