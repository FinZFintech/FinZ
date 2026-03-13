import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DARK_COLORS = {
  primary: '#2D2B6B',
  primaryLight: '#3E3C8A',
  primaryDark: '#1E1C4E',
  secondary: '#F5B731',
  secondaryLight: '#F7C95C',
  teal: '#4AEDC4',
  purple: '#7B6DAF',
  accent: '#4AEDC4',
  background: '#0D1017',
  surface: '#151A24',
  cardBg: '#1A1E2E',
  cardBorder: 'rgba(255,255,255,0.08)',
  error: '#FF6B6B',
  success: '#4AEDC4',
  warning: '#F5B731',
  info: '#7B6DAF',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E95A8',
  textLight: '#FFFFFF',
  border: 'rgba(255,255,255,0.1)',
  disabled: '#3A3F4E',
  overlay: 'rgba(0,0,0,0.6)',
  cardShadow: 'rgba(0,0,0,0.3)',
  headerBg: '#111520',
  inputBg: '#1A1E2E',
  selectedBorder: '#4AEDC4',
  buttonGreen: '#4AEDC4',
  buttonGreenDark: '#3AAF8F',
};

const LIGHT_COLORS = {
  primary: '#2D2B6B',
  primaryLight: '#3E3C8A',
  primaryDark: '#1E1C4E',
  secondary: '#F5B731',
  secondaryLight: '#F7C95C',
  teal: '#2CC5BE',
  purple: '#7B6DAF',
  accent: '#2CC5BE',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.08)',
  error: '#E53E3E',
  success: '#2CC5BE',
  warning: '#F5B731',
  info: '#7B6DAF',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#FFFFFF',
  border: 'rgba(0,0,0,0.1)',
  disabled: '#D1D5DB',
  overlay: 'rgba(0,0,0,0.4)',
  cardShadow: 'rgba(0,0,0,0.08)',
  headerBg: '#2D2B6B',
  inputBg: '#F0F1F5',
  selectedBorder: '#2CC5BE',
  buttonGreen: '#2CC5BE',
  buttonGreenDark: '#239E98',
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then((val) => {
      if (val === 'light') setIsDark(false);
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem('app_theme', next ? 'dark' : 'light');
  };

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors, isLoaded }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
