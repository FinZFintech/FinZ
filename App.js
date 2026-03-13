import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, View, Platform, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/store/AuthContext';
import { LoanProvider } from './src/store/LoanContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { COLORS } from './src/config/constants';

const MAX_MOBILE_WIDTH = 480;

const DarkNavTheme = {
  dark: true,
  colors: {
    primary: COLORS.teal,
    background: COLORS.background,
    card: COLORS.headerBg,
    text: COLORS.textPrimary,
    border: COLORS.border,
    notification: COLORS.teal,
  },
};

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

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <MobileContainer>
        <AuthProvider>
          <LoanProvider>
            <NavigationContainer ref={navigationRef} theme={DarkNavTheme}>
              <StatusBar backgroundColor={COLORS.background} barStyle="light-content" />
              <AppNavigator />
            </NavigationContainer>
          </LoanProvider>
        </AuthProvider>
      </MobileContainer>
    </GestureHandlerRootView>
  );
}
