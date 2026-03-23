import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { useTheme } from '../../store/ThemeContext';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content: 'By downloading, installing, or using the FinZ mobile application ("App"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use the App. These Terms constitute a legally binding agreement between you and FinZ Fintech Private Limited ("Company", "we", "us").',
  },
  {
    title: '2. Eligibility',
    content: 'You must be at least 18 years of age and a citizen/resident of India to use the App. By using the App, you represent and warrant that you meet the eligibility requirements. For education loans, co-applicants (parents/guardians) must also meet the eligibility criteria as specified during the loan application process.',
  },
  {
    title: '3. Services Offered',
    content: 'FinZ provides digital lending services including but not limited to: (a) Education loans for students enrolled in approved educational institutions; (b) Employee loans for salaried professionals; (c) Credit score monitoring; (d) Loan management and servicing features. All loans are subject to eligibility criteria, credit assessment, and approval by our lending partners.',
  },
  {
    title: '4. KYC and Verification',
    content: 'You agree to provide accurate, current, and complete information during the KYC (Know Your Customer) verification process including PAN verification, Aadhaar-based eKYC, bank account verification, and income verification. You consent to the collection and verification of your personal and financial information through authorized third-party services including CIBIL, DigiLocker, and Account Aggregators.',
  },
  {
    title: '5. Loan Terms',
    content: 'Loan disbursement is subject to successful completion of all verification steps, credit assessment, and approval. Interest rates, processing fees, tenure, and EMI amounts will be clearly communicated before loan sanction. You are responsible for timely repayment of all EMIs as per the agreed schedule. Late payments may attract penalties and adversely affect your credit score.',
  },
  {
    title: '6. eNACH and eSign',
    content: 'By setting up eNACH (Electronic National Automated Clearing House), you authorize automatic debit of EMI amounts from your registered bank account. By executing eSign, you digitally sign the loan agreement and related documents. Both eNACH mandate and eSign are legally binding and equivalent to physical signatures under the Information Technology Act, 2000.',
  },
  {
    title: '7. Data Privacy',
    content: 'We collect, store, and process your personal data in accordance with our Privacy Policy and applicable data protection laws. Your data may be shared with our lending partners, credit bureaus, and authorized service providers for the purpose of loan processing and servicing. Please refer to our Privacy Policy for detailed information.',
  },
  {
    title: '8. User Obligations',
    content: 'You agree to: (a) Provide truthful and accurate information; (b) Not use the App for any unlawful purpose; (c) Maintain the confidentiality of your account credentials and OTP; (d) Promptly notify us of any unauthorized access to your account; (e) Not attempt to reverse engineer, modify, or tamper with the App.',
  },
  {
    title: '9. Intellectual Property',
    content: 'All content, trademarks, logos, and intellectual property displayed on the App are owned by FinZ Fintech Private Limited or its licensors. You are granted a limited, non-exclusive, non-transferable license to use the App for personal, non-commercial purposes only.',
  },
  {
    title: '10. Limitation of Liability',
    content: 'To the maximum extent permitted by law, FinZ shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App or services. Our total liability shall not exceed the amount of fees paid by you in the preceding 12 months.',
  },
  {
    title: '11. Grievance Redressal',
    content: 'For any complaints or grievances, you may contact our Grievance Officer at grievance@finz.co.in or call our helpline at 1800-XXX-XXXX. We aim to resolve all complaints within 15 business days from the date of receipt. If not satisfied, you may escalate to the RBI Ombudsman as per applicable regulations.',
  },
  {
    title: '12. Governing Law',
    content: 'These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.',
  },
  {
    title: '13. Amendments',
    content: 'We reserve the right to modify these Terms at any time. Changes will be effective upon posting the updated Terms on the App. Your continued use of the App after such changes constitutes acceptance of the modified Terms. We will notify you of material changes via the App or registered email/SMS.',
  },
];

const TermsAndConditionsScreen = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Terms & Conditions" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        <Card>
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>Last updated: March 2026</Text>
          <Text style={[styles.intro, { color: colors.textPrimary }]}>
            Please read these Terms and Conditions carefully before using the FinZ application.
          </Text>
        </Card>

        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{section.title}</Text>
            <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>{section.content}</Text>
          </Card>
        ))}

        <Card>
          <Text style={[styles.contactTitle, { color: colors.textPrimary }]}>Contact Us</Text>
          <Text style={[styles.contactText, { color: colors.textSecondary }]}>
            FinZ Fintech Private Limited{'\n'}
            Email: legal@finz.co.in{'\n'}
            Phone: 1800-XXX-XXXX
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
  lastUpdated: { fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  intro: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sectionContent: { fontSize: 14, lineHeight: 22 },
  contactTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  contactText: { fontSize: 14, lineHeight: 22 },
  bottomSpacer: { height: 100 },
});

export default TermsAndConditionsScreen;
