import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { COLORS } from '../../config/constants';
import { engagementService } from '../../services/engagementService';

const OffersScreen = ({ navigation }) => {
  const [offers, setOffers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadOffers(); }, []);

  const loadOffers = async () => {
    try {
      const data = await engagementService.getOffers();
      setOffers(data.offers || []);
    } catch {
      setOffers([
        { id: '1', title: 'Zero Processing Fee', description: 'Apply for education loan this month and get zero processing fee!', validTill: '2026-03-31', color: '#E8F8F7' },
        { id: '2', title: 'Reduced Interest Rate', description: 'Special 11% p.a. interest rate for select institutes.', validTill: '2026-04-15', color: '#F0EDF5' },
        { id: '3', title: 'Cashback Offer', description: 'Get ₹1000 cashback on your first EMI payment.', validTill: '2026-03-31', color: '#FFF8E1' },
        { id: '4', title: 'Referral Bonus Double', description: 'Earn ₹1000 per referral this month. Double the rewards!', validTill: '2026-03-31', color: '#E8F8F7' },
      ]);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadOffers(); setRefreshing(false); };

  return (
    <View style={styles.container}>
      <Header title="Offers & Rewards" onBack={() => navigation.goBack()} />
      <FlatList
        data={offers}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Card style={[styles.offerCard, { backgroundColor: item.color }]}>
            <Text style={styles.offerTitle}>{item.title}</Text>
            <Text style={styles.offerDesc}>{item.description}</Text>
            <Text style={styles.validity}>Valid till: {item.validTill}</Text>
            <Button title="Apply Now" onPress={() => navigation.navigate('InstituteSelection')} variant="outline" style={styles.btn} />
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16 },
  offerCard: { marginBottom: 4 },
  offerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  offerDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 8 },
  validity: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 12 },
  btn: { alignSelf: 'flex-start' },
});

export default OffersScreen;
