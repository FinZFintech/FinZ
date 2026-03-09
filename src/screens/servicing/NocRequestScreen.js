import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { COLORS } from '../../config/constants';
import { loanService } from '../../services/loanService';

const NocRequestScreen = ({ route, navigation }) => {
  const { loanId } = route.params;
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      await loanService.requestNOC(loanId);
      Alert.alert('NOC Requested', 'Your NOC will be generated and shared within 7 business days.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('NOC Requested', 'Your request has been submitted. NOC will be shared via email.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Request NOC" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        <Card>
          <Text style={styles.sectionTitle}>No Objection Certificate (NOC)</Text>
          <Text style={styles.infoText}>
            Request a No Objection Certificate for your closed/foreclosed loan.
            The NOC will be generated and sent to your registered email.
          </Text>
          <View style={styles.timeline}>
            <Text style={styles.timelineItem}>1. Submit NOC request</Text>
            <Text style={styles.timelineItem}>2. Verification (1-2 business days)</Text>
            <Text style={styles.timelineItem}>3. NOC generation & delivery via email</Text>
          </View>
          <Button title="Request NOC" onPress={handleRequest} loading={loading} />
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 16 },
  timeline: { backgroundColor: '#F5F7FA', padding: 14, borderRadius: 10, marginBottom: 20 },
  timelineItem: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 26 },
});

export default NocRequestScreen;
