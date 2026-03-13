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

        {/* ===== "Z" — geometric colored blocks ===== */}
        <G transform="translate(136, 2)">
          {/* Top bar: purple left + navy right */}
          <Rect x="0" y="0" width="42" height="22" rx="5" fill={white ? 'rgba(255,255,255,0.65)' : PURPLE} />
          <Rect x="30" y="0" width="42" height="22" rx="5" fill={white ? 'rgba(255,255,255,0.85)' : NAVY_DARK} />

          {/* Diagonal stripe (teal) */}
          <Path
            d="M55 9 L68 9 L17 69 L4 69 Z"
            fill={white ? 'rgba(255,255,255,0.9)' : TEAL}
          />

          {/* Bottom bar: teal left + golden right */}
          <Rect x="0" y="56" width="42" height="22" rx="5" fill={white ? 'rgba(255,255,255,0.9)' : TEAL} />
          <Rect x="30" y="56" width="42" height="22" rx="5" fill={white ? '#FFFFFF' : GOLD} />
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
