import { MTALKZ_CONFIG } from '../config/constants';

// OTP store keyed by phone number
const otpStore = {};

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildOtpMessage(otp) {
  return MTALKZ_CONFIG.TEMPLATES.OTP.replace('{#otp}', otp);
}

export const smsService = {
  /**
   * Send an SMS via mTalkz API.
   * @param {string} number - Recipient phone number (10-digit or with country code)
   * @param {string} message - Message body
   */
  async sendSms(number, message) {
    const payload = {
      apikey: MTALKZ_CONFIG.API_KEY,
      senderid: MTALKZ_CONFIG.SENDER_ID,
      number: number.replace(/^\+91/, ''),
      message,
      format: 'json',
    };

    console.log('[smsService] Sending SMS to', number);
    const response = await fetch(MTALKZ_CONFIG.BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('[smsService] mTalkz response:', result);

    if (result.status === 'error' || result.msgtype === 'error') {
      throw new Error(result.message || 'SMS delivery failed');
    }

    return result;
  },

  /**
   * Generate OTP, store it, and send via SMS.
   * @param {string} mobile - 10-digit mobile number
   * @returns {{ success: boolean, message: string }}
   */
  async sendOtp(mobile) {
    const otp = generateOtp();
    const message = buildOtpMessage(otp);

    await this.sendSms(mobile, message);

    otpStore[mobile] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
    };

    console.log('[smsService] OTP stored for', mobile);
    return { success: true, message: 'OTP sent successfully' };
  },

  /**
   * Verify OTP entered by the user.
   * @param {string} mobile - 10-digit mobile number
   * @param {string} otp - OTP entered by user
   * @returns {{ verified: boolean }}
   */
  verifyOtp(mobile, otp) {
    const entry = otpStore[mobile];
    if (!entry) {
      throw new Error('OTP not found. Please request a new OTP.');
    }
    if (Date.now() > entry.expiresAt) {
      delete otpStore[mobile];
      throw new Error('OTP has expired. Please request a new OTP.');
    }
    entry.attempts += 1;
    if (entry.attempts > 5) {
      delete otpStore[mobile];
      throw new Error('Too many attempts. Please request a new OTP.');
    }
    if (entry.otp !== otp) {
      throw new Error('Invalid OTP. Please try again.');
    }

    delete otpStore[mobile];
    return { verified: true };
  },
};
