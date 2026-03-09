import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import InfoRow from '../../components/common/InfoRow';
import { COLORS } from '../../config/constants';
import { loanService } from '../../services/loanService';
import { formatCurrency } from '../../utils/helpers';

const PrepaymentScreen = ({ route, navigation }) => {
  const { loanId, type } = route.params;
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const titles = {
    emi: 'Pay EMI Before Due Date',
    part: 'Part/Pre Payment',
    foreclosure: 'Foreclosure Request',
  };

  const handleSubmit = async () => {
    if (type !== 'foreclosure' && (!amount || isNaN(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      if (type === 'foreclosure') {
        await loanService.requestForeclosure(loanId);
      } else {
        await loanService.requestPrepayment(loanId, { amount: Number(amount), type });
      }
      Alert.alert('Success', 'Your request has been submitted successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Success', 'Request submitted. You will receive payment link shortly.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title={titles[type]} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        <Card>
          <Text style={styles.sectionTitle}>{titles[type]}</Text>
          <InfoRow label="Loan ID" value={`#${loanId}`} />

          {type === 'foreclosure' ? (
            <>
              <Text style={styles.infoText}>
                Foreclosure will close your loan account. Foreclosure charges as per
                your loan agreement will apply.
              </Text>
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  Foreclosure amount will be calculated and shared with you.
                  Processing may take 2-3 business days.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.infoText}>
                {type === 'emi'
                  ? 'Pay your upcoming EMI before the due date.'
                  : 'Make a part payment to reduce your outstanding principal.'}
              </Text>
              <Input
                label="Amount (₹)"
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                placeholder="Enter amount"
                keyboardType="number-pad"
              />
              {amount && (
                <Text style={styles.amountPreview}>
                  Amount: {formatCurrency(Number(amount))}
                </Text>
              )}
            </>
          )}

          <Button
            title="Submit Request"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginVertical: 12 },
  warningBanner: { backgroundColor: '#FFF8E1', padding: 12, borderRadius: 8, marginBottom: 12 },
  warningText: { fontSize: 13, color: COLORS.warning, lineHeight: 20 },
  amountPreview: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 12 },
  submitBtn: { marginTop: 16 },
});

export default PrepaymentScreen;
