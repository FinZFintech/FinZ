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
  const w = 220 * scale;
  const h = 80 * scale;
  const textColor = white ? '#FFFFFF' : NAVY;

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      <Svg width={w} height={h} viewBox="0 0 220 80">
        {/* ===== "f" lowercase ===== */}
        {/* f vertical stem */}
        <Rect x="10" y="18" width="12" height="48" rx="6" fill={textColor} />
        {/* f ascender curve (top curves right) */}
        <Path
          d="M16 18 C16 8, 22 2, 32 2 C36 2, 39 3, 41 5"
          stroke={textColor}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />
        {/* f crossbar */}
        <Rect x="2" y="32" width="32" height="11" rx="5.5" fill={textColor} />
        {/* f bottom descender hook (curves left) */}
        <Path
          d="M16 66 C16 73, 12 78, 4 78"
          stroke={textColor}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />

        {/* ===== "i" lowercase ===== */}
        {/* i dot (golden yellow) */}
        <Circle cx="53" cy="14" r="7" fill={white ? '#FFFFFF' : GOLD} />
        {/* i stem */}
        <Rect x="47" y="30" width="12" height="36" rx="6" fill={textColor} />

        {/* ===== "n" lowercase ===== */}
        {/* n left stem */}
        <Rect x="68" y="30" width="12" height="36" rx="6" fill={textColor} />
        {/* n arch + right stem */}
        <Path
          d="M74 54 L74 42 C74 34, 80 28, 90 28 C100 28, 106 34, 106 42 L106 66"
          stroke={textColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* ===== "Z" geometric colored blocks ===== */}
        <G transform="translate(124, 4)">
          {/* Z top bar: purple left + navy right */}
          <Rect x="0" y="0" width="40" height="22" rx="5" fill={white ? 'rgba(255,255,255,0.65)' : PURPLE} />
          <Rect x="30" y="0" width="40" height="22" rx="5" fill={white ? 'rgba(255,255,255,0.85)' : NAVY_DARK} />

          {/* Z diagonal stripe (teal) */}
          <Path
            d="M54 10 L66 10 L16 62 L4 62 Z"
            fill={white ? 'rgba(255,255,255,0.9)' : TEAL}
            rx="3"
          />

          {/* Z bottom bar: teal left + golden right */}
          <Rect x="0" y="50" width="40" height="22" rx="5" fill={white ? 'rgba(255,255,255,0.9)' : TEAL} />
          <Rect x="30" y="50" width="40" height="22" rx="5" fill={white ? '#FFFFFF' : GOLD} />
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
