import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../store/ThemeContext';

const Card = ({ children, style, onPress, elevation = 0, accent, selected }) => {
  const { colors } = useTheme();
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.card,
        { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
        selected && { borderColor: colors.teal, borderWidth: 1.5 },
        style,
      ]}
    >
      {accent && <View style={[styles.accentBar, { backgroundColor: accent }]} />}
      {children}
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    marginVertical: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});

export default Card;
