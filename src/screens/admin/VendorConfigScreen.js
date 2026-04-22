import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Alert, RefreshControl,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { getVendorConfig, updateVendorConfig, clearVendorConfigCache } from '../../services/vendorConfigService';

const VendorConfigScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadConfig = useCallback(async () => {
    clearVendorConfigCache();
    try {
      const c = await getVendorConfig();
      setConfig(JSON.parse(JSON.stringify(c))); // deep clone
    } catch (err) {
      Alert.alert('Error', 'Failed to load vendor config.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConfig();
    setRefreshing(false);
  }, [loadConfig]);

  const toggleVendor = (pair, vendorKey) => {
    setConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const current = next[pair][vendorKey];
      const otherActive = Object.entries(next[pair])
        .filter(([k]) => k !== vendorKey)
        .some(([, v]) => v.active);

      if (current.active && !otherActive) {
        Alert.alert('Cannot Disable', 'At least one vendor must remain active. Enable the alternate vendor first.');
        return prev;
      }

      next[pair][vendorKey].active = !current.active;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateVendorConfig(config, user?.name || user?.phone || '');
      Alert.alert('Saved', 'Vendor configuration updated successfully.');
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const renderVendorPair = (pair, title, description) => {
    if (!config?.[pair]) return null;
    const vendors = Object.entries(config[pair]);
    const bothActive = vendors.every(([, v]) => v.active);

    return (
      <Card style={{ marginBottom: 12 }}>
        <Text style={[styles.pairTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>{description}</Text>

        {bothActive && (
          <View style={{ backgroundColor: `${colors.teal}14`, padding: 10, borderRadius: 8, marginBottom: 12 }}>
            <Text style={{ color: colors.teal, fontSize: 12 }}>
              Both vendors active — automatic failover enabled. If the primary fails, the alternate will be tried automatically.
            </Text>
          </View>
        )}

        {vendors.map(([key, vendor]) => (
          <View key={key} style={[styles.vendorRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
                  {vendor.label}
                </Text>
                <View style={{
                  marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
                  backgroundColor: vendor.type === 'primary' ? `${colors.teal}14` : `${colors.warning}14`,
                }}>
                  <Text style={{
                    color: vendor.type === 'primary' ? colors.teal : colors.warning,
                    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
                  }}>
                    {vendor.type}
                  </Text>
                </View>
              </View>
              <Text style={{ color: vendor.active ? colors.teal : colors.error, fontSize: 11, marginTop: 4 }}>
                {vendor.active ? '● Active' : '○ Inactive'}
              </Text>
            </View>
            <Switch
              value={vendor.active}
              onValueChange={() => toggleVendor(pair, key)}
              trackColor={{ false: colors.border, true: `${colors.teal}60` }}
              thumbColor={vendor.active ? colors.teal : colors.textSecondary}
            />
          </View>
        ))}
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Vendor Configuration" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Loading configuration...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Vendor Configuration (BCP)" onBack={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
      >
        <View style={{ backgroundColor: `${colors.warning}14`, padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
            Business Continuity Plan (BCP)
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            Configure primary and alternate vendors for all API and SMS services. When both vendors are active, the system automatically fails over to the alternate if the primary fails. At least one vendor per category must remain active.
          </Text>
        </View>

        {renderVendorPair(
          'api',
          'API Services (KYC / Verification / Identity)',
          'Used for PAN verification, CKYC, employment check, phone prefill, FraudShield, GST, ITR, bank IFSC, face match, liveness, and all other identity/verification APIs.',
        )}

        {renderVendorPair(
          'sms',
          'SMS / OTP Services',
          'Used for sending OTP during login, phone verification, and transactional notifications.',
        )}

        <Button
          title={saving ? 'Saving...' : 'Save Configuration'}
          onPress={handleSave}
          disabled={saving}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pairTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  vendorRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

export default VendorConfigScreen;
