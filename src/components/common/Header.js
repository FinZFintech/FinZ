import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { COLORS } from '../../config/constants';
import { useTheme } from '../../store/ThemeContext';

const Header = ({ title, greeting, subtitle, onBack, rightAction, rightIcon, showLogo = true }) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.progressStrip}>
        <View style={[styles.stripTeal, { backgroundColor: colors.teal }]} />
        <View style={[styles.stripPurple, { backgroundColor: colors.purple }]} />
        <View style={[styles.stripGold, { backgroundColor: colors.secondary }]} />
      </View>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
              <Text style={[styles.backText, { color: colors.textLight }]}>{'\u2039'}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.titleContainer}>
            {greeting ? <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting}</Text> : null}
            <Text style={[styles.title, { color: colors.textLight }, greeting ? styles.titleWithGreeting : undefined]} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        <View style={styles.rightSection}>
          {showLogo && (
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>Fin<Text style={[styles.logoZ, { color: colors.teal }]}>Z</Text></Text>
            </View>
          )}
          {rightAction && (
            <TouchableOpacity onPress={rightAction} style={[styles.avatarButton, { backgroundColor: colors.teal }]} activeOpacity={0.7}>
              <Text style={[styles.avatarText, { color: colors.background }]}>{rightIcon || '\u22EE'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: StatusBar.currentHeight || 44,
    borderBottomWidth: 1,
  },
  progressStrip: {
    flexDirection: 'row',
    height: 3,
  },
  stripTeal: { flex: 3 },
  stripPurple: { flex: 1 },
  stripGold: { flex: 1 },
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
    fontSize: 24,
    fontWeight: '400',
    marginTop: -2,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  titleWithGreeting: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  logoBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  logoZ: {
    fontWeight: '900',
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Header;
