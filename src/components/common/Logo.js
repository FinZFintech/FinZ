import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { COLORS } from '../../config/constants';

const NAVY = COLORS.primary;       // #2D2B6B
const GOLD = COLORS.secondary;     // #F5B731
const PURPLE = COLORS.purple;      // #7B6DAF
const TEAL = COLORS.teal;          // #2CC5BE
const NAVY_DARK = COLORS.primaryDark; // #1E1C4E

const Logo = ({ size = 'medium', white = false }) => {
  const scale = size === 'large' ? 1.5 : size === 'small' ? 0.6 : size === 'tiny' ? 0.35 : 1;
  const w = 200 * scale;
  const h = 70 * scale;
  const textColor = white ? '#FFFFFF' : NAVY;

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      <Svg width={w} height={h} viewBox="0 0 200 70">
        {/* ===== "f" lowercase ===== */}
        {/* f vertical stem */}
        <Rect x="12" y="12" width="11" height="50" rx="5.5" fill={textColor} />
        {/* f ascender curve (top curves right) */}
        <Path
          d="M17.5 12 C17.5 4, 22 0, 30 0 C34 0, 37 1, 39 3"
          stroke={textColor}
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />
        {/* f crossbar */}
        <Rect x="4" y="28" width="30" height="10" rx="5" fill={textColor} />
        {/* f bottom hook (curves left) */}
        <Path
          d="M17.5 62 C17.5 67, 14 70, 8 70"
          stroke={textColor}
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />

        {/* ===== "i" lowercase ===== */}
        {/* i dot (golden yellow) */}
        <Circle cx="52" cy="10" r="6.5" fill={white ? '#FFFFFF' : GOLD} />
        {/* i stem */}
        <Rect x="46.5" y="26" width="11" height="36" rx="5.5" fill={textColor} />

        {/* ===== "n" lowercase ===== */}
        {/* n left stem */}
        <Rect x="66" y="26" width="11" height="36" rx="5.5" fill={textColor} />
        {/* n arch + right stem */}
        <Path
          d="M71.5 50 L71.5 38 C71.5 30, 77 26, 85 26 C93 26, 98.5 30, 98.5 38 L98.5 62"
          stroke={textColor}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* ===== "Z" geometric colored blocks ===== */}
        <G transform="translate(116, 2)">
          {/* Z top bar: purple left + navy right */}
          <Rect x="0" y="0" width="36" height="18" rx="4" fill={white ? 'rgba(255,255,255,0.65)' : PURPLE} />
          <Rect x="28" y="0" width="36" height="18" rx="4" fill={white ? 'rgba(255,255,255,0.85)' : NAVY_DARK} />

          {/* Z diagonal stripe (teal) */}
          <Path
            d="M50 8 L60 8 L14 58 L4 58 Z"
            fill={white ? 'rgba(255,255,255,0.9)' : TEAL}
          />

          {/* Z bottom bar: teal left + golden right */}
          <Rect x="0" y="48" width="36" height="18" rx="4" fill={white ? 'rgba(255,255,255,0.9)' : TEAL} />
          <Rect x="28" y="48" width="36" height="18" rx="4" fill={white ? '#FFFFFF' : GOLD} />
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
