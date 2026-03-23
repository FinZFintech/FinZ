import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { useTheme } from '../../store/ThemeContext';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    content: 'We collect the following categories of information:\n\n' +
      'Personal Information: Name, date of birth, gender, PAN number, Aadhaar number, address, email, phone number, and photographs.\n\n' +
      'Financial Information: Bank account details, income details, credit score, employment information, and transaction history.\n\n' +
      'Device Information: Device model, operating system, unique device identifiers, IP address, and app usage data.\n\n' +
      'KYC Documents: Identity and address proof documents submitted during the verification process.',
  },
  {
    title: '2. How We Use Your Information',
    content: 'We use your information for:\n\n' +
      '(a) Processing and evaluating loan applications\n' +
      '(b) Identity verification and KYC compliance\n' +
      '(c) Credit assessment and risk evaluation\n' +
      '(d) Loan disbursement and servicing\n' +
      '(e) Communication regarding your account and transactions\n' +
      '(f) Fraud detection and prevention\n' +
      '(g) Improving our services and user experience\n' +
      '(h) Compliance with legal and regulatory requirements',
  },
  {
    title: '3. Information Sharing',
    content: 'We may share your information with:\n\n' +
      'Lending Partners: NBFCs and banks for loan processing and disbursement.\n\n' +
      'Credit Bureaus: CIBIL, Experian, Equifax for credit assessment and reporting.\n\n' +
      'Verification Services: Signzy, DigiLocker, NSDL for KYC and identity verification.\n\n' +
      'Account Aggregators: For income and financial data verification with your consent.\n\n' +
      'We do not sell your personal information to third parties for marketing purposes.',
  },
  {
    title: '4. Data Security',
    content: 'We implement industry-standard security measures to protect your data:\n\n' +
      '(a) End-to-end encryption for data transmission (TLS 1.3)\n' +
      '(b) AES-256 encryption for data at rest\n' +
      '(c) Multi-factor authentication for account access\n' +
      '(d) Regular security audits and vulnerability assessments\n' +
      '(e) Access controls and employee training on data handling\n' +
      '(f) Secure data centers with SOC 2 Type II compliance',
  },
  {
    title: '5. Data Retention',
    content: 'We retain your personal data for as long as your account is active or as needed to provide services. After loan closure, we retain records for a minimum period as required by RBI regulations and applicable laws (typically 5-8 years). Incomplete loan applications are auto-discarded after 7 days of inactivity.',
  },
  {
    title: '6. Your Rights',
    content: 'You have the right to:\n\n' +
      '(a) Access your personal data held by us\n' +
      '(b) Correct inaccurate or incomplete data\n' +
      '(c) Withdraw consent for data processing (subject to legal obligations)\n' +
      '(d) Request deletion of your data (subject to regulatory retention requirements)\n' +
      '(e) Receive your data in a portable format\n' +
      '(f) Lodge a complaint with the data protection authority',
  },
  {
    title: '7. Cookies and Tracking',
    content: 'The App may use local storage and analytics tools to improve user experience. We use anonymized usage data to understand app performance and user behavior. You can manage your preferences through your device settings.',
  },
  {
    title: '8. Third-Party Links',
    content: 'The App may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.',
  },
  {
    title: '9. Children\'s Privacy',
    content: 'Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected data from a minor, we will take steps to delete such information promptly.',
  },
  {
    title: '10. Updates to This Policy',
    content: 'We may update this Privacy Policy periodically. We will notify you of significant changes through the App or via email/SMS. The "Last Updated" date at the top indicates when the policy was last revised. Continued use of the App after updates constitutes acceptance of the revised policy.',
  },
];

const PrivacyPolicyScreen = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Privacy Policy" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        <Card>
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>Last updated: March 2026</Text>
          <Text style={[styles.intro, { color: colors.textPrimary }]}>
            FinZ Fintech Private Limited ("FinZ", "we", "us") is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, store, and share your personal information.
          </Text>
        </Card>

        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{section.title}</Text>
            <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>{section.content}</Text>
          </Card>
        ))}

        <Card>
          <Text style={[styles.contactTitle, { color: colors.textPrimary }]}>Data Protection Officer</Text>
          <Text style={[styles.contactText, { color: colors.textSecondary }]}>
            FinZ Fintech Private Limited{'\n'}
            Email: privacy@finz.co.in{'\n'}
            Phone: 1800-XXX-XXXX{'\n'}
            Address: [Registered Office Address]
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

export default PrivacyPolicyScreen;
