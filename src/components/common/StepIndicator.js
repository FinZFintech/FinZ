import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../config/constants';

const steps = [
  'Institute',
  'Apply',
  'PAN & Credit',
  'KYC',
  'Selfie & Bank',
  'Income',
  'eNACH & eSign',
];

const StepIndicator = ({ currentStep, totalSteps, labels }) => {
  const stepLabels = labels || steps;
  const total = totalSteps || stepLabels.length;

  return (
    <View style={styles.container}>
      <View style={styles.stepsRow}>
        {Array.from({ length: total }, (_, i) => (
          <React.Fragment key={i}>
            <View style={styles.stepItem}>
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
                    i === currentStep && styles.activeLabel,
                  ]}
                  numberOfLines={1}
                >
                  {stepLabels[i]}
                </Text>
              )}
            </View>
            {i < total - 1 && (
              <View
                style={[
                  styles.line,
                  i < currentStep && styles.completedLine,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    width: 42,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completed: {
    backgroundColor: COLORS.success,
  },
  active: {
    backgroundColor: COLORS.primary,
  },
  circleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  activeText: {
    color: COLORS.textLight,
  },
  label: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  activeLabel: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  completedLine: {
    backgroundColor: COLORS.success,
  },
});

export default StepIndicator;
