import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { COLORS, RISK_CONFIG } from '../../config/constants';
import { useRisk } from '../../store/RiskContext';
import { getAllBreakerStatuses } from '../../utils/circuitBreaker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_MAX_WIDTH = SCREEN_WIDTH - 140;

const DECISION_COLORS = {
  auto_approve: COLORS.teal,
  standard: '#4CAF50',
  elevated: COLORS.warning,
  review: '#FF9800',
  decline: COLORS.error,
};

const DECISION_LABELS = {
  auto_approve: 'Auto Approve',
  standard: 'Standard',
  elevated: 'Elevated',
  review: 'Manual Review',
  decline: 'Declined',
};

const CATEGORY_LABELS = {
  identity: 'Identity',
  creditBureau: 'Credit Bureau',
  financial: 'Financial',
  bankStatement: 'Bank Statement',
  phoneDigital: 'Phone/Digital',
  address: 'Address',
  income: 'Income',
  document: 'Document',
  device: 'Device',
  fraud: 'Fraud',
  behavioral: 'Behavioral',
  legal: 'Legal',
};

const getCategoryColor = (score) => {
  if (score >= 80) return COLORS.teal;
  if (score >= 60) return '#4CAF50';
  if (score >= 40) return COLORS.warning;
  if (score >= 20) return '#FF9800';
  return COLORS.error;
};

const ScoreGauge = ({ score, size = 140 }) => {
  const radius = (size - 16) / 2;
  const circumference = Math.PI * radius;
  const progress = score != null ? (score / 1000) * circumference : 0;

  const getScoreColor = () => {
    if (score == null) return COLORS.textSecondary;
    if (score >= 800) return COLORS.teal;
    if (score >= 600) return '#4CAF50';
    if (score >= 400) return COLORS.warning;
    if (score >= 200) return '#FF9800';
    return COLORS.error;
  };

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size * 0.65 }}>
      <View style={{ position: 'absolute', top: 0 }}>
        <View style={{
          width: size, height: size / 2, borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2,
          borderWidth: 8, borderBottomWidth: 0, borderColor: '#E8E8F0',
          overflow: 'hidden',
        }}>
          <View style={{
            position: 'absolute', bottom: 0, left: -4, right: -4, height: size / 2,
            borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2,
            borderWidth: 8, borderBottomWidth: 0, borderColor: getScoreColor(),
            transform: [{ rotate: `${-180 + (score != null ? (score / 1000) * 180 : 0)}deg` }],
            transformOrigin: 'bottom center',
          }} />
        </View>
      </View>
      <View style={{ position: 'absolute', bottom: 0, alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: getScoreColor() }}>
          {score != null ? score : '--'}
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' }}>/ 1000</Text>
      </View>
    </View>
  );
};

const CategoryBar = ({ label, score, weight }) => {
  const barWidth = score != null ? (score / 100) * BAR_MAX_WIDTH * 0.6 : 0;
  const color = getCategoryColor(score);
  const weightPct = `${Math.round(weight * 100)}%`;

  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryLabelCol}>
        <Text style={styles.categoryLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.categoryWeight}>{weightPct}</Text>
      </View>
      <View style={styles.categoryBarCol}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: barWidth, backgroundColor: color }]} />
        </View>
      </View>
      <Text style={[styles.categoryScore, { color }]}>{score != null ? score : '--'}</Text>
    </View>
  );
};

const PhaseCard = ({ phase, result }) => {
  if (!result) return null;
  const gateColor = result.gate === 'pass' ? COLORS.teal : result.gate === 'fail' ? COLORS.error : COLORS.warning;
  return (
    <View style={styles.phaseRow}>
      <View style={[styles.phaseDot, { backgroundColor: gateColor }]} />
      <Text style={styles.phaseLabel}>Phase {phase}</Text>
      <Text style={[styles.phaseScore, { color: gateColor }]}>{result.score}</Text>
      <Text style={styles.phaseGate}>{result.gate?.toUpperCase()}</Text>
      <Text style={styles.phaseTime}>
        {result.completedAt ? new Date(result.completedAt).toLocaleTimeString() : ''}
      </Text>
    </View>
  );
};

const RiskDashboardScreen = ({ navigation }) => {
  const { state: riskState } = useRisk();
  const [refreshing, setRefreshing] = useState(false);
  const [, forceUpdate] = useState(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    forceUpdate((n) => n + 1);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const { finalScore, categoryScores, decision, phaseResults, allFlags, reasonCodes, degradedApis } = riskState;
  const weights = RISK_CONFIG.CATEGORY_WEIGHTS;

  const breakerStatuses = getAllBreakerStatuses();
  const openBreakers = Object.values(breakerStatuses).filter((b) => b.state !== 'CLOSED');

  return (
    <View style={styles.container}>
      <Header
        title="Risk Dashboard"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Score Overview */}
        <Card accent={decision ? DECISION_COLORS[decision.decision] || COLORS.primary : undefined}>
          <View style={styles.scoreHeader}>
            <ScoreGauge score={finalScore} />
            <View style={styles.scoreInfo}>
              {decision && (
                <View style={[styles.decisionBadge, { backgroundColor: DECISION_COLORS[decision.decision] || COLORS.primary }]}>
                  <Text style={styles.decisionText}>
                    {DECISION_LABELS[decision.decision] || decision.label || decision.decision}
                  </Text>
                </View>
              )}
              <Text style={styles.scoreLabel}>Risk Score</Text>
              {riskState.currentPhase && (
                <Text style={styles.phaseIndicator}>
                  Phase: {riskState.currentPhase === 'complete' ? 'All Complete' : riskState.currentPhase}
                </Text>
              )}
              {riskState.isCalculating && (
                <Text style={styles.calculatingText}>Calculating...</Text>
              )}
            </View>
          </View>
        </Card>

        {/* Alert Banner */}
        {openBreakers.length > 0 && (
          <Card style={styles.alertCard} accent={COLORS.error}>
            <Text style={styles.alertTitle}>API Degradation Active</Text>
            <Text style={styles.alertText}>
              {openBreakers.length} API{openBreakers.length > 1 ? 's' : ''} circuit-broken. Risk scoring may be degraded.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('ApiHealthMonitor')}>
              <Text style={styles.alertLink}>View API Health →</Text>
            </TouchableOpacity>
          </Card>
        )}

        {degradedApis.length > 0 && (
          <Card style={styles.degradedCard}>
            <Text style={styles.degradedTitle}>Degraded APIs in Current Session</Text>
            {degradedApis.map((d, i) => (
              <View key={i} style={styles.degradedRow}>
                <View style={[styles.phaseDot, { backgroundColor: COLORS.warning }]} />
                <Text style={styles.degradedApi}>{d.api}</Text>
                <Text style={styles.degradedReason}>{d.reason || 'circuit broken'}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Phase Pipeline */}
        {Object.keys(phaseResults).length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Phase Pipeline</Text>
            {['A', 'B', 'C', 'D'].map((p) => (
              <PhaseCard key={p} phase={p} result={phaseResults[p]} />
            ))}
          </Card>
        )}

        {/* Category Breakdown */}
        {categoryScores && (
          <Card>
            <Text style={styles.sectionTitle}>Category Scores</Text>
            <Text style={styles.sectionSubtitle}>Score out of 100 (weight %)</Text>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <CategoryBar
                key={key}
                label={label}
                score={categoryScores[key]?.score}
                weight={weights[key] || 0}
              />
            ))}
          </Card>
        )}

        {/* Risk Flags */}
        {allFlags.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Risk Flags</Text>
            <View style={styles.flagsContainer}>
              {allFlags.map((flag, i) => (
                <View
                  key={i}
                  style={[
                    styles.flagChip,
                    flag.type === 'negative' ? styles.flagNegative :
                    flag.type === 'positive' ? styles.flagPositive :
                    styles.flagNeutral,
                  ]}
                >
                  <Text style={[
                    styles.flagText,
                    flag.type === 'negative' ? styles.flagTextNeg :
                    flag.type === 'positive' ? styles.flagTextPos :
                    styles.flagTextNeutral,
                  ]}>
                    {flag.type === 'negative' ? '−' : flag.type === 'positive' ? '+' : '·'} {flag.text}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Reason Codes */}
        {reasonCodes.length > 0 && (
          <Card style={styles.reasonCard}>
            <Text style={styles.sectionTitle}>Reason Codes</Text>
            {reasonCodes.map((code, i) => (
              <View key={i} style={styles.reasonRow}>
                <Text style={styles.reasonNumber}>{i + 1}</Text>
                <Text style={styles.reasonText}>{code}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Empty State */}
        {!finalScore && !riskState.isCalculating && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Risk Data</Text>
            <Text style={styles.emptyText}>
              Risk scoring data will appear here once a loan application triggers phase execution.
            </Text>
          </Card>
        )}

        {/* Quick Links */}
        <Card>
          <Text style={styles.sectionTitle}>Monitoring</Text>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => navigation.navigate('ApiHealthMonitor')}
          >
            <Text style={styles.quickLinkIcon}>🔌</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickLinkTitle}>API Health Monitor</Text>
              <Text style={styles.quickLinkDesc}>Circuit breakers, latency, uptime</Text>
            </View>
            <Text style={styles.quickLinkArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => navigation.navigate('AuditTrailViewer')}
          >
            <Text style={styles.quickLinkIcon}>📜</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickLinkTitle}>Audit Trail</Text>
              <Text style={styles.quickLinkDesc}>Historical risk profiles & decisions</Text>
            </View>
            <Text style={styles.quickLinkArrow}>→</Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },

  scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreInfo: { flex: 1, alignItems: 'flex-start' },
  scoreLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  phaseIndicator: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 4 },
  calculatingText: { fontSize: 12, color: COLORS.warning, fontWeight: '600', marginTop: 4 },

  decisionBadge: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
  },
  decisionText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  alertCard: { backgroundColor: '#FFF3F0' },
  alertTitle: { fontSize: 15, fontWeight: '700', color: COLORS.error, marginBottom: 4 },
  alertText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  alertLink: { fontSize: 13, color: COLORS.primary, fontWeight: '700', marginTop: 8 },

  degradedCard: { backgroundColor: '#FFF8E1' },
  degradedTitle: { fontSize: 14, fontWeight: '700', color: COLORS.warning, marginBottom: 8 },
  degradedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  degradedApi: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  degradedReason: { fontSize: 11, color: COLORS.textSecondary, flex: 1, textAlign: 'right' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  sectionSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 12 },

  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, width: 60 },
  phaseScore: { fontSize: 16, fontWeight: '800', width: 50 },
  phaseGate: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  phaseTime: { fontSize: 10, color: COLORS.textSecondary, flex: 1, textAlign: 'right' },

  categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  categoryLabelCol: { width: 80 },
  categoryLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textPrimary },
  categoryWeight: { fontSize: 9, color: COLORS.textSecondary },
  categoryBarCol: { flex: 1, marginHorizontal: 8 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#E8E8F0' },
  barFill: { height: 8, borderRadius: 4, minWidth: 2 },
  categoryScore: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '800' },

  flagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flagChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  flagNegative: { backgroundColor: '#FFF3F0', borderColor: '#FFCCBC' },
  flagPositive: { backgroundColor: '#E8F8F7', borderColor: '#B2DFDB' },
  flagNeutral: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  flagText: { fontSize: 11, fontWeight: '600' },
  flagTextNeg: { color: COLORS.error },
  flagTextPos: { color: COLORS.teal },
  flagTextNeutral: { color: COLORS.textSecondary },

  reasonCard: { borderLeftWidth: 3, borderLeftColor: COLORS.error },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  reasonNumber: { fontSize: 11, fontWeight: '800', color: COLORS.error, width: 16 },
  reasonText: { fontSize: 12, color: COLORS.textSecondary, flex: 1, lineHeight: 18 },

  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  quickLink: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  quickLinkIcon: { fontSize: 24 },
  quickLinkTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  quickLinkDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  quickLinkArrow: { fontSize: 16, color: COLORS.textSecondary },

  bottomSpacer: { height: 100 },
});

export default RiskDashboardScreen;
