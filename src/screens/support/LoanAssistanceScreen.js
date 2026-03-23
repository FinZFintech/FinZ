import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useTheme } from '../../store/ThemeContext';
import { useLoan } from '../../store/LoanContext';
import { getStatusLabel, getStepFromStatus } from '../../store/LoanContext';

const LOAN_STEPS = [
  {
    step: 0,
    label: 'Institute Selection',
    screen: 'InstituteSelection',
    icon: '🏫',
    description: 'Select your educational institution from our approved list.',
    tips: [
      'Search by institution name or city',
      'Only RBI-approved partner institutions are listed',
      'If your institute is not listed, contact support',
    ],
    troubleshoot: [
      { issue: 'Institute not found', solution: 'Verify the exact name. If still not found, the institute may not be in our partner network yet. Contact support to request addition.' },
      { issue: 'Page not loading', solution: 'Check your internet connection and try again. Pull down to refresh the list.' },
    ],
  },
  {
    step: 1,
    label: 'Student & Borrower Details',
    screen: 'StudentDetails',
    icon: '📝',
    description: 'Enter student information, select borrower type, and choose loan product.',
    tips: [
      'Enter details exactly as on your official documents',
      'Co-applicant (parent/guardian) details are mandatory for education loans',
      'Choose the loan product and tenure that fits your repayment capacity',
    ],
    troubleshoot: [
      { issue: 'Form validation errors', solution: 'Ensure all mandatory fields are filled. Names should match your PAN card. Date format should be DD/MM/YYYY.' },
      { issue: 'Unable to select borrower type', solution: 'Primary borrower must be 18+ years old. If student is minor, parent/guardian will be the primary borrower.' },
    ],
  },
  {
    step: 2,
    label: 'PAN Verification',
    screen: 'PanVerification',
    icon: '🪪',
    description: 'Verify your PAN card and check credit eligibility.',
    tips: [
      'Enter your 10-character PAN number accurately',
      'PAN details are fetched from NSDL/UTIITSL in real-time',
      'Your CIBIL score will be checked — 650+ is recommended',
    ],
    troubleshoot: [
      { issue: 'PAN not found', solution: 'Double-check the PAN number. Ensure there are no spaces or special characters. PAN format: ABCDE1234F.' },
      { issue: 'Credit check failed', solution: 'A score below 500 may lead to rejection. You can improve your score by clearing outstanding dues and checking back after 3 months.' },
      { issue: 'Name mismatch', solution: 'The name on PAN must match your application. If there is a genuine mismatch, you may need to update your PAN first.' },
    ],
  },
  {
    step: 3,
    label: 'Income Verification',
    screen: 'IncomeVerification',
    icon: '💰',
    description: 'Verify bank account and income details for eligibility assessment.',
    tips: [
      'Keep your bank account details and IFSC code ready',
      'A penny drop (₹1) will be done to verify your bank account',
      'Income is verified via Account Aggregator or bank statements',
    ],
    troubleshoot: [
      { issue: 'Penny drop failed', solution: 'Ensure the account number and IFSC are correct. The account must be active and in your name (matching PAN).' },
      { issue: 'Account Aggregator consent', solution: 'You will receive an OTP on your registered mobile to approve data sharing. This is a one-time consent for loan processing.' },
      { issue: 'Not eligible', solution: 'Eligibility is based on income-to-EMI ratio. Consider reducing loan amount or increasing tenure for better eligibility.' },
    ],
  },
  {
    step: 4,
    label: 'KYC Verification',
    screen: 'KycVerification',
    icon: '🔐',
    description: 'Complete identity verification via DigiLocker, CKYC, or Aadhaar XML.',
    tips: [
      'DigiLocker is the fastest method — use your Aadhaar-linked mobile',
      'CKYC works if you have existing KYC with any financial institution',
      'Ensure your Aadhaar address is current for successful verification',
    ],
    troubleshoot: [
      { issue: 'DigiLocker OTP not received', solution: 'OTP is sent to Aadhaar-linked mobile. If number changed, update with UIDAI first or use CKYC method instead.' },
      { issue: 'Address mismatch', solution: 'If KYC address differs from current address, you will be asked to provide address proof. Upload a valid utility bill or rent agreement.' },
      { issue: 'Face match failed', solution: 'Ensure good lighting, remove glasses/mask, and look directly at the camera. The selfie must match your Aadhaar photo.' },
    ],
  },
  {
    step: 5,
    label: 'Selfie Verification',
    screen: 'SelfieVerification',
    icon: '🤳',
    description: 'Take a live selfie for liveness check and face matching.',
    tips: [
      'Use front camera in a well-lit room',
      'Remove sunglasses, hats, or face coverings',
      'Follow the on-screen instructions for liveness detection',
    ],
    troubleshoot: [
      { issue: 'Camera not working', solution: 'Grant camera permission in your device settings. Go to Settings > Apps > FinZ > Permissions > Camera.' },
      { issue: 'Liveness check failing', solution: 'Ensure stable lighting (avoid backlighting). Hold the phone at arm\'s length and follow the prompts slowly.' },
      { issue: 'Face match score low', solution: 'Try again with better lighting. If it keeps failing, your Aadhaar photo may be outdated — contact support for VKYC assistance.' },
    ],
  },
  {
    step: 6,
    label: 'eNACH, eSign & VKYC',
    screen: 'EnachEsign',
    icon: '✍️',
    description: 'Set up auto-debit mandate, digitally sign loan agreement, and complete video KYC if required.',
    tips: [
      'eNACH sets up automatic EMI deduction from your bank',
      'eSign is your digital signature on the loan agreement — read it carefully',
      'VKYC (video call) is required for loans above ₹60,000',
    ],
    troubleshoot: [
      { issue: 'eNACH registration failed', solution: 'Your bank must support eNACH. Try with a different bank account or contact your bank to enable e-mandate.' },
      { issue: 'eSign OTP not received', solution: 'OTP is sent to your Aadhaar-linked mobile. Ensure the number is active. Wait 60 seconds before requesting again.' },
      { issue: 'VKYC call dropping', solution: 'Ensure a stable internet connection (preferably Wi-Fi). Keep the app in foreground during the video call.' },
    ],
  },
];

const LoanAssistanceScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, getResumeInfo } = useLoan();
  const [expandedStep, setExpandedStep] = useState(null);
  const [showRemoteHelp, setShowRemoteHelp] = useState(false);
  const [sessionCode, setSessionCode] = useState(null);
  const [waitingForAgent, setWaitingForAgent] = useState(false);

  const resumeInfo = getResumeInfo();
  const currentStep = resumeInfo ? resumeInfo.step : null;

  const handleGoToStep = (screen) => {
    navigation.navigate(screen);
  };

  const generateSessionCode = useCallback(() => {
    const code = 'FZ' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionCode(code);
    return code;
  }, []);

  const handleRequestRemoteAssistance = () => {
    const code = generateSessionCode();
    setWaitingForAgent(true);

    // Simulate agent connection after a delay
    setTimeout(() => {
      setWaitingForAgent(false);
      Alert.alert(
        'Agent Connected',
        `An agent is ready to assist you.\n\nSession: ${code}\nAgent: Support Team\n\nThe agent can see your current loan application step and will guide you through the process.\n\nYou will receive guidance via chat/call.`,
        [
          { text: 'Start Call', onPress: () => Linking.openURL('tel:1800XXXXXXX').catch(() => {}) },
          { text: 'Continue in App', style: 'cancel' },
        ]
      );
    }, 3000);
  };

  const handleCallAgent = () => {
    Alert.alert(
      'Connect with Agent',
      'Choose how you would like to connect:',
      [
        {
          text: 'Phone Call',
          onPress: () => Linking.openURL('tel:1800XXXXXXX').catch(() => {
            Alert.alert('Error', 'Unable to make a call from this device.');
          }),
        },
        {
          text: 'WhatsApp',
          onPress: () => Linking.openURL('https://wa.me/9198XXXXXXXX').catch(() => {
            Alert.alert('Error', 'WhatsApp is not installed on this device.');
          }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Loan Assistance" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        {/* Current Status */}
        {resumeInfo && (
          <Card style={[styles.statusCard, { backgroundColor: `${colors.teal}12` }]}>
            <Text style={[styles.statusTitle, { color: colors.teal }]}>Your Current Progress</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Application:</Text>
              <Text style={[styles.statusValue, { color: colors.textPrimary }]}>{resumeInfo.applicationId}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
              <Text style={[styles.statusValue, { color: colors.teal }]}>{resumeInfo.statusLabel}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Next Step:</Text>
              <Text style={[styles.statusValue, { color: colors.textPrimary }]}>{resumeInfo.screen}</Text>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${((resumeInfo.step + 1) / 7) * 100}%`, backgroundColor: colors.teal }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              Step {resumeInfo.step + 1} of 7 completed
            </Text>

            <Button
              title={`Resume: ${resumeInfo.screen}`}
              onPress={() => handleGoToStep(resumeInfo.screen)}
              style={styles.resumeBtn}
            />
          </Card>
        )}

        {!resumeInfo && (
          <Card style={styles.noAppCard}>
            <Text style={styles.noAppIcon}>📋</Text>
            <Text style={[styles.noAppTitle, { color: colors.textPrimary }]}>No Active Application</Text>
            <Text style={[styles.noAppText, { color: colors.textSecondary }]}>
              You don't have an active loan application. Start a new application or browse the step-by-step guide below.
            </Text>
            <Button title="Start New Application" onPress={() => navigation.navigate('InstituteSelection')} />
          </Card>
        )}

        {/* Remote Assistance Section */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🎧 Live Agent Assistance</Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Connect with a support agent who can see your current step in the loan journey and guide you in real-time.
          </Text>

          {!showRemoteHelp ? (
            <View style={styles.assistOptions}>
              <TouchableOpacity
                style={[styles.assistOption, { backgroundColor: `${colors.teal}12`, borderColor: `${colors.teal}30` }]}
                onPress={() => setShowRemoteHelp(true)}
              >
                <Text style={styles.assistOptionIcon}>🖥️</Text>
                <Text style={[styles.assistOptionTitle, { color: colors.teal }]}>Screen Sharing</Text>
                <Text style={[styles.assistOptionDesc, { color: colors.textSecondary }]}>
                  Agent sees your screen and guides you step-by-step
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.assistOption, { backgroundColor: `${colors.secondary}12`, borderColor: `${colors.secondary}30` }]}
                onPress={handleCallAgent}
              >
                <Text style={styles.assistOptionIcon}>📞</Text>
                <Text style={[styles.assistOptionTitle, { color: colors.secondary }]}>Voice Call</Text>
                <Text style={[styles.assistOptionDesc, { color: colors.textSecondary }]}>
                  Talk to an agent on call for verbal guidance
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.remoteSession}>
              {!sessionCode ? (
                <>
                  <Text style={[styles.remoteInfo, { color: colors.textSecondary }]}>
                    When you start a remote assistance session, an agent will be able to:
                  </Text>
                  <View style={styles.permissionList}>
                    <Text style={[styles.permissionItem, { color: colors.textPrimary }]}>
                      ✓ See which step you're on in the loan journey
                    </Text>
                    <Text style={[styles.permissionItem, { color: colors.textPrimary }]}>
                      ✓ View your screen to identify where you're stuck
                    </Text>
                    <Text style={[styles.permissionItem, { color: colors.textPrimary }]}>
                      ✓ Guide you with on-screen annotations
                    </Text>
                    <Text style={[styles.permissionItem, { color: colors.error }]}>
                      ✗ They cannot enter data or make changes on your behalf
                    </Text>
                    <Text style={[styles.permissionItem, { color: colors.error }]}>
                      ✗ They cannot access your passwords or OTPs
                    </Text>
                  </View>
                  <Button title="Start Remote Session" onPress={handleRequestRemoteAssistance} />
                  <TouchableOpacity style={styles.cancelLink} onPress={() => setShowRemoteHelp(false)}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.sessionCodeBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Text style={[styles.sessionCodeLabel, { color: colors.textSecondary }]}>Session Code</Text>
                    <Text style={[styles.sessionCode, { color: colors.teal }]}>{sessionCode}</Text>
                    {waitingForAgent && (
                      <Text style={[styles.waitingText, { color: colors.secondary }]}>
                        Connecting to agent...
                      </Text>
                    )}
                    {!waitingForAgent && (
                      <Text style={[styles.connectedText, { color: colors.success }]}>
                        Session active
                      </Text>
                    )}
                  </View>

                  {resumeInfo && (
                    <View style={[styles.sharedInfo, { backgroundColor: `${colors.teal}08`, borderColor: `${colors.teal}20` }]}>
                      <Text style={[styles.sharedInfoTitle, { color: colors.textPrimary }]}>Shared with Agent:</Text>
                      <Text style={[styles.sharedInfoItem, { color: colors.textSecondary }]}>
                        Current Step: {LOAN_STEPS[resumeInfo.step]?.label || 'Unknown'}
                      </Text>
                      <Text style={[styles.sharedInfoItem, { color: colors.textSecondary }]}>
                        Status: {resumeInfo.statusLabel}
                      </Text>
                      <Text style={[styles.sharedInfoItem, { color: colors.textSecondary }]}>
                        Application: {resumeInfo.applicationId}
                      </Text>
                    </View>
                  )}

                  <Button
                    title="End Session"
                    onPress={() => {
                      setSessionCode(null);
                      setShowRemoteHelp(false);
                      setWaitingForAgent(false);
                      Alert.alert('Session Ended', 'Your remote assistance session has been terminated.');
                    }}
                    variant="outline"
                  />
                </>
              )}
            </View>
          )}
        </Card>

        {/* Step-by-Step Guide */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📖 Step-by-Step Guide</Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Tap on any step to see detailed instructions and troubleshooting tips.
          </Text>
        </Card>

        {LOAN_STEPS.map((item) => {
          const isCurrentStep = currentStep !== null && item.step === currentStep;
          const isCompleted = currentStep !== null && item.step < currentStep;
          const isExpanded = expandedStep === item.step;

          return (
            <TouchableOpacity
              key={item.step}
              activeOpacity={0.8}
              onPress={() => setExpandedStep(isExpanded ? null : item.step)}
            >
              <Card
                style={[
                  isCurrentStep && { borderColor: colors.teal, borderWidth: 1.5 },
                  isCompleted && { opacity: 0.7 },
                ]}
              >
                <View style={styles.stepHeader}>
                  <View style={[
                    styles.stepBadge,
                    { backgroundColor: isCompleted ? colors.success : isCurrentStep ? colors.teal : colors.inputBg },
                  ]}>
                    <Text style={[
                      styles.stepBadgeText,
                      { color: isCompleted || isCurrentStep ? colors.background : colors.textSecondary },
                    ]}>
                      {isCompleted ? '✓' : item.icon}
                    </Text>
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={[styles.stepLabel, { color: colors.textPrimary }]}>
                      Step {item.step + 1}: {item.label}
                    </Text>
                    {isCurrentStep && (
                      <Text style={[styles.currentTag, { color: colors.teal }]}>← You are here</Text>
                    )}
                    {isCompleted && (
                      <Text style={[styles.completedTag, { color: colors.success }]}>Completed</Text>
                    )}
                  </View>
                  <Text style={[styles.expandIcon, { color: colors.teal }]}>
                    {isExpanded ? '▲' : '▼'}
                  </Text>
                </View>

                {isExpanded && (
                  <View style={styles.stepExpanded}>
                    <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>{item.description}</Text>

                    <Text style={[styles.tipsTitle, { color: colors.textPrimary }]}>Tips:</Text>
                    {item.tips.map((tip) => (
                      <Text key={tip} style={[styles.tipItem, { color: colors.textSecondary }]}>
                        • {tip}
                      </Text>
                    ))}

                    <Text style={[styles.troubleTitle, { color: colors.textPrimary }]}>Common Issues:</Text>
                    {item.troubleshoot.map((t) => (
                      <View key={t.issue} style={[styles.troubleItem, { backgroundColor: `${colors.error}08`, borderLeftColor: colors.secondary }]}>
                        <Text style={[styles.troubleIssue, { color: colors.textPrimary }]}>{t.issue}</Text>
                        <Text style={[styles.troubleSolution, { color: colors.textSecondary }]}>{t.solution}</Text>
                      </View>
                    ))}

                    {isCurrentStep && (
                      <Button
                        title={`Go to ${item.label}`}
                        onPress={() => handleGoToStep(item.screen)}
                        style={styles.goBtn}
                      />
                    )}
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}

        {/* Still Need Help */}
        <Card style={{ alignItems: 'center' }}>
          <Text style={styles.stillHelpIcon}>🆘</Text>
          <Text style={[styles.stillHelpTitle, { color: colors.textPrimary }]}>Still Need Help?</Text>
          <Text style={[styles.stillHelpText, { color: colors.textSecondary }]}>
            Our support team is available Monday-Saturday to assist you with your loan application.
          </Text>
          <Button title="Call Support: 080-6506 1588" onPress={() => Linking.openURL('tel:08065061588').catch(() => {})} variant="outline" />
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  statusCard: { paddingVertical: 16 },
  statusTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statusLabel: { fontSize: 13 },
  statusValue: { fontSize: 13, fontWeight: '600' },
  progressContainer: { height: 6, borderRadius: 3, marginTop: 12, marginBottom: 4 },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
  resumeBtn: { marginTop: 8 },
  noAppCard: { alignItems: 'center', paddingVertical: 24 },
  noAppIcon: { fontSize: 40, marginBottom: 8 },
  noAppTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  noAppText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  sectionDesc: { fontSize: 13, lineHeight: 20 },
  assistOptions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  assistOption: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  assistOptionIcon: { fontSize: 28, marginBottom: 8 },
  assistOptionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  assistOptionDesc: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  remoteSession: { marginTop: 12 },
  remoteInfo: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  permissionList: { marginBottom: 16 },
  permissionItem: { fontSize: 13, lineHeight: 24, paddingLeft: 4 },
  cancelLink: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  cancelText: { fontSize: 14 },
  sessionCodeBox: { alignItems: 'center', padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sessionCodeLabel: { fontSize: 12, marginBottom: 4 },
  sessionCode: { fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  waitingText: { fontSize: 13, marginTop: 8, fontWeight: '600' },
  connectedText: { fontSize: 13, marginTop: 8, fontWeight: '600' },
  sharedInfo: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  sharedInfoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  sharedInfoItem: { fontSize: 12, lineHeight: 20 },
  stepHeader: { flexDirection: 'row', alignItems: 'center' },
  stepBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stepBadgeText: { fontSize: 18 },
  stepInfo: { flex: 1 },
  stepLabel: { fontSize: 15, fontWeight: '600' },
  currentTag: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  completedTag: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  expandIcon: { fontSize: 12 },
  stepExpanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)' },
  stepDesc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  tipsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  tipItem: { fontSize: 13, lineHeight: 22, paddingLeft: 4 },
  troubleTitle: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  troubleItem: { padding: 10, borderRadius: 8, borderLeftWidth: 3, marginBottom: 8 },
  troubleIssue: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  troubleSolution: { fontSize: 13, lineHeight: 18 },
  goBtn: { marginTop: 12 },
  stillHelpIcon: { fontSize: 36, marginBottom: 8 },
  stillHelpTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  stillHelpText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  bottomSpacer: { height: 100 },
});

export default LoanAssistanceScreen;
