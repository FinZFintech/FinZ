import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Animated, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '../../store/ThemeContext';
import { useLoan } from '../../store/LoanContext';
import { useAuth } from '../../store/AuthContext';
import { getMessage, detectInputType, LANGUAGES, FBOT_STEPS } from './FBotEngine';

const { height: SCREEN_H } = Dimensions.get('window');
const BOT_AVATAR = '🤖';
const USER_AVATAR = '👤';

const FBot = ({ onAction }) => {
  const { colors } = useTheme();
  const { state } = useLoan();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentStep, setCurrentStep] = useState('welcome');
  const [typing, setTyping] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const flatListRef = useRef(null);
  const [minimized, setMinimized] = useState(false);

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
    }, 600 + Math.random() * 400);
  }, []);

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

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, typing]);

  // Start conversation when language is selected
  const selectLanguage = (langCode) => {
    setLang(langCode);
    addBotMessage(getMessage('welcome', langCode));

    // Check if we have prefill data
    const prefillName = state.borrowerDetails?.name || user?.name || '';
    setTimeout(() => {
      if (prefillName) {
        addBotMessage(getMessage('askName', langCode, { prefillName }));
      } else {
        addBotMessage(getMessage('askNameFresh', langCode));
      }
      setCurrentStep('askName');
    }, 1200);
  };

  // Process user input
  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addUserMessage(text);

    const detected = detectInputType(text);

    if (detected.type === 'help') {
      addBotMessage(getMessage('help', lang));
      return;
    }

    processStep(detected, text);
  };

  const processStep = (detected, rawText) => {
    const l = lang || 'en';

    switch (currentStep) {
      case 'askName':
        if (detected.type === 'confirm') {
          const name = state.borrowerDetails?.name || user?.name || '';
          onAction?.({ type: 'SET_NAME', value: name });
          addBotMessage(getMessage('askPhone', l));
          setCurrentStep('askPhone');
        } else if (detected.type === 'deny') {
          addBotMessage(getMessage('askNameFresh', l));
        } else if (detected.type === 'text') {
          onAction?.({ type: 'SET_NAME', value: detected.value });
          addBotMessage(getMessage('askPhone', l));
          setCurrentStep('askPhone');
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
          }, 2000);
        } else {
          addBotMessage(l === 'en'
            ? 'Please enter a valid 10-digit mobile number starting with 6-9.'
            : 'Please ek valid 10-digit mobile number enter karein jo 6-9 se start ho.');
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
                addBotMessage(l === 'en'
                  ? `I found your PAN: ${prefillPan}. Is this correct?`
                  : `Mujhe aapka PAN mila: ${prefillPan}. Kya ye sahi hai?`);
              } else {
                addBotMessage(getMessage('askPan', l));
              }
            }, 800);
          }, 1500);
        } else {
          addBotMessage(l === 'en'
            ? 'Please enter the 6-digit OTP sent to your mobile.'
            : 'Please 6-digit OTP enter karein jo aapke mobile pe aaya hai.');
        }
        break;

      case 'askPan':
        if (detected.type === 'confirm') {
          const pan = state.borrowerDetails?.pan || state.panDetails?.panNumber || '';
          onAction?.({ type: 'VERIFY_PAN', value: pan });
          addBotMessage(getMessage('waiting', l));
          setTimeout(() => {
            addBotMessage(getMessage('panVerified', l));
            setCurrentStep('creditCheck');
            setTimeout(() => {
              addBotMessage(getMessage('creditPassed', l));
              setCurrentStep('askOccupation');
              setTimeout(() => addBotMessage(getMessage('askOccupation', l)), 800);
            }, 2000);
          }, 1500);
        } else if (detected.type === 'pan') {
          onAction?.({ type: 'VERIFY_PAN', value: detected.value });
          addBotMessage(getMessage('waiting', l));
          setTimeout(() => {
            addBotMessage(getMessage('panVerified', l));
            setCurrentStep('creditCheck');
            setTimeout(() => {
              addBotMessage(getMessage('creditPassed', l));
              setCurrentStep('askOccupation');
              setTimeout(() => addBotMessage(getMessage('askOccupation', l)), 800);
            }, 2000);
          }, 1500);
        } else {
          addBotMessage(l === 'en'
            ? 'Please enter a valid PAN number (e.g. ABCDE1234F).'
            : 'Please ek valid PAN number enter karein (jaise ABCDE1234F).');
        }
        break;

      case 'askOccupation':
        if (detected.type === 'occupation' || detected.type === 'text') {
          const occ = detected.type === 'occupation' ? detected.value : rawText;
          onAction?.({ type: 'SET_OCCUPATION', value: occ });
          addBotMessage(getMessage('askBankDetails', l));
          setCurrentStep('askBankDetails');
        }
        break;

      case 'askBankDetails':
        if (detected.type === 'ifsc') {
          onAction?.({ type: 'SET_IFSC', value: detected.value });
          addBotMessage(l === 'en'
            ? 'IFSC noted. Now please share your account number.'
            : 'IFSC note kar liya. Ab please apna account number share karein.');
          setCurrentStep('askAccountNumber');
        } else if (detected.type === 'confirm') {
          addBotMessage(getMessage('kycStart', l));
          setCurrentStep('kycStart');
        } else {
          addBotMessage(l === 'en'
            ? 'Please share your bank IFSC code (11 characters, e.g. SBIN0001234).'
            : 'Please apna bank IFSC code share karein (11 characters, jaise SBIN0001234).');
        }
        break;

      case 'askAccountNumber':
        if (detected.type === 'accountNumber') {
          onAction?.({ type: 'SET_ACCOUNT', value: detected.value });
          addBotMessage(l === 'en'
            ? 'Bank details saved! ✅ Let me verify your income now...'
            : 'Bank details save ho gaye! ✅ Ab income verify karta hoon...');
          onAction?.({ type: 'VERIFY_BANK' });
          setTimeout(() => {
            addBotMessage(getMessage('kycStart', l));
            setCurrentStep('kycStart');
          }, 2000);
        }
        break;

      case 'kycStart':
        if (detected.type === 'confirm' || detected.type === 'text') {
          onAction?.({ type: 'START_KYC' });
          addBotMessage(getMessage('waiting', l));
          setTimeout(() => {
            addBotMessage(getMessage('kycOtp', l));
            setCurrentStep('kycOtp');
          }, 2000);
        }
        break;

      case 'kycOtp':
        if (detected.type === 'otp') {
          onAction?.({ type: 'VERIFY_KYC_OTP', value: detected.value });
          addBotMessage(getMessage('waiting', l));
          setTimeout(() => {
            addBotMessage(getMessage('kycDone', l));
            setCurrentStep('selfieStart');
            setTimeout(() => addBotMessage(getMessage('selfieStart', l)), 800);
          }, 2000);
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
        <Text style={styles.headerTitle}>🤖 FBot</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => setMinimized(!minimized)} style={{ marginRight: 16 }}>
            <Text style={styles.headerClose}>{minimized ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setVisible(false)}>
            <Text style={styles.headerClose}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

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
            ListFooterComponent={typing ? (
              <View style={[styles.msgRow, styles.msgRowBot]}>
                <Text style={styles.avatar}>{BOT_AVATAR}</Text>
                <View style={[styles.bubble, styles.bubbleBot, { backgroundColor: `${colors.teal}14` }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>typing...</Text>
                </View>
              </View>
            ) : null}
          />

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
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_H * 0.55, borderTopLeftRadius: 20, borderTopRightRadius: 20,
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
