import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, Platform,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { formatDate } from '../../utils/helpers';
import {
  createStaffUser, getAllStaffUsers, disableStaffUser,
  enableStaffUser, updateStaffUserRole,
} from '../../services/userService';

const ROLES = ['sales', 'credit', 'operations', 'admin'];

const UserManagementScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('sales');
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      Alert.alert('Error', 'Please enter a valid name (at least 2 characters).');
      return;
    }
    if (!newPhone || newPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setCreating(true);
    try {
      await createStaffUser({
        phone: newPhone,
        name: newName.trim(),
        role: newRole,
        createdBy: user?.name || user?.phone || '',
      });
      setShowCreate(false);
      setNewName('');
      setNewPhone('');
      setNewRole('sales');
      Alert.alert('Success', `${newRole} user created. They can now log in with OTP on ${newPhone}.`);
      loadUsers();
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (staffUser) => {
    const action = staffUser.active ? 'disable' : 'enable';
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${action === 'disable' ? 'Disable' : 'Enable'} user ${staffUser.name} (${staffUser.phone})?`)
      : true;
    if (!confirmed) return;

    try {
      if (action === 'disable') {
        await disableStaffUser(staffUser.phone, user?.name || user?.phone || '');
      } else {
        await enableStaffUser(staffUser.phone, user?.name || user?.phone || '');
      }
      loadUsers();
    } catch (err) {
      Alert.alert('Error', err?.message || `Failed to ${action} user.`);
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

        {/* Create button */}
        <Button
          title="+ Create New Staff User"
          onPress={() => setShowCreate(true)}
          style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 8 }}
        />

        {/* User list */}
        {loading ? (
          <View style={styles.emptyWrap}>
            <Text style={{ color: colors.textSecondary }}>Loading users...</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              No staff users created yet. Tap the button above to create your first user.
            </Text>
          </View>
        ) : (
          users.map((u) => (
            <Card key={u.userId || u.phone} style={{ marginHorizontal: 16, marginBottom: 8 }}>
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
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{u.phone}</Text>
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
                  onPress={() => handleToggleActive(u)}
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
          <View style={{ backgroundColor: colors.cardBg, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
              Create Staff User
            </Text>
            <Input
              label="Full Name"
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter staff member name"
              autoCapitalize="words"
            />
            <Input
              label="Mobile Number"
              value={newPhone}
              onChangeText={(t) => setNewPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />
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
});

export default UserManagementScreen;
