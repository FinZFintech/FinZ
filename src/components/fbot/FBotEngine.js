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
  askLoanAmount: {
    en: "How much loan do you need? You can type an amount like 500000 or 5L (5 lakhs).",
    hinglish: "Aapko kitna loan chahiye? Amount type karein jaise 500000 ya 5L (5 lakh).",
    hi: "आपको कितना लोन चाहिए? राशि टाइप करें जैसे 500000 या 5L (5 लाख)।",
  },
  askTenure: {
    en: "For how many months would you like the loan? (e.g. 12, 24, 36, 60)",
    hinglish: "Kitne mahine ke liye loan chahiye? (jaise 12, 24, 36, 60)",
    hi: "कितने महीने के लिए लोन चाहिए? (जैसे 12, 24, 36, 60)",
  },
  askDob: {
    en: "Please share your date of birth in DD/MM/YYYY format (e.g. 15/08/1995).",
    hinglish: "Apni date of birth DD/MM/YYYY format mein bataiye (jaise 15/08/1995).",
    hi: "कृपया अपनी जन्मतिथि DD/MM/YYYY फॉर्मेट में बताएं (जैसे 15/08/1995)।",
  },
  askEmployer: {
    en: "What's the name of your employer / company?",
    hinglish: "Aapki company / employer ka naam kya hai?",
    hi: "आपकी कंपनी / नियोक्ता का नाम क्या है?",
  },
  askMonthlyIncome: {
    en: "What is your approximate monthly in-hand income? (e.g. 45000)",
    hinglish: "Aapki monthly in-hand income kitni hai? (jaise 45000)",
    hi: "आपकी मासिक इन-हैंड आय कितनी है? (जैसे 45000)",
  },
  confirmLoan: {
    en: "To confirm: ₹{amount} for {tenure} months. Shall I submit your application?",
    hinglish: "Confirm karte hain: ₹{amount} for {tenure} months. Application submit karun?",
    hi: "पुष्टि करें: ₹{amount} {tenure} महीनों के लिए। क्या मैं एप्लीकेशन सबमिट करूँ?",
  },
  restarted: {
    en: "No problem — let's start fresh. 🔄",
    hinglish: "Koi baat nahi — phir se shuru karte hain. 🔄",
    hi: "कोई बात नहीं — फिर से शुरू करते हैं। 🔄",
  },
  backStep: {
    en: "Going back to the previous step...",
    hinglish: "Pichle step pe wapas chalte hain...",
    hi: "पिछले चरण पर वापस चलते हैं...",
  },
  invalidPhone: {
    en: "Please enter a valid 10-digit mobile number starting with 6-9.",
    hinglish: "Please ek valid 10-digit mobile number enter karein jo 6-9 se start ho.",
    hi: "कृपया 6-9 से शुरू होने वाला 10 अंकों का मोबाइल नंबर दर्ज करें।",
  },
  invalidOtp: {
    en: "Please enter the 6-digit OTP sent to your mobile.",
    hinglish: "Please 6-digit OTP enter karein jo aapke mobile pe aaya hai.",
    hi: "कृपया अपने मोबाइल पर भेजा गया 6 अंकों का OTP दर्ज करें।",
  },
  invalidPan: {
    en: "Please enter a valid PAN number (e.g. ABCDE1234F).",
    hinglish: "Please ek valid PAN number enter karein (jaise ABCDE1234F).",
    hi: "कृपया एक वैध PAN नंबर दर्ज करें (जैसे ABCDE1234F)।",
  },
  invalidIfsc: {
    en: "Please share your bank IFSC code (11 characters, e.g. SBIN0001234).",
    hinglish: "Please apna bank IFSC code share karein (11 characters, jaise SBIN0001234).",
    hi: "कृपया अपना बैंक IFSC कोड साझा करें (11 अक्षर, जैसे SBIN0001234)।",
  },
  invalidAmount: {
    en: "Please enter a valid amount (e.g. 500000 or 5L).",
    hinglish: "Please valid amount enter karein (jaise 500000 ya 5L).",
    hi: "कृपया वैध राशि दर्ज करें (जैसे 500000 या 5L)।",
  },
  invalidTenure: {
    en: "Please enter tenure in months between 6 and 84.",
    hinglish: "Please 6 aur 84 ke beech mein months mein tenure enter karein.",
    hi: "कृपया 6 से 84 के बीच महीनों में अवधि दर्ज करें।",
  },
  invalidDob: {
    en: "Please enter date of birth as DD/MM/YYYY.",
    hinglish: "Please DOB DD/MM/YYYY format mein enter karein.",
    hi: "कृपया जन्मतिथि DD/MM/YYYY फॉर्मेट में दर्ज करें।",
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
  const lower = trimmed.toLowerCase();

  // Control keywords (checked first so they win over ambiguous numeric input)
  if (['help', 'madad', 'sahayata', 'sahayam', 'உதவி', 'సహాయం', '?'].includes(lower)) return { type: 'help' };
  if (['skip', 'chhodo', 'छोड़ो', 'chod', 'tadsu', 'தவிர்', 'దాటవేయి'].includes(lower)) return { type: 'skip' };
  if (['back', 'peeche', 'वापस', 'wapas', 'पिछला', 'பின்', 'వెనుకకు'].includes(lower)) return { type: 'back' };
  if (['restart', 'reset', 'shuru', 'शुरू', 'फिर से', 'மறுதொடக்கம்', 'పునఃప్రారంభం'].includes(lower)) return { type: 'restart' };

  // OTP: exactly 6 digits
  if (/^\d{6}$/.test(trimmed)) return { type: 'otp', value: trimmed };

  // Phone: 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(trimmed)) return { type: 'phone', value: trimmed };

  // PAN: 5 letters + 4 digits + 1 letter
  if (/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(trimmed)) return { type: 'pan', value: trimmed.toUpperCase() };

  // IFSC: 4 letters + 0 + 6 alphanum
  if (/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(trimmed)) return { type: 'ifsc', value: trimmed.toUpperCase() };

  // Date of birth: DD/MM/YYYY or DD-MM-YYYY
  const dobMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dobMatch) {
    const [, d, m, y] = dobMatch;
    const day = parseInt(d, 10), mon = parseInt(m, 10), year = parseInt(y, 10);
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12 && year >= 1900 && year <= new Date().getFullYear()) {
      const iso = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { type: 'dob', value: iso };
    }
  }

  // Amount with lakh / L / cr suffix: "5L", "5 lakh", "5.5L", "10cr"
  const amtMatch = trimmed.match(/^₹?\s*(\d+(?:\.\d+)?)\s*(l|lakh|lakhs|लाख|cr|crore|crores|करोड़|k|thousand|हज़ार)?$/i);
  if (amtMatch) {
    const n = parseFloat(amtMatch[1]);
    const suf = (amtMatch[2] || '').toLowerCase();
    let rupees = n;
    if (/^l|lakh/.test(suf) || suf === 'लाख') rupees = n * 100000;
    else if (/^cr|crore/.test(suf) || suf === 'करोड़') rupees = n * 10000000;
    else if (/^k|thousand/.test(suf) || suf === 'हज़ार') rupees = n * 1000;
    if (rupees >= 1000) return { type: 'amount', value: Math.round(rupees) };
  }

  // Tenure in months/years: "24", "24 months", "2 years", "2 saal"
  const tenMatch = trimmed.match(/^(\d{1,3})\s*(m|mo|month|months|mahine|महीने|y|yr|year|years|saal|साल|वर्ष)?$/i);
  if (tenMatch) {
    const n = parseInt(tenMatch[1], 10);
    const suf = (tenMatch[2] || '').toLowerCase();
    let months = n;
    if (/^y|yr|year|saal/.test(suf) || suf === 'साल' || suf === 'वर्ष') months = n * 12;
    if (months >= 6 && months <= 84) return { type: 'tenure', value: months };
  }

  // Account number: 8-18 digits
  if (/^\d{8,18}$/.test(trimmed)) return { type: 'accountNumber', value: trimmed };

  // Yes/No/Confirm (expanded for more languages)
  const CONFIRM = new Set([
    'yes', 'y', 'ok', 'okay', 'sure', 'right', 'correct',
    'haan', 'ha', 'haa', 'hain', 'ji', 'sahi', 'theek', 'thik',
    'हाँ', 'हां', 'जी', 'सही',
    'হ্যাঁ', 'হা', 'আছে',                      // bn
    'હા', 'હાં',                                // gu
    'ಹೌದು', 'ಸರಿ',                              // kn
    'അതെ', 'ശരി',                               // ml
    'होय', 'बरोबर',                              // mr
    'ହଁ', 'ଠିକ',                                 // or
    'ਹਾਂ', 'ਸਹੀ',                                // pa
    'ஆம்', 'சரி',                                // ta
    'అవును', 'సరే',                              // te
    'হয়', 'ঠিক',                                 // as
  ]);
  const DENY = new Set([
    'no', 'n', 'nope', 'wrong', 'galat',
    'nahi', 'nai', 'nahin', 'na',
    'नहीं', 'ना', 'गलत',
    'না', 'নেই',
    'ના',
    'ಇಲ್ಲ',
    'ഇല്ല',
    'नाही',
    'ନାହିଁ',
    'ਨਹੀਂ',
    'இல்லை',
    'కాదు',
    'নহয়',
  ]);
  if (CONFIRM.has(lower) || CONFIRM.has(trimmed)) return { type: 'confirm', value: true };
  if (DENY.has(lower) || DENY.has(trimmed)) return { type: 'deny', value: false };

  // Gender
  if (/^(male|m|पुरुष|ਮਰਦ|ஆண்|పురుషుడు|পুরুষ)$/i.test(trimmed)) return { type: 'gender', value: 'male' };
  if (/^(female|f|महिला|ਔਰਤ|பெண்|స్త్రీ|মহিলা)$/i.test(trimmed)) return { type: 'gender', value: 'female' };

  // Occupation keywords
  if (/salaried|salary|naukri|job|private|govt|सैलरी|ನೌಕರಿ/i.test(lower)) return { type: 'occupation', value: 'salaried_private' };
  if (/self.?employed|business|vyapar|dukaan|shop|व्यवसाय|ವ್ಯಾಪಾರ/i.test(lower)) return { type: 'occupation', value: 'self_employed_business' };

  // Default: treat as name/text
  return { type: 'text', value: trimmed };
}

/**
 * FBot step sequence — maps to the loan application flow.
 * Kept ordered so progress (i / N) and back-navigation work correctly.
 */
export const FBOT_STEPS = [
  'welcome',
  'askName',
  'askDob',
  'askPhone',
  'askOtp',
  'askPan',
  'askOccupation',
  'askEmployer',
  'askMonthlyIncome',
  'askLoanAmount',
  'askTenure',
  'askBankDetails',
  'askAccountNumber',
  'kycStart',
  'kycOtp',
  'selfieStart',
  'applicationComplete',
];

/**
 * Progress fraction (0..1) for a given step. Welcome = 0, complete = 1.
 */
export function getProgress(step) {
  const idx = FBOT_STEPS.indexOf(step);
  if (idx < 0) return 0;
  return idx / (FBOT_STEPS.length - 1);
}

/**
 * Label "step X of N" for the current step.
 */
export function getProgressLabel(step, lang = 'en') {
  const idx = FBOT_STEPS.indexOf(step);
  if (idx < 0) return '';
  const total = FBOT_STEPS.length - 1; // exclude 'welcome'
  const current = Math.max(0, idx);
  const prefix = lang === 'hi' ? 'चरण'
    : lang === 'hinglish' ? 'Step'
    : 'Step';
  const joiner = lang === 'hi' ? 'का' : 'of';
  return `${prefix} ${current} ${joiner} ${total}`;
}

/**
 * Previous step (for "back" command). Does not go below index 1 (askName).
 */
export function getPreviousStep(step) {
  const idx = FBOT_STEPS.indexOf(step);
  if (idx <= 1) return FBOT_STEPS[1] || step;
  return FBOT_STEPS[idx - 1];
}

export { LANGUAGES, MESSAGES };
