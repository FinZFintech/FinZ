import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../config/constants';

export const authService = {
  async sendOtp(mobile) {
    return api.post(API_ENDPOINTS.AUTH.SEND_OTP, { mobile });
  },

  async verifyOtp(mobile, otp) {
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
