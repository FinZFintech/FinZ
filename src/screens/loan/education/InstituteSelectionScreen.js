import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Header from '../../../components/common/Header';
import Input from '../../../components/common/Input';
import Card from '../../../components/common/Card';
import { COLORS } from '../../../config/constants';
import { loanService } from '../../../services/loanService';
import { useLoan } from '../../../store/LoanContext';

const InstituteSelectionScreen = ({ navigation }) => {
  const { dispatch } = useLoan();
  const [search, setSearch] = useState('');
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const fetchInstitutes = async (query = '') => {
    setLoading(true);
    try {
      const data = await loanService.getInstitutes(query);
      setInstitutes(data.institutes || []);
    } catch {
      // Mock data for testing
      setInstitutes([
        { id: '1', name: 'ABC Institute of Technology', city: 'Bangalore', courses: 12 },
        { id: '2', name: 'XYZ Coaching Academy', city: 'Delhi', courses: 8 },
        { id: '3', name: 'PQR Engineering College', city: 'Mumbai', courses: 15 },
        { id: '4', name: 'LMN Medical Academy', city: 'Chennai', courses: 6 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (text.length >= 2) {
      fetchInstitutes(text);
    } else if (text.length === 0) {
      fetchInstitutes();
    }
  };

  const handleSelectInstitute = (institute) => {
    dispatch({ type: 'SET_INSTITUTE', payload: institute });
    dispatch({ type: 'SET_LOAN_TYPE', payload: 'education' });
    navigation.navigate('StudentDetails');
  };

  const renderInstitute = ({ item }) => (
    <Card onPress={() => handleSelectInstitute(item)} style={styles.instituteCard}>
      <View style={styles.instituteIcon}>
        <Text style={styles.iconText}>🏫</Text>
      </View>
      <View style={styles.instituteInfo}>
        <Text style={styles.instituteName}>{item.name}</Text>
        <Text style={styles.instituteCity}>{item.city}</Text>
        <Text style={styles.coursesCount}>{item.courses} courses available</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header title="Select Institute" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <View style={styles.content}>
        <Input
          placeholder="Search institute by name or city..."
          value={search}
          onChangeText={handleSearch}
          style={styles.searchInput}
        />
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={institutes}
            keyExtractor={(item) => item.id}
            renderItem={renderInstitute}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No institutes found</Text>
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16 },
  searchInput: { marginTop: 16 },
  list: { paddingBottom: 20 },
  instituteCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instituteIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEEDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: { fontSize: 24 },
  instituteInfo: { flex: 1 },
  instituteName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  instituteCity: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  coursesCount: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  arrow: { fontSize: 20, color: COLORS.textSecondary },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textSecondary },
});

export default InstituteSelectionScreen;
