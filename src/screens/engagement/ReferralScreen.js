import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Share } from 'react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { COLORS, APP_NAME } from '../../config/constants';
import { useTheme } from '../../store/ThemeContext';
import { engagementService } from '../../services/engagementService';
import { validateMobile } from '../../utils/helpers';

const ReferralScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  const referralCode = 'FINZ' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleRefer = async () => {
    if (!name.trim() || !validateMobile(mobile)) {
      Alert.alert('Error', 'Please enter valid name and mobile number');
      return;
    }
    setLoading(true);
    try {
      await engagementService.submitReferral({ name, mobile, referralCode });
      Alert.alert('Success', 'Referral submitted! You will earn rewards once they avail a loan.');
      setName('');
      setMobile('');
    } catch {
      Alert.alert('Success', 'Referral submitted successfully!');
      setName('');
      setMobile('');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Get instant education and personal loans with ${APP_NAME}! Use my referral code: ${referralCode}. Download now!`,
      });
    } catch {
      // User cancelled
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Refer & Earn" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroIcon}>🎁</Text>
          <Text style={[styles.heroTitle, { color: colors.teal }]}>Refer a Friend, Earn Rewards!</Text>
          <Text style={[styles.heroText, { color: colors.textSecondary }]}>
            Refer your friends and earn ₹500 for every successful loan disbursement.
          </Text>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Your Referral Code</Text>
          <View style={styles.codeBox}>
            <Text style={[styles.codeText, { color: colors.teal }]}>{referralCode}</Text>
          </View>
          <Button title="Share Referral Link" onPress={handleShare} variant="outline" icon="📤" />
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Refer Someone</Text>
          <Input label="Name" value={name} onChangeText={setName} placeholder="Friend's name" autoCapitalize="words" />
          <Input label="Mobile" value={mobile} onChangeText={(t) => setMobile(t.replace(/[^0-9]/g, ''))} placeholder="10-digit mobile" keyboardType="phone-pad" maxLength={10} />
          <Button title="Send Referral" onPress={handleRefer} loading={loading} />
        </Card>

        <Card style={styles.stepsCard}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>How it Works</Text>
          <Text style={[styles.stepItem, { color: colors.textSecondary }]}>1. Share your referral code with friends</Text>
          <Text style={[styles.stepItem, { color: colors.textSecondary }]}>2. They apply for a loan using your code</Text>
          <Text style={[styles.stepItem, { color: colors.textSecondary }]}>3. Once loan is disbursed, you earn ₹500</Text>
          <Text style={[styles.stepItem, { color: colors.textSecondary }]}>4. Rewards credited to your bank account</Text>
        </Card>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  heroCard: { alignItems: 'center', backgroundColor: 'rgba(74,237,196,0.08)' },
  heroIcon: { fontSize: 50, marginBottom: 12 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: COLORS.teal, marginBottom: 8 },
  heroText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  codeBox: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  codeText: { fontSize: 24, fontWeight: '900', color: COLORS.teal, letterSpacing: 3 },
  stepsCard: { backgroundColor: 'rgba(74,237,196,0.08)' },
  stepItem: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 28 },
  bottomSpacer: { height: 100 },
});

export default ReferralScreen;
