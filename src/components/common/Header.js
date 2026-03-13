import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { COLORS } from '../../config/constants';
import Logo from './Logo';

const Header = ({ title, greeting, subtitle, onBack, rightAction, rightIcon, showLogo = true }) => (
  <View style={styles.container}>
    <StatusBar backgroundColor={COLORS.background} barStyle="light-content" />
    <View style={styles.progressStrip}>
      <View style={styles.stripTeal} />
      <View style={styles.stripPurple} />
      <View style={styles.stripGold} />
    </View>
    <View style={styles.content}>
      <View style={styles.leftSection}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backText}>{'\u2039'}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
          <Text style={[styles.title, greeting ? styles.titleWithGreeting : undefined]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.rightSection}>
        {showLogo && (
          <View style={styles.logoBadge}>
            <Logo size="tiny" white />
          </View>
        )}
        {rightAction && (
          <TouchableOpacity onPress={rightAction} style={styles.avatarButton} activeOpacity={0.7}>
            <Text style={styles.avatarText}>{rightIcon || '\u22EE'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.headerBg,
    paddingTop: StatusBar.currentHeight || 44,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  progressStrip: {
    flexDirection: 'row',
    height: 3,
  },
  stripTeal: {
    flex: 3,
    backgroundColor: COLORS.teal,
  },
  stripPurple: {
    flex: 1,
    backgroundColor: COLORS.purple,
  },
  stripGold: {
    flex: 1,
    backgroundColor: COLORS.secondary,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  backText: {
    color: COLORS.textLight,
    fontSize: 24,
    fontWeight: '400',
    marginTop: -2,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    color: COLORS.textSecondary,
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
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  logoBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Header;
