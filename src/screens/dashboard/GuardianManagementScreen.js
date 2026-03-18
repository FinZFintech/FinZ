import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { validateMobile, validateEmail } from '../../utils/helpers';

const RELATION_OPTIONS = ['Father', 'Mother', 'Guardian', 'Spouse'];

const GuardianManagementScreen = ({ navigation }) => {
  const { user, guardians, addGuardian, removeGuardian } = useAuth();
  const { colors } = useTheme();

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setRelation('');
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter guardian name');
      return;
    }
    if (!validateMobile(phone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    if (email && !validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!relation) {
      Alert.alert('Error', 'Please select a relationship');
      return;
    }
    if (phone === user?.phone) {
      Alert.alert('Error', 'Guardian phone number cannot be the same as yours');
      return;
    }
    const alreadyExists = guardians.some(g => g.phone === phone);
    if (alreadyExists) {
      Alert.alert('Error', 'A guardian with this phone number already exists');
      return;
    }

    setSaving(true);
    try {
      await addGuardian({ name: name.trim(), phone, email: email.trim(), relation });
      setShowAddModal(false);
      resetForm();
      Alert.alert('Success', `${name.trim()} has been added as your ${relation.toLowerCase()}. They can now view your loan applications when they log in with ${phone}.`);
    } catch {
      Alert.alert('Error', 'Failed to add guardian. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (guardian) => {
    Alert.alert(
      'Remove Guardian',
      `Are you sure you want to remove ${guardian.name} as your ${guardian.relation.toLowerCase()}? They will no longer be able to view your loans.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeGuardian(guardian.id);
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Parent / Guardian" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>Link Parent or Guardian</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Add your parent or guardian so they can view your loan applications, track loan status, and take actions on your behalf from their own login.
          </Text>
        </Card>

        {/* Existing Guardians */}
        {guardians.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Linked Guardians</Text>
            {guardians.map((guardian) => (
              <View
                key={guardian.id}
                style={[styles.guardianCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <View style={styles.guardianInfo}>
                  <View style={[styles.guardianAvatar, { backgroundColor: colors.teal }]}>
                    <Text style={[styles.guardianAvatarText, { color: colors.background }]}>
                      {guardian.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.guardianDetails}>
                    <Text style={[styles.guardianName, { color: colors.textPrimary }]}>{guardian.name}</Text>
                    <Text style={[styles.guardianRelation, { color: colors.teal }]}>{guardian.relation}</Text>
                    <Text style={[styles.guardianPhone, { color: colors.textSecondary }]}>{guardian.phone}</Text>
                    {guardian.email ? (
                      <Text style={[styles.guardianPhone, { color: colors.textSecondary }]}>{guardian.email}</Text>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.removeBtn, { backgroundColor: `${colors.error}15` }]}
                  onPress={() => handleRemove(guardian)}
                >
                  <Text style={[styles.removeBtnText, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {/* Add Guardian Button */}
        <Button
          title="Add Parent / Guardian"
          onPress={() => setShowAddModal(true)}
          style={styles.addBtn}
        />

        {/* Empty State */}
        {guardians.length === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👨‍👧</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No parent or guardian linked yet. Add one to allow them to view and manage your loans.
            </Text>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add Guardian Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Parent / Guardian</Text>

            <Input
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter guardian's full name"
              autoCapitalize="words"
            />
            <Input
              label="Mobile Number"
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
              placeholder="Enter 10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Input
              label="Email (Optional)"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
            />

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Relationship</Text>
            <View style={styles.relationRow}>
              {RELATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.relationChip,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    relation === opt && { borderColor: colors.teal, backgroundColor: `${colors.teal}14` },
                  ]}
                  onPress={() => setRelation(opt)}
                >
                  <Text
                    style={[
                      styles.relationText,
                      { color: colors.textSecondary },
                      relation === opt && { color: colors.teal },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => { setShowAddModal(false); resetForm(); }}
                variant="outline"
                style={styles.modalActionBtn}
              />
              <Button
                title="Add Guardian"
                onPress={handleAdd}
                loading={saving}
                style={styles.modalActionBtn}
              />
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
  infoCard: { paddingVertical: 20 },
  infoTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  infoText: { fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  guardianCard: {
    borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10,
  },
  guardianInfo: { flexDirection: 'row', alignItems: 'center' },
  guardianAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  guardianAvatarText: { fontSize: 18, fontWeight: '800' },
  guardianDetails: { flex: 1 },
  guardianName: { fontSize: 15, fontWeight: '700' },
  guardianRelation: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  guardianPhone: { fontSize: 12, marginTop: 2 },
  removeBtn: {
    marginTop: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
  },
  removeBtnText: { fontSize: 13, fontWeight: '600' },
  addBtn: { marginTop: 16 },
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  bottomSpacer: { height: 100 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 7, letterSpacing: 0.2 },
  relationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  relationChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5,
  },
  relationText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalActionBtn: { flex: 1 },
});

export default GuardianManagementScreen;
