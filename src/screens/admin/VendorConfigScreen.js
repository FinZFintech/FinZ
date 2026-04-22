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
      setConfig(JSON.parse(JSON.stringify(c)));
    } catch {
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

  const toggleApiVendor = (apiKey, vendor) => {
    setConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const entry = next.apis[apiKey];
      const other = vendor === 'signzy' ? 'digitap' : 'signzy';
      if (entry[vendor] && !entry[other]) {
        Alert.alert('Cannot Disable', 'At least one vendor must be active. Enable the other vendor first.');
        return prev;
      }
      next.apis[apiKey][vendor] = !entry[vendor];
      return next;
    });
  };

  const toggleSmsVendor = (smsKey, vendor) => {
    setConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const entry = next.sms[smsKey];
      const other = vendor === 'mtalkz' ? 'aisensy' : 'mtalkz';
      if (entry[vendor] && !entry[other]) {
        Alert.alert('Cannot Disable', 'At least one vendor must be active. Enable the other vendor first.');
        return prev;
      }
      next.sms[smsKey][vendor] = !entry[vendor];
      return next;
    });
  };

  const enableAllSignzy = () => {
    setConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      for (const key of Object.keys(next.apis)) {
        next.apis[key].signzy = true;
      }
      return next;
    });
  };

  const enableAllDigitap = () => {
    setConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      for (const key of Object.keys(next.apis)) {
        next.apis[key].digitap = true;
      }
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

  if (loading || !config) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Vendor Configuration" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Loading configuration...</Text>
        </View>
      </View>
    );
  }

  const apiEntries = Object.entries(config.apis || {});
  const smsEntries = Object.entries(config.sms || {});
  const apisBothActive = apiEntries.filter(([, v]) => v.signzy && v.digitap).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Vendor Config (BCP)" onBack={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
      >
        <View style={{ backgroundColor: `${colors.warning}14`, padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
            Business Continuity Plan (BCP) — Per-API Control
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            Toggle vendors independently for each API. When both vendors are enabled for an API, automatic failover kicks in — if the primary fails, the alternate is tried automatically.
          </Text>
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Button title="Enable All Signzy" onPress={enableAllSignzy} variant="outline" style={{ flex: 1, marginRight: 6 }} />
          <Button title="Enable All Digitap" onPress={enableAllDigitap} variant="outline" style={{ flex: 1, marginLeft: 6 }} />
        </View>

        {apisBothActive > 0 && (
          <View style={{ backgroundColor: `${colors.teal}14`, padding: 10, borderRadius: 8, marginBottom: 12 }}>
            <Text style={{ color: colors.teal, fontSize: 12 }}>
              {apisBothActive} API(s) have dual-vendor failover enabled.
            </Text>
          </View>
        )}

        {/* API Services — per-API toggles */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            API Services ({apiEntries.length})
          </Text>
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerLabel, { color: colors.textSecondary, flex: 1 }]}>API</Text>
            <Text style={[styles.headerLabel, { color: colors.teal, width: 70, textAlign: 'center' }]}>Signzy</Text>
            <Text style={[styles.headerLabel, { color: colors.warning, width: 70, textAlign: 'center' }]}>Digitap</Text>
          </View>

          {apiEntries.map(([key, val]) => (
            <View key={key} style={[styles.apiRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '500' }}>{val.label}</Text>
                {val.signzy && val.digitap && (
                  <Text style={{ color: colors.teal, fontSize: 9, fontWeight: '600' }}>FAILOVER</Text>
                )}
              </View>
              <View style={{ width: 70, alignItems: 'center' }}>
                <Switch
                  value={val.signzy}
                  onValueChange={() => toggleApiVendor(key, 'signzy')}
                  trackColor={{ false: colors.border, true: `${colors.teal}60` }}
                  thumbColor={val.signzy ? colors.teal : colors.textSecondary}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>
              <View style={{ width: 70, alignItems: 'center' }}>
                <Switch
                  value={val.digitap}
                  onValueChange={() => toggleApiVendor(key, 'digitap')}
                  trackColor={{ false: colors.border, true: `${colors.warning}60` }}
                  thumbColor={val.digitap ? colors.warning : colors.textSecondary}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>
            </View>
          ))}
        </Card>

        {/* SMS Services */}
        <Card style={{ marginTop: 12 }}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            SMS / OTP Services ({smsEntries.length})
          </Text>
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerLabel, { color: colors.textSecondary, flex: 1 }]}>Service</Text>
            <Text style={[styles.headerLabel, { color: colors.teal, width: 70, textAlign: 'center' }]}>mTalkz</Text>
            <Text style={[styles.headerLabel, { color: colors.warning, width: 70, textAlign: 'center' }]}>Aisensy</Text>
          </View>

          {smsEntries.map(([key, val]) => (
            <View key={key} style={[styles.apiRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '500' }}>{val.label}</Text>
                {val.mtalkz && val.aisensy && (
                  <Text style={{ color: colors.teal, fontSize: 9, fontWeight: '600' }}>FAILOVER</Text>
                )}
              </View>
              <View style={{ width: 70, alignItems: 'center' }}>
                <Switch
                  value={val.mtalkz}
                  onValueChange={() => toggleSmsVendor(key, 'mtalkz')}
                  trackColor={{ false: colors.border, true: `${colors.teal}60` }}
                  thumbColor={val.mtalkz ? colors.teal : colors.textSecondary}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>
              <View style={{ width: 70, alignItems: 'center' }}>
                <Switch
                  value={val.aisensy}
                  onValueChange={() => toggleSmsVendor(key, 'aisensy')}
                  trackColor={{ false: colors.border, true: `${colors.warning}60` }}
                  thumbColor={val.aisensy ? colors.warning : colors.textSecondary}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>
            </View>
          ))}
        </Card>

        <Button
          title={saving ? 'Saving...' : 'Save Configuration'}
          onPress={handleSave}
          disabled={saving}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4,
  },
  headerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  apiRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

export default VendorConfigScreen;
