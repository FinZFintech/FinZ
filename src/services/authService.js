import AsyncStorage from '@react-native-async-storage/async-storage';
import { smsService } from './smsService';

const USER_PROFILES_KEY = 'finz_user_profiles'; // Map of phone -> user profile

// Generate a stable user ID from phone number
function getUserIdFromPhone(phone) {
  return `user_${phone}`;
}

// Role-based routing for test numbers
function getRoleForPhone(phone) {
  switch (phone) {
    case '9999900000': return 'admin';
    case '9999900001': return 'credit';
    case '9999900002': return 'sales';
    case '9999900003': return 'operations';
    default: return 'customer';
  }
}

// Load all saved user profiles
async function loadProfiles() {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Save user profile keyed by phone
async function saveProfile(phone, userData) {
  try {
    const profiles = await loadProfiles();
    profiles[phone] = userData;
    await AsyncStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn('[authService] Failed to save profile:', err.message);
  }
}

export const authService = {
  async sendOtp(mobile) {
    console.log('[authService] Sending OTP to', mobile);
    return smsService.sendOtp(mobile);
  },

  async verifyOtp(mobile, otp) {
    // Verify the OTP sent via SMS
    smsService.verifyOtp(mobile, otp);

    const role = getRoleForPhone(mobile);
    const stableId = getUserIdFromPhone(mobile);

    // Check if user profile already exists (returning user)
    const profiles = await loadProfiles();
    let user = profiles[mobile];

    if (user) {
      // Returning user — preserve all saved personal details, update role
      user.role = role;
      user.lastLoginAt = new Date().toISOString();
    } else {
      // New user — create profile with defaults
      const roleNames = {
        admin: 'Admin User',
        credit: 'Credit Officer',
        sales: 'Sales Executive',
        operations: 'Operations Officer',
        customer: '',
      };
      user = {
        id: stableId,
        name: roleNames[role] || '',
        phone: mobile,
        email: '',
        role,
        kycVerified: false,
        dob: '',
        gender: '',
        address: '',
        guardians: [],
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    }

    // Persist profile
    await saveProfile(mobile, user);

    const response = {
      token: 'jwt_' + stableId + '_' + Date.now(),
      refreshToken: 'refresh_' + stableId + '_' + Date.now(),
      user,
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

  async updateUser(userData) {
    await AsyncStorage.setItem('user_data', JSON.stringify(userData));
    // Also update persistent profile
    if (userData.phone) {
      await saveProfile(userData.phone, userData);
    }
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
