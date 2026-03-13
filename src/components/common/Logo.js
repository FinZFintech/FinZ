import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { COLORS } from '../../config/constants';

const NAVY = '#2D2B6B';
const GOLD = '#F5B731';
const PURPLE = '#7B6DAF';
const TEAL = '#2CC5BE';
const NAVY_DARK = '#1E1C4E';

const SW = 13; // stroke width for letter strokes

const Logo = ({ size = 'medium', white = false }) => {
  const scale = size === 'large' ? 1.5 : size === 'small' ? 0.6 : size === 'tiny' ? 0.35 : 1;
  const w = 240 * scale;
  const h = 90 * scale;
  const c = white ? '#FFFFFF' : NAVY;

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      <Svg width={w} height={h} viewBox="0 0 240 90">
        {/* ===== "f" — stroke-based single path ===== */}
        {/* f stem (vertical) */}
        <Path d="M22 20 L22 65" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none" />
        {/* f ascender (curves up and right) */}
        <Path d="M22 20 C22 9, 28 3, 38 3" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none" />
        {/* f crossbar */}
        <Path d="M10 37 L35 37" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none" />
        {/* f descender hook (curves down-left) */}
        <Path d="M22 65 C22 75, 16 80, 8 80" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none" />

        {/* ===== "i" — dot + stem ===== */}
        <Circle cx="56" cy="15" r="7.5" fill={white ? '#FFFFFF' : GOLD} />
        <Path d="M56 33 L56 67" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none" />

        {/* ===== "n" — left stem + arch + right stem ===== */}
        <Path d="M76 33 L76 67" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none" />
        <Path
          d="M76 48 L76 42 C76 34, 83 28, 94 28 C105 28, 112 34, 112 42 L112 67"
          stroke={c}
          strokeWidth={SW}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* ===== "Z" — geometric colored blocks ===== */}
        <G transform="translate(134, 5)">
          {/* Top bar: purple left + navy right */}
          <Rect x="0" y="0" width="42" height="24" rx="6" fill={white ? 'rgba(255,255,255,0.65)' : PURPLE} />
          <Rect x="32" y="0" width="42" height="24" rx="6" fill={white ? 'rgba(255,255,255,0.85)' : NAVY_DARK} />

          {/* Diagonal stripe (teal) — wider parallelogram */}
          <Path
            d="M56 10 L70 10 L18 68 L4 68 Z"
            fill={white ? 'rgba(255,255,255,0.9)' : TEAL}
          />

          {/* Bottom bar: teal left + golden right */}
          <Rect x="0" y="54" width="42" height="24" rx="6" fill={white ? 'rgba(255,255,255,0.9)' : TEAL} />
          <Rect x="32" y="54" width="42" height="24" rx="6" fill={white ? '#FFFFFF' : GOLD} />
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
