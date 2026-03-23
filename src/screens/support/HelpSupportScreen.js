import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useTheme } from '../../store/ThemeContext';

const FAQ_DATA = [
  {
    question: 'What types of loans does FinZ offer?',
    answer: 'FinZ currently offers Education Loans for students enrolled in approved institutions and Employee Loans for salaried professionals. More products are coming soon.',
  },
  {
    question: 'What documents are required for a loan?',
    answer: 'You will need: PAN card, Aadhaar card, bank account details, income proof (salary slips/bank statements), and institution admission letter (for education loans). All verification is done digitally.',
  },
  {
    question: 'How long does loan approval take?',
    answer: 'With complete documentation and successful verification, loans can be approved within minutes. The entire process from application to disbursement typically takes 24-48 hours.',
  },
  {
    question: 'How is the interest rate determined?',
    answer: 'Interest rates are determined based on your credit score, income, employment stability, and loan amount. Rates start from 11% p.a. for education loans.',
  },
  {
    question: 'Can I prepay or foreclose my loan?',
    answer: 'Yes, you can make part-payments or foreclose your loan at any time through the app. Go to My Loans > Loan Details > Prepayment to explore options.',
  },
  {
    question: 'What if my KYC verification fails?',
    answer: 'If your KYC fails due to document mismatch, you can retry with correct documents. For persistent issues, contact our support team for manual verification assistance.',
  },
  {
    question: 'How do I check my credit score?',
    answer: 'Go to the Engage tab or Profile > Credit Score to check your CIBIL score for free. Checking your score through FinZ does not affect your credit rating.',
  },
  {
    question: 'Is my data safe with FinZ?',
    answer: 'Yes, we use industry-standard encryption (AES-256) and follow RBI guidelines for data protection. Your data is never sold to third parties. Read our Privacy Policy for details.',
  },
];

const CONTACT_OPTIONS = [
  { icon: '📧', label: 'Email Us', detail: 'customersupport@finz.club', action: 'mailto:customersupport@finz.club' },
  { icon: '📞', label: 'Call Us', detail: '080-6506 1588', action: 'tel:08065061588' },
];

const HelpSupportScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleContact = (action) => {
    Linking.canOpenURL(action).then((supported) => {
      if (supported) {
        Linking.openURL(action);
      } else {
        Alert.alert('Unable to Open', 'This action is not supported on your device.');
      }
    });
  };

  const handleLoanAssistance = () => {
    navigation.navigate('LoanAssistance');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Help & Support" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        {/* Loan Assistance Banner */}
        <Card style={[styles.assistBanner, { backgroundColor: `${colors.teal}15` }]}>
          <Text style={styles.assistIcon}>🤝</Text>
          <Text style={[styles.assistTitle, { color: colors.teal }]}>Stuck in Loan Journey?</Text>
          <Text style={[styles.assistText, { color: colors.textSecondary }]}>
            Get step-by-step guidance or connect with a live agent who can see your screen and help you complete your application.
          </Text>
          <Button title="Get Assistance" onPress={handleLoanAssistance} style={styles.assistBtn} />
        </Card>

        {/* Contact Us */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contact Us</Text>
          {CONTACT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.contactRow, { borderBottomColor: colors.border }]}
              onPress={() => handleContact(opt.action)}
            >
              <Text style={styles.contactIcon}>{opt.icon}</Text>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
                <Text style={[styles.contactDetail, { color: colors.textSecondary }]}>{opt.detail}</Text>
              </View>
              <Text style={[styles.contactArrow, { color: colors.teal }]}>→</Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Office Hours */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Office Hours</Text>
          <View style={styles.hoursRow}>
            <Text style={[styles.hoursDay, { color: colors.textPrimary }]}>Monday - Friday</Text>
            <Text style={[styles.hoursTime, { color: colors.textSecondary }]}>9:00 AM - 7:00 PM</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={[styles.hoursDay, { color: colors.textPrimary }]}>Saturday</Text>
            <Text style={[styles.hoursTime, { color: colors.textSecondary }]}>10:00 AM - 4:00 PM</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={[styles.hoursDay, { color: colors.textPrimary }]}>Sunday & Holidays</Text>
            <Text style={[styles.hoursTime, { color: colors.error }]}>Closed</Text>
          </View>
        </Card>

        {/* FAQs */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Frequently Asked Questions</Text>
          {FAQ_DATA.map((faq, index) => (
            <TouchableOpacity
              key={faq.question}
              style={[styles.faqItem, { borderBottomColor: colors.border }]}
              onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
            >
              <View style={styles.faqHeader}>
                <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>{faq.question}</Text>
                <Text style={[styles.faqToggle, { color: colors.teal }]}>
                  {expandedFaq === index ? '−' : '+'}
                </Text>
              </View>
              {expandedFaq === index && (
                <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </Card>

        {/* Grievance */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Grievance Redressal</Text>
          <Text style={[styles.grievanceText, { color: colors.textSecondary }]}>
            If your concern is not resolved within 15 business days, you may escalate to our Grievance Officer:
          </Text>
          <Text style={[styles.grievanceDetail, { color: colors.textPrimary }]}>
            Grievance Officer{'\n'}
            Email: gro@finz.club{'\n'}
            Resolution Timeline: 15 business days
          </Text>
          <Text style={[styles.grievanceText, { color: colors.textSecondary, marginTop: 12 }]}>
            You may also approach the RBI Ombudsman for Digital Lending if your complaint remains unresolved.
          </Text>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  assistBanner: { alignItems: 'center', paddingVertical: 20 },
  assistIcon: { fontSize: 40, marginBottom: 8 },
  assistTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  assistText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 8 },
  assistBtn: { width: '100%' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
  contactIcon: { fontSize: 24, marginRight: 14 },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 15, fontWeight: '600' },
  contactDetail: { fontSize: 13, marginTop: 2 },
  contactArrow: { fontSize: 16 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  hoursDay: { fontSize: 14, fontWeight: '500' },
  hoursTime: { fontSize: 14 },
  faqItem: { paddingVertical: 14, borderBottomWidth: 0.5 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: 14, fontWeight: '600', flex: 1, paddingRight: 12 },
  faqToggle: { fontSize: 22, fontWeight: '700', width: 24, textAlign: 'center' },
  faqAnswer: { fontSize: 13, lineHeight: 20, marginTop: 10, paddingRight: 24 },
  grievanceText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  grievanceDetail: { fontSize: 14, lineHeight: 22, fontWeight: '500' },
  bottomSpacer: { height: 100 },
});

export default HelpSupportScreen;
