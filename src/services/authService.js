import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS, MOCK_MODE, SUPABASE_MODE } from '../config/constants';
import { supabaseAuthService } from './supabaseAuthService';

const mockAuthService = {
  async sendOtp(mobile) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { success: true, message: 'OTP sent successfully' };
  },

  async verifyOtp(mobile, otp) {
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

const apiAuthService = {
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

// Route to the appropriate service based on configuration
export const authService = SUPABASE_MODE
  ? supabaseAuthService
  : MOCK_MODE
    ? mockAuthService
    : apiAuthService;
