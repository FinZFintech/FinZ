import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { APP_NAME } from '../../config/constants';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { navigationRef } from '../../navigation/navigationRef';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const isKycVerified = !!user?.kycVerified;

  const menuItems = [
    { icon: '👤', label: 'Personal Details', screen: 'PersonalDetails' },
    { icon: '👨‍👧', label: 'Parent / Guardian', screen: 'GuardianManagement' },
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Profile" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <ScrollView style={styles.content}>
        <Card style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: colors.teal }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{user?.name || 'User'}</Text>
          <Text style={[styles.phone, { color: colors.textSecondary }]}>{user?.phone || '+91 XXXXXXXXXX'}</Text>
          {isKycVerified && (
            <View style={[styles.kycBadge, { backgroundColor: `${colors.success}20`, borderColor: colors.success }]}>
              <Text style={[styles.kycBadgeText, { color: colors.success }]}>KYC Verified</Text>
            </View>
          )}
        </Card>

        {/* Theme Toggle */}
        <Card>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={toggleTheme}>
            <Text style={styles.menuIcon}>{isDark ? '🌙' : '☀️'}</Text>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>
              {isDark ? 'Dark Theme' : 'Light Theme'}
            </Text>
            <View style={[styles.themeToggleTrack, {
              backgroundColor: isDark ? 'rgba(74,237,196,0.2)' : 'rgba(0,0,0,0.1)',
              borderColor: isDark ? 'rgba(74,237,196,0.3)' : 'rgba(0,0,0,0.15)',
            }]}>
              <View style={[styles.themeToggleThumb, {
                backgroundColor: isDark ? colors.teal : colors.primary,
                left: isDark ? 22 : 2,
              }]} />
            </View>
          </TouchableOpacity>
        </Card>

        <Card>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => item.screen && navigation.navigate(item.screen)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
              <Text style={[styles.menuArrow, { color: colors.teal }]}>→</Text>
            </TouchableOpacity>
          ))}
        </Card>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)}>
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textSecondary }]}>{APP_NAME} v1.0.0</Text>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Logout</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLogoutModal(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalLogoutBtn} onPress={handleLogout}>
                <Text style={[styles.modalLogoutText, { color: colors.error }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  profileCard: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700' },
  phone: { fontSize: 14, marginTop: 4 },
  kycBadge: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, marginTop: 8,
  },
  kycBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15 },
  menuArrow: { fontSize: 16 },
  themeToggleTrack: {
    width: 44, height: 24, borderRadius: 12, borderWidth: 1, justifyContent: 'center',
  },
  themeToggleThumb: {
    width: 20, height: 20, borderRadius: 10, position: 'absolute',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,107,107,0.1)', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)',
  },
  logoutText: { fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 16 },
  bottomSpacer: { height: 100 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    borderRadius: 16, padding: 24, width: '80%', borderWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalMessage: { fontSize: 14, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancelBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalLogoutBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
  modalLogoutText: { fontSize: 14, fontWeight: '700' },
});

export default ProfileScreen;
