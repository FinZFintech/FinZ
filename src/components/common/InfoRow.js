import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../store/ThemeContext';

const InfoRow = ({ label, value, highlight, style }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }, style]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary }, highlight && { color: colors.teal, fontWeight: '700' }]}>{value || '—'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 13,
    flex: 1,
    letterSpacing: 0.1,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1.2,
    textAlign: 'right',
  },
});

export default InfoRow;
