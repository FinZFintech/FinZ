import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../config/constants';

const InfoRow = ({ label, value, style }) => (
  <View style={[styles.row, style]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value || '-'}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
});

export default InfoRow;
