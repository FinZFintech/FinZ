import AsyncStorage from '@react-native-async-storage/async-storage';
import { smsService } from './smsService';

export const authService = {
  async sendOtp(mobile) {
    console.log('[authService] Sending OTP to', mobile);
    return smsService.sendOtp(mobile);
  },

  async verifyOtp(mobile, otp) {
    // Verify the OTP sent via SMS
    smsService.verifyOtp(mobile, otp);

    // Role-based routing for test numbers
    let role = 'customer';
    if (mobile === '9999900000') role = 'admin';
    else if (mobile === '9999900001') role = 'credit_team';
    else if (mobile === '9999900002') role = 'sales_team';

    const response = {
      token: 'mock_jwt_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      user: {
        id: 'mock_user_' + Date.now(),
        name: 'Test User',
        phone: mobile,
        email: 'test@finz.finance',
        role,
      },
    };

    await AsyncStorage.setItem('auth_token', response.token);
    await AsyncStorage.setItem('refresh_token', response.refreshToken);
    await AsyncStorage.setItem('user_data', JSON.stringify(response.user));
    return response;
  },

  async getUser() {
    const userData = await AsyncStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  },

  async logout() {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('user_data');
  },

  async isAuthenticated() {
    const token = await AsyncStorage.getItem('auth_token');
    return !!token;
  },
};
