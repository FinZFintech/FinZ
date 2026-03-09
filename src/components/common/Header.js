import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { COLORS } from '../../config/constants';

const Header = ({ title, subtitle, onBack, rightAction, rightIcon }) => (
  <View style={styles.container}>
    <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
    <View style={styles.content}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
      )}
      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {rightAction && (
        <TouchableOpacity onPress={rightAction} style={styles.rightButton}>
          <Text style={styles.rightText}>{rightIcon || '⋮'}</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    paddingTop: StatusBar.currentHeight || 44,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backText: {
    color: COLORS.textLight,
    fontSize: 24,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: COLORS.textLight,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  rightButton: {
    padding: 8,
  },
  rightText: {
    color: COLORS.textLight,
    fontSize: 22,
  },
});

export default Header;
