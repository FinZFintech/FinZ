import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, View, Platform, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/store/AuthContext';
import { LoanProvider } from './src/store/LoanContext';
import { RiskProvider } from './src/store/RiskContext';
import { ThemeProvider, useTheme } from './src/store/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';

const MAX_MOBILE_WIDTH = 480;

function MobileContainer({ children }) {
  const { width } = useWindowDimensions();
  if (Platform.OS === 'web' && width > MAX_MOBILE_WIDTH) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: MAX_MOBILE_WIDTH,
          height: '100%',
          maxHeight: 900,
          overflow: 'hidden',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        }}>
          {children}
        </View>
      </View>
    );
  }
  return children;
}

function ThemedApp() {
  const { colors, isDark } = useTheme();

  const navTheme = {
    dark: isDark,
    colors: {
      primary: colors.teal,
      background: colors.background,
      card: colors.headerBg,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.teal,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar
        backgroundColor={colors.background}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <LoanProvider>
          <RiskProvider>
            <NavigationContainer>
              <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
              <AppNavigator />
            </NavigationContainer>
          </RiskProvider>
        </LoanProvider>
      </AuthProvider>
      <ThemeProvider>
        <MobileContainer>
          <AuthProvider>
            <LoanProvider>
              <ThemedApp />
            </LoanProvider>
          </AuthProvider>
        </MobileContainer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
