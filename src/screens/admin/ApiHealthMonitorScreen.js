import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { COLORS } from '../../config/constants';
import { getAllBreakerStatuses, resetAllBreakers, STATES } from '../../utils/circuitBreaker';

const STATE_COLORS = {
  [STATES.CLOSED]: COLORS.teal,
  [STATES.OPEN]: COLORS.error,
  [STATES.HALF_OPEN]: COLORS.warning,
};

const STATE_BG = {
  [STATES.CLOSED]: '#E8F8F7',
  [STATES.OPEN]: '#FFF3F0',
  [STATES.HALF_OPEN]: '#FFF8E1',
};

const STATE_LABELS = {
  [STATES.CLOSED]: 'Healthy',
  [STATES.OPEN]: 'Open (Broken)',
  [STATES.HALF_OPEN]: 'Recovering',
};

const API_GROUPS = {
  'Identity & KYC': [
    'phoneToPan', 'verifyPan', 'sendOtp', 'verifyOtp',
    'eAadhaarXml', 'digilockerDetails',
  ],
  'Phone Intelligence': [
    'phoneIntelligence', 'whatsAppPresence', 'digitalIdentityScore',
    'phoneToRegisteredAddress', 'phoneToAlternatePhone', 'phoneToPrefill',
    'phoneToIncome', 'phoneToIdentityDetails',
  ],
  'Banking & Financial': [
    'verifyBankAccount', 'searchBankByIfsc', 'verifyEmployment', 'advancedEmployment',
  ],
  'Address & Location': [
    'geocodeAddress', 'pincodeDetails',
  ],
  'Device & Document': [
    'fetchImeiDetails', 'checkDocumentForgery',
  ],
  'Risk & Fraud': [
    'checkGeoFencing', 'checkDigitalIntegrity',
  ],
};

const BreakerCard = ({ name, status }) => {
  const stateColor = STATE_COLORS[status.state] || COLORS.textSecondary;
  const stateBg = STATE_BG[status.state] || '#F5F5F5';
  const stateLabel = STATE_LABELS[status.state] || status.state;
  const timeSinceFailure = status.lastFailureTime
    ? formatTimeSince(status.lastFailureTime)
    : null;

  return (
    <View style={[styles.breakerCard, { borderLeftColor: stateColor }]}>
      <View style={styles.breakerHeader}>
        <Text style={styles.breakerName} numberOfLines={1}>{formatApiName(name)}</Text>
        <View style={[styles.stateBadge, { backgroundColor: stateBg }]}>
          <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
          <Text style={[styles.stateText, { color: stateColor }]}>{stateLabel}</Text>
        </View>
      </View>
      <View style={styles.breakerStats}>
        <View style={styles.breakerStat}>
          <Text style={styles.statLabel}>Successes</Text>
          <Text style={[styles.statValue, { color: COLORS.teal }]}>{status.successCount}</Text>
        </View>
        <View style={styles.breakerStat}>
          <Text style={styles.statLabel}>Failures</Text>
          <Text style={[styles.statValue, { color: status.failureCount > 0 ? COLORS.error : COLORS.textSecondary }]}>
            {status.failureCount}
          </Text>
        </View>
        {timeSinceFailure && (
          <View style={styles.breakerStat}>
            <Text style={styles.statLabel}>Last Fail</Text>
            <Text style={[styles.statValue, { color: COLORS.warning, fontSize: 11 }]}>{timeSinceFailure}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

function formatApiName(name) {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatTimeSince(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const ApiHealthMonitorScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);

  const refresh = useCallback(() => {
    const s = getAllBreakerStatuses();
    setStatuses(s);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 300);
  }, [refresh]);

  const handleResetAll = () => {
    Alert.alert(
      'Reset All Breakers',
      'This will reset all circuit breakers to CLOSED state. Proceed?',
      [
        { text: 'Cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetAllBreakers();
            refresh();
          },
        },
      ]
    );
  };

  const statusList = Object.entries(statuses);
  const totalApis = statusList.length;
  const healthyCount = statusList.filter(([, s]) => s.state === STATES.CLOSED).length;
  const openCount = statusList.filter(([, s]) => s.state === STATES.OPEN).length;
  const halfOpenCount = statusList.filter(([, s]) => s.state === STATES.HALF_OPEN).length;
  const totalFailures = statusList.reduce((sum, [, s]) => sum + s.failureCount, 0);
  const totalSuccesses = statusList.reduce((sum, [, s]) => sum + s.successCount, 0);
  const totalCalls = totalFailures + totalSuccesses;
  const successRate = totalCalls > 0 ? ((totalSuccesses / totalCalls) * 100).toFixed(1) : '--';

  return (
    <View style={styles.container}>
      <Header title="API Health" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: COLORS.teal }]}>
            <Text style={styles.summaryValue}>{healthyCount}/{totalApis}</Text>
            <Text style={styles.summaryLabel}>Healthy</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: COLORS.error }]}>
            <Text style={[styles.summaryValue, openCount > 0 && { color: COLORS.error }]}>{openCount}</Text>
            <Text style={styles.summaryLabel}>Open</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: COLORS.warning }]}>
            <Text style={styles.summaryValue}>{halfOpenCount}</Text>
            <Text style={styles.summaryLabel}>Recovering</Text>
          </View>
        </View>

        {/* Success Rate */}
        <Card>
          <View style={styles.rateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rateLabel}>Success Rate</Text>
              <Text style={styles.rateValue}>{successRate}%</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.rateLabel}>Total Calls</Text>
              <Text style={styles.rateValue}>{totalCalls}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.rateLabel}>Failures</Text>
              <Text style={[styles.rateValue, totalFailures > 0 && { color: COLORS.error }]}>{totalFailures}</Text>
            </View>
          </View>
          {/* Success rate bar */}
          <View style={styles.rateBar}>
            <View style={[styles.rateBarFill, { width: `${totalCalls > 0 ? (totalSuccesses / totalCalls) * 100 : 0}%` }]} />
          </View>
        </Card>

        {/* Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.controlBtn, autoRefresh && styles.controlBtnActive]}
            onPress={() => setAutoRefresh(!autoRefresh)}
          >
            <Text style={[styles.controlBtnText, autoRefresh && styles.controlBtnTextActive]}>
              {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleResetAll}>
            <Text style={styles.resetBtnText}>Reset All</Text>
          </TouchableOpacity>
        </View>

        {/* API Groups */}
        {Object.entries(API_GROUPS).map(([group, apiNames]) => {
          const groupBreakers = apiNames
            .filter((name) => statuses[name])
            .map((name) => ({ name, status: statuses[name] }));

          if (groupBreakers.length === 0) return null;

          const groupHealthy = groupBreakers.filter((b) => b.status.state === STATES.CLOSED).length;

          return (
            <Card key={group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group}</Text>
                <Text style={[
                  styles.groupCount,
                  { color: groupHealthy === groupBreakers.length ? COLORS.teal : COLORS.warning },
                ]}>
                  {groupHealthy}/{groupBreakers.length}
                </Text>
              </View>
              {groupBreakers.map((b) => (
                <BreakerCard key={b.name} name={b.name} status={b.status} />
              ))}
            </Card>
          );
        })}

        {/* Ungrouped APIs */}
        {(() => {
          const allGrouped = new Set(Object.values(API_GROUPS).flat());
          const ungrouped = statusList.filter(([name]) => !allGrouped.has(name));
          if (ungrouped.length === 0) return null;
          return (
            <Card>
              <Text style={styles.groupTitle}>Other APIs</Text>
              {ungrouped.map(([name, status]) => (
                <BreakerCard key={name} name={name} status={status} />
              ))}
            </Card>
          );
        })()}

        {/* Empty State */}
        {totalApis === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔌</Text>
            <Text style={styles.emptyTitle}>No API Calls Yet</Text>
            <Text style={styles.emptyText}>
              Circuit breaker data will appear here once APIs are called during a loan application.
            </Text>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  summaryValue: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  rateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rateLabel: { fontSize: 11, color: COLORS.textSecondary },
  rateValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  rateBar: { height: 6, borderRadius: 3, backgroundColor: '#E8E8F0' },
  rateBarFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.teal },

  controlsRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  controlBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5,
    borderColor: COLORS.border, alignItems: 'center',
  },
  controlBtnActive: { borderColor: COLORS.teal, backgroundColor: '#E8F8F7' },
  controlBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  controlBtnTextActive: { color: COLORS.teal },
  resetBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5,
    borderColor: COLORS.error, alignItems: 'center',
  },
  resetBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  groupCount: { fontSize: 13, fontWeight: '800' },

  breakerCard: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
    marginBottom: 8, borderLeftWidth: 3,
  },
  breakerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  breakerName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  stateBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  stateDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  stateText: { fontSize: 10, fontWeight: '700' },

  breakerStats: { flexDirection: 'row', gap: 16 },
  breakerStat: {},
  statLabel: { fontSize: 9, color: COLORS.textSecondary },
  statValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },

  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  bottomSpacer: { height: 100 },
});

export default ApiHealthMonitorScreen;
