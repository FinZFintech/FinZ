import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { COLORS } from '../../config/constants';
const Header = ({ title, subtitle, onBack, rightAction, rightIcon, showLogo = true }) => (
  <View style={styles.container}>
    <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
    <View style={styles.accentStrip} />
    <View style={styles.content}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
      )}
      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {showLogo && (
        <Text style={styles.logoText}>FinZ</Text>
      )}
      {rightAction && (
        <TouchableOpacity onPress={rightAction} style={styles.rightButton} activeOpacity={0.7}>
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
  accentStrip: {
    height: 3,
    backgroundColor: COLORS.teal,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: {
    color: COLORS.textLight,
    fontSize: 26,
    fontWeight: '300',
    marginTop: -2,
  },
  titleContainer: {
    flex: 1,
  },
  logoText: {
    color: COLORS.textLight,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  title: {
    color: COLORS.textLight,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  rightButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  rightText: {
    color: COLORS.textLight,
    fontSize: 20,
  },
});

export default Header;
