import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/store/AuthContext';
import { LoanProvider } from './src/store/LoanContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/config/constants';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <LoanProvider>
          <NavigationContainer>
            <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
            <AppNavigator />
          </NavigationContainer>
        </LoanProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
