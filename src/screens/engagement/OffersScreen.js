import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useTheme } from '../../store/ThemeContext';
import { engagementService } from '../../services/engagementService';

const OffersScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [offers, setOffers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadOffers(); }, []);

  const loadOffers = async () => {
    try {
      const data = await engagementService.getOffers();
      setOffers(data.offers || []);
    } catch {
      setOffers([
        { id: '1', title: 'Zero Processing Fee', description: 'Apply for education loan this month and get zero processing fee!', validTill: '2026-03-31', color: 'rgba(74,237,196,0.08)' },
        { id: '2', title: 'Reduced Interest Rate', description: 'Special 11% p.a. interest rate for select institutes.', validTill: '2026-04-15', color: null },
        { id: '3', title: 'Cashback Offer', description: 'Get ₹1000 cashback on your first EMI payment.', validTill: '2026-03-31', color: 'rgba(245,183,49,0.08)' },
        { id: '4', title: 'Referral Bonus Double', description: 'Earn ₹1000 per referral this month. Double the rewards!', validTill: '2026-03-31', color: 'rgba(74,237,196,0.08)' },
      ]);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadOffers(); setRefreshing(false); };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Offers & Rewards" onBack={() => navigation.goBack()} />
      <FlatList
        data={offers}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Card style={[styles.offerCard, item.color && { backgroundColor: item.color }]}>
            <Text style={[styles.offerTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.offerDesc, { color: colors.textSecondary }]}>{item.description}</Text>
            <Text style={[styles.validity, { color: colors.textSecondary }]}>Valid till: {item.validTill}</Text>
            <Button title="Apply Now" onPress={() => navigation.navigate('InstituteSelection')} variant="outline" style={styles.btn} />
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 80 },
  offerCard: { marginBottom: 4 },
  offerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  offerDesc: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  validity: { fontSize: 12, fontStyle: 'italic', marginBottom: 12 },
  btn: { alignSelf: 'flex-start' },
});

export default OffersScreen;
