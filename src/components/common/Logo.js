import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { COLORS } from '../../config/constants';

const NAVY = COLORS.primary;
const GOLD = COLORS.secondary;
const PURPLE = COLORS.purple;
const TEAL = COLORS.teal;
const NAVY_DARK = COLORS.primaryDark;

const Logo = ({ size = 'medium', white = false }) => {
  const scale = size === 'large' ? 1.5 : size === 'small' ? 0.6 : 1;
  const w = 220 * scale;
  const h = 72 * scale;
  const textColor = white ? '#FFFFFF' : NAVY;

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      <Svg width={w} height={h} viewBox="0 0 220 72">
        {/* ===== "F" character (uppercase) ===== */}
        {/* F vertical stem */}
        <Rect x="6" y="6" width="12" height="54" rx="2" fill={textColor} />
        {/* F top bar */}
        <Rect x="6" y="6" width="32" height="10" rx="2" fill={textColor} />
        {/* F middle crossbar */}
        <Rect x="6" y="30" width="26" height="9" rx="2" fill={textColor} />

        {/* ===== "i" character ===== */}
        {/* i dot - golden yellow */}
        <Circle cx="52" cy="15" r="6" fill={white ? '#FFFFFF' : GOLD} />
        {/* i stem */}
        <Rect x="47" y="26" width="10" height="34" rx="4" fill={textColor} />

        {/* ===== "n" character ===== */}
        {/* n left stem */}
        <Rect x="66" y="26" width="10" height="34" rx="2" fill={textColor} />
        {/* n arch */}
        <Path
          d="M71 40 C71 30, 78 26, 87 26 C96 26, 100 32, 100 40 L100 60 L90 60 L90 42 C90 36, 88 32, 83 32 C78 32, 76 36, 76 42 L76 40 Z"
          fill={textColor}
        />
        {/* n right stem */}
        <Rect x="90" y="32" width="10" height="28" rx="2" fill={textColor} />

        {/* ===== "Z" character (geometric colored blocks) ===== */}
        <G transform="translate(112, 4)">
          {/* Z top bar: purple left + navy right */}
          <Rect x="0" y="0" width="40" height="16" rx="3" fill={white ? 'rgba(255,255,255,0.7)' : PURPLE} />
          <Rect x="40" y="0" width="40" height="16" rx="3" fill={white ? 'rgba(255,255,255,0.85)' : NAVY_DARK} />

          {/* Z diagonal: teal stripe */}
          <Path
            d="M62 10 L80 10 L18 54 L0 54 Z"
            fill={white ? 'rgba(255,255,255,0.9)' : TEAL}
          />

          {/* Z bottom bar: teal left + golden right */}
          <Rect x="0" y="48" width="40" height="16" rx="3" fill={white ? 'rgba(255,255,255,0.9)' : TEAL} />
          <Rect x="40" y="48" width="40" height="16" rx="3" fill={white ? '#FFFFFF' : GOLD} />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Logo;
