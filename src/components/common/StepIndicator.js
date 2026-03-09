import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../config/constants';

const steps = [
  'Institute',
  'Apply',
  'PAN',
  'KYC',
  'Verify',
  'Income',
  'Sign',
];

const StepIndicator = ({ currentStep, totalSteps, labels }) => {
  const stepLabels = labels || steps;
  const total = totalSteps || stepLabels.length;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min((currentStep / (total - 1)) * 100, 100)}%` },
          ]}
        />
      </View>
      {/* Step dots */}
      <View style={styles.stepsRow}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={styles.stepItem}>
            <View
              style={[
                styles.circle,
                i < currentStep && styles.completed,
                i === currentStep && styles.active,
              ]}
            >
              <Text
                style={[
                  styles.circleText,
                  (i <= currentStep) && styles.activeText,
                ]}
              >
                {i < currentStep ? '✓' : i + 1}
              </Text>
            </View>
            {stepLabels[i] && (
              <Text
                style={[
                  styles.label,
                  i <= currentStep && styles.activeLabel,
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
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: COLORS.teal,
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
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completed: {
    backgroundColor: COLORS.teal,
  },
  active: {
    backgroundColor: COLORS.primary,
  },
  circleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  activeText: {
    color: COLORS.textLight,
  },
  label: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  activeLabel: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default StepIndicator;
