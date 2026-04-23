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
import {
  getMessage, detectInputType, LANGUAGES, FBOT_STEPS,
  getProgress, getProgressLabel, getPreviousStep,
} from './FBotEngine';
import { useFBot } from './FBotContext';

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
        { label: L('yes', lg), value: 'yes' },
        { label: L('no', lg), value: 'no' },
        { label: L('help', lg), value: 'help' },
        { label: L('restart', lg), value: 'restart' },
      ];
    case 'welcome':
    case 'askName':
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
  const chips = quickRepliesForStep(currentStep, lang);
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
            onPress={() => onPress(c.value)}
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
    case 'askName':
    case 'askDob':
    case 'askPhone':
    case 'askOtp':
      return 'BorrowerSelection';
    case 'askPan':
      return 'PanVerification';
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

  // Every FBot action: (1) update persistent loan state and (2) notify any
  // mounted screen listener so it can auto-fill and auto-submit its form.
  const onAction = useCallback((action) => {
    dispatchLoanUpdate(dispatch, action);
    postAction(action);
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
  const [minimized, setMinimized] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showLangSwitcher, setShowLangSwitcher] = useState(false);

  // Localized validation error message helper
  const invalid = (key) => getMessage(key, lang || 'en');

  // ─── Persistence: load saved state on mount ────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.lang) setLang(saved.lang);
          if (Array.isArray(saved.messages)) setMessages(saved.messages);
          if (saved.currentStep) setCurrentStep(saved.currentStep);
        } catch (_) { /* ignore */ }
      }
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, []);

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
      setMessages((prev) => [...prev, {
        id: `bot_${Date.now()}_${Math.random()}`,
        from: 'bot',
        text,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
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
    setMessages((prev) => [...prev, {
      id: `user_${Date.now()}`,
      from: 'user',
      text,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
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

  // True if the user has an application in progress we can resume into.
  const hasActiveApplication = () => !!(state.loanType || state.instituteDetails || state.borrowerDetails);

  // Kick off a new application on the user's behalf: pick a default loan
  // type, dispatch it, and navigate to the Apply tab so the flow begins.
  const startNewApplication = () => {
    const l = lang || 'en';
    onAction({ type: 'SET_LOAN_TYPE', value: 'education' });
    addBotMessage(tr('startedApp'));
    safeNavigate('ApplyTab');
    setTimeout(() => {
      const prefillName = state.borrowerDetails?.name || user?.name || '';
      addBotMessage(prefillName
        ? getMessage('askName', l, { prefillName })
        : getMessage('askNameFresh', l));
      setCurrentStep('askName');
    }, 1200);
  };

  const selectLanguage = (langCode, { greet = true } = {}) => {
    setLang(langCode);
    setShowLangSwitcher(false);
    if (!greet) return;
    addBotMessage(getMessage('welcome', langCode));
    setTimeout(() => {
      // Always enter askStart — the chips adapt based on whether an
      // application already exists (Resume / Start-new / No).
      const lg = langCode;
      const promptLines = hasActiveApplication()
        ? {
            en: "You have an application in progress. Would you like me to continue where you left off?",
            hinglish: "Aapki ek application chal rahi hai. Kya main wahan se continue karoon jahan aap chhoda tha?",
            hi: "आपकी एक एप्लीकेशन चल रही है। क्या मैं वहीं से आगे बढ़ूँ जहाँ आपने छोड़ा था?",
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

    processStep(detected, rawText);
  };

  const advanceTo = (next, extra) => {
    setCurrentStep(next);
    // If this step has an owning screen, open it so the matching form
    // listener is mounted and the chat-filled data takes effect.
    const targetScreen = screenForStep(next);
    if (targetScreen) safeNavigate(targetScreen);
    if (extra) setTimeout(() => addBotMessage(extra), 400);
    setTimeout(() => addBotMessage(getMessage(next, lang || 'en')), extra ? 1100 : 500);
  };

  const processStep = (detected, rawText) => {
    const l = lang || 'en';

    switch (currentStep) {
      case 'askStart':
        if (detected.type === 'confirm' || detected.type === 'text') {
          if (hasActiveApplication()) {
            // Resume the existing application from where it left off.
            const prefillName = state.borrowerDetails?.name || user?.name || '';
            addBotMessage(prefillName
              ? getMessage('askName', l, { prefillName })
              : getMessage('askNameFresh', l));
            setCurrentStep('askName');
            safeNavigate(screenForStep('askName'));
          } else {
            startNewApplication();
          }
        } else if (detected.type === 'deny') {
          addBotMessage(tr('noThanks'));
        }
        break;

      case 'askName':
        if (detected.type === 'confirm') {
          const name = state.borrowerDetails?.name || user?.name || '';
          onAction?.({ type: 'SET_NAME', value: name });
          advanceTo('askDob');
        } else if (detected.type === 'deny') {
          addBotMessage(getMessage('askNameFresh', l));
        } else if (detected.type === 'text') {
          onAction?.({ type: 'SET_NAME', value: detected.value });
          advanceTo('askDob');
        }
        break;

      case 'askDob':
        if (detected.type === 'dob') {
          onAction?.({ type: 'SET_DOB', value: detected.value });
          advanceTo('askPhone');
        } else {
          addBotMessage(invalid('invalidDob'));
        }
        break;

      case 'askPhone':
        if (detected.type === 'phone') {
          onAction?.({ type: 'SET_PHONE', value: detected.value });
          addBotMessage(getMessage('waiting', l));
          onAction?.({ type: 'SEND_OTP', value: detected.value });
          setTimeout(() => {
            addBotMessage(getMessage('askOtp', l));
            setCurrentStep('askOtp');
          }, 1800);
        } else {
          addBotMessage(invalid('invalidPhone'));
        }
        break;

      case 'askOtp':
        if (detected.type === 'otp') {
          addBotMessage(getMessage('waiting', l));
          onAction?.({ type: 'VERIFY_OTP', value: detected.value });
          setTimeout(() => {
            addBotMessage(getMessage('phoneVerified', l));
            setCurrentStep('askPan');
            setTimeout(() => {
              const prefillPan = state.borrowerDetails?.pan || '';
              if (prefillPan) {
                addBotMessage(l === 'hi'
                  ? `मुझे आपका PAN मिला: ${prefillPan}। क्या यह सही है?`
                  : `Mujhe aapka PAN mila: ${prefillPan}. Kya ye sahi hai?`);
              } else {
                addBotMessage(getMessage('askPan', l));
              }
            }, 700);
          }, 1400);
        } else {
          addBotMessage(invalid('invalidOtp'));
        }
        break;

      case 'askPan': {
        const isConfirm = detected.type === 'confirm';
        const isPan = detected.type === 'pan';
        if (isConfirm || isPan) {
          const pan = isPan
            ? detected.value
            : (state.borrowerDetails?.pan || state.panDetails?.panNumber || '');
          onAction?.({ type: 'VERIFY_PAN', value: pan });
          addBotMessage(getMessage('waiting', l));
          setTimeout(() => {
            addBotMessage(getMessage('panVerified', l));
            setTimeout(() => {
              addBotMessage(getMessage('creditPassed', l));
              advanceTo('askOccupation');
            }, 1600);
          }, 1400);
        } else {
          addBotMessage(invalid('invalidPan'));
        }
        break;
      }

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
        if (detected.type === 'amount') {
          onAction?.({ type: 'SET_LOAN_AMOUNT', value: detected.value });
          advanceTo('askTenure');
        } else {
          addBotMessage(invalid('invalidAmount'));
        }
        break;

      case 'askTenure':
        if (detected.type === 'tenure') {
          onAction?.({ type: 'SET_TENURE', value: detected.value });
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

      case 'askAccountNumber':
        if (detected.type === 'accountNumber') {
          onAction?.({ type: 'SET_ACCOUNT', value: detected.value });
          onAction?.({ type: 'VERIFY_BANK' });
          addBotMessage(l === 'hi'
            ? 'बैंक डिटेल्स सेव हो गए! ✅ अब KYC करते हैं...'
            : l === 'en'
              ? 'Bank details saved! ✅ Now let\'s do KYC...'
              : 'Bank details save ho gaye! ✅ Ab KYC karte hain...');
          setTimeout(() => advanceTo('kycStart'), 1500);
        }
        break;

      case 'kycStart':
        if (detected.type === 'confirm' || detected.type === 'text') {
          onAction?.({ type: 'START_KYC' });
          addBotMessage(getMessage('waiting', l));
          setTimeout(() => advanceTo('kycOtp'), 1800);
        }
        break;

      case 'kycOtp':
        if (detected.type === 'otp') {
          onAction?.({ type: 'VERIFY_KYC_OTP', value: detected.value });
          addBotMessage(getMessage('waiting', l));
          setTimeout(() => {
            addBotMessage(getMessage('kycDone', l));
            advanceTo('selfieStart');
          }, 1800);
        } else {
          addBotMessage(invalid('invalidOtp'));
        }
        break;

      case 'selfieStart':
        onAction?.({ type: 'START_SELFIE' });
        addBotMessage(getMessage('applicationComplete', l));
        setCurrentStep('applicationComplete');
        break;

      default:
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
