import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Header from '../../../components/common/Header';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { COLORS } from '../../../config/constants';
import { useTheme } from '../../../store/ThemeContext';
import { loanService } from '../../../services/loanService';
import { useLoan } from '../../../store/LoanContext';

const InstituteSelectionScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { dispatch } = useLoan();
  const [search, setSearch] = useState('');
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCity, setManualCity] = useState('');

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const fetchInstitutes = async (query = '') => {
    setLoading(true);
    try {
      const data = await loanService.getInstitutes(query);
      setInstitutes(data.institutes || []);
    } catch {
      setInstitutes([]);
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

  const handleManualSubmit = () => {
    if (!manualName.trim()) {
      Alert.alert('Error', 'Please enter institute name');
      return;
    }
    if (!manualCity.trim()) {
      Alert.alert('Error', 'Please enter city');
      return;
    }
    const manualInstitute = {
      id: null,
      name: manualName.trim(),
      city: manualCity.trim(),
      courses: 0,
      isManual: true,
    };
    dispatch({ type: 'SET_INSTITUTE', payload: manualInstitute });
    dispatch({ type: 'SET_LOAN_TYPE', payload: 'education' });
    navigation.navigate('StudentDetails');
  };

  const renderInstitute = ({ item }) => (
    <Card onPress={() => handleSelectInstitute(item)} style={styles.instituteCard}>
      <View style={styles.instituteIcon}>
        <Text style={styles.iconText}>🏫</Text>
      </View>
      <View style={styles.instituteInfo}>
        <Text style={[styles.instituteName, { color: colors.textPrimary }]}>{item.name}</Text>
        <Text style={[styles.instituteCity, { color: colors.textSecondary }]}>{item.city}</Text>
        <Text style={[styles.coursesCount, { color: colors.teal }]}>{item.courses} courses available</Text>
      </View>
      <Text style={[styles.arrow, { color: colors.textSecondary }]}>→</Text>
    </Card>
  );

  if (manualEntry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Enter Institute Details" onBack={() => setManualEntry(false)} />
        <ScrollView style={styles.content} contentContainerStyle={styles.manualContent} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={[styles.manualTitle, { color: colors.textPrimary }]}>Institute Not Listed?</Text>
            <Text style={[styles.manualSubtitle, { color: colors.textSecondary }]}>
              Enter your institute details manually. You will also need to fill in student details on the next screen.
            </Text>
            <Input
              label="Institute Name"
              value={manualName}
              onChangeText={setManualName}
              placeholder="Enter full institute name"
              autoCapitalize="words"
            />
            <Input
              label="City"
              value={manualCity}
              onChangeText={setManualCity}
              placeholder="Enter city"
              autoCapitalize="words"
            />
            <Button
              title="Continue"
              onPress={handleManualSubmit}
              style={styles.manualBtn}
            />
          </Card>
        </ScrollView>
        <FloatingAssistButton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Select Institute" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <View style={styles.content}>
        <Input
          placeholder="Search institute by name or city..."
          value={search}
          onChangeText={handleSearch}
          style={styles.searchInput}
        />
        {loading ? (
          <ActivityIndicator size="large" color={colors.teal} style={styles.loader} />
        ) : (
          <FlatList
            data={institutes}
            keyExtractor={(item) => item.id}
            renderItem={renderInstitute}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No institutes found</Text>
            }
          />
        )}
        <TouchableOpacity
          style={styles.manualEntryBtn}
          onPress={() => setManualEntry(true)}
        >
          <Text style={[styles.manualEntryText, { color: colors.teal }]}>My institute is not listed</Text>
          <Text style={[styles.manualEntryArrow, { color: colors.teal }]}>→</Text>
        </TouchableOpacity>
      </View>
      <FloatingAssistButton />
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
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: { fontSize: 24 },
  instituteInfo: { flex: 1 },
  instituteName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  instituteCity: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  coursesCount: { fontSize: 12, color: COLORS.teal, marginTop: 2 },
  arrow: { fontSize: 20, color: COLORS.textSecondary },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textSecondary },
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.teal,
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(74,237,196,0.05)',
  },
  manualEntryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.teal,
  },
  manualEntryArrow: {
    fontSize: 16,
    color: COLORS.teal,
    marginLeft: 8,
  },
  manualContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  manualTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  manualSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  manualBtn: { marginTop: 12 },
});

export default InstituteSelectionScreen;
