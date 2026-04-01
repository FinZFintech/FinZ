import { MTALKZ_CONFIG } from '../config/constants';

// OTP store keyed by phone number
const otpStore = {};

// Test numbers use fixed OTP 123456 and skip SMS delivery
const TEST_NUMBERS = new Set(['9999900000', '9999900001', '9999900002', '9999900003']);
const TEST_OTP = '123456';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildOtpMessage(otp) {
  return MTALKZ_CONFIG.TEMPLATES.OTP.replace('{#otp#}', otp);
}

export const smsService = {
  /**
   * Send an SMS via mTalkz API.
   * Uses GET request with query parameters as per mTalkz API spec.
   * @param {string} number - Recipient phone number (10-digit or with country code)
   * @param {string} message - Message body
   */
  async sendSms(number, message) {
    const phone = number.replace(/^\+91/, '');

    const params = new URLSearchParams({
      apikey: MTALKZ_CONFIG.API_KEY,
      senderid: MTALKZ_CONFIG.SENDER_ID,
      number: phone,
      message,
      format: 'json',
    });

    const url = `${MTALKZ_CONFIG.BASE_URL}?${params.toString()}`;

    console.log('[smsService] Sending SMS to', phone);
    const response = await fetch(url, { method: 'GET' });

    const result = await response.json();
    console.log('[smsService] mTalkz response:', result);

    if (result.status === 'error' || result.msgtype === 'error') {
      throw new Error(result.message || 'SMS delivery failed');
    }

    return result;
  },

  /**
   * Generate OTP, store it, and send via SMS.
   * OTP is stored first so verification works even if SMS delivery has transient issues.
   * @param {string} mobile - 10-digit mobile number
   * @returns {{ success: boolean, message: string }}
   */
  async sendOtp(mobile) {
    const isTestNumber = TEST_NUMBERS.has(mobile);
    const otp = isTestNumber ? TEST_OTP : generateOtp();

    // Store OTP before sending SMS so it's available for verification
    otpStore[mobile] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
    };

    if (isTestNumber) {
      console.log(`[smsService] Test number ${mobile} — use OTP: ${TEST_OTP}`);
    } else {
      const message = buildOtpMessage(otp);
      try {
        await this.sendSms(mobile, message);
        console.log('[smsService] OTP SMS sent to', mobile);
      } catch (err) {
        console.warn('[smsService] SMS delivery failed, OTP still stored for verification:', err.message);
      }
    }

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
