import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';

const AuthContext = createContext(null);
const GUARDIANS_KEY = 'finz_guardians';
const LINKED_WARDS_KEY = 'finz_linked_wards';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guardians, setGuardians] = useState([]);
  const [linkedWards, setLinkedWards] = useState([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await authService.getUser();
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
        await loadGuardians(userData.id);
        await loadLinkedWards(userData.phone);
      }
    } catch {
      // Not authenticated
    } finally {
      setIsLoading(false);
    }
  };

  const loadGuardians = async (userId) => {
    try {
      const data = await AsyncStorage.getItem(`${GUARDIANS_KEY}_${userId}`);
      if (data) setGuardians(JSON.parse(data));
    } catch { /* ignore */ }
  };

  const loadLinkedWards = async (phone) => {
    try {
      const data = await AsyncStorage.getItem(`${LINKED_WARDS_KEY}_${phone}`);
      if (data) setLinkedWards(JSON.parse(data));
    } catch { /* ignore */ }
  };

  const login = async (mobile, otp) => {
    const response = await authService.verifyOtp(mobile, otp);
    setUser(response.user);
    setIsAuthenticated(true);
    await loadGuardians(response.user.id);
    await loadLinkedWards(response.user.phone);
    return response;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setGuardians([]);
    setLinkedWards([]);
  };

  const updateUser = async (userData) => {
    setUser(userData);
    await AsyncStorage.setItem('user_data', JSON.stringify(userData));
  };

  const addGuardian = async (guardian) => {
    const updated = [...guardians, { ...guardian, id: `guardian_${Date.now()}`, addedAt: new Date().toISOString() }];
    setGuardians(updated);
    await AsyncStorage.setItem(`${GUARDIANS_KEY}_${user.id}`, JSON.stringify(updated));
    // Link this user as a ward under the guardian's phone
    const wardKey = `${LINKED_WARDS_KEY}_${guardian.phone}`;
    try {
      const existing = await AsyncStorage.getItem(wardKey);
      const wards = existing ? JSON.parse(existing) : [];
      const alreadyLinked = wards.some(w => w.userId === user.id);
      if (!alreadyLinked) {
        wards.push({
          userId: user.id,
          name: user.name,
          phone: user.phone,
          relation: guardian.relation,
          linkedAt: new Date().toISOString(),
        });
        await AsyncStorage.setItem(wardKey, JSON.stringify(wards));
      }
    } catch { /* ignore */ }
  };

  const removeGuardian = async (guardianId) => {
    const guardian = guardians.find(g => g.id === guardianId);
    const updated = guardians.filter(g => g.id !== guardianId);
    setGuardians(updated);
    await AsyncStorage.setItem(`${GUARDIANS_KEY}_${user.id}`, JSON.stringify(updated));
    // Unlink ward from guardian
    if (guardian) {
      const wardKey = `${LINKED_WARDS_KEY}_${guardian.phone}`;
      try {
        const existing = await AsyncStorage.getItem(wardKey);
        if (existing) {
          const wards = JSON.parse(existing).filter(w => w.userId !== user.id);
          await AsyncStorage.setItem(wardKey, JSON.stringify(wards));
        }
      } catch { /* ignore */ }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user, isLoading, isAuthenticated, login, logout, updateUser,
        guardians, addGuardian, removeGuardian,
        linkedWards,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
