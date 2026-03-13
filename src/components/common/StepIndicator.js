import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../store/ThemeContext';

const steps = [
  'Institute',
  'Apply',
  'PAN',
  'Income',
  'KYC',
  'Verify',
  'Sign',
];

const StepIndicator = React.memo(({ currentStep, totalSteps, labels }) => {
  const { colors } = useTheme();
  const stepLabels = labels || steps;
  const total = totalSteps || stepLabels.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min((currentStep / (total - 1)) * 100, 100)}%`, backgroundColor: colors.teal },
          ]}
        />
      </View>
      <View style={styles.stepsRow}>
        {Array.from({ length: total }, (_, i) => (
          <View key={stepLabels[i] || `step-${i}`} style={styles.stepItem}>
            <View
              style={[
                styles.circle,
                { backgroundColor: colors.border },
                (i <= currentStep) && { backgroundColor: colors.teal },
              ]}
            >
              <Text
                style={[
                  styles.circleText,
                  { color: colors.textSecondary },
                  (i <= currentStep) && { color: colors.textLight },
                ]}
              >
                {i < currentStep ? '✓' : i + 1}
              </Text>
            </View>
            {stepLabels[i] && (
              <Text
                style={[
                  styles.label,
                  { color: colors.textSecondary },
                  i <= currentStep && { color: colors.teal, fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {stepLabels[i]}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default StepIndicator;
