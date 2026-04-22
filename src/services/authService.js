import AsyncStorage from '@react-native-async-storage/async-storage';
import { smsService } from './smsService';
import { getStaffUserByPhone, getStaffUserByEmail } from './userService';
import { isFirebaseConfigured } from '../config/firebase';

const USER_PROFILES_KEY = 'finz_user_profiles';

function getUserIdFromPhone(phone) {
  return `user_${phone}`;
}

// Fallback test numbers when Firestore is not configured
const TEST_STAFF = {
  '9999900000': 'admin',
  '9999900001': 'credit',
  '9999900002': 'sales',
  '9999900003': 'operations',
};

/**
 * Determine user role:
 *  1. Check Firestore staff_users collection (if Firebase configured)
 *  2. Fall back to hardcoded test numbers
 *  3. Default to 'customer'
 */
async function getRoleForPhone(phone) {
  // Try Firestore first
  if (isFirebaseConfigured()) {
    try {
      const staffUser = await getStaffUserByPhone(phone);
      if (staffUser) {
        if (!staffUser.active) {
          throw new Error('Your account has been disabled. Please contact admin.');
        }
        return { role: staffUser.role, name: staffUser.name, fromFirestore: true };
      }
    } catch (err) {
      if (err.message?.includes('disabled')) throw err;
      console.log('[authService] Firestore staff lookup failed:', err?.message);
    }
  }
  // Fallback to test numbers
  const testRole = TEST_STAFF[phone];
  if (testRole) return { role: testRole, name: '', fromFirestore: false };
  return { role: 'customer', name: '', fromFirestore: false };
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
    smsService.verifyOtp(mobile, otp);

    const { role, name: staffName, fromFirestore } = await getRoleForPhone(mobile);
    const stableId = getUserIdFromPhone(mobile);

    const profiles = await loadProfiles();
    let user = profiles[mobile];

    if (user) {
      user.role = role;
      if (staffName) user.name = staffName;
      user.lastLoginAt = new Date().toISOString();
    } else {
      const roleNames = {
        admin: 'Admin User',
        credit: 'Credit Officer',
        sales: 'Sales Executive',
        operations: 'Operations Officer',
        customer: '',
      };
      user = {
        id: stableId,
        name: staffName || roleNames[role] || '',
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
        fromFirestore,
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
