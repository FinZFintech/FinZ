import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { COLORS, APP_NAME } from '../../config/constants';
import { useAuth } from '../../store/AuthContext';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
          );
        },
      },
    ]);
  };

  const menuItems = [
    { icon: '👤', label: 'Personal Details', screen: 'PersonalDetails' },
    { icon: '📋', label: 'My Loans', screen: 'MyLoans' },
    { icon: '📊', label: 'Credit Score', screen: 'CreditScore' },
    { icon: '🎁', label: 'Refer & Earn', screen: 'Referral' },
    { icon: '🏷️', label: 'Offers', screen: 'Offers' },
    { icon: '🔥', label: 'Daily Check-In', screen: 'DailyCheckIn' },
    { icon: '❓', label: 'Help & Support', screen: null },
    { icon: '📄', label: 'Terms & Conditions', screen: null },
    { icon: '🔒', label: 'Privacy Policy', screen: null },
  ];

  return (
    <View style={styles.container}>
      <Header title="Profile" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <ScrollView style={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.phone}>{user?.phone || '+91 XXXXXXXXXX'}</Text>
        </Card>

        <Card>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={() => item.screen && navigation.navigate(item.screen)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </Card>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>{APP_NAME} v1.0.0</Text>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  profileCard: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.teal,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: COLORS.textLight },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  phone: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  menuArrow: { fontSize: 16, color: COLORS.teal },
  logoutBtn: {
    backgroundColor: '#FFF3F0', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: COLORS.error },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.textSecondary, marginTop: 16 },
  bottomSpacer: { height: 100 },
});

export default ProfileScreen;
