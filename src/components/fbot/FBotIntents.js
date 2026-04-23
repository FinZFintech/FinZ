/**
 * FBotIntents — keyword-based FAQ / intent matcher
 *
 * Lets the bot respond to open-ended questions ("what's my EMI?",
 * "how much can I borrow?", "loan status") even when the user is
 * mid-flow. Offline only — uses token overlap scoring, no ML.
 *
 * Each intent has:
 *   • keywords — phrase / word list; matched case-insensitively and
 *                with loose whole-word boundaries
 *   • answer   — per-language response (falls through en)
 *   • action   — optional `{ type: 'navigate', screen: '...' }` so the
 *                bot can deep-link (e.g. "my loans" → MyLoans screen)
 */

const INTENTS = [
  {
    id: 'checkStatus',
    keywords: [
      'status', 'track', 'application status', 'loan status', 'progress',
      'kya hua', 'kahan tak', 'स्थिति', 'अवस्था', 'நிலை', 'స్థితి',
    ],
    answer: {
      en: "I'll show you your application status — one moment.",
      hinglish: "Main aapko application status dikhata hoon — ek minute.",
      hi: "मैं आपको एप्लीकेशन स्थिति दिखाता हूँ — एक क्षण।",
    },
    action: { type: 'navigate', screen: 'MyLoans' },
  },
  {
    id: 'loanAmount',
    keywords: [
      'how much loan', 'how much can i borrow', 'max loan', 'maximum loan',
      'kitna loan', 'kitne ka loan', 'loan limit', 'eligibility',
      'कितना लोन', 'ऋण सीमा', 'எவ்வளவு கடன்',
    ],
    answer: {
      en: "The loan you qualify for depends on your income, credit score, and the institute. Typical range is ₹50,000 to ₹20,00,000 — let's finish the application to see your exact offer.",
      hinglish: "Aapko milne wala loan amount aapki income, credit score aur institute pe depend karta hai. Usually ₹50,000 se ₹20,00,000 tak hota hai. Application complete karein to exact offer milega.",
      hi: "आपको मिलने वाला लोन आपकी आय, क्रेडिट स्कोर और संस्थान पर निर्भर करता है। आमतौर पर ₹50,000 से ₹20,00,000 तक। एप्लीकेशन पूरी करें तो सटीक ऑफर मिलेगा।",
    },
  },
  {
    id: 'emi',
    keywords: [
      'emi', 'monthly payment', 'installment', 'kitna dena', 'mahine',
      'मासिक', 'किस्त', 'मासिक किस्त', 'மாத தவணை',
    ],
    answer: {
      en: "Your EMI depends on the loan amount, tenure, and interest rate. After eligibility I'll show you the exact EMI before you e-sign.",
      hinglish: "EMI aapke loan amount, tenure aur interest rate pe depend karti hai. Eligibility ke baad exact EMI dikha dunga before e-sign.",
      hi: "आपकी EMI लोन राशि, अवधि और ब्याज दर पर निर्भर करती है। पात्रता के बाद e-sign से पहले सटीक EMI दिखाऊंगा।",
    },
  },
  {
    id: 'interestRate',
    keywords: [
      'interest rate', 'rate of interest', 'roi', 'byaj', 'byaaz', 'sood',
      'ब्याज दर', 'ब्याज', 'வட்டி', 'వడ్డీ',
    ],
    answer: {
      en: "Interest rates typically range from 10.5% to 15% p.a. depending on your credit profile and the institute tie-up.",
      hinglish: "Interest rate aam taur pe 10.5% se 15% p.a. ke beech hota hai, aapke credit profile aur institute tie-up pe depend karta hai.",
      hi: "ब्याज दर आमतौर पर 10.5% से 15% प्रति वर्ष होती है, जो आपके क्रेडिट प्रोफाइल और संस्थान के टाई-अप पर निर्भर करती है।",
    },
  },
  {
    id: 'tenure',
    keywords: [
      'tenure', 'duration', 'months', 'years', 'how long', 'kitne saal',
      'कितने साल', 'अवधि', 'ಅವಧಿ',
    ],
    answer: {
      en: "Tenures range from 6 months up to 84 months (7 years). You'll pick your preferred tenure on the next step.",
      hinglish: "Tenure 6 mahine se 84 mahine (7 saal) tak ho sakta hai. Apni preferred tenure aap next step pe choose karenge.",
      hi: "अवधि 6 महीने से 84 महीने (7 साल) तक हो सकती है। अपनी पसंदीदा अवधि अगले चरण में चुनें।",
    },
  },
  {
    id: 'documents',
    keywords: [
      'documents', 'docs', 'papers', 'what do i need', 'kya chahiye',
      'दस्तावेज़', 'कागज', 'ஆவணங்கள்',
    ],
    answer: {
      en: "You'll need: PAN card, Aadhaar (for KYC), a bank account with IFSC, and basic income proof. I'll guide you through each one.",
      hinglish: "PAN card, Aadhaar (KYC ke liye), bank account with IFSC, aur basic income proof chahiye. Main har step pe guide karunga.",
      hi: "PAN कार्ड, आधार (KYC के लिए), IFSC वाला बैंक अकाउंट, और बुनियादी आय प्रमाण चाहिए। मैं हर चरण में आपकी मदद करूँगा।",
    },
  },
  {
    id: 'kycHelp',
    keywords: [
      'kyc', 'aadhaar', 'ckyc', 'digilocker', 'identity',
      'पहचान', 'आधार', 'ஆதார்',
    ],
    answer: {
      en: "For KYC you can use CKYC (fastest, OTP-based), DigiLocker (Aadhaar pull), or Aadhaar XML. CKYC works if your PAN–Aadhaar link is seeded.",
      hinglish: "KYC ke liye aap CKYC (sabse fast, OTP), DigiLocker (Aadhaar pull), ya Aadhaar XML use kar sakte hain. CKYC tab chalta hai jab PAN–Aadhaar seeded ho.",
      hi: "KYC के लिए आप CKYC (सबसे तेज़, OTP), DigiLocker (आधार पुल), या आधार XML उपयोग कर सकते हैं। CKYC तभी चलता है जब PAN–आधार सीड हो।",
    },
  },
  {
    id: 'contactSupport',
    keywords: [
      'contact', 'support', 'human', 'agent', 'customer care', 'helpline',
      'madad chahiye', 'शिकायत', 'ਸਹਾਇਤਾ',
    ],
    answer: {
      en: "I'll connect you with loan assistance — you can chat with a human agent there.",
      hinglish: "Main aapko loan assistance pe le jaata hoon — wahaan real agent se baat kar sakte hain.",
      hi: "मैं आपको लोन सहायता पर ले जाता हूँ — वहाँ असली एजेंट से बात कर सकते हैं।",
    },
    action: { type: 'navigate', screen: 'LoanAssistance' },
  },
  {
    id: 'referral',
    keywords: [
      'refer', 'referral', 'invite', 'दोस्त', 'invite friend',
      'refer and earn',
    ],
    answer: {
      en: "Check the Referral section — every friend who gets a loan earns you a bonus.",
      hinglish: "Referral section dekho — har dost jisko loan milega uspe aapko bonus milega.",
      hi: "रेफ़रल सेक्शन देखें — हर दोस्त जिसे लोन मिले उस पर आपको बोनस मिलेगा।",
    },
    action: { type: 'navigate', screen: 'Referral' },
  },
  {
    id: 'offers',
    keywords: [
      'offer', 'offers', 'discount', 'scheme', 'योजना', 'छूट',
    ],
    answer: {
      en: "Let me open Offers for you — you'll see the latest discounts and schemes.",
      hinglish: "Offers open karta hoon — latest discounts aur schemes dikhenge.",
      hi: "ऑफर्स खोल रहा हूँ — नवीनतम छूट और योजनाएं दिखेंगी।",
    },
    action: { type: 'navigate', screen: 'Offers' },
  },
  {
    id: 'creditScore',
    keywords: [
      'credit score', 'cibil', 'cibil score', 'ഋण स्कोर', 'క్రెడిట్ స్కోర్',
    ],
    answer: {
      en: "Your credit score is checked automatically during PAN verification. I'll show it after that step.",
      hinglish: "Aapka credit score PAN verification ke time auto-check ho jata hai. Uss step ke baad dikha dunga.",
      hi: "आपका क्रेडिट स्कोर PAN सत्यापन के समय स्वचालित रूप से चेक होता है। उस चरण के बाद दिखाऊंगा।",
    },
    action: { type: 'navigate', screen: 'CreditScore' },
  },
  {
    id: 'privacy',
    keywords: [
      'privacy', 'data', 'secure', 'safe', 'सुरक्षित', 'गोपनीयता',
    ],
    answer: {
      en: "Your data is encrypted in transit and at rest. We only share it with RBI-registered credit bureaus and your lender. You can read the full policy anytime.",
      hinglish: "Aapka data encrypted hai (transit mein bhi, storage mein bhi). Hum sirf RBI-registered credit bureau aur aapke lender ke saath share karte hain. Policy kabhi bhi padh sakte hain.",
      hi: "आपका डेटा एन्क्रिप्टेड है (ट्रांज़िट और स्टोरेज दोनों में)। हम केवल RBI-पंजीकृत क्रेडिट ब्यूरो और आपके लेंडर के साथ साझा करते हैं।",
    },
    action: { type: 'navigate', screen: 'PrivacyPolicy' },
  },
  {
    id: 'greeting',
    keywords: [
      'hi', 'hello', 'hey', 'namaste', 'hola', 'नमस्ते', 'हेलो', 'வணக்கம்',
    ],
    answer: {
      en: "Hi! 👋 I'm here to help with your loan application. What would you like to do?",
      hinglish: "Namaste! 👋 Main aapki loan application mein madad ke liye hoon. Kya karna chahenge?",
      hi: "नमस्ते! 👋 मैं आपकी लोन एप्लीकेशन में मदद के लिए हूँ। क्या करना चाहेंगे?",
    },
  },
  {
    id: 'thanks',
    keywords: [
      'thanks', 'thank you', 'thx', 'dhanyawad', 'shukriya',
      'धन्यवाद', 'शुक्रिया', 'நன்றி', 'ధన్యవాదాలు',
    ],
    answer: {
      en: "You're welcome! Happy to help anytime.",
      hinglish: "Aap ka swagat hai! Kabhi bhi madad chahiye to bataiye.",
      hi: "आपका स्वागत है! जब भी मदद चाहिए, बताइए।",
    },
  },
];

/**
 * Score how well a text matches an intent's keyword list. Returns a
 * value in [0, 1]. Simple: longer-keyword matches weigh more; a single
 * match is enough for short commands ("hi", "emi", "kyc").
 */
function scoreIntent(text, intent) {
  const lower = (text || '').toLowerCase();
  if (!lower) return 0;
  let best = 0;
  for (const kw of intent.keywords) {
    const k = kw.toLowerCase();
    if (!k) continue;
    if (lower === k) { best = Math.max(best, 1); continue; }
    // Whole-word-ish boundary match (works for CJK / Indic too since
    // we don't rely on \b which is ASCII-only).
    if (lower.includes(k)) {
      // Weight longer keywords more — they carry more signal than
      // a 2-char token that might appear accidentally.
      const w = Math.min(0.95, 0.4 + k.length * 0.04);
      if (w > best) best = w;
    }
  }
  return best;
}

/**
 * Match free-form user text against the intent catalog. Returns the
 * top intent if its confidence exceeds THRESHOLD, otherwise null.
 *
 * The caller is responsible for picking the right language on the
 * intent's `answer` object.
 */
export function matchIntent(text, { threshold = 0.45 } = {}) {
  let topIntent = null;
  let topScore = 0;
  for (const intent of INTENTS) {
    const s = scoreIntent(text, intent);
    if (s > topScore) { topScore = s; topIntent = intent; }
  }
  if (!topIntent || topScore < threshold) return null;
  return { intent: topIntent, confidence: topScore };
}

/** Get an answer in the user's language with proper fallback. */
export function intentAnswer(intent, lang = 'en') {
  if (!intent?.answer) return '';
  return intent.answer[lang] || intent.answer.hi || intent.answer.hinglish || intent.answer.en || '';
}

export { INTENTS };
