import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G, Text as SvgText, TSpan } from 'react-native-svg';

const NAVY = '#2D2B6B';
const GOLD = '#F5B731';
const PURPLE = '#7B6DAF';
const TEAL = '#2CC5BE';
const NAVY_DARK = '#1E1C4E';

const Logo = ({ size = 'medium', white = false }) => {
  const scale = size === 'large' ? 1.5 : size === 'small' ? 0.6 : size === 'tiny' ? 0.35 : 1;
  const w = 240 * scale;
  const h = 85 * scale;
  const c = white ? '#FFFFFF' : NAVY;

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      <Svg width={w} height={h} viewBox="0 0 240 85">
        {/* ===== "fin" rendered as bold text ===== */}
        <SvgText
          fill={c}
          fontSize="68"
          fontWeight="900"
          fontFamily="System"
          x="0"
          y="68"
          letterSpacing="-1"
        >
          <TSpan>fin</TSpan>
        </SvgText>

        {/* "i" dot overlay — golden yellow circle */}
        <Circle cx="68" cy="14" r="8" fill={white ? '#FFFFFF' : GOLD} />

        {/* ===== "Z" — geometric colored letter ===== */}
        <G transform="translate(136, 2)">
          {/* Top bar — purple */}
          <Rect x="0" y="0" width="72" height="18" rx="4" fill={white ? 'rgba(255,255,255,0.7)' : PURPLE} />

          {/* Diagonal stroke — navy dark */}
          <Path
            d="M50 18 L72 18 L22 58 L0 58 Z"
            fill={white ? 'rgba(255,255,255,0.85)' : NAVY_DARK}
          />

          {/* Bottom bar — golden yellow */}
          <Rect x="0" y="58" width="72" height="18" rx="4" fill={white ? '#FFFFFF' : GOLD} />
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
