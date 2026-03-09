import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { COLORS } from '../../config/constants';

const Header = ({ title, subtitle, onBack, rightAction, rightIcon, showLogo = true }) => (
  <View style={styles.container}>
    <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
    <View style={styles.content}>
      <View style={styles.leftSection}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.rightSection}>
        {showLogo && (
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>Fin</Text>
            <Text style={styles.logoZ}>Z</Text>
          </View>
        )}
        {rightAction && (
          <TouchableOpacity onPress={rightAction} style={styles.rightButton} activeOpacity={0.7}>
            <Text style={styles.rightText}>{rightIcon || '⋮'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
    <View style={styles.accentStrip}>
      <View style={styles.stripTeal} />
      <View style={styles.stripGold} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    paddingTop: StatusBar.currentHeight || 44,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: {
    color: COLORS.textLight,
    fontSize: 18,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: COLORS.textLight,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 12,
  },
  logoText: {
    color: COLORS.textLight,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  logoZ: {
    color: COLORS.teal,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rightButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  rightText: {
    color: COLORS.textLight,
    fontSize: 18,
  },
  accentStrip: {
    flexDirection: 'row',
    height: 3,
  },
  stripTeal: {
    flex: 3,
    backgroundColor: COLORS.teal,
  },
  stripGold: {
    flex: 1,
    backgroundColor: COLORS.secondary,
  },
});

export default Header;
