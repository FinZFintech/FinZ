import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { COLORS } from '../../config/constants';

const Header = ({ title, greeting, subtitle, onBack, rightAction, rightIcon, showLogo = true }) => (
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
          {greeting && <Text style={styles.greeting}>{greeting}</Text>}
          <Text style={[styles.title, greeting && styles.titleWithGreeting]} numberOfLines={1}>{title}</Text>
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
          <TouchableOpacity onPress={rightAction} style={styles.avatarButton} activeOpacity={0.7}>
            <Text style={styles.avatarText}>{rightIcon || '⋮'}</Text>
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
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
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
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  backText: {
    color: COLORS.textLight,
    fontSize: 18,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  title: {
    color: COLORS.textLight,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  titleWithGreeting: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  logoText: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  logoZ: {
    color: COLORS.teal,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.textLight,
    fontSize: 16,
    fontWeight: '700',
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
