import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useTheme } from '../../store/ThemeContext';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DailyCheckInScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [streak, setStreak] = useState(0);
  const [checkedIn, setCheckedIn] = useState(false);
  const [weekStatus, setWeekStatus] = useState([false, false, false, false, false, false, false]);
  const [financialQuiz, setFinancialQuiz] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  useEffect(() => {
    loadCheckInData();
    loadQuiz();
  }, []);

  const loadCheckInData = useCallback(async () => {
    try {
      const lastCheckIn = await AsyncStorage.getItem('last_checkin');
      const streakData = await AsyncStorage.getItem('checkin_streak');
      const today = new Date().toDateString();

      if (lastCheckIn === today) {
        setCheckedIn(true);
      }
      setStreak(Number(streakData) || 0);

      const dayOfWeek = new Date().getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const ws = [...weekStatus];
      for (let i = 0; i <= adjustedDay; i++) ws[i] = i < adjustedDay || lastCheckIn === today;
      setWeekStatus(ws);
    } catch {
      // First time
    }
  }, []);

  const loadQuiz = useCallback(() => {
    const quizzes = [
      { question: 'What does CIBIL score range from?', options: ['0-100', '300-900', '100-1000', '0-850'], correct: 1 },
      { question: 'What is the full form of EMI?', options: ['Equal Monthly Income', 'Equated Monthly Installment', 'Every Month Interest', 'Equal Money Installment'], correct: 1 },
      { question: 'What percentage of income should ideally go to EMIs?', options: ['80%', '60%', '40%', '100%'], correct: 2 },
      { question: 'What is foreclosure of a loan?', options: ['Missing EMI payment', 'Paying loan before tenure', 'Loan rejection', 'Interest increase'], correct: 1 },
    ];
    setFinancialQuiz(quizzes[Math.floor(Math.random() * quizzes.length)]);
  }, []);

  const handleCheckIn = useCallback(async () => {
    const today = new Date().toDateString();
    const lastCheckIn = await AsyncStorage.getItem('last_checkin');
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let newStreak = lastCheckIn === yesterday ? streak + 1 : 1;

    await AsyncStorage.setItem('last_checkin', today);
    await AsyncStorage.setItem('checkin_streak', String(newStreak));
    setCheckedIn(true);
    setStreak(newStreak);

    const dayOfWeek = new Date().getDay();
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const ws = [...weekStatus];
    ws[adjustedDay] = true;
    setWeekStatus(ws);
  }, [streak, weekStatus]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Daily Check-In" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <ScrollView style={styles.content}>
        {/* Streak Card */}
        <Card style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={[styles.streakCount, { color: colors.secondary }]}>{streak}</Text>
          <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Day Streak</Text>
          <View style={styles.weekRow}>
            {DAYS.map((day, i) => (
              <View key={day} style={styles.dayItem}>
                <View style={[styles.dayCircle, { backgroundColor: colors.inputBg }, weekStatus[i] && { backgroundColor: colors.teal }]}>
                  <Text style={[styles.dayText, { color: colors.textSecondary }, weekStatus[i] && { color: colors.background }]}>
                    {weekStatus[i] ? '✓' : day[0]}
                  </Text>
                </View>
                <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{day}</Text>
              </View>
            ))}
          </View>
          {!checkedIn ? (
            <Button title="Check In Today" onPress={handleCheckIn} style={styles.checkInBtn} />
          ) : (
            <View style={styles.checkedBadge}>
              <Text style={[styles.checkedText, { color: colors.teal }]}>✓ Checked In Today!</Text>
            </View>
          )}
        </Card>

        {/* Financial Quiz */}
        {financialQuiz && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📝 Financial Quiz</Text>
            <Text style={[styles.quizQuestion, { color: colors.textPrimary }]}>{financialQuiz.question}</Text>
            {financialQuiz.options.map((opt, optIndex) => (
              <TouchableOpacity
                key={`quiz-${opt}`}
                style={[
                  styles.quizOption,
                  { borderColor: colors.border },
                  selectedAnswer === optIndex && optIndex === financialQuiz.correct && styles.correctOption,
                  selectedAnswer === optIndex && optIndex !== financialQuiz.correct && styles.wrongOption,
                  selectedAnswer !== null && optIndex === financialQuiz.correct && styles.correctOption,
                ]}
                onPress={() => setSelectedAnswer(optIndex)}
                disabled={selectedAnswer !== null}
              >
                <Text style={[styles.quizOptionText, { color: colors.textPrimary }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
            {selectedAnswer !== null && (
              <Text style={styles.quizResult}>
                {selectedAnswer === financialQuiz.correct
                  ? '🎉 Correct! Great financial knowledge!'
                  : '📚 Good try! Keep learning about finance.'}
              </Text>
            )}
          </Card>
        )}

        {/* Rewards Info */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🏆 Check-In Rewards</Text>
          <Text style={[styles.rewardItem, { color: colors.textSecondary }]}>7-day streak: Free credit score check</Text>
          <Text style={[styles.rewardItem, { color: colors.textSecondary }]}>14-day streak: ₹100 cashback on EMI</Text>
          <Text style={[styles.rewardItem, { color: colors.textSecondary }]}>30-day streak: Processing fee discount</Text>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  streakCard: { alignItems: 'center', backgroundColor: 'rgba(245,183,49,0.08)' },
  streakEmoji: { fontSize: 40 },
  streakCount: { fontSize: 48, fontWeight: '900' },
  streakLabel: { fontSize: 14, marginBottom: 16 },
  weekRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dayItem: { alignItems: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13, fontWeight: '600' },
  dayLabel: { fontSize: 10, marginTop: 4 },
  checkInBtn: { width: '100%' },
  checkedBadge: { backgroundColor: 'rgba(74,237,196,0.08)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  checkedText: { fontWeight: '700' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  quizQuestion: { fontSize: 15, fontWeight: '600', marginBottom: 12, lineHeight: 22 },
  quizOption: { padding: 12, borderRadius: 8, borderWidth: 1.5, marginBottom: 8 },
  correctOption: { borderColor: '#4AEDC4', backgroundColor: 'rgba(74,237,196,0.08)' },
  wrongOption: { borderColor: '#FF6B6B', backgroundColor: 'rgba(255,107,107,0.08)' },
  quizOptionText: { fontSize: 14 },
  quizResult: { fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  rewardItem: { fontSize: 14, lineHeight: 28 },
  bottomSpacer: { height: 100 },
});

export default DailyCheckInScreen;
