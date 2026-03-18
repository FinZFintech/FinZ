import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { validateEmail, validateMobile } from '../../utils/helpers';

const PersonalDetailsScreen = ({ navigation }) => {
  const { user, updateUser } = useAuth();
  const { colors } = useTheme();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone] = useState(user?.phone || '');
  const [dob, setDob] = useState(user?.dob || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [address, setAddress] = useState(user?.address || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setDob(user.dob || '');
      setGender(user.gender || '');
      setAddress(user.address || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (email && !validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        ...user,
        name: name.trim(),
        email: email.trim(),
        dob,
        gender,
        address: address.trim(),
      });
      setEditing(false);
      Alert.alert('Success', 'Personal details updated successfully');
    } catch {
      Alert.alert('Error', 'Failed to update details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setDob(user?.dob || '');
    setGender(user?.gender || '');
    setAddress(user?.address || '');
    setEditing(false);
  };

  const isKycVerified = !!user?.kycVerified;
  const genderOptions = ['Male', 'Female', 'Other'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Personal Details" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Profile Header with KYC Badge */}
        <Card style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.teal }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>
              {(name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{name || 'User'}</Text>
          {isKycVerified && (
            <View style={[styles.kycBadge, { backgroundColor: `${colors.success}20`, borderColor: colors.success }]}>
              <Text style={[styles.kycBadgeText, { color: colors.success }]}>KYC Verified</Text>
            </View>
          )}
          {!isKycVerified && (
            <View style={[styles.kycBadge, { backgroundColor: `${colors.warning}20`, borderColor: colors.warning }]}>
              <Text style={[styles.kycBadgeText, { color: colors.warning }]}>KYC Pending</Text>
            </View>
          )}
        </Card>

        {/* Personal Information */}
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Information</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={[styles.editBtn, { color: colors.teal }]}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            editable={editing}
            autoCapitalize="words"
          />
          <Input
            label="Mobile Number"
            value={phone}
            placeholder="Mobile number"
            editable={false}
            prefix="+91"
          />
          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            editable={editing}
            keyboardType="email-address"
          />
          <Input
            label="Date of Birth"
            value={dob}
            onChangeText={setDob}
            placeholder="DD/MM/YYYY"
            editable={editing}
            keyboardType="number-pad"
            maxLength={10}
          />

          {/* Gender Selection */}
          <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Gender</Text>
          <View style={styles.genderRow}>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.genderChip,
                  { borderColor: colors.border, backgroundColor: colors.cardBg },
                  gender === option && { borderColor: colors.teal, backgroundColor: `${colors.teal}14` },
                ]}
                onPress={() => editing && setGender(option)}
                disabled={!editing}
              >
                <Text
                  style={[
                    styles.genderText,
                    { color: colors.textSecondary },
                    gender === option && { color: colors.teal },
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Enter your address"
            editable={editing}
            multiline
            autoCapitalize="sentences"
          />

          {editing && (
            <View style={styles.actionRow}>
              <Button
                title="Cancel"
                onPress={handleCancel}
                variant="outline"
                style={styles.actionBtn}
              />
              <Button
                title="Save"
                onPress={handleSave}
                loading={saving}
                style={styles.actionBtn}
              />
            </View>
          )}
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  profileHeader: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '800' },
  userName: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  kycBadge: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, marginTop: 4,
  },
  kycBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  editBtn: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 7, letterSpacing: 0.2 },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genderChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
  },
  genderText: { fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: { flex: 1 },
  bottomSpacer: { height: 100 },
});

export default PersonalDetailsScreen;
