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
      const mockUser = {
        id: 'USR_' + Date.now(),
        name: 'Test User',
        phone: mobile,
        email: 'user@finz.com',
        role: 'customer',
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
    await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
  },

  async isAuthenticated() {
    const token = await AsyncStorage.getItem('auth_token');
    return !!token;
  },
};
