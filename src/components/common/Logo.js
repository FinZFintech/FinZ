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
        {/* ===== "f" character ===== */}
        {/* f stem */}
        <Rect x="8" y="18" width="10" height="42" rx="2" fill={textColor} />
        {/* f top hook */}
        <Path
          d="M18 18 C18 8, 24 2, 34 2 L34 2 C36 2, 36 4, 34 4 C26 4, 22 9, 22 18 L28 18 C29 18, 29 20, 28 20 L22 20 L22 18 Z"
          fill={textColor}
        />
        {/* f crossbar */}
        <Rect x="4" y="26" width="28" height="8" rx="3" fill={textColor} />

        {/* ===== "i" character ===== */}
        {/* i dot - golden yellow */}
        <Circle cx="48" cy="15" r="6" fill={white ? '#FFFFFF' : GOLD} />
        {/* i stem */}
        <Rect x="43" y="26" width="10" height="34" rx="4" fill={textColor} />

        {/* ===== "n" character ===== */}
        {/* n left stem */}
        <Rect x="62" y="26" width="10" height="34" rx="2" fill={textColor} />
        {/* n arch */}
        <Path
          d="M67 40 C67 30, 74 26, 83 26 C92 26, 96 32, 96 40 L96 60 L86 60 L86 42 C86 36, 84 32, 79 32 C74 32, 72 36, 72 42 L72 40 Z"
          fill={textColor}
        />
        {/* n right stem */}
        <Rect x="86" y="32" width="10" height="28" rx="2" fill={textColor} />

        {/* ===== "Z" character (geometric colored blocks) ===== */}
        <G transform="translate(110, 4)">
          {/* Z top bar: purple left + navy right */}
          <Rect x="0" y="0" width="42" height="18" rx="3" fill={white ? 'rgba(255,255,255,0.7)' : PURPLE} />
          <Rect x="42" y="0" width="42" height="18" rx="3" fill={white ? 'rgba(255,255,255,0.85)' : NAVY_DARK} />

          {/* Z diagonal: teal stripe */}
          <Path
            d="M68 14 L84 14 L16 52 L0 52 Z"
            fill={white ? 'rgba(255,255,255,0.9)' : TEAL}
          />

          {/* Z bottom bar: teal left + golden right */}
          <Rect x="0" y="48" width="42" height="18" rx="3" fill={white ? 'rgba(255,255,255,0.9)' : TEAL} />
          <Rect x="42" y="48" width="42" height="18" rx="3" fill={white ? '#FFFFFF' : GOLD} />
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
