import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../config/constants';

const Logo = ({ size = 'medium' }) => {
  const scale = size === 'large' ? 1.6 : size === 'small' ? 0.7 : 1;

  return (
    <View style={[styles.container, { transform: [{ scale }] }]}>
      {/* "fin" text in navy */}
      <Text style={styles.finText}>fin</Text>
      {/* Golden dot on the "i" - positioned absolutely */}
      <View style={styles.dotContainer}>
        <View style={styles.dot} />
      </View>
      {/* "Z" made of colored blocks */}
      <View style={styles.zContainer}>
        {/* Top bar - purple + dark navy */}
        <View style={styles.zTop}>
          <View style={styles.zTopPurple} />
          <View style={styles.zTopNavy} />
        </View>
        {/* Diagonal - teal */}
        <View style={styles.zMid}>
          <View style={styles.zDiagonal} />
        </View>
        {/* Bottom bar - teal + golden */}
        <View style={styles.zBottom}>
          <View style={styles.zBottomTeal} />
          <View style={styles.zBottomGold} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  finText: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -1,
    lineHeight: 48,
  },
  dotContainer: {
    position: 'absolute',
    left: 41,
    top: -2,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.secondary,
  },
  zContainer: {
    width: 36,
    height: 40,
    marginLeft: 6,
    marginBottom: 3,
    justifyContent: 'space-between',
  },
  zTop: {
    flexDirection: 'row',
    height: 11,
  },
  zTopPurple: {
    flex: 1,
    backgroundColor: COLORS.purple,
    borderTopLeftRadius: 2,
  },
  zTopNavy: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    borderTopRightRadius: 2,
  },
  zMid: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 18,
    overflow: 'hidden',
  },
  zDiagonal: {
    width: 42,
    height: 12,
    backgroundColor: COLORS.teal,
    transform: [{ rotate: '-25deg' }],
  },
  zBottom: {
    flexDirection: 'row',
    height: 11,
  },
  zBottomTeal: {
    flex: 1,
    backgroundColor: COLORS.teal,
    borderBottomLeftRadius: 2,
  },
  zBottomGold: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderBottomRightRadius: 2,
  },
});

export default Logo;
