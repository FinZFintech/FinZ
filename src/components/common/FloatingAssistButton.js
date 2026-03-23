import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../store/ThemeContext';

const FloatingAssistButton = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showTooltip, setShowTooltip] = useState(false);

  const handlePress = () => {
    navigation.navigate('LoanAssistance');
  };

  const handleLongPress = () => {
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {showTooltip && (
        <View style={[styles.tooltip, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.tooltipText, { color: colors.textPrimary }]}>Need help? Tap for assistance</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.teal }]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.icon, { color: colors.background }]}>🤝</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'flex-end',
  },
  tooltip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  icon: {
    fontSize: 24,
  },
});

export default FloatingAssistButton;
