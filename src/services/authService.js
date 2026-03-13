import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS, MOCK_MODE } from '../config/constants';

export const authService = {
  async sendOtp(mobile) {
    if (MOCK_MODE) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { success: true, message: 'OTP sent successfully' };
    }
    return api.post(API_ENDPOINTS.AUTH.SEND_OTP, { mobile });
  },

  async verifyOtp(mobile, otp) {
    if (MOCK_MODE) {
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Mock role routing by phone number:
      //   9999900000 → admin
      //   9999900001 → credit team
      //   9999900002 → sales team
      //   all others → customer
      let role = 'customer';
      let name = 'Test User';
      let email = 'user@finz.com';
      if (mobile === '9999900000') { role = 'admin';  name = 'Admin User';  email = 'admin@finz.com'; }
      else if (mobile === '9999900001') { role = 'credit'; name = 'Credit Analyst'; email = 'credit@finz.com'; }
      else if (mobile === '9999900002') { role = 'sales';  name = 'Sales Agent';   email = 'sales@finz.com'; }

      const mockUser = {
        id: 'USR_' + Date.now(),
        name,
        phone: mobile,
        email,
        role,
      };
      const mockResponse = {
        token: 'mock_jwt_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        user: mockUser,
      };
      await AsyncStorage.setItem('auth_token', mockResponse.token);
      await AsyncStorage.setItem('refresh_token', mockResponse.refreshToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(mockResponse.user));
      return mockResponse;
    }

    const response = await api.post(API_ENDPOINTS.AUTH.VERIFY_OTP, { mobile, otp });
    if (response.token) {
      await AsyncStorage.setItem('auth_token', response.token);
      await AsyncStorage.setItem('refresh_token', response.refreshToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(response.user));
    }
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
