import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../config/constants';

const api = axios.create({
  baseURL: API_ENDPOINTS.BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(
            `${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.AUTH.REFRESH_TOKEN}`,
            { refreshToken }
          );
          await AsyncStorage.setItem('auth_token', res.data.token);
          error.config.headers.Authorization = `Bearer ${res.data.token}`;
          return api(error.config);
        } catch {
          await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
        }
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
