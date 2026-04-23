import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Animated, Dimensions, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../store/ThemeContext';
import { useLoan } from '../../store/LoanContext';
import { useAuth } from '../../store/AuthContext';
import { smsService } from '../../services/smsService';
import { kycService } from '../../services/kycService';
import { signzyService } from '../../services/signzyService';
import { bankService } from '../../services/bankService';
import { loanService } from '../../services/loanService';
import {
  getMessage, detectInputType, LANGUAGES, FBOT_STEPS,
  getProgress, getProgressLabel, getPreviousStep,
} from './FBotEngine';
import { useFBot } from './FBotContext';
import {
  loadMemory, remember, recall, rememberCorrection, recallCorrection,
  logChipTap, reorderChipsByTaps, logIntent, intentFrequency, clearMemory,
} from './FBotMemory';
import { matchIntent, intentAnswer } from './FBotIntents';

const { height: SCREEN_H } = Dimensions.get('window');
const BOT_AVATAR = '🤖';
const USER_AVATAR = '👤';
const STORAGE_KEY = 'fbot_state_v2';
const MAX_HISTORY = 80; // cap saved messages to keep AsyncStorage lean

// Chip labels per language. Fallback: en.
const CHIP_LABELS = {
  yes:     { en: 'Yes',     hi: 'हाँ',     hinglish: 'Haan' },
  no:      { en: 'No',      hi: 'नहीं',    hinglish: 'Nahi' },
  skip:    { en: 'Skip',    hi: 'छोड़ें',  hinglish: 'Skip' },
  back:    { en: 'Back',    hi: 'पीछे',    hinglish: 'Wapas' },
  help:    { en: 'Help',    hi: 'मदद',     hinglish: 'Madad' },
  restart: { en: 'Restart', hi: 'फिर से',  hinglish: 'Restart' },
  salaried:     { en: 'Salaried',      hi: 'वेतनभोगी',  hinglish: 'Salaried' },
  selfEmployed: { en: 'Self-employed', hi: 'स्व-नियोजित', hinglish: 'Self-employed' },
  continueApp:  { en: 'Continue',      hi: 'जारी रखें',  hinglish: 'Continue' },
  startNew:     { en: 'Start new',     hi: 'नई शुरू करें', hinglish: 'Nayi start' },
  somethingElse:{ en: 'Something else', hi: 'कुछ और',     hinglish: 'Kuch aur' },
  resendOtp:    { en: 'Resend OTP',    hi: 'OTP फिर भेजें', hinglish: 'Resend OTP' },
  student:      { en: 'Student',       hi: 'छात्र',      hinglish: 'Student' },
  parent:       { en: 'Parent / Guardian', hi: 'माता-पिता', hinglish: 'Parent' },
  father:       { en: 'Father',        hi: 'पिता',       hinglish: 'Father' },
  mother:       { en: 'Mother',        hi: 'माता',       hinglish: 'Mother' },
  guardian:     { en: 'Guardian',      hi: 'संरक्षक',    hinglish: 'Guardian' },
};
const L = (key, lang) => CHIP_LABELS[key]?.[lang] || CHIP_LABELS[key]?.en || key;

// Context-sensitive chips per step. Returns an array of { label, value } pairs.
function quickRepliesForStep(step, lang) {
  const lg = lang || 'en';
  const base = [
    { label: L('help', lg), value: 'help' },
    { label: L('back', lg), value: 'back' },
    { label: L('restart', lg), value: 'restart' },
  ];
  switch (step) {
    case 'askStart':
      return [
        { label: L('continueApp', lg), value: 'continue' },
        { label: L('startNew', lg), value: 'start new' },
        { label: L('somethingElse', lg), value: 'something else' },
        { label: L('help', lg), value: 'help' },
      ];
    case 'askBorrowerType':
      return [
        { label: L('student', lg), value: 'student' },
        { label: L('parent', lg), value: 'parent' },
        { label: L('help', lg), value: 'help' },
        { label: L('back', lg), value: 'back' },
      ];
    case 'askRelationship':
      return [
        { label: L('father', lg), value: 'father' },
        { label: L('mother', lg), value: 'mother' },
        { label: L('guardian', lg), value: 'guardian' },
        { label: L('back', lg), value: 'back' },
      ];
    case 'askOtp':
    case 'kycOtp':
      return [
        { label: L('resendOtp', lg), value: 'resend otp' },
        { label: L('help', lg), value: 'help' },
        { label: L('back', lg), value: 'back' },
      ];
    case 'welcome':
    case 'askName':
      return [
        { label: L('yes', lg), value: 'yes' },
        { label: L('no', lg), value: 'no' },
        ...base,
      ];
    case 'askEmployerConfirm':
      return [
        { label: L('yes', lg), value: 'yes' },
        { label: L('no', lg), value: 'no' },
        ...base,
      ];
    case 'askOccupation':
      return [
        { label: L('salaried', lg), value: 'salaried' },
        { label: L('selfEmployed', lg), value: 'self employed' },
        ...base,
      ];
    case 'askPan':
    case 'askBankDetails':
    case 'kycStart':
      return [
        { label: L('yes', lg), value: 'yes' },
        { label: L('no', lg), value: 'no' },
        { label: L('skip', lg), value: 'skip' },
        ...base,
      ];
    default:
      return [{ label: L('skip', lg), value: 'skip' }, ...base];
  }
}

const renderQuickReplies = ({ currentStep, lang, onPress, colors }) => {
  // Reorder the default chip set so chips this user taps more often
  // appear first. Stable for untapped chips — no learning-induced
  // flicker on fresh installs.
  const defaultChips = quickRepliesForStep(currentStep, lang);
  const chips = reorderChipsByTaps(currentStep, defaultChips);
  return (
    <View style={{ height: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' }}
      >
        {chips.map((c) => (
          <TouchableOpacity
            key={c.value}
            onPress={() => { logChipTap(currentStep, c.value); onPress(c.value); }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.teal,
              backgroundColor: `${colors.teal}12`,
              marginRight: 6,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Maps an FBot intent (SET_NAME, SET_PHONE, VERIFY_PAN, ...) onto a
// LoanContext dispatch. Kept outside the component so it doesn't rebind
// on every render.
const dispatchLoanUpdate = (dispatch, action) => {
  if (!dispatch || !action || !action.type) return;
  switch (action.type) {
    case 'SET_NAME':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { name: action.value } });
      return;
    case 'SET_DOB':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { dob: action.value } });
      return;
    case 'SET_PHONE':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { phone: action.value } });
      return;
    case 'VERIFY_PAN':
      dispatch({ type: 'SET_PAN', payload: { panNumber: action.value, verified: true } });
      return;
    case 'SET_OCCUPATION':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { occupation: action.value } });
      return;
    case 'SET_EMPLOYER':
      dispatch({ type: 'SET_BORROWER_DETAILS', payload: { employer: action.value } });
      return;
    case 'SET_MONTHLY_INCOME':
      dispatch({ type: 'SET_INCOME', payload: { monthlyIncome: action.value } });
      return;
    case 'SET_LOAN_AMOUNT':
      dispatch({ type: 'SET_PRODUCT', payload: { requestedAmount: action.value } });
      return;
    case 'SET_TENURE':
      dispatch({ type: 'SET_TENURE', payload: action.value });
      return;
    case 'SET_IFSC':
      dispatch({ type: 'SET_BANK_DETAILS', payload: { ifsc: action.value } });
      return;
    case 'SET_ACCOUNT':
      dispatch({ type: 'SET_BANK_DETAILS', payload: { accountNumber: action.value } });
      return;
    case 'VERIFY_BANK':
      dispatch({ type: 'SET_PENNY_DROP', payload: { verified: true } });
      return;
    case 'SET_LOAN_TYPE':
      dispatch({ type: 'SET_LOAN_TYPE', payload: action.value });
      return;
    default:
      // OTP / KYC_OTP / SELFIE side-effects are handled by the mounted
      // screen's listener via FBotContext; no direct state update here.
      return;
  }
};

// Screens nested inside HomeStack (see AppNavigator). Navigating to these
// from a different tab requires going through the 'Home' tab first, i.e.
// navigation.navigate('Home', { screen: 'PanVerification' }). Using a bare
// navigate('PanVerification') from e.g. ApplyTab silently fails and the
// screen never mounts — so the bot's listener never fires and APIs are
// never called.
const HOME_STACK_SCREENS = new Set([
  'InstituteSelection',
  'StudentDetails',
  'BorrowerSelection',
  'PanVerification',
  'IncomeVerification',
  'KycVerification',
  'SelfieVerification',
  'BankDetails',
  'VkycScreen',
  'EnachEsign',
  'LoanSuccess',
]);

// Route an FBot step to the customer-facing screen that collects that step's
// data. Used so the bot can navigate the user to the right screen when a
// step begins (e.g. when we reach askPan, open the PAN screen).
const screenForStep = (step) => {
  switch (step) {
    case 'askInstitute':
      return 'InstituteSelection';
    case 'askRegNo':
    case 'askStudentConfirm':
      return 'StudentDetails';
    case 'askBorrowerType':
    case 'askRelationship':
    case 'askName':
    case 'askPhone':
    case 'askOtp':
      return 'BorrowerSelection';
    case 'askPan':
      return 'PanVerification';
    case 'askEmployerConfirm':
    case 'askOccupation':
    case 'askEmployer':
    case 'askMonthlyIncome':
    case 'askLoanAmount':
    case 'askTenure':
    case 'askBankDetails':
    case 'askAccountNumber':
      return 'IncomeVerification';
    case 'kycStart':
    case 'kycOtp':
      return 'KycVerification';
    case 'selfieStart':
      return 'SelfieVerification';
    case 'applicationComplete':
      return 'EnachEsign';
    default:
      return null;
  }
};

const FBot = () => {
  const { postAction } = useFBot();
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { user } = useAuth();
  const navigation = useNavigation();

  // Every FBot action: (1) update persistent loan state, (2) notify any
  // mounted screen listener so it can auto-fill/auto-submit, and (3) pipe
  // the key facts into memory so the bot can pre-fill them next session.
  const onAction = useCallback((action) => {
    dispatchLoanUpdate(dispatch, action);
    postAction(action);
    switch (action?.type) {
      case 'SET_NAME':        if (action.value) remember('userName', action.value); break;
      case 'SET_DOB':         if (action.value) remember('userDob', action.value); break;
      case 'SET_PHONE':       if (action.value) remember('userPhone', action.value); break;
      case 'SET_OCCUPATION':  if (action.value) remember('userOccupation', action.value); break;
      case 'SET_EMPLOYER':    if (action.value) remember('userEmployer', action.value); break;
      case 'SET_MONTHLY_INCOME': if (action.value) remember('userMonthlyIncome', action.value); break;
      case 'SET_IFSC':        if (action.value) remember('userIfsc', action.value); break;
    }
  }, [dispatch, postAction]);

  // Navigate to a screen robustly across tabs. Loan-flow screens live
  // inside the Home tab's stack; from any other tab, the correct call is
  // navigate('Home', { screen: X }). Plain navigate(X) silently fails
  // there, which is why bot listeners weren't firing and APIs weren't
  // being triggered when the user chatted from another tab.
  const safeNavigate = useCallback((screen) => {
    if (!screen || !navigation?.navigate) return;
    if (HOME_STACK_SCREENS.has(screen)) {
      try {
        navigation.navigate('Home', { screen });
        return;
      } catch (_) { /* fall through */ }
    }
    try {
      navigation.navigate(screen);
    } catch (_) {
      try { navigation.navigate('Home', { screen }); } catch (_) {}
    }
  }, [navigation]);
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentStep, setCurrentStep] = useState('welcome');
  const [typing, setTyping] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const flatListRef = useRef(null);
  // Holds CKYC initiation handles between kycStart (sendOtp) and kycOtp
  // (validateOtp). Stored on a ref rather than state so React doesn't
  // re-render on every mutation and so stale-closure issues around the
  // async OTP flow don't drop the requestId.
  const ckycRef = useRef({ requestId: '', referenceNo: '' });
  // Institute search results the user is choosing from (askInstitute → pick).
  const instituteSearchRef = useRef([]);
  const [minimized, setMinimized] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showLangSwitcher, setShowLangSwitcher] = useState(false);

  // Localized validation error message helper
  const invalid = (key) => getMessage(key, lang || 'en');

  // ─── Persistence: load saved state on mount ────────────────────────────
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      loadMemory(),
    ]).then(([raw, mem]) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.lang) setLang(saved.lang);
          if (Array.isArray(saved.messages)) setMessages(saved.messages);
          if (saved.currentStep) setCurrentStep(saved.currentStep);
        } catch (_) { /* ignore */ }
      }
      // If we don't have a language in the session snapshot but memory
      // remembers one from a past session, adopt it so the user doesn't
      // have to re-pick it.
      if (!mem) { /* memory unavailable */ }
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, []);

  // Remember language every time it changes so a fresh install /
  // cleared session restores it.
  useEffect(() => {
    if (lang) remember('preferredLanguage', lang);
  }, [lang]);

  // Persist on change (after hydration, to avoid overwriting with defaults)
  useEffect(() => {
    if (!hydrated) return;
    const snapshot = {
      lang,
      currentStep,
      messages: messages.slice(-MAX_HISTORY),
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, [lang, currentStep, messages, hydrated]);

  const addBotMessage = useCallback((text, options = {}) => {
    setTyping(true);
    setTimeout(() => {
      const now = Date.now();
      setMessages((prev) => [...prev, {
        id: `bot_${now}_${Math.random()}`,
        from: 'bot',
        text,
        at: now,
        time: new Date(now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        ...options,
      }]);
      setTyping(false);
      // Bump unread when panel isn't showing messages
      setUnread((u) => (!visible || minimized ? u + 1 : 0));
    }, 600 + Math.random() * 400);
  }, [visible, minimized]);

  // Clear unread when panel opens (and is not minimized)
  useEffect(() => {
    if (visible && !minimized) setUnread(0);
  }, [visible, minimized]);

  const addUserMessage = useCallback((text) => {
    const now = Date.now();
    setMessages((prev) => [...prev, {
      id: `user_${now}`,
      from: 'user',
      text,
      at: now,
      time: new Date(now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }]);
  }, []);

  // Show/hide animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  // Every time the panel opens after hydration, offer the continue /
  // start-new / help choice — but only when the conversation is
  // genuinely idle. If the user is mid-flow (asked for loan amount,
  // OTP, bank details etc.) dropping a "welcome back" banner on them
  // is disruptive, so we gate on:
  //   - currentStep is a resting state (welcome / askStart / applicationComplete), OR
  //   - no prior messages, OR
  //   - last message is older than IDLE_PROMPT_MS (10 minutes)
  // Fires at most once per panel open thanks to openPromptRef.
  const IDLE_PROMPT_MS = 10 * 60 * 1000;
  const openPromptRef = useRef(false);
  useEffect(() => {
    if (!visible || !hydrated || !lang) { openPromptRef.current = false; return; }
    if (openPromptRef.current) return;
    openPromptRef.current = true;

    const restingSteps = new Set(['welcome', 'askStart', 'applicationComplete']);
    const restingStep = restingSteps.has(currentStep);
    let lastAt = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.at || messages[i]?.time) {
        // messages[].time is a display string — use Date.now() as a
        // fallback; we primarily track freshness via message count /
        // resting-step for persisted conversations.
        lastAt = messages[i].at || 0;
        break;
      }
    }
    const stale = !lastAt || (Date.now() - lastAt) > IDLE_PROMPT_MS;
    if (!restingStep && !stale && messages.length > 0) return;

    const lg = lang;
    const prompt = hasActiveApplication()
      ? {
          en: "Welcome back. Would you like to continue your application, start a new one, or ask me something else?",
          hinglish: "Wapas aane ke liye shukriya. Application continue karein, nayi start karein, ya kuch aur poochein?",
          hi: "वापस आने के लिए धन्यवाद। एप्लीकेशन जारी रखें, नई शुरू करें, या कुछ और पूछें?",
        }
      : {
          en: "Shall we start a new loan application, or do you need help with something?",
          hinglish: "Nayi loan application start karein, ya kuch aur madad chahiye?",
          hi: "नई एप्लीकेशन शुरू करें, या कुछ और मदद चाहिए?",
        };
    addBotMessage(prompt[lg] || prompt.hinglish);
    setCurrentStep('askStart');
  }, [visible, hydrated, lang]);

  // Auto-scroll to bottom whenever messages change, on typing updates, and
  // — importantly — after the panel opens from a collapsed state with
  // hydrated history, so the user sees the last message, not the first.
  useEffect(() => {
    if (!visible || minimized) return;
    const t1 = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
    const t2 = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 250);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [messages, typing, visible, minimized, hydrated]);

  // Start conversation when language is selected
  // Static translations for bot prompts that aren't in the engine's MESSAGES
  // map (kept here to avoid shuttling tiny strings back through the engine).
  const tr = (key) => {
    const lg = lang || 'en';
    const lines = {
      askStart: {
        en: "I can help you start a new loan application — shall we begin?",
        hinglish: "Main ek nayi loan application start karne mein madad kar sakta hoon — shuru karein?",
        hi: "मैं एक नई लोन एप्लीकेशन शुरू करने में मदद कर सकता हूँ — शुरू करें?",
      },
      startedApp: {
        en: "Starting a new education loan application for you. 🚀",
        hinglish: "Aapke liye nayi education loan application start kar raha hoon. 🚀",
        hi: "आपके लिए एक नई एजुकेशन लोन एप्लीकेशन शुरू कर रहा हूँ। 🚀",
      },
      openingScreen: {
        en: "Opening the next screen for you...",
        hinglish: "Aapke liye next screen open kar raha hoon...",
        hi: "आपके लिए अगली स्क्रीन खोल रहा हूँ...",
      },
      noThanks: {
        en: "No problem — you can ask me anytime to start or continue.",
        hinglish: "Koi baat nahi — kabhi bhi shuru karne ke liye kah dein.",
        hi: "कोई बात नहीं — कभी भी शुरू करने के लिए कह दें।",
      },
    };
    return lines[key]?.[lg] || lines[key]?.hinglish || lines[key]?.en || '';
  };

  // True if the user has an application the bot can resume into. Excludes
  // terminal (submitted / disbursed / closed), rejected (credit_check_failed /
  // kyc_failed / not_eligible) and explicitly-discarded drafts so that a
  // user who's wiped their last app gets offered "start new" rather than
  // a broken "continue".
  const hasActiveApplication = () => {
    const dead = new Set([
      'submitted', 'disbursed', 'active', 'closed',
      'credit_check_failed', 'kyc_failed', 'not_eligible',
      'discarded',
    ]);
    if (state.status && dead.has(state.status)) return false;
    return !!(state.loanType || state.instituteDetails || state.borrowerDetails);
  };

  // Inspect the live loan state and return the bot step that corresponds
  // to the first piece of data still missing. Mirrors the real loan-screen
  // flow so the bot doesn't ask for things the user has already provided.
  //
  // Education-loan funnel now stays entirely in chat — no more "needs
  // institute, opening screen" hand-offs — so askInstitute / askRegNo
  // collect institute + student details directly.
  const nextStepFromState = () => {
    if (!state.loanType) return 'askStart';
    if (!state.instituteDetails && state.loanType === 'education') return 'askInstitute';
    if (!state.studentDetails && state.loanType === 'education') return 'askRegNo';

    // Borrower type gates the rest — without it we don't know whether
    // the loan is student-self or parent/guardian. Education loans only.
    if (state.loanType === 'education' && !state.borrowerType) return 'askBorrowerType';
    if (state.loanType === 'education' && state.borrowerType === 'parent' && !state.borrowerDetails?.relationship) {
      return 'askRelationship';
    }

    const b = state.borrowerDetails || {};
    if (!b.name) return 'askName';
    // DOB is not chat-collected — it's auto-fetched when the PAN API
    // resolves during PAN verification, so we skip it in the bot flow.
    if (!b.phone) return 'askPhone';

    if (!state.panDetails?.panNumber) return 'askPan';
    // If EPFO already pre-filled occupation + employer we don't need to
    // ask separately; just confirm monthly income.
    if (!b.occupation) return 'askOccupation';
    if (!b.employer) return 'askEmployer';
    if (!state.incomeData?.monthlyIncome && !b.monthlyIncome) return 'askMonthlyIncome';
    if (!state.selectedProduct?.requestedAmount) return 'askLoanAmount';
    if (!state.selectedTenure) return 'askTenure';
    if (!state.bankDetails?.ifsc) return 'askBankDetails';
    if (!state.bankDetails?.accountNumber) return 'askAccountNumber';

    if (!state.kycData || !state.kycMethod) return 'kycStart';

    // Loan amount decides selfie vs vkyc. Bot's job stops at selfie — VKYC
    // happens inside the EnachEsign screen which the user must reach via
    // the normal flow.
    const amt = state.selectedProduct?.requestedAmount
      || state.selectedProduct?.amount
      || state.studentDetails?.balanceFee
      || 0;
    if (amt < 60000 && !state.selfieData?.matched) return 'selfieStart';

    return 'applicationComplete';
  };

  // A one-liner that tells the user what's already done and what's next.
  // Shown when resuming a returning user into their application.
  const progressSummary = (l) => {
    const done = [];
    if (state.instituteDetails) done.push(l === 'hi' ? 'संस्थान' : l === 'en' ? 'institute' : 'institute');
    if (state.borrowerDetails?.name) done.push(l === 'hi' ? 'नाम' : l === 'en' ? 'name' : 'naam');
    if (state.panDetails?.panNumber) done.push('PAN');
    if (state.incomeData) done.push(l === 'hi' ? 'आय' : l === 'en' ? 'income' : 'income');
    if (state.bankDetails?.ifsc) done.push(l === 'hi' ? 'बैंक' : l === 'en' ? 'bank' : 'bank');
    if (state.kycData) done.push('KYC');
    if (state.selfieData?.matched) done.push(l === 'hi' ? 'सेल्फी' : l === 'en' ? 'selfie' : 'selfie');
    if (done.length === 0) return '';
    if (l === 'hi') return `आपने अब तक ${done.join(', ')} पूरा किया है। ✅`;
    if (l === 'en') return `You've already completed: ${done.join(', ')}. ✅`;
    return `Aapne ab tak complete kiya: ${done.join(', ')}. ✅`;
  };

  // Resume an existing application by jumping the conversation to the
  // first truly-missing field. Summarizes what's already done so the user
  // has context, then either asks for the next field or hands the user to
  // a screen (institute / student details) that can't be chat-collected.
  const resumeFromState = () => {
    const l = lang || 'en';
    const summary = progressSummary(l);
    if (summary) addBotMessage(summary);

    const next = nextStepFromState();

    // Institute and student details are screen-only — tell the user and
    // navigate them there. The screens already auto-forward to the next
    // stage on completion, so flow continues without the bot.
    if (next === 'applicationComplete') {
      // Everything the bot can collect is done. Don't re-run the generic
      // summary (which would be wrong post-completion and then follow with
      // an empty prompt). Offer the most useful follow-ups: check status,
      // get help, start a fresh application.
      const done = {
        en: "Your application is complete — nothing more to fill. 🎉 Would you like to check status, talk to support, or start a new application?",
        hinglish: "Aapki application complete hai — ab kuch nahi bharna hai. 🎉 Status check karna ho, support se baat karna ho, ya nayi application start karna ho?",
        hi: "आपकी एप्लीकेशन पूरी हो चुकी है — अब कुछ नहीं भरना। 🎉 स्थिति देखें, सहायता से बात करें, या नई एप्लीकेशन शुरू करें?",
      };
      addBotMessage(done[l] || done.hinglish);
      setCurrentStep('applicationComplete');
      return;
    }

    // Normal resumption: jump to the missing step and ask for it.
    setCurrentStep(next);
    const prefillName = state.borrowerDetails?.name || user?.name || recall('userName') || '';
    const prompt = next === 'askName' && prefillName
      ? getMessage('askName', l, { prefillName })
      : getMessage(next, l);
    if (prompt) setTimeout(() => addBotMessage(prompt), 500);
    const targetScreen = screenForStep(next);
    if (targetScreen) safeNavigate(targetScreen);
  };

  // Kick off a new application on the user's behalf: pick a default loan
  // type, dispatch it, announce it, then hand the user to InstituteSelection
  // so they can pick their institute. Everything else in the funnel is
  // chat-collectable, but institute / student details need their own screens.
  const startNewApplication = () => {
    const l = lang || 'en';
    onAction({ type: 'SET_LOAN_TYPE', value: 'education' });
    addBotMessage(tr('startedApp'));
    // Stay in chat. Ask for the institute directly — loanService.getInstitutes
    // returns matches we can present as chips.
    const prompt = {
      en: "Which college / institute is the student studying in? (Type a name or city to search)",
      hinglish: "Student kis college / institute mein hai? (Naam ya city type karein)",
      hi: "छात्र किस कॉलेज / संस्थान में पढ़ रहा है? (नाम या शहर टाइप करें)",
    };
    setTimeout(() => {
      addBotMessage(prompt[l] || prompt.hinglish);
      setCurrentStep('askInstitute');
    }, 800);
  };

  // Personalized welcome-back line used when memory remembers the user.
  // Kept inline (not in MESSAGES) to avoid shuttling user names through
  // the translation layer.
  const welcomeBackLine = (langCode, name) => {
    const lines = {
      en: `Welcome back${name ? ', ' + name : ''}! 👋 How can I help you today?`,
      hinglish: `Wapas aane ke liye shukriya${name ? ', ' + name : ''}! 👋 Aaj main kaise madad karoon?`,
      hi: `वापस आने के लिए स्वागत है${name ? ', ' + name : ''}! 👋 आज मैं कैसे मदद करूँ?`,
    };
    return lines[langCode] || lines.hinglish;
  };

  const selectLanguage = (langCode, { greet = true } = {}) => {
    setLang(langCode);
    setShowLangSwitcher(false);
    if (!greet) return;

    // Returning user? Greet by name instead of the generic welcome.
    const rememberedName = recall('userName');
    if (rememberedName) {
      addBotMessage(welcomeBackLine(langCode, rememberedName));
    } else {
      addBotMessage(getMessage('welcome', langCode));
    }
    setTimeout(() => {
      // Always enter askStart. For returning users we show three
      // choices (continue / start-new / help); new users just get
      // the start prompt. The chip set for askStart below mirrors
      // these options so the user can tap rather than type.
      const lg = langCode;
      const promptLines = hasActiveApplication()
        ? {
            en: "You have an application in progress. Would you like to continue it, start a new one, or get help with something else?",
            hinglish: "Aapki ek application chal rahi hai. Continue karein, nayi start karein, ya kuch aur madad chahiye?",
            hi: "आपकी एक एप्लीकेशन चल रही है। क्या उसे जारी रखें, नई शुरू करें, या कुछ और मदद चाहिए?",
          }
        : {
            en: "I can help you start a new loan application — shall we begin?",
            hinglish: "Main ek nayi loan application start karne mein madad kar sakta hoon — shuru karein?",
            hi: "मैं एक नई लोन एप्लीकेशन शुरू करने में मदद कर सकता हूँ — शुरू करें?",
          };
      addBotMessage(promptLines[lg] || promptLines.hinglish);
      setCurrentStep('askStart');
    }, 1200);
  };

  // Restart the conversation from scratch
  const restartConversation = () => {
    const l = lang || 'en';
    setMessages([]);
    setCurrentStep('welcome');
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    addBotMessage(getMessage('restarted', l));
    setTimeout(() => {
      const prefillName = state.borrowerDetails?.name || user?.name || '';
      addBotMessage(prefillName
        ? getMessage('askName', l, { prefillName })
        : getMessage('askNameFresh', l));
      setCurrentStep('askName');
      safeNavigate(screenForStep('askName'));
    }, 800);
  };

  // Send from quick-reply chip (skips re-typing)
  const sendText = (text) => {
    if (!text) return;
    addUserMessage(text);
    const detected = detectInputType(text);
    handleDetected(detected, text);
  };

  // Process user input
  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addUserMessage(text);
    const detected = detectInputType(text);
    handleDetected(detected, text);
  };

  const handleDetected = (detected, rawText) => {
    const l = lang || 'en';

    if (detected.type === 'help') {
      addBotMessage(getMessage('help', l));
      return;
    }
    if (detected.type === 'restart') {
      restartConversation();
      return;
    }
    if (detected.type === 'back') {
      const prev = getPreviousStep(currentStep);
      setCurrentStep(prev);
      addBotMessage(getMessage('backStep', l));
      setTimeout(() => addBotMessage(getMessage(prev, l) || ''), 500);
      return;
    }
    if (detected.type === 'skip') {
      // Move forward one step without storing data
      const idx = FBOT_STEPS.indexOf(currentStep);
      const next = FBOT_STEPS[Math.min(idx + 1, FBOT_STEPS.length - 1)];
      setCurrentStep(next);
      addBotMessage(getMessage(next, l) || '');
      return;
    }

    // ── Intent matching ───────────────────────────────────────────────
    // For open-ended free text (not a recognized form field), try to
    // match an FAQ intent. If confidence is high enough, answer it
    // without disrupting the current flow. Intents can also navigate
    // (e.g. "my status" → MyLoans screen).
    //
    // Skipped when the step is actively collecting text data (askName,
    // askEmployer) — in those cases the user is meant to provide a
    // value, not ask a question.
    const stepWantsText = ['askName', 'askEmployer'].includes(currentStep);
    if (detected.type === 'text' && !stepWantsText) {
      const match = matchIntent(rawText);
      if (match) {
        const answer = intentAnswer(match.intent, l);
        if (answer) addBotMessage(answer);
        logIntent(match.intent.id, rawText);
        if (match.intent.action?.type === 'navigate') {
          setTimeout(() => safeNavigate(match.intent.action.screen), 600);
        }
        // If we've seen this intent many times, the user is clearly
        // confused — nudge them toward human support.
        if (intentFrequency(match.intent.id) >= 3) {
          setTimeout(() => addBotMessage(
            l === 'hi'
              ? "आप यह कई बार पूछ रहे हैं — क्या मैं आपको सहायता टीम से जोड़ूँ?"
              : l === 'en'
                ? "You've asked this a few times — would you like me to connect you with the support team?"
                : "Aap ye baar-baar pooch rahe hain — kya main aapko support team se connect karoon?"
          ), 1200);
        }
        return;
      }
    }

    processStep(detected, rawText);
  };

  const advanceTo = (next, extra) => {
    setCurrentStep(next);
    // If this step has an owning screen, open it so the matching form
    // listener is mounted and the chat-filled data takes effect.
    const targetScreen = screenForStep(next);
    if (targetScreen) safeNavigate(targetScreen);
    if (extra) setTimeout(() => addBotMessage(extra), 400);

    // Step-specific prompt resolution. Some steps embed placeholders or
    // pre-filled data that must be substituted at the advance site.
    const lg = lang || 'en';
    let prompt = '';
    if (next === 'askName') {
      const prefillName = state.borrowerDetails?.name || user?.name || recall('userName') || '';
      prompt = prefillName
        ? getMessage('askName', lg, { prefillName })
        : getMessage('askNameFresh', lg);
    } else if (next === 'askLoanAmount') {
      // If we already know the balance fee (from student lookup) use it
      // as the proposed loan amount — user just confirms.
      const proposed = state.selectedProduct?.requestedAmount
        || state.studentDetails?.balanceFee || 0;
      if (proposed) {
        prompt = lg === 'hi'
          ? `आपकी बकाया फीस ₹${proposed.toLocaleString('en-IN')} है। क्या इतना ही लोन चाहिए? (हाँ, या अलग राशि टाइप करें)`
          : lg === 'en'
            ? `Your balance fee is ₹${proposed.toLocaleString('en-IN')}. Take a loan for this amount? (reply "yes" or type a different amount)`
            : `Aapki balance fee ₹${proposed.toLocaleString('en-IN')} hai. Itna hi loan chahiye? (haan ya alag amount type karein)`;
      } else {
        prompt = getMessage('askLoanAmount', lg);
      }
    } else {
      prompt = getMessage(next, lg);
    }
    if (prompt) setTimeout(() => addBotMessage(prompt), extra ? 1100 : 500);
  };

  // Re-interpret a generic detection in light of the step the bot is
  // expecting. Without this, a 6-digit "500000" looks like an OTP and a
  // 14-digit account number can look like an amount — both misclassified
  // before they reach the step handler.
  const coerceForStep = (detected, rawText, step) => {
    if (!detected) return detected;
    const pure = /^\d+$/.test((rawText || '').trim());
    const digits = (rawText || '').trim();

    if (step === 'askLoanAmount') {
      if (detected.type === 'otp' && pure) {
        // "500000" — treat as rupees, not OTP
        return { type: 'amount', value: parseInt(digits, 10) };
      }
      if (detected.type === 'tenure' && pure && digits.length >= 4) {
        return { type: 'amount', value: parseInt(digits, 10) };
      }
      if (detected.type === 'accountNumber' && pure && digits.length <= 9) {
        return { type: 'amount', value: parseInt(digits, 10) };
      }
    }
    if (step === 'askMonthlyIncome') {
      if ((detected.type === 'otp' || detected.type === 'tenure') && pure) {
        return { type: 'amount', value: parseInt(digits, 10) };
      }
    }
    if (step === 'askAccountNumber') {
      // Any pure-digit input 8-18 long is an account number regardless of
      // what the generic detector labelled it.
      if (pure && digits.length >= 8 && digits.length <= 18) {
        return { type: 'accountNumber', value: digits };
      }
    }
    if (step === 'askTenure') {
      // Accept plain 2-digit numbers even if the detector thought they
      // were something else.
      if (pure && digits.length >= 1 && digits.length <= 2) {
        const n = parseInt(digits, 10);
        if (n >= 6 && n <= 84) return { type: 'tenure', value: n };
      }
    }
    return detected;
  };

  const processStep = (detectedRaw, rawText) => {
    const l = lang || 'en';
    const detected = coerceForStep(detectedRaw, rawText, currentStep);

    switch (currentStep) {
      case 'askStart': {
        // Three meaningful intents here: continue existing, start new
        // (discarding the current draft), or something else / FAQ.
        const lower = (rawText || '').toLowerCase();
        const wantsContinue = /continue|resume|continu|jari|जारी|পরিচালিত|chalu|आगे/.test(lower)
          || (detected.type === 'confirm' && hasActiveApplication());
        const wantsNew = /new|fresh|start new|start fresh|naya|नया|नई|pehle se|discard|restart/.test(lower);
        const wantsElse = /something else|else|question|madad|help|सहायता|query/.test(lower);

        if (wantsContinue && hasActiveApplication()) {
          resumeFromState();
          return;
        }
        if (wantsNew) {
          // If there's a draft, mark it as discarded first so the user
          // doesn't end up editing two applications in parallel.
          if (state.applicationId) {
            try { dispatch({ type: 'RESET' }); } catch (_) {}
          }
          startNewApplication();
          return;
        }
        if (wantsElse) {
          addBotMessage(getMessage('help', l));
          return;
        }
        // Plain yes with no app → start new. Plain no → politely back off.
        if (detected.type === 'confirm') {
          startNewApplication();
          return;
        }
        if (detected.type === 'deny') {
          addBotMessage(tr('noThanks'));
          return;
        }
        // Fall back to help if we couldn't parse the intent.
        addBotMessage(getMessage('help', l));
        break;
      }

      case 'askInstitute': {
        const query = (rawText || '').trim();
        // Tap-to-pick: user can reply with a number matching a previously
        // listed result.
        const asNum = parseInt(query, 10);
        const list = instituteSearchRef.current || [];
        if (asNum && asNum >= 1 && asNum <= list.length) {
          const picked = list[asNum - 1];
          dispatch({ type: 'SET_INSTITUTE', payload: {
            id: picked.id, name: picked.name, instituteName: picked.name, city: picked.city,
          }});
          instituteSearchRef.current = [];
          const prompt = {
            en: `Great — ${picked.name} selected. 👍 What's the student's registration number / roll number?`,
            hinglish: `Done — ${picked.name} select ho gaya. 👍 Student ka registration / roll number kya hai?`,
            hi: `हो गया — ${picked.name} चुन लिया। 👍 छात्र का रजिस्ट्रेशन / रोल नंबर क्या है?`,
          };
          addBotMessage(prompt[l] || prompt.hinglish);
          setCurrentStep('askRegNo');
          return;
        }
        if (!query || query.length < 2) {
          addBotMessage(l === 'hi'
            ? 'कृपया कम से कम 2 अक्षर का नाम या शहर टाइप करें।'
            : 'Please type at least 2 characters of the institute name or city.');
          return;
        }
        addBotMessage(getMessage('waiting', l));
        loanService.getInstitutes(query).then((res) => {
          const hits = (res.institutes || []).slice(0, 5);
          instituteSearchRef.current = hits;
          if (hits.length === 0) {
            addBotMessage(l === 'hi'
              ? 'इस नाम से कोई संस्थान नहीं मिला। कृपया अलग नाम से खोजें।'
              : l === 'en'
                ? "No institutes matched that. Try a different name or city."
                : 'Is naam se institute nahi mila. Dusra naam ya city try karein.');
            return;
          }
          const header = l === 'hi' ? 'ये मिले — नंबर भेजें जिसे चुनना है:'
            : l === 'en' ? 'Found these — reply with the number to pick:'
            : 'Ye mile — jo chunna hai uska number bhejein:';
          const lines = hits.map((h, i) => `${i + 1}. ${h.name}${h.city ? ` (${h.city})` : ''}`).join('\n');
          addBotMessage(`${header}\n${lines}`);
        }).catch((err) => {
          console.log('[FBot] institutes search failed:', err?.message);
          addBotMessage(l === 'hi'
            ? 'संस्थान खोज में दिक्कत — कृपया दोबारा प्रयास करें।'
            : 'Institute search failed — please try again.');
        });
        break;
      }

      case 'askRegNo': {
        const regNo = (rawText || '').trim();
        if (!regNo || regNo.length < 3) {
          addBotMessage(l === 'hi'
            ? 'कृपया वैध रजिस्ट्रेशन / रोल नंबर बताएं।'
            : 'Please share a valid registration / roll number.');
          return;
        }
        addBotMessage(getMessage('waiting', l));
        const instituteId = state.instituteDetails?.id || '';
        loanService.getStudentDetails(instituteId, regNo).then((student) => {
          dispatch({ type: 'SET_STUDENT', payload: {
            ...student,
            regNo,
          }});
          // Default the loan amount to the outstanding balance fee so the
          // user doesn't have to type it manually — they can still change
          // it at askLoanAmount if needed.
          if (student.balanceFee) {
            dispatch({ type: 'SET_PRODUCT', payload: { requestedAmount: student.balanceFee }});
          }
          const lines = [];
          if (student.studentName) lines.push(l === 'hi' ? `नाम: ${student.studentName}` : `Name: ${student.studentName}`);
          if (student.fatherName) lines.push(l === 'hi' ? `पिता: ${student.fatherName}` : `Father: ${student.fatherName}`);
          if (student.courseName) lines.push(l === 'hi' ? `कोर्स: ${student.courseName}` : `Course: ${student.courseName}`);
          if (student.balanceFee) lines.push(l === 'hi' ? `बकाया फीस: ₹${student.balanceFee.toLocaleString('en-IN')}` : `Balance fee: ₹${student.balanceFee.toLocaleString('en-IN')}`);
          const intro = l === 'hi'
            ? `छात्र की जानकारी मिल गई:\n${lines.join('\n')}\n\nक्या ये सही है?`
            : l === 'en'
              ? `I found the student details:\n${lines.join('\n')}\n\nIs this correct?`
              : `Student details mili:\n${lines.join('\n')}\n\nKya ye sahi hai?`;
          addBotMessage(intro);
          setCurrentStep('askStudentConfirm');
        }).catch((err) => {
          console.log('[FBot] getStudentDetails failed:', err?.message);
          addBotMessage(l === 'hi'
            ? 'इस रजिस्ट्रेशन नंबर से छात्र नहीं मिला। कृपया जाँच कर दोबारा बताएं।'
            : l === 'en'
              ? "I couldn't find a student with that registration number. Please double-check and try again."
              : 'Is reg number se student nahi mila. Check karke dobara bataiye.');
        });
        break;
      }

      case 'askStudentConfirm': {
        if (detected.type === 'confirm') {
          // Continue into the existing funnel — borrower type next.
          advanceTo('askBorrowerType');
          return;
        }
        if (detected.type === 'deny') {
          // Clear the student details and ask reg number again.
          dispatch({ type: 'SET_STUDENT', payload: null });
          addBotMessage(l === 'hi' ? 'ठीक है, कृपया सही रजिस्ट्रेशन नंबर बताएं।'
            : l === 'en' ? 'No problem — please share the correct registration number.'
            : 'Theek hai, sahi reg number bataiye.');
          setCurrentStep('askRegNo');
          return;
        }
        addBotMessage(l === 'hi' ? 'कृपया "हाँ" या "नहीं" बताएं।'
          : 'Please reply with "yes" or "no".');
        break;
      }

      case 'askBorrowerType': {
        const lower = (rawText || '').toLowerCase();
        const isStudent = /student|khud|self|स्वयं|छात्र|मैं/.test(lower);
        const isParent = /parent|father|mother|guardian|pita|mata|माता|पिता|संरक्षक/.test(lower);
        if (isStudent) {
          dispatch({ type: 'SET_BORROWER_TYPE', payload: 'self' });
          // borrower = student, no further relationship needed.
          advanceTo('askName');
          return;
        }
        if (isParent) {
          dispatch({ type: 'SET_BORROWER_TYPE', payload: 'parent' });
          advanceTo('askRelationship');
          return;
        }
        addBotMessage(l === 'hi'
          ? 'कृपया "छात्र" या "माता-पिता" में से चुनें।'
          : l === 'en'
            ? 'Please choose "student" or "parent".'
            : 'Please "student" ya "parent" mein se choose karein.');
        break;
      }

      case 'askRelationship': {
        const lower = (rawText || '').toLowerCase();
        let rel = null;
        if (/father|pita|पिता|dad|daddy/.test(lower)) rel = 'father';
        else if (/mother|mata|माता|mom|mummy/.test(lower)) rel = 'mother';
        else if (/guardian|sanrakshak|संरक्षक|uncle|grandfather|grandmother|चाचा|दादा|नाना/.test(lower)) rel = 'guardian';
        if (rel) {
          dispatch({ type: 'SET_BORROWER_DETAILS', payload: { relationship: rel } });
          advanceTo('askName');
          return;
        }
        addBotMessage(l === 'hi'
          ? 'कृपया "पिता", "माता" या "संरक्षक" बताएं।'
          : l === 'en'
            ? 'Please tell me: father, mother, or guardian?'
            : 'Please bataiye: father, mother, ya guardian?');
        break;
      }

      case 'askName':
        if (detected.type === 'confirm') {
          const name = state.borrowerDetails?.name || user?.name || recall('userName') || '';
          onAction?.({ type: 'SET_NAME', value: name });
          advanceTo('askPhone');
        } else if (detected.type === 'deny') {
          addBotMessage(getMessage('askNameFresh', l));
        } else if (detected.type === 'text') {
          // User corrected the prefilled name — remember it for next time.
          rememberCorrection('askName', detected.value);
          onAction?.({ type: 'SET_NAME', value: detected.value });
          advanceTo('askPhone');
        }
        break;

      case 'askPhone':
        if (detected.type === 'phone') {
          onAction?.({ type: 'SET_PHONE', value: detected.value });
          addBotMessage(getMessage('waiting', l));
          // Actually call the OTP service — previously the bot only
          // fired a postAction that required BorrowerSelection to be
          // mounted, so if the user was elsewhere no OTP was ever sent.
          smsService.sendOtp(detected.value).then(() => {
            addBotMessage(getMessage('askOtp', l));
            setCurrentStep('askOtp');
          }).catch((err) => {
            addBotMessage(l === 'hi'
              ? `OTP भेजने में दिक्कत हुई: ${err?.message || 'कृपया पुनः प्रयास करें'}. दोबारा फोन नंबर टाइप करें।`
              : l === 'en'
                ? `Couldn't send OTP: ${err?.message || 'please try again'}. Please type your phone number once more.`
                : `OTP bhejne mein dikkat: ${err?.message || 'dobara try karein'}. Phone number phir se type karein.`);
          });
          // Still notify mounted screens so BorrowerSelection auto-fills.
          onAction?.({ type: 'SEND_OTP', value: detected.value });
        } else {
          addBotMessage(invalid('invalidPhone'));
        }
        break;

      case 'askOtp': {
        const phoneForOtp = state.borrowerDetails?.phone || recall('userPhone') || '';
        const looksLikeResend = detected.type === 'text'
          && /resend|re send|re-send|phir bhejo|dobara|फिर भेजो|नया otp|new otp/i.test(rawText || '');
        if (looksLikeResend) {
          if (!phoneForOtp) {
            setCurrentStep('askPhone');
            addBotMessage(l === 'hi'
              ? 'फोन नंबर नहीं मिला — कृपया फिर से फोन नंबर दर्ज करें।'
              : 'Phone number missing — please re-enter your phone number.');
            break;
          }
          addBotMessage(getMessage('waiting', l));
          smsService.sendOtp(phoneForOtp).then(() => {
            addBotMessage(l === 'hi'
              ? 'नया OTP आपके फोन पर भेज दिया है। 6 अंकों का OTP बताइए।'
              : l === 'en'
                ? 'A new OTP has been sent to your phone. Please share the 6-digit OTP.'
                : 'Naya OTP bhej diya hai. 6-digit OTP share karein.');
          }).catch((err) => {
            addBotMessage(l === 'hi'
              ? `OTP भेजने में दिक्कत: ${err?.message || 'कृपया पुनः प्रयास करें'}`
              : `Couldn't resend OTP: ${err?.message || 'please try again'}`);
          });
          break;
        }
        if (detected.type !== 'otp') {
          addBotMessage(invalid('invalidOtp'));
          // Remind the user that resend is an option if they just keep
          // typing garbage at this step.
          addBotMessage(l === 'hi'
            ? "OTP नहीं मिला? 'resend otp' टाइप करें।"
            : l === 'en'
              ? "Didn't receive it? Type 'resend otp' to get a new one."
              : "OTP nahi mila? 'resend otp' type karein.");
          break;
        }
        addBotMessage(getMessage('waiting', l));
        if (!phoneForOtp) {
          addBotMessage(l === 'hi'
            ? 'फोन नंबर नहीं मिला — कृपया फिर से फोन नंबर दर्ज करें।'
            : 'Phone number missing — please re-enter your phone number.');
          setCurrentStep('askPhone');
          break;
        }
        // Real verification. Wrong OTP now produces an error message and
        // keeps us on askOtp — previously the bot always said "Phone
        // verified" after 1.4s regardless of what the user typed. Expired
        // / too-many-attempts errors suggest a resend.
        try {
          smsService.verifyOtp(phoneForOtp, detected.value);
        } catch (err) {
          const msg = err?.message || '';
          const stale = /expired|too many|not found/i.test(msg);
          addBotMessage(l === 'hi'
            ? `गलत OTP: ${msg || 'कृपया पुनः प्रयास करें'}`
            : l === 'en'
              ? `Wrong OTP: ${msg || 'please try again'}`
              : `Galat OTP: ${msg || 'dobara try karein'}`);
          if (stale) {
            addBotMessage(l === 'hi'
              ? "'resend otp' टाइप करके नया OTP पाएँ।"
              : l === 'en'
                ? "Type 'resend otp' to get a fresh one."
                : "'resend otp' type karein naya OTP ke liye.");
          }
          break;
        }
        // Bot already verified via smsService.verifyOtp above — if we
        // posted VERIFY_OTP to the screen listener it would call
        // smsService.verifyOtp again, hit "OTP not found" (the OTP was
        // already consumed), and throw a false "OTP expired" error at
        // the user. Post a PHONE_VERIFIED signal instead so the screen
        // can sync its form state without re-verifying.
        onAction?.({ type: 'PHONE_VERIFIED', value: detected.value });
        addBotMessage(getMessage('phoneVerified', l));

        // Phone is verified — now pull PAN + name + DOB via Signzy's
        // phone-to-PAN lookup and prefill everything so the user doesn't
        // have to repeat what we already know.
        const fullName = state.borrowerDetails?.name || user?.name || recall('userName') || '';
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

        kycService.fetchPanByMobile(phoneForOtp, firstName, lastName).then((res) => {
          const prefill = {
            pan: res.panNumber || '',
            dob: res.dateOfBirth || '',
            gender: res.gender || '',
          };
          // Persist the DOB + gender on the borrower and the PAN on state.
          if (prefill.dob) {
            onAction?.({ type: 'SET_DOB', value: prefill.dob });
          }
          if (res.name && !fullName) {
            onAction?.({ type: 'SET_NAME', value: res.name });
          }
          if (prefill.pan) {
            // Stash the prefilled PAN in borrowerDetails so the PAN screen
            // can read it and the confirm-flow can use it.
            dispatch({ type: 'SET_BORROWER_DETAILS', payload: { pan: prefill.pan } });

            const lines = [];
            if (res.name) lines.push(l === 'hi' ? `नाम: ${res.name}` : l === 'en' ? `Name: ${res.name}` : `Naam: ${res.name}`);
            lines.push(l === 'hi' ? `PAN: ${prefill.pan}` : `PAN: ${prefill.pan}`);
            if (prefill.dob) lines.push(l === 'hi' ? `जन्मतिथि: ${prefill.dob}` : l === 'en' ? `DOB: ${prefill.dob}` : `DOB: ${prefill.dob}`);
            if (prefill.gender) lines.push(l === 'hi' ? `लिंग: ${prefill.gender}` : l === 'en' ? `Gender: ${prefill.gender}` : `Gender: ${prefill.gender}`);

            const intro = l === 'hi'
              ? `आपके नंबर से जुड़ी ये जानकारी मिली:\n${lines.join('\n')}\n\nक्या ये सही है?`
              : l === 'en'
                ? `I found these details linked to your number:\n${lines.join('\n')}\n\nIs this correct?`
                : `Aapke number se linked details mili:\n${lines.join('\n')}\n\nKya ye sahi hai?`;
            addBotMessage(intro);
            setCurrentStep('askPan');
          } else {
            // Phone-to-PAN API returned no PAN for this number — be
            // explicit so the user knows why we're asking manually.
            addBotMessage(l === 'hi'
              ? "आपके नंबर से PAN नहीं मिल पाया — कृपया स्वयं अपना PAN साझा करें।"
              : l === 'en'
                ? "I couldn't find a PAN linked to your number automatically — please share your PAN."
                : "Aapke number se PAN auto-fill nahi ho paaya — kripya apna PAN share karein.");
            setCurrentStep('askPan');
          }
          safeNavigate('PanVerification');
        }).catch((err) => {
          console.log('[FBot] phone-to-PAN failed:', err?.message);
          // Non-fatal — let the user know prefill failed and ask manually.
          addBotMessage(l === 'hi'
            ? `PAN ऑटो-फेच नहीं हो सका (${err?.message || 'सेवा अनुपलब्ध'})। कृपया स्वयं अपना PAN दर्ज करें।`
            : l === 'en'
              ? `Couldn't auto-fetch PAN (${err?.message || 'service unavailable'}). Please enter your PAN.`
              : `PAN auto-fetch fail ho gaya (${err?.message || 'service down'}). Kripya apna PAN enter karein.`);
          addBotMessage(getMessage('askPan', l));
          setCurrentStep('askPan');
          safeNavigate('PanVerification');
        });
        break;
      }

      case 'askPan': {
        const isConfirm = detected.type === 'confirm';
        const isPan = detected.type === 'pan';
        const isDeny = detected.type === 'deny';

        if (isDeny) {
          // User said the prefilled PAN is wrong — ask them to type it.
          addBotMessage(getMessage('askPan', l));
          break;
        }
        if (!isConfirm && !isPan) {
          addBotMessage(invalid('invalidPan'));
          break;
        }
        const pan = isPan
          ? detected.value
          : (state.borrowerDetails?.pan || state.panDetails?.panNumber || '');
        if (!pan) {
          addBotMessage(invalid('invalidPan'));
          break;
        }
        addBotMessage(getMessage('waiting', l));

        // Actually verify the PAN with Signzy instead of pretending.
        kycService.validatePan(pan).then((res) => {
          const valid = res?.isValid !== false && res?.status !== 'INVALID';
          if (!valid) {
            addBotMessage(l === 'hi'
              ? `यह PAN वैध नहीं है (${res?.panStatus || 'अमान्य'}). कृपया दूसरा PAN दर्ज करें।`
              : l === 'en'
                ? `That PAN is not valid (${res?.panStatus || 'invalid'}). Please enter a different PAN.`
                : `Ye PAN valid nahi hai (${res?.panStatus || 'invalid'}). Dobara PAN enter karein.`);
            return;
          }
          // Persist the verified PAN.
          dispatch({
            type: 'SET_PAN',
            payload: {
              panNumber: pan,
              name: res.name || '',
              panStatus: res.panStatus || 'E',
              isValid: true,
              isIndividual: res.isIndividual !== false,
              aadhaarSeedingStatus: res.aadhaarSeedingStatus || 'Y',
            },
          });
          onAction?.({ type: 'VERIFY_PAN', value: pan });
          addBotMessage(getMessage('panVerified', l));
          // Credit-bureau check isn't integrated yet — bot proceeds
          // assuming pass (PanVerification screen offers a simulator).
          setTimeout(() => {
            addBotMessage(getMessage('creditPassed', l));
            // EPFO / UAN lookup runs the same way the IncomeVerification
            // screen does it — takes (phone, pan) and returns the
            // applicant's current employer + UAN history. If we get a
            // hit, prefill employer + salary into state and ask the user
            // to confirm instead of typing it all. Graceful fallback:
            // just advance to askOccupation if the API fails or no UAN.
            const phoneForEpfo = state.borrowerDetails?.phone || recall('userPhone') || '';
            if (!phoneForEpfo) { advanceTo('askOccupation'); return; }
            signzyService.getCurrentEmployer(phoneForEpfo, pan).then((epfo) => {
              const employer = epfo?.recentEmployer?.establishmentName || '';
              const isEmployed = !!epfo?.isEmployed;
              if (employer && isEmployed) {
                // Mark as salaried and save employer on borrowerDetails.
                dispatch({ type: 'SET_BORROWER_DETAILS', payload: {
                  occupation: 'salaried_private',
                  employer,
                  uan: epfo?.recentEmployer?.matchingUan || '',
                }});
                remember('userEmployer', employer);
                remember('userOccupation', 'salaried_private');

                const msg = l === 'hi'
                  ? `आपके EPFO रिकॉर्ड से मिली जानकारी:\nनियोक्ता: ${employer}\nरोजगार: सक्रिय ✅\n\nक्या ये सही है?`
                  : l === 'en'
                    ? `I found this from your EPFO record:\nEmployer: ${employer}\nEmployment: Active ✅\n\nIs this correct?`
                    : `EPFO record se mila:\nEmployer: ${employer}\nEmployment: Active ✅\n\nKya ye sahi hai?`;
                addBotMessage(msg);
                setCurrentStep('askEmployerConfirm');
                safeNavigate('IncomeVerification');
              } else {
                advanceTo('askOccupation');
              }
            }).catch((err) => {
              console.log('[FBot] EPFO lookup failed:', err?.message);
              advanceTo('askOccupation');
            });
          }, 1600);
        }).catch((err) => {
          console.log('[FBot] PAN validate failed:', err?.message);
          addBotMessage(l === 'hi'
            ? `PAN सत्यापन विफल: ${err?.message || 'कृपया पुनः प्रयास करें'}`
            : l === 'en'
              ? `PAN verification failed: ${err?.message || 'please try again'}`
              : `PAN verify nahi hua: ${err?.message || 'dobara try karein'}`);
        });
        break;
      }

      case 'askEmployerConfirm':
        // We showed the user the EPFO-prefilled employer earlier. Now
        // handle their yes/no response. Yes → skip directly past
        // askOccupation + askEmployer + askMonthlyIncome (EPFO doesn't
        // expose net salary, so still ask income). No → clear the
        // prefilled fields and ask occupation manually.
        if (detected.type === 'confirm') {
          advanceTo('askMonthlyIncome');
        } else if (detected.type === 'deny') {
          dispatch({ type: 'SET_BORROWER_DETAILS', payload: {
            occupation: null, employer: null, uan: null,
          }});
          advanceTo('askOccupation');
        } else {
          addBotMessage(l === 'hi'
            ? 'कृपया "हाँ" या "नहीं" बताएं।'
            : l === 'en'
              ? 'Please reply with "yes" or "no".'
              : 'Please "yes" ya "no" mein reply karein.');
        }
        break;

      case 'askOccupation':
        if (detected.type === 'occupation' || detected.type === 'text') {
          const occ = detected.type === 'occupation' ? detected.value : rawText;
          onAction?.({ type: 'SET_OCCUPATION', value: occ });
          advanceTo('askEmployer');
        }
        break;

      case 'askEmployer':
        if (detected.type === 'text') {
          onAction?.({ type: 'SET_EMPLOYER', value: rawText });
          advanceTo('askMonthlyIncome');
        }
        break;

      case 'askMonthlyIncome':
        if (detected.type === 'amount' || detected.type === 'tenure') {
          // tenure detection can swallow small numbers; accept either here
          const income = detected.value;
          onAction?.({ type: 'SET_MONTHLY_INCOME', value: income });
          advanceTo('askLoanAmount');
        } else {
          addBotMessage(invalid('invalidAmount'));
        }
        break;

      case 'askLoanAmount':
        if (detected.type === 'confirm') {
          // User is confirming the prefilled balance-fee amount.
          const prefilled = state.selectedProduct?.requestedAmount
            || state.studentDetails?.balanceFee || 0;
          if (prefilled) {
            onAction?.({ type: 'SET_LOAN_AMOUNT', value: prefilled });
            advanceTo('askTenure');
          } else {
            addBotMessage(invalid('invalidAmount'));
          }
        } else if (detected.type === 'amount') {
          onAction?.({ type: 'SET_LOAN_AMOUNT', value: detected.value });
          advanceTo('askTenure');
        } else {
          addBotMessage(invalid('invalidAmount'));
        }
        break;

      case 'askTenure':
        if (detected.type === 'tenure') {
          onAction?.({ type: 'SET_TENURE', value: detected.value });
          // Estimate EMI so the user sees the monthly cost before bank /
          // KYC steps. Rate falls back to 14% when selectedProduct isn't
          // hydrated yet. Kept inline — no dependency on a calc util.
          const amt = state.selectedProduct?.requestedAmount
            || state.studentDetails?.balanceFee || 0;
          const months = detected.value;
          const rate = (state.selectedProduct?.interestRate || 14) / 100 / 12;
          const emi = amt && months && rate
            ? Math.round((amt * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1))
            : 0;
          const totalPayable = emi * months;
          const interestTotal = totalPayable - amt;
          if (emi) {
            const lines = l === 'hi'
              ? [
                  `ऋण राशि: ₹${amt.toLocaleString('en-IN')}`,
                  `अवधि: ${months} महीने`,
                  `ब्याज दर: ${(rate * 12 * 100).toFixed(1)}% प्रति वर्ष`,
                  `अनुमानित EMI: ₹${emi.toLocaleString('en-IN')} / माह`,
                  `कुल ब्याज: ₹${interestTotal.toLocaleString('en-IN')}`,
                  `कुल भुगतान: ₹${totalPayable.toLocaleString('en-IN')}`,
                ]
              : l === 'en'
                ? [
                    `Loan amount: ₹${amt.toLocaleString('en-IN')}`,
                    `Tenure: ${months} months`,
                    `Interest rate: ${(rate * 12 * 100).toFixed(1)}% p.a.`,
                    `Estimated EMI: ₹${emi.toLocaleString('en-IN')} / month`,
                    `Total interest: ₹${interestTotal.toLocaleString('en-IN')}`,
                    `Total payable: ₹${totalPayable.toLocaleString('en-IN')}`,
                  ]
                : [
                    `Loan: ₹${amt.toLocaleString('en-IN')}`,
                    `Tenure: ${months} mahine`,
                    `Rate: ${(rate * 12 * 100).toFixed(1)}% p.a.`,
                    `EMI: ₹${emi.toLocaleString('en-IN')} / month`,
                    `Total interest: ₹${interestTotal.toLocaleString('en-IN')}`,
                    `Total payable: ₹${totalPayable.toLocaleString('en-IN')}`,
                  ];
            addBotMessage(lines.join('\n'));
          }
          advanceTo('askBankDetails');
        } else {
          addBotMessage(invalid('invalidTenure'));
        }
        break;

      case 'askBankDetails':
        if (detected.type === 'ifsc') {
          onAction?.({ type: 'SET_IFSC', value: detected.value });
          addBotMessage(l === 'hi'
            ? 'IFSC नोट कर लिया। अब कृपया अपना अकाउंट नंबर साझा करें।'
            : l === 'en'
              ? 'IFSC noted. Now please share your account number.'
              : 'IFSC note kar liya. Ab please apna account number share karein.');
          setCurrentStep('askAccountNumber');
        } else if (detected.type === 'confirm') {
          advanceTo('kycStart');
        } else {
          addBotMessage(invalid('invalidIfsc'));
        }
        break;

      case 'askAccountNumber': {
        if (detected.type !== 'accountNumber') break;
        onAction?.({ type: 'SET_ACCOUNT', value: detected.value });
        addBotMessage(getMessage('waiting', l));
        // Run the real Signzy hybrid penny drop against the account the
        // user just typed, using the verified name on state. If the
        // account passes, dispatch SET_PENNY_DROP with the result so the
        // downstream screens (IncomeVerification etc.) see it just like
        // they would from their own flow.
        const ifscForPd = state.bankDetails?.ifsc || '';
        const nameForPd = state.panDetails?.name || state.borrowerDetails?.name || '';
        const phoneForPd = state.borrowerDetails?.phone || '';
        bankService.pennyDrop({
          accountNumber: detected.value,
          ifsc: ifscForPd,
          name: nameForPd,
          mobile: phoneForPd,
        }).then((pd) => {
          dispatch({ type: 'SET_PENNY_DROP', payload: pd });
          onAction?.({ type: 'VERIFY_BANK' });
          if (pd?.verified) {
            addBotMessage(l === 'hi'
              ? `बैंक सत्यापित ✅\nखाताधारक: ${pd.accountHolderName || '—'}\nनाम मिलान: ${pd.nameMatch ? 'हाँ' : 'आंशिक'}`
              : l === 'en'
                ? `Bank verified ✅\nAccount holder: ${pd.accountHolderName || '—'}\nName match: ${pd.nameMatch ? 'yes' : 'partial'}`
                : `Bank verify ho gaya ✅\nAccount holder: ${pd.accountHolderName || '—'}\nName match: ${pd.nameMatch ? 'haan' : 'partial'}`);
            setTimeout(() => advanceTo('kycStart'), 1200);
          } else {
            addBotMessage(l === 'hi'
              ? 'बैंक खाता सत्यापित नहीं हो पाया। कृपया सही IFSC और खाता संख्या दोबारा बताएँ।'
              : l === 'en'
                ? "Bank verification failed. Please re-enter a correct IFSC and account number."
                : 'Bank verify nahi ho paaya. Sahi IFSC aur account number dobara bataiye.');
            setCurrentStep('askBankDetails');
          }
        }).catch((err) => {
          console.log('[FBot] pennyDrop failed:', err?.message);
          addBotMessage(l === 'hi'
            ? `बैंक सत्यापन विफल: ${err?.message || 'पुनः प्रयास करें'}`
            : l === 'en'
              ? `Bank verification failed: ${err?.message || 'please try again'}`
              : `Bank verify fail: ${err?.message || 'dobara try karein'}`);
          setCurrentStep('askBankDetails');
        });
        break;
      }

      case 'kycStart':
        if (detected.type === 'confirm' || detected.type === 'text') {
          onAction?.({ type: 'START_KYC' });
          addBotMessage(getMessage('waiting', l));
          // Kick off the real CKYC flow: search CERSAI → trigger OTP to
          // the CKYC-registered mobile. Previously the bot just waited
          // 1.8s and advanced, no API ever fired.
          const panForKyc = state.panDetails?.panNumber || state.borrowerDetails?.pan || '';
          const phoneForKyc = state.borrowerDetails?.phone || recall('userPhone') || '';
          const nameForKyc = state.panDetails?.name || state.borrowerDetails?.name || recall('userName') || '';
          if (!panForKyc || !phoneForKyc || !nameForKyc) {
            addBotMessage(l === 'hi'
              ? 'CKYC शुरू करने के लिए PAN, नाम और फोन चाहिए — कुछ छूट गया है।'
              : l === 'en'
                ? "I can't start CKYC without PAN, name and phone on file — something's missing."
                : 'CKYC ke liye PAN, naam aur phone chahiye — kuch missing hai.');
            break;
          }
          kycService.initiateCkyc({
            pan: panForKyc,
            name: nameForKyc,
            phone: phoneForKyc,
            loanId: state.applicationId || '',
          }).then((res) => {
            ckycRef.current = {
              requestId: res.requestId || '',
              referenceNo: res.ckycReferNo || '',
            };
            dispatch({ type: 'SET_KYC_METHOD', payload: 'ckyc' });
            addBotMessage(getMessage('kycOtp', l));
            setCurrentStep('kycOtp');
          }).catch((err) => {
            console.log('[FBot] initiateCkyc failed:', err?.message);
            addBotMessage(l === 'hi'
              ? `CKYC शुरू नहीं हो सका: ${err?.message || 'DigiLocker आज़माएँ'}`
              : l === 'en'
                ? `CKYC couldn't start: ${err?.message || 'try DigiLocker instead'}`
                : `CKYC start nahi ho saka: ${err?.message || 'DigiLocker try karein'}`);
            // Fall back to selfie/enach flow so the user isn't stuck.
            setTimeout(() => advanceTo('selfieStart'), 800);
          });
        }
        break;

      case 'kycOtp': {
        const lowerText = (rawText || '').toLowerCase();
        if (/resend|phir bhejo|dobara|नया otp|new otp/.test(lowerText)) {
          if (!ckycRef.current.requestId) {
            addBotMessage(l === 'hi' ? 'CKYC सत्र खो गया — कृपया KYC फिर शुरू करें।'
              : 'CKYC session lost — please restart KYC.');
            setCurrentStep('kycStart');
            break;
          }
          const phoneForKyc = state.borrowerDetails?.phone || '';
          const panForKyc = state.panDetails?.panNumber || state.borrowerDetails?.pan || '';
          kycService.resendCkycOtp({ pan: panForKyc, phone: phoneForKyc, requestId: ckycRef.current.requestId })
            .then(() => addBotMessage(l === 'hi'
              ? 'नया OTP भेज दिया। 6 अंकों का OTP बताइए।'
              : l === 'en'
                ? 'A new OTP has been sent. Share the 6-digit code.'
                : 'Naya OTP bhej diya. 6-digit OTP share karein.'))
            .catch((err) => addBotMessage(`${err?.message || 'Resend failed'}`));
          break;
        }
        if (detected.type !== 'otp') {
          addBotMessage(invalid('invalidOtp'));
          break;
        }
        if (!ckycRef.current.requestId || !ckycRef.current.referenceNo) {
          addBotMessage(l === 'hi' ? 'CKYC सत्र नहीं मिला — कृपया KYC फिर शुरू करें।'
            : 'CKYC session missing — please restart KYC.');
          setCurrentStep('kycStart');
          break;
        }
        onAction?.({ type: 'VERIFY_KYC_OTP', value: detected.value });
        addBotMessage(getMessage('waiting', l));
        const panForVerify = state.panDetails?.panNumber || state.borrowerDetails?.pan || '';
        const phoneForVerify = state.borrowerDetails?.phone || '';
        kycService.verifyCkycOtp({
          pan: panForVerify,
          phone: phoneForVerify,
          otp: detected.value,
          requestId: ckycRef.current.requestId,
          referenceNo: ckycRef.current.referenceNo,
        }).then((kyc) => {
          // Persist the full CKYC payload so the review screens and
          // selfie liveness step see the same data the real KYC flow
          // would produce.
          dispatch({ type: 'SET_KYC_DATA', payload: kyc });
          ckycRef.current = { requestId: '', referenceNo: '' };
          addBotMessage(getMessage('kycDone', l));
          advanceTo('selfieStart');
        }).catch((err) => {
          console.log('[FBot] verifyCkycOtp failed:', err?.message);
          addBotMessage(l === 'hi'
            ? `CKYC OTP गलत: ${err?.message || 'पुनः प्रयास करें'}`
            : l === 'en'
              ? `CKYC OTP failed: ${err?.message || 'try again'}`
              : `CKYC OTP galat: ${err?.message || 'dobara try karein'}`);
        });
        break;
      }

      case 'selfieStart':
        onAction?.({ type: 'START_SELFIE' });
        addBotMessage(getMessage('applicationComplete', l));
        setCurrentStep('applicationComplete');
        break;

      default:
        // When we've been parked at 'welcome' and the user types something,
        // re-check the application state and resume from the first missing
        // field if there's a draft to continue. 'applicationComplete' is
        // intentionally excluded — re-entering resumeFromState there just
        // repeats the "nothing more to fill" message; intent-matching or
        // help is a better fit.
        if (currentStep === 'welcome' && hasActiveApplication()) {
          resumeFromState();
          return;
        }
        addBotMessage(getMessage('help', l));
    }
  };

  // Render message bubble
  const renderMessage = ({ item }) => {
    const isBot = item.from === 'bot';
    return (
      <View style={[styles.msgRow, isBot ? styles.msgRowBot : styles.msgRowUser]}>
        {isBot && <Text style={styles.avatar}>{BOT_AVATAR}</Text>}
        <View style={[
          styles.bubble,
          { backgroundColor: isBot ? `${colors.teal}14` : `${colors.primary}20` },
          isBot ? styles.bubbleBot : styles.bubbleUser,
        ]}>
          <Text style={[styles.msgText, { color: colors.textPrimary }]}>{item.text}</Text>
          <Text style={[styles.msgTime, { color: colors.textSecondary }]}>{item.time}</Text>
        </View>
        {!isBot && <Text style={styles.avatar}>{USER_AVATAR}</Text>}
      </View>
    );
  };

  // FAB button (always visible)
  if (!visible) {
    return (
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.teal }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>🤖</Text>
        <Text style={[styles.fabLabel, { color: '#fff' }]}>FBot</Text>
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.error || '#E53E3E' }]}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Language selection
  if (!lang) {
    return (
      <Animated.View style={[styles.container, { backgroundColor: colors.cardBg, transform: [{ translateY: slideAnim }] }]}>
        <View style={[styles.header, { backgroundColor: colors.teal }]}>
          <Text style={styles.headerTitle}>🤖 FBot — Loan Assistant</Text>
          <TouchableOpacity onPress={() => setVisible(false)}>
            <Text style={styles.headerClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.langPicker}>
          <Text style={[styles.langTitle, { color: colors.textPrimary }]}>Select your language / अपनी भाषा चुनें</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => selectLanguage(l.code)}
              >
                <Text style={[styles.langNative, { color: colors.textPrimary }]}>{l.native}</Text>
                <Text style={[styles.langLabel, { color: colors.textSecondary }]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>
    );
  }

  // Chat view (minimized = just last message visible)
  return (
    <Animated.View style={[
      minimized ? styles.containerMinimized : styles.container,
      { backgroundColor: `${colors.cardBg}F0`, transform: [{ translateY: slideAnim }] },
    ]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.teal }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.headerTitle}>🤖 FBot</Text>
          {!minimized && (
            <Text style={styles.headerProgress}>
              {' · '}{getProgressLabel(currentStep, lang || 'en')}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => setShowLangSwitcher((s) => !s)} style={{ marginRight: 14 }}>
            <Text style={styles.headerClose}>🌐</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMinimized(!minimized)} style={{ marginRight: 14 }}>
            <Text style={styles.headerClose}>{minimized ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setVisible(false)}>
            <Text style={styles.headerClose}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar (hidden when minimized or on welcome) */}
      {!minimized && currentStep !== 'welcome' && (
        <View style={[styles.progressTrack, { backgroundColor: `${colors.teal}22` }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.teal, width: `${Math.round(getProgress(currentStep) * 100)}%` },
            ]}
          />
        </View>
      )}

      {/* In-chat language switcher (shown on demand) */}
      {!minimized && showLangSwitcher && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langStrip}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[
                styles.langStripChip,
                {
                  borderColor: lang === l.code ? colors.teal : colors.border,
                  backgroundColor: lang === l.code ? `${colors.teal}22` : colors.surface,
                },
              ]}
              onPress={() => selectLanguage(l.code, { greet: false })}
            >
              <Text style={[styles.langStripText, { color: colors.textPrimary }]}>{l.native}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!minimized ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={60}
        >
          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={typing ? (
              <View style={[styles.msgRow, styles.msgRowBot]}>
                <Text style={styles.avatar}>{BOT_AVATAR}</Text>
                <View style={[styles.bubble, styles.bubbleBot, { backgroundColor: `${colors.teal}14` }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>typing...</Text>
                </View>
              </View>
            ) : null}
          />

          {/* Quick-reply chips — contextual based on step */}
          {renderQuickReplies({ currentStep, lang, onPress: sendText, colors })}

          {/* Input */}
          <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              value={input}
              onChangeText={setInput}
              placeholder={lang === 'hi' ? 'यहाँ टाइप करें...' : 'Type here...'}
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.teal }]} onPress={handleSend}>
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* Minimized: show last message only */
        messages.length > 0 && (
          <View style={[styles.miniMsg, { backgroundColor: `${colors.teal}14` }]}>
            <Text style={[styles.miniText, { color: colors.textPrimary }]} numberOfLines={2}>
              {messages[messages.length - 1]?.text}
            </Text>
          </View>
        )
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 80, right: 16, width: 56, height: 56,
    borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, zIndex: 999,
  },
  fabText: { fontSize: 24 },
  fabLabel: { fontSize: 8, fontWeight: '800', marginTop: -2 },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  headerProgress: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 3, width: '100%' },
  progressFill: { height: 3 },
  langStrip: { maxHeight: 44, paddingHorizontal: 6, paddingVertical: 6 },
  langStripChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1,
    marginRight: 6, minWidth: 64, alignItems: 'center',
  },
  langStripText: { fontSize: 12, fontWeight: '600' },
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_H * 0.7, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden', elevation: 20, zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12,
  },
  containerMinimized: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 100, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden', elevation: 20, zIndex: 999,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerClose: { color: '#fff', fontSize: 18, fontWeight: '700' },
  messageList: { padding: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },
  avatar: { fontSize: 18, marginHorizontal: 4 },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 14 },
  bubbleBot: { borderBottomLeftRadius: 4 },
  bubbleUser: { borderBottomRightRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTime: { fontSize: 9, marginTop: 4, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row', padding: 8, borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, fontSize: 14, marginRight: 8,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18 },
  langPicker: { flex: 1, padding: 16 },
  langTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    margin: 4, alignItems: 'center', minWidth: 90,
  },
  langNative: { fontSize: 14, fontWeight: '600' },
  langLabel: { fontSize: 10, marginTop: 2 },
  miniMsg: { padding: 12, marginHorizontal: 12, marginTop: 4, borderRadius: 8 },
  miniText: { fontSize: 13 },
});

export default FBot;
