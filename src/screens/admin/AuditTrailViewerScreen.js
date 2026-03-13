import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
  Modal,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { COLORS, RISK_CONFIG } from '../../config/constants';
import { useRisk } from '../../store/RiskContext';

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

const formatDate = (ts) => {
  if (!ts) return '--';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const getScoreColor = (score) => {
  if (score >= 800) return COLORS.teal;
  if (score >= 600) return '#4CAF50';
  if (score >= 400) return COLORS.warning;
  if (score >= 200) return '#FF9800';
  return COLORS.error;
};

const ProfileDetailModal = ({ visible, profile, onClose }) => {
  if (!profile) return null;

  const decisionColor = DECISION_COLORS[profile.decision] || COLORS.textSecondary;
  const decisionLabel = DECISION_LABELS[profile.decision] || profile.decisionLabel || profile.decision || '--';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Header title="Risk Profile Detail" onBack={onClose} />
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
          {/* Score Header */}
          <Card accent={decisionColor}>
            <View style={styles.modalScoreRow}>
              <View>
                <Text style={[styles.modalScore, { color: getScoreColor(profile.finalScore) }]}>
                  {profile.finalScore ?? '--'}
                </Text>
                <Text style={styles.modalScoreLabel}>/ 1000</Text>
              </View>
              <View style={[styles.modalDecisionBadge, { backgroundColor: decisionColor }]}>
                <Text style={styles.modalDecisionText}>{decisionLabel}</Text>
              </View>
            </View>
            <View style={styles.modalMeta}>
              <Text style={styles.metaText}>Phase: {profile.lastPhase || '--'}</Text>
              <Text style={styles.metaText}>{formatDate(profile.calculatedAt)}</Text>
            </View>
            {profile.applicationId && (
              <Text style={styles.metaText}>App ID: {profile.applicationId}</Text>
            )}
          </Card>

          {/* Phase Results */}
          {profile.phases && Object.keys(profile.phases).length > 0 && (
            <Card>
              <Text style={styles.detailSectionTitle}>Phase Results</Text>
              {['A', 'B', 'C', 'D'].map((p) => {
                const pr = profile.phases[p];
                if (!pr) return null;
                const gateColor = pr.gate === 'pass' ? COLORS.teal : pr.gate === 'fail' ? COLORS.error : COLORS.warning;
                return (
                  <View key={p} style={styles.phaseRow}>
                    <View style={[styles.phaseDot, { backgroundColor: gateColor }]} />
                    <Text style={styles.phaseLabel}>Phase {p}</Text>
                    <Text style={[styles.phaseScore, { color: gateColor }]}>{pr.score}</Text>
                    <Text style={[styles.phaseGate, { color: gateColor }]}>{pr.gate?.toUpperCase()}</Text>
                    <Text style={styles.phaseTime}>
                      {pr.completedAt ? new Date(pr.completedAt).toLocaleTimeString() : ''}
                    </Text>
                  </View>
                );
              })}
            </Card>
          )}

          {/* Category Scores */}
          {profile.categoryScores && (
            <Card>
              <Text style={styles.detailSectionTitle}>Category Breakdown</Text>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                const cat = profile.categoryScores[key];
                if (!cat) return null;
                const score = cat.score;
                const weight = RISK_CONFIG.CATEGORY_WEIGHTS[key] || 0;
                const color = getScoreColor(score * 10);
                return (
                  <View key={key} style={styles.categoryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.categoryLabel}>{label}</Text>
                      <Text style={styles.categoryWeight}>{Math.round(weight * 100)}% weight</Text>
                    </View>
                    <View style={styles.categoryBarWrap}>
                      <View style={styles.categoryBarTrack}>
                        <View style={[styles.categoryBarFill, { width: `${score}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                    <Text style={[styles.categoryScore, { color }]}>{score}</Text>
                  </View>
                );
              })}
            </Card>
          )}

          {/* Reason Codes */}
          {profile.reasonCodes?.length > 0 && (
            <Card style={styles.reasonCard}>
              <Text style={styles.detailSectionTitle}>Reason Codes</Text>
              {profile.reasonCodes.map((code, i) => (
                <View key={i} style={styles.reasonRow}>
                  <Text style={styles.reasonNum}>{i + 1}</Text>
                  <Text style={styles.reasonText}>{code}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Degraded APIs */}
          {profile.degradedApis?.length > 0 && (
            <Card style={styles.degradedCard}>
              <Text style={styles.detailSectionTitle}>Degraded APIs</Text>
              {profile.degradedApis.map((d, i) => (
                <View key={i} style={styles.degradedRow}>
                  <View style={[styles.phaseDot, { backgroundColor: COLORS.warning }]} />
                  <Text style={styles.degradedApi}>{d.api}</Text>
                  <Text style={styles.degradedReason}>{d.reason || 'circuit broken'}</Text>
                </View>
              ))}
            </Card>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const AuditTrailViewerScreen = ({ navigation }) => {
  const { getAuditTrail } = useRisk();
  const [profiles, setProfiles] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadTrail = useCallback(async () => {
    const trail = await getAuditTrail();
    setProfiles(trail);
  }, [getAuditTrail]);

  useEffect(() => { loadTrail(); }, [loadTrail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTrail();
    setRefreshing(false);
  }, [loadTrail]);

  const filteredProfiles = filter === 'all'
    ? profiles
    : profiles.filter((p) => p.decision === filter);

  // Stats
  const total = profiles.length;
  const decisionCounts = {};
  for (const p of profiles) {
    const d = p.decision || 'unknown';
    decisionCounts[d] = (decisionCounts[d] || 0) + 1;
  }
  const avgScore = total > 0
    ? Math.round(profiles.reduce((sum, p) => sum + (p.finalScore || 0), 0) / total)
    : 0;

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'auto_approve', label: 'Approved' },
    { key: 'standard', label: 'Standard' },
    { key: 'elevated', label: 'Elevated' },
    { key: 'review', label: 'Review' },
    { key: 'decline', label: 'Declined' },
  ];

  const renderProfile = ({ item, index }) => {
    const decisionColor = DECISION_COLORS[item.decision] || COLORS.textSecondary;
    const decisionLabel = DECISION_LABELS[item.decision] || item.decisionLabel || item.decision || '--';

    return (
      <TouchableOpacity onPress={() => setSelectedProfile(item)}>
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileRank}>
              <Text style={styles.profileIndex}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.profileTopRow}>
                <Text style={[styles.profileScore, { color: getScoreColor(item.finalScore) }]}>
                  {item.finalScore ?? '--'}
                </Text>
                <View style={[styles.profileDecision, { backgroundColor: decisionColor }]}>
                  <Text style={styles.profileDecisionText}>{decisionLabel}</Text>
                </View>
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.profileDate}>{formatDate(item.calculatedAt)}</Text>
                <Text style={styles.profilePhase}>Phase {item.lastPhase || '--'}</Text>
                {item.degradedApis?.length > 0 && (
                  <Text style={styles.profileDegraded}>
                    {item.degradedApis.length} degraded
                  </Text>
                )}
              </View>
              {item.reasonCodes?.length > 0 && (
                <Text style={styles.profileReasons} numberOfLines={1}>
                  {item.reasonCodes.slice(0, 2).join(' | ')}
                  {item.reasonCodes.length > 2 ? ` +${item.reasonCodes.length - 2} more` : ''}
                </Text>
              )}
            </View>
            <Text style={styles.profileArrow}>→</Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Audit Trail" onBack={() => navigation.goBack()} />

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.primary }]}>
          <Text style={styles.summaryValue}>{total}</Text>
          <Text style={styles.summaryLabel}>Profiles</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.teal }]}>
          <Text style={styles.summaryValue}>{avgScore}</Text>
          <Text style={styles.summaryLabel}>Avg Score</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.error }]}>
          <Text style={styles.summaryValue}>{decisionCounts.decline || 0}</Text>
          <Text style={styles.summaryLabel}>Declined</Text>
        </View>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
              {f.key !== 'all' && decisionCounts[f.key] ? ` (${decisionCounts[f.key]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Profile List */}
      <FlatList
        data={filteredProfiles}
        renderItem={renderProfile}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyTitle}>No Audit Profiles</Text>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'Risk profiles will appear here once loan applications are processed.'
                : `No profiles with decision "${filter}" found.`}
            </Text>
          </Card>
        }
      />

      {/* Detail Modal */}
      <ProfileDetailModal
        visible={!!selectedProfile}
        profile={selectedProfile}
        onClose={() => setSelectedProfile(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },

  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    borderLeftWidth: 4, elevation: 2,
  },
  summaryValue: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },

  filterScroll: { maxHeight: 48 },
  filterContent: { paddingHorizontal: 16, gap: 6, alignItems: 'center', paddingVertical: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  filterChipActive: { borderColor: COLORS.teal, backgroundColor: '#E8F8F7' },
  filterText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.teal },

  profileCard: { padding: 14 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileRank: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  profileIndex: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileScore: { fontSize: 20, fontWeight: '900' },
  profileDecision: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  profileDecisionText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  profileMeta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  profileDate: { fontSize: 10, color: COLORS.textSecondary },
  profilePhase: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  profileDegraded: { fontSize: 10, color: COLORS.warning, fontWeight: '600' },
  profileReasons: { fontSize: 10, color: COLORS.error, marginTop: 4 },
  profileArrow: { fontSize: 16, color: COLORS.textSecondary },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalScroll: { flex: 1 },
  modalContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  modalScoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalScore: { fontSize: 36, fontWeight: '900' },
  modalScoreLabel: { fontSize: 12, color: COLORS.textSecondary },
  modalDecisionBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  modalDecisionText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  modalMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { fontSize: 11, color: COLORS.textSecondary },

  detailSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },

  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, width: 56 },
  phaseScore: { fontSize: 15, fontWeight: '800', width: 44 },
  phaseGate: { fontSize: 10, fontWeight: '700' },
  phaseTime: { fontSize: 10, color: COLORS.textSecondary, flex: 1, textAlign: 'right' },

  categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  categoryLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  categoryWeight: { fontSize: 9, color: COLORS.textSecondary },
  categoryBarWrap: { flex: 1 },
  categoryBarTrack: { height: 6, borderRadius: 3, backgroundColor: '#E8E8F0' },
  categoryBarFill: { height: 6, borderRadius: 3 },
  categoryScore: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '800' },

  reasonCard: { borderLeftWidth: 3, borderLeftColor: COLORS.error },
  reasonRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  reasonNum: { fontSize: 11, fontWeight: '800', color: COLORS.error, width: 16 },
  reasonText: { fontSize: 12, color: COLORS.textSecondary, flex: 1, lineHeight: 18 },

  degradedCard: { backgroundColor: '#FFF8E1' },
  degradedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  degradedApi: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  degradedReason: { fontSize: 11, color: COLORS.textSecondary, flex: 1, textAlign: 'right' },

  emptyCard: { alignItems: 'center', paddingVertical: 32, marginTop: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
});

export default AuditTrailViewerScreen;
