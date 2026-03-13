import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabaseAuthService = {
  /**
   * Send OTP to mobile number via Supabase Auth (phone provider).
   * Requires Twilio or other SMS provider configured in Supabase dashboard.
   */
  async sendOtp(mobile) {
    const phone = mobile.startsWith('+') ? mobile : `+91${mobile}`;
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
    return { success: true, message: 'OTP sent successfully' };
  },

  /**
   * Verify OTP and create/fetch user profile.
   */
  async verifyOtp(mobile, otp) {
    const phone = mobile.startsWith('+') ? mobile : `+91${mobile}`;
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });
    if (error) throw error;

    const session = data.session;
    const authUser = data.user;

    // Upsert profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          auth_id: authUser.id,
          phone: mobile,
          name: authUser.user_metadata?.name || '',
          email: authUser.email || '',
        },
        { onConflict: 'auth_id' }
      )
      .select()
      .single();

    if (profileError) throw profileError;

    const user = {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      role: profile.role,
    };

    // Store for AuthContext compatibility
    await AsyncStorage.setItem('auth_token', session.access_token);
    await AsyncStorage.setItem('refresh_token', session.refresh_token);
    await AsyncStorage.setItem('user_data', JSON.stringify(user));

    return {
      token: session.access_token,
      refreshToken: session.refresh_token,
      user,
    };
  },

  /**
   * Get current user from Supabase session.
   */
  async getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', session.user.id)
      .single();

    if (!profile) return null;

    return {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      role: profile.role,
    };
  },

  /**
   * Sign out from Supabase and clear local storage.
   */
  async logout() {
    await supabase.auth.signOut();
    await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
  },

  /**
   * Check if the user has an active Supabase session.
   */
  async isAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },
};
