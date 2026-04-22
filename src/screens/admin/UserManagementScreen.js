import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, Platform,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { formatDate, validateMobile, validateEmail } from '../../utils/helpers';
import {
  createStaffUser, getAllStaffUsers, disableStaffUser,
  enableStaffUser, getStaffUserByPhone,
} from '../../services/userService';

const ROLES = ['sales', 'credit', 'operations', 'admin'];

const UserManagementScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loginMethod, setLoginMethod] = useState('phone'); // 'phone' | 'email'
  const [newRole, setNewRole] = useState('sales');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const all = await getAllStaffUsers();
      setUsers(all);
    } catch (err) {
      console.log('[UserMgmt] Load failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }, [loadUsers]);

  // Search / filter
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q),
    );
  }, [users, searchQuery]);

  const handleCreate = async () => {
    setCreateError('');

    if (!newName.trim() || newName.trim().length < 2) {
      setCreateError('Please enter a valid name (at least 2 characters).');
      return;
    }

    if (loginMethod === 'phone') {
      if (!newPhone || newPhone.length !== 10) {
        setCreateError('Please enter a valid 10-digit mobile number.');
        return;
      }
      if (!/^[6-9]\d{9}$/.test(newPhone)) {
        setCreateError('Invalid mobile number. Must start with 6-9 and be 10 digits.');
        return;
      }
      // Check duplicate
      const existing = users.find((u) => u.phone === newPhone);
      if (existing) {
        setCreateError(`A user with mobile ${newPhone} already exists (${existing.name}, ${existing.role}).`);
        return;
      }
    } else {
      if (!newEmail || !validateEmail(newEmail)) {
        setCreateError('Please enter a valid email address.');
        return;
      }
      // Check duplicate email
      const existing = users.find((u) => u.email?.toLowerCase() === newEmail.toLowerCase());
      if (existing) {
        setCreateError(`A user with email ${newEmail} already exists (${existing.name}, ${existing.role}).`);
        return;
      }
    }

    setCreating(true);
    try {
      await createStaffUser({
        phone: loginMethod === 'phone' ? newPhone : '',
        email: loginMethod === 'email' ? newEmail.trim() : '',
        name: newName.trim(),
        role: newRole,
        loginMethod,
        createdBy: user?.name || user?.phone || '',
      });
      setShowCreate(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewRole('sales');
      setCreateError('');
      const loginId = loginMethod === 'phone' ? newPhone : newEmail;
      Alert.alert('Success', `${newRole} user created. They can log in via OTP on ${loginId}.`);
      loadUsers();
    } catch (err) {
      setCreateError(err?.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  // Toggle active modal
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [toggleUser, setToggleUser] = useState(null);
  const [toggling, setToggling] = useState(false);

  const openToggleModal = (staffUser) => {
    setToggleUser(staffUser);
    setShowToggleModal(true);
  };

  const handleToggleConfirm = async () => {
    if (!toggleUser) return;
    const action = toggleUser.active ? 'disable' : 'enable';
    setToggling(true);
    try {
      if (action === 'disable') {
        await disableStaffUser(toggleUser.phone || toggleUser.email, user?.name || user?.phone || '');
      } else {
        await enableStaffUser(toggleUser.phone || toggleUser.email, user?.name || user?.phone || '');
      }
      // Update local state immediately for instant UI feedback
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === toggleUser.userId ? { ...u, active: !toggleUser.active } : u,
        ),
      );
    } catch (err) {
      console.log('[UserMgmt] Toggle failed:', err?.message);
      // Still close modal — show error inline or via alert
      Alert.alert('Error', err?.message || `Failed to ${action} user.`);
    } finally {
      setToggling(false);
      setShowToggleModal(false);
      setToggleUser(null);
    }
  };

  const roleColor = (role) => {
    switch (role) {
      case 'admin': return colors.error;
      case 'credit': return colors.warning;
      case 'sales': return colors.teal;
      case 'operations': return colors.info || colors.purple;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="User Management" onBack={() => navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
      >
        {/* Stats */}
        <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.teal }]}>{users.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.teal }]}>{users.filter(u => u.active).length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.error }]}>{users.filter(u => !u.active).length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Disabled</Text>
          </View>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by phone, email, name, or role..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>

        {/* Create button */}
        <Button
          title="+ Create New Staff User"
          onPress={() => { setShowCreate(true); setCreateError(''); }}
          style={{ marginHorizontal: 16, marginBottom: 8 }}
        />

        {/* User list */}
        {loading ? (
          <View style={styles.emptyWrap}>
            <Text style={{ color: colors.textSecondary }}>Loading users...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>{searchQuery ? '🔍' : '👥'}</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              {searchQuery
                ? `No users match "${searchQuery}".`
                : 'No staff users created yet. Tap the button above to create your first user.'}
            </Text>
          </View>
        ) : (
          filteredUsers.map((u) => (
            <Card key={u.userId || u.phone || u.email} style={{ marginHorizontal: 16, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: `${roleColor(u.role)}20`, marginRight: 10,
                }}>
                  <Text style={{ color: roleColor(u.role), fontWeight: '800', fontSize: 14 }}>
                    {(u.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{u.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {u.phone || u.email || '—'}
                    {u.loginMethod === 'email' ? ' (email login)' : ''}
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1,
                  borderColor: roleColor(u.role), backgroundColor: `${roleColor(u.role)}14`,
                }}>
                  <Text style={{ color: roleColor(u.role), fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                    {u.role}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: u.active ? colors.teal : colors.error, fontSize: 11, fontWeight: '600' }}>
                  {u.active ? '● Active' : '○ Disabled'}
                </Text>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
                    borderColor: u.active ? colors.error : colors.teal,
                    backgroundColor: u.active ? `${colors.error}14` : `${colors.teal}14`,
                  }}
                  onPress={() => openToggleModal(u)}
                >
                  <Text style={{ color: u.active ? colors.error : colors.teal, fontSize: 11, fontWeight: '700' }}>
                    {u.active ? 'Disable' : 'Enable'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Create User Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: colors.cardBg, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
                Create Staff User
              </Text>

              {createError ? (
                <View style={{ backgroundColor: `${colors.error}14`, padding: 10, borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ color: colors.error, fontSize: 13 }}>{createError}</Text>
                </View>
              ) : null}

              <Input
                label="Full Name"
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter staff member name"
                autoCapitalize="words"
              />

              {/* Login method toggle */}
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginBottom: 8, marginTop: 4 }}>
                Login Method
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center', marginRight: 8,
                    borderColor: loginMethod === 'phone' ? colors.teal : colors.border,
                    backgroundColor: loginMethod === 'phone' ? `${colors.teal}14` : colors.surface,
                  }}
                  onPress={() => setLoginMethod('phone')}
                >
                  <Text style={{ color: loginMethod === 'phone' ? colors.teal : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>
                    📱 Mobile OTP
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center',
                    borderColor: loginMethod === 'email' ? colors.teal : colors.border,
                    backgroundColor: loginMethod === 'email' ? `${colors.teal}14` : colors.surface,
                  }}
                  onPress={() => setLoginMethod('email')}
                >
                  <Text style={{ color: loginMethod === 'email' ? colors.teal : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>
                    ✉️ Email OTP
                  </Text>
                </TouchableOpacity>
              </View>

              {loginMethod === 'phone' ? (
                <Input
                  label="Mobile Number"
                  value={newPhone}
                  onChangeText={(t) => setNewPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="10-digit mobile (starts with 6-9)"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              ) : (
                <Input
                  label="Email Address"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="name@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}

              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginBottom: 8, marginTop: 4 }}>
                Role
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                      marginRight: 8, marginBottom: 8,
                      borderColor: newRole === r ? colors.teal : colors.border,
                      backgroundColor: newRole === r ? `${colors.teal}14` : colors.surface,
                    }}
                    onPress={() => setNewRole(r)}
                  >
                    <Text style={{
                      color: newRole === r ? colors.teal : colors.textSecondary,
                      fontSize: 13, fontWeight: newRole === r ? '700' : '400',
                      textTransform: 'capitalize',
                    }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginRight: 8 }}
                  onPress={() => setShowCreate(false)}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.teal, alignItems: 'center', opacity: creating ? 0.6 : 1 }}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{creating ? 'Creating...' : 'Create User'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Enable/Disable Confirmation Modal */}
      <Modal visible={showToggleModal} transparent animationType="fade" onRequestClose={() => setShowToggleModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.cardBg, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            {toggleUser && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>
                    {toggleUser.active ? '🚫' : '✅'}
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                    {toggleUser.active ? 'Disable User' : 'Enable User'}
                  </Text>
                </View>

                <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: `${roleColor(toggleUser.role)}20`, marginRight: 12,
                    }}>
                      <Text style={{ color: roleColor(toggleUser.role), fontWeight: '800', fontSize: 16 }}>
                        {(toggleUser.name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>{toggleUser.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{toggleUser.phone || toggleUser.email}</Text>
                    </View>
                    <View style={{
                      paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1,
                      borderColor: roleColor(toggleUser.role), backgroundColor: `${roleColor(toggleUser.role)}14`,
                    }}>
                      <Text style={{ color: roleColor(toggleUser.role), fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                        {toggleUser.role}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: toggleUser.active ? colors.teal : colors.error, fontSize: 12, fontWeight: '600' }}>
                    Current status: {toggleUser.active ? '● Active' : '○ Disabled'}
                  </Text>
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                  {toggleUser.active
                    ? 'This user will no longer be able to log in or access the system. Their existing data will be preserved.'
                    : 'This user will be able to log in and access the system again with their existing role and permissions.'}
                </Text>

                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginRight: 8 }}
                    onPress={() => { setShowToggleModal(false); setToggleUser(null); }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
                      backgroundColor: toggleUser.active ? colors.error : colors.teal,
                      opacity: toggling ? 0.6 : 1,
                    }}
                    onPress={handleToggleConfirm}
                    disabled={toggling}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                      {toggling
                        ? (toggleUser.active ? 'Disabling...' : 'Enabling...')
                        : (toggleUser.active ? 'Confirm Disable' : 'Confirm Enable')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  searchInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
});

export default UserManagementScreen;
