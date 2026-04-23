/**
 * FBot Conversation Engine
 *
 * Drives the loan application via chat. Each step has messages in
 * 13 languages. The engine tracks which step the user is on, what
 * data has been collected, and what to ask next.
 */

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'hinglish', label: 'Hinglish', native: 'Hinglish' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'as', label: 'Assamese', native: 'অসমীয়া' },
];

// Conversation messages per step per language (en + hinglish as primary,
// others get the same structure — in production these would come from a
// translation API or JSON file)
const MESSAGES = {
  welcome: {
    en: "Hi! I'm FBot, your loan application assistant. I'll help you complete your application step by step. Let's get started! 🚀",
    hinglish: "Namaste! Main FBot hoon, aapka loan application assistant. Main aapki application complete karne mein help karunga. Chaliye shuru karte hain! 🚀",
    hi: "नमस्ते! मैं FBot हूँ, आपका लोन एप्लीकेशन सहायक। मैं आपकी एप्लीकेशन पूरी करने में मदद करूँगा। चलिए शुरू करते हैं! 🚀",
    bn: "নমস্কার! আমি FBot, আপনার লোন আবেদন সহকারী। চলুন শুরু করি! 🚀",
    ta: "வணக்கம்! நான் FBot, உங்கள் கடன் விண்ணப்ப உதவியாளர். ஆரம்பிக்கலாம்! 🚀",
    te: "నమస్కారం! నేను FBot, మీ లోన్ అప్లికేషన్ అసిస్టెంట్. మొదలు పెడదాం! 🚀",
  },
  askName: {
    en: "May I know your name? I found your name as {prefillName}. Is this correct?",
    hinglish: "Kya mai aapka naam jaan sakta hu? Mujhe aapka naam {prefillName} mila hai, kya ye sahi hai?",
    hi: "क्या मैं आपका नाम जान सकता हूँ? मुझे आपका नाम {prefillName} मिला है, क्या यह सही है?",
  },
  askNameFresh: {
    en: "May I know your full name as per your PAN card?",
    hinglish: "Kya aap apna poora naam bata sakte hain jo aapke PAN card pe hai?",
    hi: "क्या आप अपना पूरा नाम बता सकते हैं जो आपके PAN कार्ड पर है?",
  },
  askPhone: {
    en: "I'll need your mobile number for verification. It's best if this is the number linked to your PAN and bank account.",
    hinglish: "Verification ke liye aapka phone number chahiye hoga. Ye phone number wahi ho to behtar hoga jis se aapka PAN aur bank account link ho.",
    hi: "वेरिफिकेशन के लिए आपका फोन नंबर चाहिए होगा। यह वही नंबर हो तो बेहतर होगा जिससे आपका PAN और बैंक अकाउंट लिंक हो।",
  },
  askOtp: {
    en: "An OTP has been sent to your mobile number. Please share the 6-digit OTP so I can verify your phone.",
    hinglish: "Aapke phone pe verification OTP aaya hoga. Please aap 6-digit OTP bataiye so that mai phone verify kar saku.",
    hi: "आपके फोन पर वेरिफिकेशन OTP आया होगा। कृपया 6-अंकों का OTP बताइए ताकि मैं फोन वेरिफाई कर सकूँ।",
  },
  phoneVerified: {
    en: "Phone verified successfully! ✅ I've found some details linked to your number. Let me fill them in for you.",
    hinglish: "Phone verify ho gaya! ✅ Aapke number se kuch details mili hain. Main unhe fill kar deta hoon.",
    hi: "फोन वेरिफाई हो गया! ✅ आपके नंबर से कुछ डिटेल्स मिली हैं। मैं उन्हें भर देता हूँ।",
  },
  askPan: {
    en: "Now I need your PAN number for identity verification. Please share your 10-character PAN.",
    hinglish: "Ab mujhe aapka PAN number chahiye identity verification ke liye. Please apna 10-character PAN share karein.",
    hi: "अब मुझे आपका PAN नंबर चाहिए पहचान सत्यापन के लिए। कृपया अपना 10-अक्षर का PAN साझा करें।",
  },
  panVerified: {
    en: "PAN verified! ✅ Your credit check is running in the background. This will take a few seconds.",
    hinglish: "PAN verify ho gaya! ✅ Aapka credit check background mein chal raha hai. Bas kuch seconds lagenge.",
    hi: "PAN वेरिफाई हो गया! ✅ आपका क्रेडिट चेक बैकग्राउंड में चल रहा है। बस कुछ सेकंड लगेंगे।",
  },
  creditPassed: {
    en: "Great news! Your credit check passed. ✅ Let's move to income verification now.",
    hinglish: "Badhai ho! Aapka credit check pass ho gaya. ✅ Ab income verification karte hain.",
    hi: "बधाई हो! आपका क्रेडिट चेक पास हो गया। ✅ अब आय सत्यापन करते हैं।",
  },
  creditFailed: {
    en: "I'm sorry, your credit check didn't pass at this time. You can try again after improving your credit score. 😔",
    hinglish: "Maaf kijiye, aapka credit check is samay pass nahi hua. Aap apna credit score improve karke dubara try kar sakte hain. 😔",
    hi: "माफ कीजिए, आपका क्रेडिट चेक इस समय पास नहीं हुआ। आप अपना क्रेडिट स्कोर सुधारकर दोबारा कोशिश कर सकते हैं। 😔",
  },
  askOccupation: {
    en: "What is your occupation? Are you salaried or self-employed?",
    hinglish: "Aapka occupation kya hai? Kya aap salaried hain ya self-employed?",
    hi: "आपका व्यवसाय क्या है? क्या आप वेतनभोगी हैं या स्व-नियोजित?",
  },
  askBankDetails: {
    en: "Please share your bank IFSC code and account number where your salary/income is credited.",
    hinglish: "Please apne bank ka IFSC code aur account number share karein jahan aapki salary/income aati hai.",
    hi: "कृपया अपने बैंक का IFSC कोड और खाता नंबर बताएं जहाँ आपकी सैलरी/आय आती है।",
  },
  bankPrefilled: {
    en: "I found your bank details from your ITR. IFSC: {ifsc}, Bank: {bankName}. Is this correct?",
    hinglish: "Mujhe aapke ITR se bank details mili hain. IFSC: {ifsc}, Bank: {bankName}. Kya ye sahi hai?",
    hi: "मुझे आपके ITR से बैंक डिटेल्स मिली हैं। IFSC: {ifsc}, Bank: {bankName}। क्या यह सही है?",
  },
  kycStart: {
    en: "Now let's verify your identity through KYC. I recommend using CKYC — it's the quickest method. Shall I start?",
    hinglish: "Ab KYC ke through aapki identity verify karte hain. Main CKYC recommend karunga — ye sabse tez method hai. Shuru karun?",
    hi: "अब KYC के माध्यम से आपकी पहचान सत्यापित करते हैं। मैं CKYC अनुशंसा करूँगा — यह सबसे तेज़ तरीका है। शुरू करूँ?",
  },
  kycOtp: {
    en: "An OTP has been sent to your CKYC registered mobile. Please share it to complete KYC.",
    hinglish: "Aapke CKYC registered mobile pe OTP bheja gaya hai. Please share karein KYC complete karne ke liye.",
    hi: "आपके CKYC पंजीकृत मोबाइल पर OTP भेजा गया है। कृपया KYC पूरा करने के लिए साझा करें।",
  },
  kycDone: {
    en: "KYC completed successfully! ✅ Your identity has been verified. Let's move to the next step.",
    hinglish: "KYC complete ho gaya! ✅ Aapki identity verify ho gayi hai. Ab agle step pe chalte hain.",
    hi: "KYC पूरा हो गया! ✅ आपकी पहचान सत्यापित हो गई है। अब अगले चरण पर चलते हैं।",
  },
  selfieStart: {
    en: "Now I need a selfie for face verification. Please take a clear photo with good lighting.",
    hinglish: "Ab face verification ke liye selfie chahiye. Please achhi lighting mein clear photo lein.",
    hi: "अब फेस वेरिफिकेशन के लिए सेल्फी चाहिए। कृपया अच्छी रोशनी में स्पष्ट फोटो लें।",
  },
  applicationComplete: {
    en: "Congratulations! 🎉 Your loan application is complete. Our team will review it and get back to you soon.",
    hinglish: "Badhai ho! 🎉 Aapki loan application complete ho gayi hai. Hamari team review karke aapko jaldi contact karegi.",
    hi: "बधाई हो! 🎉 आपकी लोन एप्लीकेशन पूरी हो गई है। हमारी टीम समीक्षा करके आपसे जल्द संपर्क करेगी।",
  },
  waiting: {
    en: "Please wait while I process this... ⏳",
    hinglish: "Please thoda wait karein, main process kar raha hoon... ⏳",
    hi: "कृपया प्रतीक्षा करें, मैं प्रोसेस कर रहा हूँ... ⏳",
  },
  error: {
    en: "Something went wrong. Please try again or type 'help' for assistance.",
    hinglish: "Kuch galat ho gaya. Please dobara try karein ya 'help' type karein.",
    hi: "कुछ गलत हो गया। कृपया दोबारा प्रयास करें या 'help' टाइप करें।",
  },
  help: {
    en: "You can type:\n• Your name\n• Phone number (10 digits)\n• OTP (6 digits)\n• PAN (10 characters)\n• 'yes' or 'no' to confirm\n• 'skip' to skip a step\n• 'back' to go back",
    hinglish: "Aap type kar sakte hain:\n• Apna naam\n• Phone number (10 digit)\n• OTP (6 digit)\n• PAN (10 character)\n• 'haan' ya 'nahi' confirm ke liye\n• 'skip' step skip karne ke liye\n• 'back' peeche jaane ke liye",
    hi: "आप टाइप कर सकते हैं:\n• अपना नाम\n• फोन नंबर (10 अंक)\n• OTP (6 अंक)\n• PAN (10 अक्षर)\n• 'हाँ' या 'नहीं' पुष्टि के लिए\n• 'skip' चरण छोड़ने के लिए",
  },
  digilockerGuide: {
    en: "A DigiLocker screen will open now. Please complete the Aadhaar verification there. Once done, come back here.",
    hinglish: "Ab aapke saamne DigiLocker screen open hogi, jo ki KYC ke liye jaruri hai. Please use complete karein. Complete hone ke baad yahan wapas aayein.",
    hi: "अब आपके सामने DigiLocker स्क्रीन खुलेगी। कृपया वहाँ आधार सत्यापन पूरा करें। पूरा होने पर यहाँ वापस आएं।",
  },
};

/**
 * Get a message in the selected language, with fallback to hinglish → en.
 */
export function getMessage(key, lang = 'en', replacements = {}) {
  const msgs = MESSAGES[key];
  if (!msgs) return '';
  let msg = msgs[lang] || msgs.hinglish || msgs.en || '';
  for (const [k, v] of Object.entries(replacements)) {
    msg = msg.replace(`{${k}}`, v || '');
  }
  return msg;
}

/**
 * Detect what type of input the user provided.
 */
export function detectInputType(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { type: 'empty' };

  // OTP: exactly 6 digits
  if (/^\d{6}$/.test(trimmed)) return { type: 'otp', value: trimmed };

  // Phone: 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(trimmed)) return { type: 'phone', value: trimmed };

  // PAN: 5 letters + 4 digits + 1 letter
  if (/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(trimmed)) return { type: 'pan', value: trimmed.toUpperCase() };

  // IFSC: 4 letters + 0 + 6 alphanum
  if (/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(trimmed)) return { type: 'ifsc', value: trimmed.toUpperCase() };

  // Account number: 8-18 digits
  if (/^\d{8,18}$/.test(trimmed)) return { type: 'accountNumber', value: trimmed };

  // Yes/No/Confirm
  const lower = trimmed.toLowerCase();
  if (['yes', 'haan', 'ha', 'haa', 'ji', 'ok', 'sahi', 'correct', 'right', 'y'].includes(lower)) {
    return { type: 'confirm', value: true };
  }
  if (['no', 'nahi', 'nai', 'galat', 'wrong', 'n'].includes(lower)) {
    return { type: 'deny', value: false };
  }

  // Help
  if (['help', 'madad', 'sahayata', '?'].includes(lower)) return { type: 'help' };

  // Skip
  if (['skip', 'chhodo', 'छोड़ो'].includes(lower)) return { type: 'skip' };

  // Occupation keywords
  if (/salaried|salary|naukri|job|private|govt/i.test(lower)) return { type: 'occupation', value: 'salaried_private' };
  if (/self.?employed|business|vyapar|dukaan|shop/i.test(lower)) return { type: 'occupation', value: 'self_employed_business' };

  // Default: treat as name/text
  return { type: 'text', value: trimmed };
}

/**
 * FBot step sequence — maps to the loan application flow.
 */
export const FBOT_STEPS = [
  'welcome',
  'askName',
  'askPhone',
  'askOtp',
  'phoneVerified',
  'askPan',
  'panVerifying',
  'creditCheck',
  'askOccupation',
  'askBankDetails',
  'incomeVerify',
  'kycStart',
  'kycOtp',
  'kycDone',
  'selfieStart',
  'applicationComplete',
];

export { LANGUAGES, MESSAGES };
