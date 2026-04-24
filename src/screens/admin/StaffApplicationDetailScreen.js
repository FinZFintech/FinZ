import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { loadRealApplications } from '../../utils/loadApplications';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, Linking, Image, Dimensions, Platform,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import InfoRow from '../../components/common/InfoRow';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { computeCustomerRiskSegment } from '../../utils/riskSegment';
import { smsService } from '../../services/smsService';
import { signzyService } from '../../services/signzyService';
import { kycService } from '../../services/kycService';
import { bankService } from '../../services/bankService';
import { loadAllRawData, saveApplicationToDb } from '../../services/applicationDbService';

// Verification keys that can be re-fired from the data we already have
// on state (PAN, phone, name, account number etc.) — no extra customer
// input needed. CKYC / ITR / form26AS are deliberately excluded because
// they need a fresh OTP / password from the customer.
const RETRYABLE_VERIFICATIONS = new Set([
  'phoneToPan', 'panFetch', 'fraudShieldLite', 'employmentBasic',
  'gstIncome', 'bankVerification', 'cibilBureau',
]);
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';

// ─── Tabs ────────────────────────────────────────────────────────────────────
const ALL_TABS = ['Details', 'Documents', 'Verifications', 'Raw Data', 'Comments', 'Communication'];
const RESTRICTED_TABS = ['Details', 'Documents', 'Verifications', 'Comments', 'Communication'];

/**
 * Labels for Signzy verification keys so the staff view can render a
 * card per verification without hard-coding display names inline.
 */
const SIGNZY_VERIFICATION_LABELS = {
  employmentBasic: 'Employment (UAN Basic)',
  phonePrefill: 'Phone Prefill',
  phoneToPan: 'Phone → PAN (Signzy)',
  panFetch: 'PAN Verification (Signzy)',
  bankVerification: 'Bank Account Verification (Penny Drop)',
  ckyc: 'CKYC',
  fraudShieldLite: 'FraudShield Lite',
  cibilBureau: 'CIBIL Bureau Report (Signzy)',
  gstIncome: 'GST Income (PAN → GSTIN)',
  itrPull: 'Income Tax Returns',
  form26AS: 'Form 26AS (TDS)',
};

/**
 * Renders a single image in its native aspect ratio. Uses Image.getSize
 * on mount so base64 / URL images don't get squashed into a fixed box.
 * Tap to fire `onPress` (used for zoom).
 */
const AspectImage = ({ uri, label, colors, onPress }) => {
  const [aspectRatio, setAspectRatio] = useState(3 / 4);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setAspectRatio(w / h);
      },
      () => {
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (!uri || error) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      {label ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, textAlign: 'center' }}>
          {label}
        </Text>
      ) : null}
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={!onPress}>
        <Image
          source={{ uri }}
          style={{
            width: '100%',
            aspectRatio,
            borderRadius: 12,
            backgroundColor: colors.background,
          }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
};

/**
 * Fullscreen zoom viewer for a single document image. Uses explicit
 * pixel dimensions from Dimensions.get('window') so the image renders
 * reliably (percentage widths inside an alignItems:'center' container
 * collapse to zero on RN web).
 */
const ImageZoomModal = ({ visible, uri, label, onClose }) => {
  const [aspectRatio, setAspectRatio] = useState(3 / 4);
  const [zoomed, setZoomed] = useState(false);
  const [dims, setDims] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => {
      if (sub?.remove) sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible || !uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setAspectRatio(w / h);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [visible, uri]);

  useEffect(() => {
    if (!visible) setZoomed(false);
  }, [visible]);

  if (!uri) return null;

  const HEADER_H = 80;
  const FOOTER_H = 60;
  const PAD = 16;
  const maxW = Math.max(100, dims.width - PAD * 2);
  const maxH = Math.max(100, dims.height - HEADER_H - FOOTER_H - PAD * 2);
  let imgW = maxW;
  let imgH = imgW / aspectRatio;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = imgH * aspectRatio;
  }
  const scale = zoomed ? 2 : 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: HEADER_H,
            paddingTop: 32,
            paddingHorizontal: 20,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
            {label || 'Document'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{ color: '#fff', fontSize: 24 }}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: PAD,
          }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bouncesZoom
        >
          <TouchableOpacity activeOpacity={1} onPress={() => setZoomed((z) => !z)}>
            <Image
              source={{ uri }}
              style={{
                width: imgW * scale,
                height: imgH * scale,
              }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </ScrollView>
        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            textAlign: 'center',
            height: FOOTER_H,
            lineHeight: FOOTER_H,
          }}
        >
          {zoomed ? 'Tap image to zoom out · pinch to zoom further' : 'Tap image to zoom 2x · pinch to zoom further'}
        </Text>
      </View>
    </Modal>
  );
};

// ─── Mock full application data builder ──────────────────────────────────────
function getFullApplication(app) {
  // Real applications (loaded from AsyncStorage via loadRealApplications)
  // already have all fields populated — don't overwrite them with mock
  // defaults. Mock applications (hardcoded in the dashboards) get demo
  // placeholder values so the detail screen doesn't show blanks.
  const isReal = app._isReal === true;

  const d = (realValue, mockDefault) =>
    realValue !== undefined && realValue !== null && realValue !== ''
      ? realValue
      : isReal ? (realValue ?? '') : mockDefault;

  return {
    ...app,
    // Customer details
    customerEmail: d(app.customerEmail, 'customer@email.com'),
    customerDob: d(app.customerDob, '15/06/2000'),
    customerGender: d(app.customerGender, 'Male'),
    customerAddress: d(app.customerAddress, '123, MG Road, Bangalore, Karnataka - 560001'),
    // Student / borrower
    studentName: d(app.studentName, app.customerName),
    fatherName: d(app.fatherName, isReal ? '' : 'Rajesh ' + (app.customerName || '').split(' ').pop()),
    courseName: d(app.courseName, 'B.Tech Computer Science'),
    regNo: d(app.regNo, 'REG' + (app.id || '').replace(/[^0-9]/g, '')),
    borrowerType: d(app.borrowerType, 'Self'),
    // PAN & Credit
    panNumber: d(app.panNumber, 'ABCDE1234F'),
    creditScore: app.creditScore ?? (isReal ? null : null),
    riskScore: app.riskScore ?? null,
    // KYC
    kycMethod: d(app.kycMethod, app.status !== 'draft' ? 'DigiLocker' : null),
    kycStatus: d(
      app.kycStatus,
      app.status === 'kyc_completed' || app.status === 'selfie_verified' ? 'Verified' : 'Pending',
    ),
    kycData: app.kycData || null,
    kycFailures: app.kycFailures || [],
    aadhaarLast4: d(app.aadhaarLast4, '4321'),
    // Bank
    bankName: d(app.bankName, 'State Bank of India'),
    accountNumber: d(app.accountNumber, 'XXXX XXXX 5678'),
    ifscCode: d(app.ifscCode, 'SBIN0001234'),
    pennyDropStatus: d(app.pennyDropStatus, 'Verified'),
    // Income
    monthlyIncome: app.monthlyIncome || (isReal ? 0 : 45000),
    incomeSource: d(app.incomeSource, 'Bank Statement'),
    foirRatio: d(app.foirRatio, '38%'),
    // Loan product
    product: d(app.product, 'Education Loan - EMI'),
    interestRate: app.interestRate || (isReal ? 0 : 14),
    tenure: app.tenure || (isReal ? 0 : 12),
    processingFee: d(app.processingFee, '2% + GST'),
    emi: app.emi || (isReal ? 0 : Math.round((app.amount || 0) * 0.09)),
    // eNACH / eSign
    enachStatus: d(app.enachStatus, 'Pending'),
    esignStatus: d(app.esignStatus, 'Pending'),
    // Signzy verifications — preserved as-is from the real application
    signzyVerifications: app.signzyVerifications || {},
    // Documents
    documents: app.documents || (isReal ? [] : [
      { id: 'doc_1', name: 'PAN Card', type: 'identity', uploadedAt: '2026-03-28', status: 'verified' },
      { id: 'doc_2', name: 'Aadhaar Card', type: 'identity', uploadedAt: '2026-03-28', status: 'verified' },
      { id: 'doc_3', name: 'Fee Receipt', type: 'academic', uploadedAt: '2026-03-27', status: 'pending_review' },
      { id: 'doc_4', name: 'Bank Statement (3 months)', type: 'financial', uploadedAt: '2026-03-27', status: 'verified' },
      { id: 'doc_5', name: 'Admission Letter', type: 'academic', uploadedAt: '2026-03-26', status: 'verified' },
      { id: 'doc_6', name: 'Selfie Photo', type: 'verification', uploadedAt: '2026-03-28', status: 'verified' },
    ]),
    // Comments / activity log
    comments: app.comments || (isReal ? [] : [
      { id: 'c1', author: 'System', role: 'system', text: 'Application created', timestamp: '2026-03-25T10:00:00Z' },
      { id: 'c2', author: 'Sales Executive', role: 'sales', text: 'Contacted customer, guided through institute selection', timestamp: '2026-03-26T11:30:00Z' },
      { id: 'c3', author: 'System', role: 'system', text: 'PAN verification completed', timestamp: '2026-03-27T09:15:00Z' },
      { id: 'c4', author: 'Credit Officer', role: 'credit', text: 'Credit score is satisfactory. Proceeding with income verification.', timestamp: '2026-03-28T14:00:00Z' },
    ]),
    // Staff documents
    staffDocuments: app.staffDocuments || [],
    // Communication log
    communications: app.communications || (isReal ? [] : [
      { id: 'comm_1', type: 'sms', to: app.customerPhone || '9876543210', message: 'Your loan application has been received. Application ID: ' + (app.id || 'N/A'), sentAt: '2026-03-25T10:05:00Z', sentBy: 'System' },
    ]),
  };
}

const StaffApplicationDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const userRole = user?.role || 'customer';
  const canApproveReject = userRole === 'admin' || userRole === 'credit';
  const { colors } = useTheme();
  const appData = route.params?.application || {};
  const [application, setApplication] = useState(() => getFullApplication(appData));
  const [activeTab, setActiveTab] = useState('Details');
  const [refreshing, setRefreshing] = useState(false);
  // Which verification key is currently being retried, so the
  // corresponding card disables its button + shows "Retrying…" until
  // we get a response or error back from the upstream service.
  const [retryingKey, setRetryingKey] = useState(null);

  // Whenever the screen comes into focus, re-fetch the latest version of
  // this application from Firestore / AsyncStorage. Without this the KYC
  // status / captured images / downstream API verifications that the
  // customer (or the bot) completed after the dashboard row was opened
  // still show as "Pending" because we're rendering the stale route-
  // params snapshot.
  useFocusEffect(useCallback(() => {
    const wantedId = appData?.id || appData?.applicationId;
    if (!wantedId) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await loadRealApplications();
        const fresh = all.find((a) => a.id === wantedId || a.applicationId === wantedId);
        if (!cancelled && fresh) {
          setApplication(getFullApplication(fresh));
        }
      } catch (err) {
        console.log('[StaffDetail] refresh failed:', err?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [appData?.id, appData?.applicationId]));

  // KYC image zoom modal state
  const [zoomImage, setZoomImage] = useState(null); // { uri, label } | null

  // Comment state
  const [newComment, setNewComment] = useState('');

  // Document upload state
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docName, setDocName] = useState('');
  const [docNotes, setDocNotes] = useState('');

  // Communication state
  const [showCommModal, setShowCommModal] = useState(false);
  const [commType, setCommType] = useState('sms');
  const [commMessage, setCommMessage] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 500));
    setRefreshing(false);
  }, []);

  const getRoleName = () => {
    const roles = { admin: 'Admin', credit: 'Credit Officer', sales: 'Sales Executive', operations: 'Operations Officer' };
    return roles[user?.role] || 'Staff';
  };

  // ─── Add Comment ───────────────────────────────────────────────────────────
  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const comment = {
      id: 'c_' + Date.now(),
      author: user?.name || getRoleName(),
      role: user?.role || 'staff',
      text: newComment.trim(),
      timestamp: new Date().toISOString(),
    };
    setApplication(prev => ({
      ...prev,
      comments: [...(prev.comments || []), comment],
    }));
    setNewComment('');
  };

  // ─── Add Staff Document ────────────────────────────────────────────────────
  const handleAddDocument = () => {
    if (!docName.trim()) {
      Alert.alert('Error', 'Please enter a document name');
      return;
    }
    const doc = {
      id: 'sdoc_' + Date.now(),
      name: docName.trim(),
      notes: docNotes.trim(),
      type: 'staff_upload',
      uploadedAt: new Date().toISOString().split('T')[0],
      uploadedBy: user?.name || getRoleName(),
      status: 'uploaded',
    };
    setApplication(prev => ({
      ...prev,
      staffDocuments: [...(prev.staffDocuments || []), doc],
    }));
    setShowDocUpload(false);
    setDocName('');
    setDocNotes('');
    Alert.alert('Success', 'Document added to application.');
  };

  // ─── Send Communication ────────────────────────────────────────────────────
  const handleSendCommunication = async () => {
    if (!commMessage.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    const comm = {
      id: 'comm_' + Date.now(),
      type: commType,
      to: application.customerPhone,
      message: commMessage.trim(),
      sentAt: new Date().toISOString(),
      sentBy: user?.name || getRoleName(),
    };

    // Try to actually send SMS if type is sms
    if (commType === 'sms' && application.customerPhone) {
      try {
        await smsService.sendSms(application.customerPhone, commMessage.trim());
      } catch (err) {
        console.warn('[StaffDetail] SMS send failed:', err.message);
      }
    }

    setApplication(prev => ({
      ...prev,
      communications: [...(prev.communications || []), comm],
      comments: [...(prev.comments || []), {
        id: 'c_' + Date.now(),
        author: user?.name || getRoleName(),
        role: user?.role || 'staff',
        text: `Sent ${commType.toUpperCase()} to customer: "${commMessage.trim().substring(0, 60)}${commMessage.length > 60 ? '...' : ''}"`,
        timestamp: new Date().toISOString(),
      }],
    }));
    setShowCommModal(false);
    setCommMessage('');
    Alert.alert('Success', `${commType.toUpperCase()} sent to ${application.customerPhone}.`);
  };

  // ─── Document status badge ─────────────────────────────────────────────────
  const getDocStatusStyle = (status) => {
    switch (status) {
      case 'verified': return { bg: `${colors.teal}15`, text: colors.teal, label: 'Verified' };
      case 'pending_review': return { bg: `${colors.warning}15`, text: colors.warning, label: 'Pending Review' };
      case 'rejected': return { bg: `${colors.error}15`, text: colors.error, label: 'Rejected' };
      case 'uploaded': return { bg: `${colors.info}15`, text: colors.info, label: 'Uploaded' };
      default: return { bg: `${colors.textSecondary}15`, text: colors.textSecondary, label: status };
    }
  };

  const getRiskColor = (score) => {
    if (!score) return colors.textSecondary;
    if (score >= 700) return colors.teal;
    if (score >= 500) return colors.warning;
    return colors.error;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // ─── DETAILS TAB ──────────────────────────────────────────────────────────
  const renderDetails = () => (
    <>
      {/* Application Overview */}
      <Card accent={colors.teal}>
        <View style={styles.overviewHeader}>
          <Text style={[styles.appIdLarge, { color: colors.textPrimary }]}>#{application.id}</Text>
          <StatusBadge status={application.status} />
        </View>
        <InfoRow label="Applied Date" value={formatDate(application.appliedDate)} />
        <InfoRow label="Assigned To" value={(application.assignedTo || 'N/A').charAt(0).toUpperCase() + (application.assignedTo || '').slice(1)} />
        {application.disbursementDate && <InfoRow label="Disbursed On" value={formatDate(application.disbursementDate)} />}
      </Card>

      {/* Application Timeline */}
      {(() => {
        const tl = application.timeline || application._rawState?.timeline || [];
        if (tl.length === 0) return null;

        const EVENT_LABELS = {
          institute_selected: 'Institute Selected',
          student_details: 'Student Details',
          borrower_details: 'Borrower Details',
          pan_verified: 'PAN Verified',
          credit_check: 'Credit Check',
          bank_details: 'Bank Details',
          penny_drop: 'Penny Drop',
          income_verified: 'Income Verified',
          eligibility_check: 'Eligibility Check',
          kyc_completed: 'KYC Completed',
          selfie_verified: 'Selfie Verified',
          enach: 'eNACH Mandate',
          esign: 'eSign',
          vkyc: 'Video KYC',
          submitted: 'Application Submitted',
        };

        return (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Application Timeline</Text>
            {tl.map((entry, idx) => {
              const label = EVENT_LABELS[entry.event] || entry.event;
              const isLast = idx === tl.length - 1;
              return (
                <View key={idx} style={{ flexDirection: 'row', minHeight: 40 }}>
                  {/* Timeline dot + line */}
                  <View style={{ width: 24, alignItems: 'center' }}>
                    <View style={{
                      width: 10, height: 10, borderRadius: 5, marginTop: 4,
                      backgroundColor: isLast ? colors.teal : colors.textSecondary,
                    }} />
                    {!isLast && (
                      <View style={{
                        width: 2, flex: 1,
                        backgroundColor: `${colors.textSecondary}40`,
                      }} />
                    )}
                  </View>
                  {/* Event text */}
                  <View style={{ flex: 1, paddingBottom: 12, paddingLeft: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                      {label}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {entry.at ? new Date(entry.at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      }) : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        );
      })()}

      {/* Customer Risk Segment */}
      {(() => {
        const riskSeg = computeCustomerRiskSegment(application._rawState || application);
        const segColor = riskSeg.color === 'teal' ? colors.teal : riskSeg.color === 'error' ? colors.error : colors.warning;
        return (
          <Card accent={segColor}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Customer Risk Profile</Text>
              <View style={{ backgroundColor: `${segColor}20`, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: segColor }}>
                <Text style={{ color: segColor, fontSize: 12, fontWeight: '800' }}>{riskSeg.segment} Risk</Text>
              </View>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{riskSeg.reason}</Text>
          </Card>
        );
      })()}

      {/* Rejection / Non-Eligibility Details */}
      {application.eligibilityResult?.eligible === false && (
        <Card accent={colors.error}>
          <Text style={[styles.sectionTitle, { color: colors.error }]}>Rejection Details</Text>
          {application.eligibilityResult.foir ? (
            <InfoRow label="FOIR" value={`${application.eligibilityResult.foir}%`} />
          ) : null}
          {application.eligibilityResult.emiCapacity != null ? (
            <InfoRow label="EMI Capacity" value={formatCurrency(application.eligibilityResult.emiCapacity)} />
          ) : null}
          {application.eligibilityResult.requestedEmi != null ? (
            <InfoRow label="Requested EMI" value={formatCurrency(application.eligibilityResult.requestedEmi)} />
          ) : null}
          {application.eligibilityResult.retryAfter ? (
            <InfoRow label="Retry After" value={application.eligibilityResult.retryAfter} />
          ) : null}
          {Array.isArray(application.eligibilityResult.rejectionReasons) && application.eligibilityResult.rejectionReasons.length > 0 && (
            <>
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginTop: 8, marginBottom: 4 }}>
                Rejection Reasons
              </Text>
              {application.eligibilityResult.rejectionReasons.map((reason, idx) => (
                <Text key={idx} style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                  {idx + 1}. {reason}
                </Text>
              ))}
            </>
          )}
        </Card>
      )}

      {/* Customer Details */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Customer Details</Text>
        <InfoRow label="Name" value={application.customerName} />
        <InfoRow label="Borrower Type" value={application.borrowerType === 'parent' ? 'Parent / Guardian' : 'Self (Student)'} />
        {application.borrowerType === 'parent' && (application._rawState?.borrowerDetails?.relation || application.borrowerRelation) ? (
          <InfoRow label="Relation to Student" value={application._rawState?.borrowerDetails?.relation || application.borrowerRelation} />
        ) : null}
        <InfoRow label="Phone" value={application.customerPhone} />
        <InfoRow label="Email" value={application.customerEmail} />
        <InfoRow label="Date of Birth" value={application.customerDob} />
        <InfoRow label="Gender" value={application.customerGender} />
        <InfoRow label="Address" value={application.customerAddress} />
      </Card>

      {/* Student / Academic Details */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Academic Details</Text>
        <InfoRow label="Institute" value={application.instituteName} />
        <InfoRow label="Course" value={application.courseName} />
        <InfoRow label="Registration No." value={application.regNo} />
        <InfoRow label="Student Name" value={application.studentName} />
        <InfoRow label="Father's Name" value={application.fatherName} />
        <InfoRow label="Borrower Type" value={application.borrowerType} />
      </Card>

      {/* PAN & Credit */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PAN & Credit</Text>
        <InfoRow label="PAN Number" value={application.panNumber} />
        {application.creditScore && (
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>CIBIL Score</Text>
              <Text style={[styles.scoreValue, { color: getRiskColor(application.creditScore) }]}>{application.creditScore}</Text>
            </View>
            {application.riskScore && (
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Risk Score</Text>
                <Text style={[styles.scoreValue, { color: getRiskColor(application.riskScore) }]}>{application.riskScore}</Text>
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Name Match Verification — authoritative pairs (PAN ↔ Bank ↔
          KYC) compared at a 70% threshold, borrower-entered name
          compared at a 40% threshold against those authoritative
          sources (users make typos + honorifics; as long as the
          customer-facing name is recognisable to one authoritative
          source we're fine). Overall verdict passes only when every
          available pair clears its respective threshold. */}
      {(() => {
        const AUTH_THRESHOLD = 70;       // PAN ↔ Bank ↔ KYC must match each other
        const BORROWER_THRESHOLD = 40;   // borrower-entered needs to be recognisable
        const raw = application._rawState || {};
        const borrowerName = application.customerName || raw.borrowerDetails?.name || '';
        const panName = application.panName
          || raw.panDetails?.name
          || raw.signzyVerifications?.panFetch?.result?.name
          || raw.signzyVerifications?.phoneToPan?.result?.name
          || '';
        const bankName = raw.pennyDropResult?.accountHolderName
          || raw.signzyVerifications?.bankVerification?.result?.accountHolderName
          || '';
        const kycName = application.kycData?.name || raw.kycData?.name || '';

        const authSources = [
          { key: 'pan',  label: 'PAN Name',            name: panName },
          { key: 'bank', label: 'Bank Account Holder', name: bankName },
          { key: 'kyc',  label: 'KYC Name',            name: kycName },
        ].filter((s) => s.name && s.name.trim());

        if (authSources.length === 0 && !borrowerName) return null;

        // Token-overlap match score: normalize, drop honorifics, split
        // on whitespace, intersection / union of token sets. Cheap,
        // works well for "MR RAHUL DWIVEDI" vs "Rahul Dwivedi" etc.
        const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'sri']);
        const tokenize = (s) => String(s || '')
          .toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter((t) => t && !HONORIFICS.has(t));
        const matchScore = (a, b) => {
          const ta = tokenize(a); const tb = tokenize(b);
          if (!ta.length || !tb.length) return 0;
          const setA = new Set(ta); const setB = new Set(tb);
          let inter = 0; setA.forEach((t) => { if (setB.has(t)) inter++; });
          const union = new Set([...setA, ...setB]).size;
          return Math.round((inter / union) * 100);
        };

        // Authoritative pairwise matches — every pair among
        // {PAN, Bank, KYC} that exists must clear AUTH_THRESHOLD.
        const authPairs = [];
        for (let i = 0; i < authSources.length; i++) {
          for (let j = i + 1; j < authSources.length; j++) {
            authPairs.push({
              a: authSources[i], b: authSources[j],
              score: matchScore(authSources[i].name, authSources[j].name),
            });
          }
        }

        // Borrower vs each authoritative source — must clear
        // BORROWER_THRESHOLD against ALL of them (a typo in one place
        // shouldn't look like a match just because it rhymes with a
        // different source).
        const borrowerPairs = borrowerName
          ? authSources.map((s) => ({
              a: { key: 'borrower', label: 'Borrower Name (entered)', name: borrowerName },
              b: s,
              score: matchScore(borrowerName, s.name),
            }))
          : [];

        const authOk = authPairs.every((p) => p.score >= AUTH_THRESHOLD);
        const borrowerOk = borrowerPairs.every((p) => p.score >= BORROWER_THRESHOLD);
        const overallOk = authOk && borrowerOk;

        // Headline % for the summary pill — keep the simplest thing
        // that conveys severity: average of every pair we considered.
        const allPairs = [...authPairs, ...borrowerPairs];
        const overall = allPairs.length
          ? Math.round(allPairs.reduce((sum, p) => sum + p.score, 0) / allPairs.length)
          : 0;
        const overallColor = overallOk ? colors.teal : (authPairs.some((p) => p.score < 40) || borrowerPairs.some((p) => p.score < 20)) ? colors.error : colors.warning;
        const overallLabel = overallOk ? 'MATCH' : 'REVIEW';

        const pillColor = (score, threshold) => (score >= threshold ? colors.teal
          : score >= Math.max(threshold - 20, 10) ? colors.warning
          : colors.error);

        return (
          <Card accent={overallColor}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Name Match Verification</Text>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 32, fontWeight: '800', color: overallColor }}>{overall}%</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: overallColor }}>{overallLabel}</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 8 }}>
                PAN / Bank / KYC must match each other at ≥ {AUTH_THRESHOLD}%; borrower-entered name at ≥ {BORROWER_THRESHOLD}%.
              </Text>
            </View>

            {borrowerName ? <InfoRow label="Borrower Name (entered)" value={borrowerName} /> : null}
            {authSources.map((s) => (
              <InfoRow key={s.key} label={s.label} value={s.name} />
            ))}

            {authPairs.length > 0 ? (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 14, marginBottom: 4 }}>
                  Authoritative pairs (≥ {AUTH_THRESHOLD}%)
                </Text>
                {authPairs.map((p, i) => {
                  const c = pillColor(p.score, AUTH_THRESHOLD);
                  const pass = p.score >= AUTH_THRESHOLD;
                  return (
                    <View
                      key={`auth-${i}`}
                      style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {p.a.label.replace(/Name.*$/, '').trim()} ↔ {p.b.label.replace(/Name.*$/, '').trim()}
                      </Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${c}1A` }}>
                        <Text style={{ color: c, fontSize: 12, fontWeight: '700' }}>
                          {pass ? '✓' : '✕'} {p.score}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}

            {borrowerPairs.length > 0 ? (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 14, marginBottom: 4 }}>
                  Borrower vs authoritative (≥ {BORROWER_THRESHOLD}%)
                </Text>
                {borrowerPairs.map((p, i) => {
                  const c = pillColor(p.score, BORROWER_THRESHOLD);
                  const pass = p.score >= BORROWER_THRESHOLD;
                  return (
                    <View
                      key={`b-${i}`}
                      style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        Borrower ↔ {p.b.label.replace(/Name.*$/, '').trim()}
                      </Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${c}1A` }}>
                        <Text style={{ color: c, fontSize: 12, fontWeight: '700' }}>
                          {pass ? '✓' : '✕'} {p.score}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}
          </Card>
        );
      })()}

      {/* Face Match / Selfie Results */}
      {(application.selfieData || application._rawState?.selfieData) && (() => {
        const selfie = application.selfieData || application._rawState?.selfieData || {};
        return (
          <Card accent={selfie.matched ? colors.teal : colors.error}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Face Match / Selfie Verification</Text>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <Text style={{
                fontSize: 28, fontWeight: '800',
                color: selfie.matched ? colors.teal : colors.error,
              }}>
                {selfie.faceMatchPercentage || '0%'}
              </Text>
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: selfie.matched ? colors.teal : colors.error,
              }}>
                {selfie.matched ? 'FACE MATCHED' : 'FACE NOT MATCHED'}
              </Text>
            </View>
            <InfoRow label="Face Match" value={selfie.matched ? 'Yes' : 'No'} highlight={selfie.matched} />
            <InfoRow label="Match Percentage" value={selfie.faceMatchPercentage || '—'} />
            <InfoRow label="Liveness Verified" value={selfie.livenessVerified ? 'Yes' : 'No'} highlight={selfie.livenessVerified} />
            {selfie.timestamp ? (
              <InfoRow label="Captured At" value={formatDate(selfie.timestamp)} />
            ) : null}
            {selfie.location ? (
              <InfoRow label="Location" value={selfie.location} />
            ) : null}
          </Card>
        );
      })()}

      {/* KYC Details */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>KYC Verification</Text>
        <InfoRow label="KYC Method" value={application.kycMethod || 'Not Started'} />
        <InfoRow label="KYC Status" value={application.kycStatus} highlight={application.kycStatus === 'Verified'} />
        <InfoRow label="Aadhaar (Last 4)" value={'XXXX ' + application.aadhaarLast4} />

        {/* CKYC identifiers */}
        {application.kycData?.ckycNumber ? (
          <InfoRow label="CKYC Number" value={application.kycData.ckycNumber} />
        ) : null}
        {application.kycData?.ckycReferenceNo ? (
          <InfoRow label="CKYC Reference No." value={application.kycData.ckycReferenceNo} />
        ) : null}
        {application.kycData?.validatedAt ? (
          <InfoRow label="Validated At" value={formatDate(application.kycData.validatedAt)} />
        ) : null}

        {/* Extracted KYC personal details (when available) */}
        {application.kycData?.name ? (
          <InfoRow label="KYC Name" value={application.kycData.name} />
        ) : null}
        {application.kycData?.fatherName ? (
          <InfoRow label="Father's Name" value={application.kycData.fatherName} />
        ) : null}
        {application.kycData?.motherName ? (
          <InfoRow label="Mother's Name" value={application.kycData.motherName} />
        ) : null}
        {application.kycData?.spouseName ? (
          <InfoRow label="Spouse's Name" value={application.kycData.spouseName} />
        ) : null}
        {application.kycData?.dob ? (
          <InfoRow label="Date of Birth" value={application.kycData.dob} />
        ) : null}
        {application.kycData?.gender ? (
          <InfoRow label="Gender" value={application.kycData.gender} />
        ) : null}
      </Card>

      {/* KYC Contact Details */}
      {(application.kycData?.email ||
        application.kycData?.mobileNumber ||
        application.kycData?.officePhone ||
        application.kycData?.residentialPhone) && (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>KYC Contact Details</Text>
          {application.kycData?.mobileNumber ? (
            <InfoRow
              label="Mobile"
              value={
                application.kycData.mobileCountryCode
                  ? `+${application.kycData.mobileCountryCode} ${application.kycData.mobileNumber}`
                  : application.kycData.mobileNumber
              }
            />
          ) : null}
          {application.kycData?.email ? (
            <InfoRow label="Email" value={application.kycData.email} />
          ) : null}
          {application.kycData?.residentialPhone ? (
            <InfoRow label="Residential Phone" value={application.kycData.residentialPhone} />
          ) : null}
          {application.kycData?.officePhone ? (
            <InfoRow label="Office Phone" value={application.kycData.officePhone} />
          ) : null}
        </Card>
      )}

      {/* KYC Identity Documents */}
      {Array.isArray(application.kycData?.documents) && application.kycData.documents.length > 0 && (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            KYC Identity Documents ({application.kycData.documents.length})
          </Text>
          {application.kycData.documents.map((doc, idx) => (
            <View
              key={doc.sequence || idx}
              style={{
                paddingVertical: 8,
                borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{doc.label}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{doc.number}</Text>
              {doc.verificationStatus ? (
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                  Status: {doc.verificationStatus}
                  {doc.dateOfIssue ? ` · Issued ${doc.dateOfIssue}` : ''}
                  {doc.dateOfExpiry ? ` · Expires ${doc.dateOfExpiry}` : ''}
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      )}

      {/* KYC Permanent Address */}
      {(application.kycData?.permanentAddress?.addressLine || application.kycData?.address) && (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Permanent Address</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {application.kycData?.permanentAddress?.addressLine || application.kycData?.address}
          </Text>
          {(application.kycData?.permanentAddress?.city || application.kycData?.city) ? (
            <InfoRow
              label="City"
              value={application.kycData?.permanentAddress?.city || application.kycData?.city}
            />
          ) : null}
          {(application.kycData?.permanentAddress?.state || application.kycData?.state) ? (
            <InfoRow
              label="State"
              value={application.kycData?.permanentAddress?.state || application.kycData?.state}
            />
          ) : null}
          {(application.kycData?.permanentAddress?.pincode || application.kycData?.pincode) ? (
            <InfoRow
              label="Pincode"
              value={application.kycData?.permanentAddress?.pincode || application.kycData?.pincode}
            />
          ) : null}
        </Card>
      )}

      {/* KYC Correspondence Address — when distinct from permanent */}
      {application.kycData?.correspondenceAddress?.addressLine &&
        !application.kycData?.sameAddress && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Correspondence Address</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
              {application.kycData.correspondenceAddress.addressLine}
            </Text>
            {application.kycData.correspondenceAddress.city ? (
              <InfoRow label="City" value={application.kycData.correspondenceAddress.city} />
            ) : null}
            {application.kycData.correspondenceAddress.state ? (
              <InfoRow label="State" value={application.kycData.correspondenceAddress.state} />
            ) : null}
            {application.kycData.correspondenceAddress.pincode ? (
              <InfoRow label="Pincode" value={application.kycData.correspondenceAddress.pincode} />
            ) : null}
          </Card>
        )}

      {/* KYC Documents — partition into "have a URL we can render" and
          "captured but not stored". The previous render dropped a
          full placeholder card per missing image (Photograph, Form,
          Identity Proof, Signature → 4 separate boxes). When image
          storage isn't configured, that's just noise — every image is
          unstored, every banner says the same thing. Now we show one
          banner per card that lists every captured-but-unstored doc. */}
      {Array.isArray(application.kycData?.images) && application.kycData.images.length > 0 && (() => {
        const labelOf = (img, idx) => img.label || `Document ${idx + 1}`;
        const stored = [];
        const unstored = [];
        application.kycData.images.forEach((img, idx) => {
          const imgUri = img?.uri && !String(img.uri).startsWith('[') ? img.uri : null;
          if (imgUri) stored.push({ img, idx, uri: imgUri, label: labelOf(img, idx) });
          else unstored.push({ img, idx, label: labelOf(img, idx) });
        });

        return (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              KYC Documents ({application.kycData.images.length})
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
              All images returned by {application.kycData?.method || application.kycMethod || 'the KYC source'}.
              {stored.length > 0 ? ' Tap to zoom.' : ''}
            </Text>

            {/* Stored images render as before */}
            {stored.map(({ img, idx, uri, label }) => (
              <AspectImage
                key={img.sequence || idx}
                uri={uri}
                label={label}
                colors={colors}
                onPress={() => setZoomImage({ uri, label })}
              />
            ))}

            {/* One consolidated banner for everything that wasn't persisted */}
            {unstored.length > 0 && (
              <View
                style={{
                  padding: 14, borderRadius: 10, marginTop: stored.length > 0 ? 12 : 0,
                  borderWidth: 1, borderStyle: 'dashed',
                  borderColor: colors.border, backgroundColor: colors.inputBg,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: 6 }}>
                  ⚠️ {unstored.length} document{unstored.length === 1 ? '' : 's'} captured but not stored
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
                  Image storage isn't configured. Set up free Cloudinary or upgrade
                  Firebase to Blaze, and the next KYC will persist the files.
                </Text>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                  Captured documents:
                </Text>
                {unstored.map(({ idx, label }) => (
                  <Text key={idx} style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8 }}>
                    • {label}
                  </Text>
                ))}
              </View>
            )}
          </Card>
        );
      })()}

      {/* KYC Failure History — every failed attempt across every method */}
      {Array.isArray(application.kycFailures) && application.kycFailures.length > 0 && (
        <Card accent={colors.warning}>
          <Text style={[styles.sectionTitle, { color: colors.warning }]}>
            KYC Failure History ({application.kycFailures.length})
          </Text>
          {application.kycFailures.map((failure, idx) => (
            <View
              key={idx}
              style={{
                paddingVertical: 8,
                borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                {(failure.method || 'unknown').toUpperCase()} · {failure.stage || 'unknown stage'}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{failure.reason}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                {failure.statusCode ? `HTTP ${failure.statusCode} · ` : ''}
                {failure.errorCode ? `${failure.errorCode} · ` : ''}
                {failure.at ? formatDate(failure.at) : ''}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Bank Details */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bank Details</Text>
        <InfoRow label="Bank Name" value={application.bankName} />
        <InfoRow label="Account No." value={application.accountNumber} />
        <InfoRow label="IFSC" value={application.ifscCode} />
        <InfoRow label="Penny Drop" value={application.pennyDropStatus} highlight={application.pennyDropStatus === 'Verified'} />
      </Card>

      {/* Income Details */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Income Details</Text>
        {/* Occupation type is the OCCUPATION_CATEGORIES label
            ("Salaried – Private Sector" etc.), not the employer name.
            Before this card existed it showed up under "Income Source"
            which was misleading — moved to its own row and the Income
            Source row was renamed to Verification Source (where the
            income number came from: AA / BSA / manual / EPFO). */}
        <InfoRow label="Occupation Type" value={
          application._rawState?.bankDetails?.occupationCategory
          || application._rawState?.borrowerDetails?.occupation
          || '—'
        } />
        <InfoRow label="Employer / Company" value={
          application._rawState?.borrowerDetails?.employer
          || application._rawState?.signzyVerifications?.employmentBasic?.result?.recentEmployer?.establishmentName
          || '—'
        } />
        <InfoRow label="Monthly Income" value={formatCurrency(application.monthlyIncome)} />
        <InfoRow label="Verification Source" value={application.incomeSource} />
        <InfoRow label="FOIR Ratio" value={application.foirRatio} />
      </Card>

      {/* Loan Product */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Loan Product</Text>
        <InfoRow label="Product" value={application.product} />
        <InfoRow label="Loan Amount" value={formatCurrency(application.amount)} highlight />
        <InfoRow label="Interest Rate" value={`${application.interestRate}% p.a.`} />
        <InfoRow label="Tenure" value={`${application.tenure} months`} />
        <InfoRow label="EMI" value={formatCurrency(application.emi)} />
        <InfoRow label="Processing Fee" value={application.processingFee} />
      </Card>

      {/* eNACH / eSign */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>eNACH & eSign</Text>
        <InfoRow label="eNACH Status" value={application.enachStatus} highlight={application.enachStatus === 'Completed'} />
        <InfoRow label="eSign Status" value={application.esignStatus} highlight={application.esignStatus === 'Completed'} />
      </Card>

      {application.reason && (
        <Card accent={colors.warning}>
          <Text style={[styles.sectionTitle, { color: colors.warning }]}>Remarks / Flags</Text>
          <Text style={[styles.reasonText, { color: colors.textPrimary }]}>{application.reason}</Text>
        </Card>
      )}

      {/* Admin Action History */}
      {application.adminAction && (
        <Card accent={application.adminAction.action === 'approve' ? colors.teal : colors.error}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Last Admin Action</Text>
          <InfoRow
            label="Action"
            value={application.adminAction.action === 'approve' ? 'Approved' : 'Rejected'}
            highlight={application.adminAction.action === 'approve'}
          />
          <InfoRow label="By" value={application.adminAction.by || 'Unknown'} />
          {application.adminAction.at ? (
            <InfoRow label="Date" value={formatDate(application.adminAction.at)} />
          ) : null}
        </Card>
      )}
    </>
  );

  // ─── DOCUMENTS TAB ─────────────────────────────────────────────────────────
  const renderDocuments = () => (
    <>
      {/* Customer Documents */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Customer Documents</Text>
        {(application.documents || []).map(doc => {
          const st = getDocStatusStyle(doc.status);
          return (
            <View key={doc.id} style={[styles.docRow, { borderBottomColor: colors.border }]}>
              <View style={styles.docInfo}>
                <Text style={[styles.docName, { color: colors.textPrimary }]}>{doc.name}</Text>
                <Text style={[styles.docMeta, { color: colors.textSecondary }]}>
                  {doc.type} — Uploaded {formatDate(doc.uploadedAt)}
                </Text>
              </View>
              <View style={[styles.docStatusBadge, { backgroundColor: st.bg }]}>
                <Text style={[styles.docStatusText, { color: st.text }]}>{st.label}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      {/* Staff Uploaded Documents */}
      <Card>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Supporting Documents (Staff)</Text>
        </View>

        {(application.staffDocuments || []).length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No supporting documents added yet.</Text>
        ) : (
          (application.staffDocuments || []).map(doc => {
            const st = getDocStatusStyle(doc.status);
            return (
              <View key={doc.id} style={[styles.docRow, { borderBottomColor: colors.border }]}>
                <View style={styles.docInfo}>
                  <Text style={[styles.docName, { color: colors.textPrimary }]}>{doc.name}</Text>
                  <Text style={[styles.docMeta, { color: colors.textSecondary }]}>
                    By {doc.uploadedBy} — {formatDate(doc.uploadedAt)}
                  </Text>
                  {doc.notes ? <Text style={[styles.docNotes, { color: colors.textSecondary }]}>{doc.notes}</Text> : null}
                </View>
                <View style={[styles.docStatusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.docStatusText, { color: st.text }]}>{st.label}</Text>
                </View>
              </View>
            );
          })
        )}

        <Button
          title="+ Add Supporting Document"
          onPress={() => setShowDocUpload(true)}
          variant="outline"
          style={styles.addBtn}
        />
      </Card>
    </>
  );

  // ─── COMMENTS TAB ─────────────────────────────────────────────────────────
  const renderComments = () => {
    const roleColors = {
      system: colors.textSecondary,
      admin: colors.error,
      credit: colors.warning,
      sales: colors.teal,
      operations: colors.info,
    };

    return (
      <>
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activity Log & Comments</Text>
          {(application.comments || []).map(comment => (
            <View key={comment.id} style={[styles.commentItem, { borderLeftColor: roleColors[comment.role] || colors.teal }]}>
              <View style={styles.commentHeader}>
                <Text style={[styles.commentAuthor, { color: roleColors[comment.role] || colors.teal }]}>
                  {comment.author}
                </Text>
                <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
                  {formatTimestamp(comment.timestamp)}
                </Text>
              </View>
              <Text style={[styles.commentText, { color: colors.textPrimary }]}>{comment.text}</Text>
            </View>
          ))}
        </Card>

        {/* Add Comment */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Add Comment</Text>
          <TextInput
            style={[styles.commentInput, {
              color: colors.textPrimary,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }]}
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Write a comment or note..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
          <Button
            title="Post Comment"
            onPress={handleAddComment}
            disabled={!newComment.trim()}
            style={styles.addBtn}
          />
        </Card>
      </>
    );
  };

  // ─── VERIFICATIONS TAB (Signzy) ──────────────────────────────────────────
  /**
   * Renders the structured result (or the failure reason) for every
   * Signzy verification the app has run against this application.
   * Each verification is keyed in state.signzyVerifications so more
   * APIs can drop in here without a UI change to the tab framework.
   */
  const renderVerifications = () => {
    const verifications = application.signzyVerifications || {};
    const entries = Object.entries(verifications);

    if (entries.length === 0) {
      return (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Signzy Verifications</Text>
          <Text style={{ color: colors.textSecondary }}>
            No Signzy verifications have been run for this application yet.
            Results from automated checks (employment, phone intelligence,
            email, etc.) will appear here once they are triggered during
            the application flow.
          </Text>
        </Card>
      );
    }

    return (
      <>
        {entries.map(([key, entry]) => {
          const label = SIGNZY_VERIFICATION_LABELS[key] || key;
          const status = entry?.status || 'unknown';
          const isSuccess = status === 'success';

          return (
            <Card key={key} accent={isSuccess ? colors.teal : colors.warning}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>{label}</Text>
                <Text
                  style={{
                    color: isSuccess ? colors.teal : colors.warning,
                    fontSize: 12,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                  }}
                >
                  {status}
                </Text>
              </View>
              {entry?.fetchedAt ? (
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>
                  Fetched: {formatDate(entry.fetchedAt)}
                </Text>
              ) : null}

              {/* Success body: type-specific rendering */}
              {isSuccess && key === 'employmentBasic' && renderEmploymentBasic(entry.result)}
              {isSuccess && key === 'phonePrefill' && renderPhonePrefill(entry.result)}
              {isSuccess && key === 'phoneToPan' && renderPhoneToPan(entry.result)}
              {isSuccess && key === 'panFetch' && renderPanFetch(entry.result)}
              {isSuccess && key === 'bankVerification' && renderBankVerification(entry.result)}
              {isSuccess && key === 'ckyc' && renderCkycResult(entry.result)}
              {isSuccess && key === 'fraudShieldLite' && renderFraudShield(entry.result)}
              {isSuccess && key === 'cibilBureau' && renderCibilBureau(entry.result)}
              {isSuccess && key === 'gstIncome' && renderGstIncome(entry.result)}
              {isSuccess && key === 'itrPull' && renderItrPull(entry.result)}
              {isSuccess && key === 'form26AS' && renderForm26AS(entry.result)}
              {isSuccess && !['employmentBasic', 'phonePrefill', 'phoneToPan', 'panFetch', 'bankVerification', 'ckyc', 'fraudShieldLite', 'cibilBureau', 'gstIncome', 'itrPull', 'form26AS'].includes(key) && (
                renderGenericResult(entry.result)
              )}

              {/* Failure body — shows the upstream error and, when the
                  call is replayable from the data we already have on
                  state (no fresh OTP / password required), a Retry
                  button so sales / credit can re-fire the API without
                  asking the customer to come back. Calls that need
                  user input (CKYC OTP, ITR password) get a hint
                  instead, telling the reviewer to ask the customer. */}
              {!isSuccess ? (
                <View>
                  {entry?.error ? (
                    <View
                      style={{
                        backgroundColor: `${colors.warning}14`,
                        padding: 12, borderRadius: 8, marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: colors.warning, fontWeight: '600', marginBottom: 4 }}>
                        {entry.error.message || 'Verification failed'}
                      </Text>
                      {entry.error.statusCode ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                          HTTP {entry.error.statusCode}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {RETRYABLE_VERIFICATIONS.has(key) ? (
                    <TouchableOpacity
                      style={{
                        paddingVertical: 10, borderRadius: 8, borderWidth: 1,
                        borderColor: colors.teal, alignItems: 'center',
                        opacity: retryingKey === key ? 0.6 : 1,
                      }}
                      onPress={() => retryVerification(key)}
                      disabled={retryingKey === key}
                    >
                      <Text style={{ color: colors.teal, fontWeight: '700' }}>
                        {retryingKey === key ? 'Retrying…' : '↻ Retry verification'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontStyle: 'italic' }}>
                      Needs fresh customer input (OTP / password) — please ask the
                      customer to redo this step from the app.
                    </Text>
                  )}
                </View>
              ) : null}
            </Card>
          );
        })}
      </>
    );
  };

  /**
   * Structured render of an Employment UAN Basic result.
   */
  const renderEmploymentBasic = (result) => {
    if (!result) return null;
    const recent = result.recentEmployer || {};
    const uans = Array.isArray(result.uans) ? result.uans : [];

    return (
      <>
        <InfoRow
          label="Currently Employed"
          value={result.isEmployed ? 'Yes' : 'No'}
          highlight={result.isEmployed}
        />
        <InfoRow label="UANs Linked" value={String(result.uanCount ?? 0)} />
        {result.dateOfExitMarked ? (
          <InfoRow label="Date of Exit Marked" value="Yes" />
        ) : null}

        {recent.establishmentName ? (
          <>
            <Text style={[styles.subSectionTitle || { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }]}>
              Most Recent Employer
            </Text>
            <InfoRow label="Employer" value={recent.establishmentName} />
            {recent.matchingUan ? (
              <InfoRow label="UAN" value={recent.matchingUan} />
            ) : null}
            {recent.memberId ? (
              <InfoRow label="Member ID" value={recent.memberId} />
            ) : null}
            {recent.establishmentId ? (
              <InfoRow label="Establishment ID" value={recent.establishmentId} />
            ) : null}
            {recent.dateOfJoining ? (
              <InfoRow label="Date of Joining" value={recent.dateOfJoining} />
            ) : null}
            {recent.dateOfExit ? (
              <InfoRow label="Date of Exit" value={recent.dateOfExit} />
            ) : null}
            {recent.employerConfidenceScore != null ? (
              <InfoRow
                label="Employer Confidence"
                value={String(recent.employerConfidenceScore)}
              />
            ) : null}
          </>
        ) : null}

        {uans.length > 0 ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              UAN Details ({uans.length})
            </Text>
            {uans.map((u, idx) => (
              <View
                key={u.uan || idx}
                style={{
                  paddingVertical: 8,
                  borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                  {u.uan}
                </Text>
                {u.name ? (
                  <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {u.name}
                    {u.gender ? ` · ${u.gender}` : ''}
                    {u.dob ? ` · DOB ${u.dob}` : ''}
                  </Text>
                ) : null}
                {u.establishmentName ? (
                  <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {u.establishmentName}
                    {u.dateOfJoining ? ` · Joined ${u.dateOfJoining}` : ''}
                    {u.dateOfExit ? ` · Exited ${u.dateOfExit}` : ''}
                  </Text>
                ) : null}
                {u.leaveReason ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                    Leave reason: {u.leaveReason}
                  </Text>
                ) : null}
              </View>
            ))}
          </>
        ) : null}
      </>
    );
  };

  /**
   * Fallback structured render for any Signzy result the screen doesn't
   * have a dedicated renderer for yet. Walks the object and emits one
   * InfoRow per scalar field so staff sees a readable key/value list
   * instead of raw JSON.
   */
  const renderGenericResult = (result) => {
    if (result == null || typeof result !== 'object') {
      return (
        <Text style={{ color: colors.textSecondary }}>
          {String(result ?? '—')}
        </Text>
      );
    }
    const rows = [];
    const walk = (obj, prefix = '') => {
      for (const [k, v] of Object.entries(obj || {})) {
        if (v == null) continue;
        if (/^(rawResponse|raw|image|photo|signature|photograph|images|rawJson|pdfBase64)$/i.test(k)) continue;
        const keyLabel = (prefix ? prefix + ' · ' : '') + k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        if (typeof v === 'object' && !Array.isArray(v)) {
          walk(v, keyLabel);
        } else if (Array.isArray(v)) {
          rows.push([keyLabel, `${v.length} item(s)`]);
        } else {
          rows.push([keyLabel, String(v)]);
        }
        if (rows.length > 40) break; // keep the card bounded
      }
    };
    walk(result);
    return (
      <>
        {rows.map(([k, v]) => (
          <InfoRow key={k} label={k} value={v} />
        ))}
      </>
    );
  };

  /**
   * Phone → PAN (Signzy phoneToPan) — shows just the resolved PAN and
   * the demographic fields the gateway returned.
   */
  const renderPhoneToPan = (result) => {
    if (!result) return null;
    return (
      <>
        <InfoRow label="PAN" value={result.panNumber || '—'} />
        <InfoRow label="Name" value={result.name || '—'} />
        {result.dateOfBirth ? <InfoRow label="Date of Birth" value={result.dateOfBirth} /> : null}
        {result.gender ? <InfoRow label="Gender" value={result.gender} /> : null}
      </>
    );
  };

  /**
   * PAN Verification (Signzy verifyPan / panFetch).
   */
  const renderPanFetch = (result) => {
    if (!result) return null;
    return (
      <>
        <InfoRow label="PAN Status" value={result.panStatus || result.status || '—'} />
        {result.panStatusLabel ? <InfoRow label="Status Label" value={result.panStatusLabel} /> : null}
        <InfoRow label="Name on PAN" value={result.name || '—'} />
        <InfoRow label="Holder Type" value={result.typeOfHolder || (result.isIndividual ? 'Individual' : '—')} />
        <InfoRow label="Aadhaar Linked" value={result.aadhaarSeedingStatus || '—'} highlight={result.aadhaarSeedingStatus === 'Y'} />
        {result.individualTaxComplianceStatus ? (
          <InfoRow label="Tax Compliance" value={result.individualTaxComplianceStatus} />
        ) : null}
      </>
    );
  };

  /**
   * Bank account verification (penny drop).
   */
  const renderBankVerification = (result) => {
    if (!result) return null;
    return (
      <>
        <InfoRow label="Verified" value={result.verified ? 'Yes' : 'No'} highlight={!!result.verified} />
        <InfoRow label="Account Holder" value={result.accountHolderName || '—'} />
        <InfoRow label="Name Match" value={result.nameMatch ? 'Yes' : 'No'} highlight={!!result.nameMatch} />
        {result.nameMatchScore != null ? (
          <InfoRow label="Name Match Score" value={String(result.nameMatchScore)} />
        ) : null}
        {result.bankRefNo ? <InfoRow label="Bank Reference" value={result.bankRefNo} /> : null}
        {result.accountNumberLast4 ? (
          <InfoRow label="Account (last 4)" value={result.accountNumberLast4} />
        ) : null}
      </>
    );
  };

  /**
   * CKYC verification — name / DOB / address / documents pulled from
   * CERSAI. Keeps it compact; full doc list is in the Details tab.
   */
  const renderCkycResult = (result) => {
    if (!result) return null;
    return (
      <>
        <InfoRow label="CKYC Number" value={result.ckycNumber || '—'} />
        <InfoRow label="Reference No." value={result.ckycReferenceNo || '—'} />
        <InfoRow label="Name" value={result.name || '—'} />
        {result.fatherName ? <InfoRow label="Father's Name" value={result.fatherName} /> : null}
        {result.dob ? <InfoRow label="Date of Birth" value={result.dob} /> : null}
        {result.gender ? <InfoRow label="Gender" value={result.gender} /> : null}
        {result.address || result.addressLine ? (
          <InfoRow label="Address" value={result.address || result.addressLine} />
        ) : null}
        {result.pincode ? <InfoRow label="Pincode" value={result.pincode} /> : null}
        {Array.isArray(result.documents) && result.documents.length > 0 ? (
          <InfoRow label="Documents" value={`${result.documents.length} on file`} />
        ) : null}
      </>
    );
  };

  /**
   * Structured render of a Phone Prefill result.
   */
  const renderPhonePrefill = (result) => {
    if (!result) return null;
    const alternates = result.alternatePhones || [];
    const emails = result.emails || [];
    const addresses = result.addresses || [];
    const voterIds = result.voterIds || [];
    const passports = result.passports || [];
    const drivingLicenses = result.drivingLicenses || [];
    const name = result.name || {};
    const primary = result.primaryAddress || null;

    return (
      <>
        {/* Demographics */}
        {name.fullName ? <InfoRow label="Name" value={name.fullName} /> : null}
        {result.pan ? <InfoRow label="PAN (reported)" value={result.pan} /> : null}
        {result.dob ? <InfoRow label="Date of Birth" value={result.dob} /> : null}
        {result.age ? <InfoRow label="Age" value={result.age} /> : null}
        {result.gender ? <InfoRow label="Gender" value={result.gender} /> : null}
        {result.income ? <InfoRow label="Reported Income" value={result.income} /> : null}

        {/* Primary address */}
        {primary ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Primary / Most-Recent Address
            </Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
              {primary.address}
              {primary.state ? `, ${primary.state}` : ''}
              {primary.postal ? ` - ${primary.postal}` : ''}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
              {primary.type || 'Address'}
              {primary.reportedDate ? ` · reported ${primary.reportedDate}` : ''}
            </Text>
          </>
        ) : null}

        {/* Alternate phones */}
        {alternates.length > 0 ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Alternate Phones ({alternates.length})
            </Text>
            {alternates.map((p, idx) => (
              <Text key={idx} style={{ color: colors.textSecondary, marginBottom: 2 }}>• {p}</Text>
            ))}
          </>
        ) : null}

        {/* Emails */}
        {emails.length > 0 ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Emails ({emails.length})
            </Text>
            {emails.map((e, idx) => (
              <Text key={idx} style={{ color: colors.textSecondary, marginBottom: 2 }}>• {e}</Text>
            ))}
          </>
        ) : null}

        {/* Address history */}
        {addresses.length > 0 ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Address History ({addresses.length})
            </Text>
            {addresses.map((a, idx) => (
              <View
                key={idx}
                style={{
                  paddingVertical: 8,
                  borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textPrimary }}>
                  {a.address}
                  {a.state ? `, ${a.state}` : ''}
                  {a.postal ? ` - ${a.postal}` : ''}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                  {a.type || 'Address'}
                  {a.reportedDate ? ` · reported ${a.reportedDate}` : ''}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Identity documents */}
        {(voterIds.length > 0 || passports.length > 0 || drivingLicenses.length > 0) ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Identity Documents on File
            </Text>
            {passports.map((p, idx) => (
              <InfoRow key={`pp-${idx}`} label={passports.length > 1 ? `Passport ${idx + 1}` : 'Passport'} value={p} />
            ))}
            {voterIds.map((v, idx) => (
              <InfoRow key={`vo-${idx}`} label={voterIds.length > 1 ? `Voter ID ${idx + 1}` : 'Voter ID'} value={v} />
            ))}
            {drivingLicenses.map((dl, idx) => (
              <InfoRow key={`dl-${idx}`} label={drivingLicenses.length > 1 ? `Driving License ${idx + 1}` : 'Driving License'} value={dl} />
            ))}
          </>
        ) : null}
      </>
    );
  };

  /**
   * Structured render of a FraudShield Lite result.
   * Organizes the response into headline trust score, then collapsible
   * sections for cybercrime, digital identity, finance, phone, email,
   * pincode and IP blacklist.
   */

  /**
   * CIBIL Bureau Report (Signzy soft pull). Surfaces the headline
   * score with traffic-light colouring + the matched identity /
   * addresses + a link to the full CIBIL PDF the bureau returned.
   */
  const renderCibilBureau = (result) => {
    if (!result) return null;
    const score = result.cibilScore;
    let scoreColor = colors.textSecondary;
    let scoreLabel = '—';
    if (typeof score === 'number') {
      if (score < 0) { scoreLabel = 'No hit / NTC'; scoreColor = colors.warning; }
      else if (score >= 750) { scoreLabel = 'Excellent'; scoreColor = colors.teal; }
      else if (score >= 700) { scoreLabel = 'Good'; scoreColor = colors.teal; }
      else if (score >= 600) { scoreLabel = 'Fair'; scoreColor = colors.warning; }
      else if (score >= 500) { scoreLabel = 'Borderline'; scoreColor = colors.warning; }
      else { scoreLabel = 'Below threshold'; scoreColor = colors.error; }
    }
    return (
      <>
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          padding: 12, borderRadius: 10, backgroundColor: `${scoreColor}14`, marginBottom: 12,
        }}>
          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 2 }}>CIBIL Score</Text>
            <Text style={{ color: scoreColor, fontSize: 28, fontWeight: '800' }}>
              {score == null ? '—' : score}
            </Text>
          </View>
          <Text style={{ color: scoreColor, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            {scoreLabel}
          </Text>
        </View>
        <InfoRow label="Gating Decision" value={result.gatingPassed ? 'Pass' : 'Fail'} highlight={!!result.gatingPassed} />
        {result.matchedName ? <InfoRow label="Name (CIBIL)" value={result.matchedName} /> : null}
        {result.matchedDob ? <InfoRow label="DOB (CIBIL)" value={result.matchedDob} /> : null}
        {result.matchedPan ? <InfoRow label="PAN (CIBIL)" value={result.matchedPan} /> : null}
        {result.scoreName ? <InfoRow label="Score Model" value={result.scoreName} /> : null}
        {result.scoreDate ? <InfoRow label="Score Date" value={result.scoreDate} /> : null}
        {result.enquiryControlNumber ? <InfoRow label="Enquiry Control No." value={result.enquiryControlNumber} /> : null}
        {Array.isArray(result.matchedAddresses) && result.matchedAddresses.length > 0 ? (
          <>
            <Text style={[{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }]}>
              Addresses on file
            </Text>
            {result.matchedAddresses.map((a, i) => (
              <View key={i} style={{ paddingVertical: 6, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{a.line1 || '—'}</Text>
                {a.line2 ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{a.line2}</Text> : null}
                {a.pincode ? <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Pincode: {a.pincode}</Text> : null}
              </View>
            ))}
          </>
        ) : null}
        {result.pdfUrl ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(result.pdfUrl).catch(() => {})}
            style={{
              marginTop: 12, paddingVertical: 10, borderRadius: 8,
              borderWidth: 1, borderColor: colors.teal, alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.teal, fontWeight: '700' }}>View Full CIBIL PDF</Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  };

  const renderFraudShield = (result) => {
    if (!result) return null;
    const ts = result.trustScore || {};
    const cc = result.cyberCrimeCheck || {};
    const di = result.digitalIdentity || {};
    const fi = result.financeDetails || {};
    const ph = result.phoneDetails || {};
    const em = result.emailDetails || {};
    const pc = result.pincodeDetails || {};
    const ip = result.ipBlacklist || {};

    const scoreColor =
      ts.score > 750 ? colors.teal
        : ts.score > 500 ? colors.teal
          : ts.score > 300 ? colors.warning
            : colors.error;

    const SectionHeader = ({ title, impact }) => (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{title}</Text>
        {impact ? <Text style={{ fontSize: 11, color: colors.textSecondary }}>{impact}</Text> : null}
      </View>
    );

    const Row = ({ label, value }) => {
      if (!value && value !== 0) return null;
      return <InfoRow label={label} value={String(value)} />;
    };

    return (
      <>
        {/* Headline trust score */}
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 40, fontWeight: '800', color: scoreColor }}>
            {ts.score || '—'}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: scoreColor, marginTop: 2 }}>
            {ts.riskCategory || 'Unknown'}
          </Text>
          {ts.nameMatch ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
              Name match: {ts.nameMatch}
            </Text>
          ) : null}
        </View>

        {/* Cybercrime */}
        <SectionHeader title="Cybercrime Check" impact={cc.impact} />
        <Row label="Phone Flagged" value={cc.phoneNumber} />
        <Row label="Email Flagged" value={cc.email} />

        {/* Digital Identity */}
        <SectionHeader title="Digital Identity" impact={di.impact} />
        <Row label="Digital Identity Score" value={di.score} />
        <Row label="Digital Footprint" value={di.digitalFootprint} />
        <Row label="E-commerce" value={di.ecomFootprint} />
        <Row label="Social" value={di.socialFootprint} />
        <Row label="Travel" value={di.travelFootprint} />
        <Row label="Fintech Count" value={di.fintechCount} />
        <Row label="Age Band" value={di.ageBand} />
        <Row label="Gender" value={di.gender} />
        <Row label="First Name Match" value={di.firstNameMatch} />
        <Row label="Last Name Match" value={di.lastNameMatch} />
        <Row label="Phone First Seen" value={di.phoneFirstSeenYear} />
        <Row label="Email First Seen" value={di.emailFirstSeenYear} />
        <Row label="Phone↔Email Match" value={di.phoneEmailMatch} />
        <Row label="Same Phone-Name Count" value={di.samePhoneNameCount} />
        <Row label="Different Phone-Name Count" value={di.differentPhoneNameCount} />

        {/* Finance */}
        <SectionHeader title="Finance Details" impact={fi.impact} />
        <Row label="DMAT Account" value={fi.dmatAccount} />
        <Row label="Mutual Fund" value={fi.hasMutualFund} />
        <Row label="Credit Card" value={fi.hasCreditCard} />
        <Row label="Occupation" value={fi.occupation} />
        <Row label="Business Owner" value={fi.businessOwner} />

        {/* Phone */}
        <SectionHeader title="Phone Details" impact={ph.impact} />
        <Row label="Customer Name" value={ph.customerName} />
        <Row label="Connection Type" value={ph.connectionType} />
        <Row label="Current Provider" value={ph.currentServiceProvider} />
        <Row label="Original Provider" value={ph.originalServiceProvider} />
        <Row label="Ported" value={ph.isPorted} />
        <Row label="Deactivated Days" value={ph.phoneDeactivatedDays} />
        <Row label="Deactivation Count" value={ph.phoneDeactivationCount} />

        {/* Email */}
        <SectionHeader title="Email Details" impact={em.impact} />
        <Row label="Status" value={em.status} />
        <Row label="Free Email" value={em.freeEmail} />
        <Row label="Sub Status" value={em.subStatus} />
        <Row label="Domain" value={em.domain} />
        <Row label="Domain Age (days)" value={em.domainAgeDays} />
        {em.emailBreach.length > 0 ? (
          <Row label="Breaches" value={em.emailBreach.length + ' breach(es) found'} />
        ) : null}

        {/* Pincode */}
        <SectionHeader title="Pincode" impact={pc.impact} />
        <Row label="Blacklisted" value={pc.blacklisted} />
        <Row label="Phone-Pincode Match" value={pc.phonePincodeMatchCount} />
        <Row label="Email-Pincode Match" value={pc.emailPincodeMatchCount} />

        {/* IP Blacklist */}
        {ip.impact ? (
          <>
            <SectionHeader title="IP Blacklist" impact={ip.impact} />
            <Row label="Tor" value={ip.isTor} />
            <Row label="VPN" value={ip.isVpn} />
            <Row label="Proxy" value={ip.isProxy} />
            <Row label="Bot" value={ip.isBot} />
            <Row label="Malware" value={ip.isMalware} />
            <Row label="Spyware" value={ip.isSpyware} />
            <Row label="Listed" value={ip.isListed} />
            <Row label="Lists Count" value={ip.listCount} />
            {ip.city ? <Row label="IP Location" value={`${ip.city}, ${ip.region || ''} ${ip.country || ''}`} /> : null}
          </>
        ) : null}
      </>
    );
  };

  /**
   * Structured render of a GST Income (PAN → GSTIN) result.
   */
  const renderGstIncome = (result) => {
    if (!result) return null;

    if (!result.found) {
      return (
        <Text style={{ color: colors.textSecondary }}>
          No GSTIN linked to this PAN. The applicant may not be GST-registered.
        </Text>
      );
    }

    const detail = result.gstinDetail || {};
    const principal = detail.principalPlace || {};
    const filingStatus = detail.filingStatus || [];
    const filingFreq = detail.returnFilingFrequency || [];
    const directors = detail.directorNames || [];
    const activities = detail.activities || [];
    const panToGst = result.panToGst || {};
    const allGstins = panToGst.gstins || [];

    const Row = ({ label, value }) => {
      if (!value && value !== 0) return null;
      return <InfoRow label={label} value={String(value)} />;
    };

    return (
      <>
        {/* Headline */}
        <Row label="GSTIN" value={result.gstin} />
        <Row label="Legal Name" value={result.legalName} />
        <Row label="Trade Name" value={result.tradeName} />
        <Row label="Status" value={result.status} />

        {/* Income / Turnover */}
        {(result.annualAggregateTurnOver || result.grossTotalIncome) ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Income / Turnover
            </Text>
            <Row label="Annual Aggregate Turnover" value={result.annualAggregateTurnOver} />
            {result.aggregateTurnOverRange ? (
              <Row
                label="Turnover Range"
                value={
                  result.aggregateTurnOverRange.maximum
                    ? `₹${(result.aggregateTurnOverRange.minimum / 10000000).toFixed(1)} Cr – ₹${(result.aggregateTurnOverRange.maximum / 10000000).toFixed(1)} Cr`
                    : `₹${(result.aggregateTurnOverRange.minimum / 10000000).toFixed(1)} Cr and above`
                }
              />
            ) : null}
            <Row label="Gross Total Income" value={result.grossTotalIncome} />
            {detail.grossTotalIncomeFinancialYear ? (
              <Row label="Income FY" value={detail.grossTotalIncomeFinancialYear} />
            ) : null}
          </>
        ) : null}

        {/* Business details */}
        <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
          Business Details
        </Text>
        <Row label="Constitution" value={detail.constitution} />
        <Row label="Taxpayer Type" value={detail.taxPayerType} />
        <Row label="Registration Date" value={detail.registrationDate} />
        <Row label="e-Invoicing" value={detail.eInvoicingStatus} />
        <Row label="Compliance Rating" value={detail.complianceRating} />

        {activities.length > 0 ? (
          <Row label="Activities" value={activities.join(', ')} />
        ) : null}

        {directors.length > 0 ? (
          <Row label="Directors" value={directors.join(', ')} />
        ) : null}

        {/* Principal place */}
        {principal.address ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Principal Place of Business
            </Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>{principal.address}</Text>
            <Row label="State" value={principal.state} />
            <Row label="Pincode" value={principal.pincode} />
            <Row label="Email" value={principal.email} />
            <Row label="Mobile" value={principal.mobile} />
          </>
        ) : null}

        {/* Filing frequency */}
        {filingFreq.length > 0 ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Filing Frequency ({filingFreq.length})
            </Text>
            {filingFreq.map((f, idx) => (
              <Text key={idx} style={{ color: colors.textSecondary, marginBottom: 2 }}>
                {f.financialYear} · {f.returnFilingType} · {f.frequency}
                {f.quarter ? ` (${f.quarter})` : ''}
              </Text>
            ))}
          </>
        ) : null}

        {/* Recent filing status */}
        {filingStatus.length > 0 ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              Filing Status (latest {Math.min(filingStatus.length, 12)})
            </Text>
            {filingStatus.slice(0, 12).map((f, idx) => (
              <View
                key={idx}
                style={{
                  paddingVertical: 6,
                  borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textPrimary }}>
                  {f.gstType} · {f.filingYear} · {f.monthOfFiling}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                  Status: {f.gstStatus}
                  {f.dateOfFiling ? ` · Filed ${f.dateOfFiling}` : ''}
                  {f.methodOfFilling ? ` · Method ${f.methodOfFilling}` : ''}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Other GSTINs on same PAN */}
        {allGstins.length > 1 ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: colors.textPrimary }}>
              All GSTINs on PAN ({allGstins.length})
            </Text>
            {allGstins.map((g, idx) => (
              <View
                key={idx}
                style={{
                  paddingVertical: 6,
                  borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{g.gstin}</Text>
                <Text style={{ color: colors.textSecondary }}>
                  {g.tradeName || g.legalName} · {g.status}
                  {g.principalState ? ` · ${g.principalState}` : ''}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </>
    );
  };

  /**
   * Structured render of ITR Pull result — one card per assessment year
   * with headline income figures, ITR type, filing date, and a link to
   * the PDF.
   */
  const renderItrPull = (result) => {
    if (!result) return null;
    const years = result.itrByYear || [];
    if (years.length === 0) {
      return <Text style={{ color: colors.textSecondary }}>No ITR data returned.</Text>;
    }

    const Row = ({ label, value }) => {
      if (!value && value !== 0) return null;
      return <InfoRow label={label} value={String(value)} />;
    };

    const fmtAmt = (v) => (v != null ? formatCurrency(v) : null);

    return (
      <>
        {years.map((yr, idx) => (
          <View
            key={yr.assessmentYear || idx}
            style={{
              paddingVertical: 10,
              borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: 6 }}>
              AY {yr.assessmentYear} — {yr.itrType || 'Unknown'}
            </Text>
            <Row label="Filing Date" value={yr.filingDate} />
            <Row label="Section" value={yr.filingSection} />
            <Row label="Filing Type" value={yr.filingType} />
            <Row label="Ack No." value={yr.acknowledgementNumber} />
            <Row label="Name" value={yr.name} />
            <Row label="Father's Name" value={yr.fatherName} />

            {/* Income breakdown */}
            <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4, color: colors.textSecondary }}>
              Income
            </Text>
            <Row label="Gross Salary" value={fmtAmt(yr.grossSalary)} />
            <Row label="Salary (after exemptions)" value={fmtAmt(yr.salaryIncome)} />
            <Row label="House Property" value={fmtAmt(yr.housePropertyIncome)} />
            <Row label="Other Sources" value={fmtAmt(yr.otherSourceIncome)} />
            <Row label="Gross Total Income" value={fmtAmt(yr.grossTotalIncome)} />
            <Row label="Total Deductions (Ch VI-A)" value={fmtAmt(yr.totalDeductions)} />
            <Row label="Total Taxable Income" value={fmtAmt(yr.totalIncome)} />

            {/* Tax */}
            <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4, color: colors.textSecondary }}>
              Tax
            </Text>
            <Row label="Tax Payable" value={fmtAmt(yr.totalTaxPayable)} />
            <Row label="Education Cess" value={fmtAmt(yr.educationCess)} />
            <Row label="Rebate u/s 87A" value={fmtAmt(yr.rebate87A)} />
            <Row label="Net Tax Liability" value={fmtAmt(yr.netTaxLiability)} />
            <Row label="TDS Paid" value={fmtAmt(yr.tdsPaid)} />
            <Row label="TCS Paid" value={fmtAmt(yr.tcsPaid)} />
            <Row label="Advance Tax" value={fmtAmt(yr.advanceTax)} />
            <Row label="Total Taxes Paid" value={fmtAmt(yr.totalTaxesPaid)} />
            <Row label="Refund Due" value={fmtAmt(yr.refundDue)} />

            {/* Bank accounts from ITR */}
            {yr.bankAccounts && yr.bankAccounts.length > 0 ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4, color: colors.textSecondary }}>
                  Bank Account(s) from ITR
                </Text>
                {yr.bankAccounts.map((bank, bidx) => (
                  <View key={bidx} style={{ marginBottom: 4 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                      {bank.bankName} — ****{bank.accountNumber?.slice(-4)}
                      {bank.useForRefund ? ' (refund account)' : ''}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      IFSC: {bank.ifsc} · {bank.accountType}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {/* Key deductions */}
            {(yr.section80C > 0 || yr.section80D > 0 || yr.section80CCD1B > 0 || yr.npsEmployer > 0) ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4, color: colors.textSecondary }}>
                  Key Deductions
                </Text>
                <Row label="80C" value={fmtAmt(yr.section80C)} />
                <Row label="80D (Health)" value={fmtAmt(yr.section80D)} />
                <Row label="80CCD(1B) NPS" value={fmtAmt(yr.section80CCD1B)} />
                <Row label="NPS Employer" value={fmtAmt(yr.npsEmployer)} />
              </>
            ) : null}

            {/* Employers */}
            {yr.employers && yr.employers.length > 0 ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4, color: colors.textSecondary }}>
                  Employer(s)
                </Text>
                {yr.employers.map((emp, eidx) => (
                  <View key={eidx} style={{ marginBottom: 4 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{emp.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      TAN: {emp.tan} · Income: {formatCurrency(emp.incomeCharged)} · TDS: {formatCurrency(emp.tdsDeducted)}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {/* Filing status trail */}
            {yr.filingStatus && yr.filingStatus.length > 0 ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4, color: colors.textSecondary }}>
                  Filing Status
                </Text>
                {yr.filingStatus.map((fs, fidx) => (
                  <Text key={fidx} style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 2 }}>
                    {fs.activityDate} — {fs.statusDescription}
                  </Text>
                ))}
              </>
            ) : null}

            {yr.pdfUrl ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(yr.pdfUrl).catch(() => {})}
                style={{ marginTop: 6 }}
              >
                <Text style={{ color: colors.teal, fontSize: 13 }}>View ITR PDF →</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </>
    );
  };

  /**
   * Structured render of Form 26AS TDS data.
   */
  const renderForm26AS = (result) => {
    if (!result) return null;
    const years = result.byYear || [];
    if (years.length === 0) {
      return <Text style={{ color: colors.textSecondary }}>No Form 26AS data returned.</Text>;
    }

    return (
      <>
        {years.map((yr, idx) => (
          <View
            key={yr.assessmentYear || idx}
            style={{
              paddingVertical: 10,
              borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: 6 }}>
              AY {yr.assessmentYear}
            </Text>
            <InfoRow label="Total Paid" value={formatCurrency(yr.totalAmountPaid)} />
            <InfoRow label="Total Tax Deducted" value={formatCurrency(yr.totalTaxDeducted)} />
            <InfoRow label="Total TDS Deposited" value={formatCurrency(yr.totalTdsDeposited)} />
            {yr.deductors.length > 0 ? (
              <InfoRow label="Deductors" value={yr.deductors.join(', ')} />
            ) : null}

            {yr.tdsEntries.length > 0 ? (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4, color: colors.textSecondary }}>
                  TDS Entries ({yr.tdsEntries.length})
                </Text>
                {yr.tdsEntries.slice(0, 10).map((entry, eidx) => (
                  <View
                    key={eidx}
                    style={{
                      paddingVertical: 4,
                      borderTopWidth: eidx === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
                      {entry.nameOfDeductor} · §{entry.section} · {entry.transactionDate || ''}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      Paid: {formatCurrency(parseFloat(entry.amountPaid) || 0)} · TDS: {formatCurrency(parseFloat(entry.taxDeducted) || 0)}
                    </Text>
                  </View>
                ))}
                {yr.tdsEntries.length > 10 ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                    ... and {yr.tdsEntries.length - 10} more entries
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ))}
      </>
    );
  };

  // ── Action modal state ──
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionModalType, setActionModalType] = useState(null); // 'approve' | 'reject' | 'call'
  const [actionComment, setActionComment] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

  const openActionModal = (type) => {
    setActionModalType(type);
    setActionComment('');
    setActionModalVisible(true);
  };

  /**
   * Re-fire one of the verification APIs for this application using
   * data already on state. Persisted via SET_SIGNZY_VERIFICATION
   * onto _rawState so a Firestore save commits the new outcome and
   * other dashboards / role views see the update on next focus.
   */
  const retryVerification = async (key) => {
    if (!key || retryingKey) return;
    setRetryingKey(key);
    try {
      const raw = application._rawState || {};
      const fullName = (application.customerName || raw.borrowerDetails?.name || '').trim();
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const phone = application.customerPhone || raw.borrowerDetails?.phone || '';
      const pan = application.panNumber || raw.panDetails?.panNumber || raw.borrowerDetails?.pan || '';

      let result = null;
      let normalised = null;

      if (key === 'phoneToPan') {
        result = await kycService.fetchPanByMobile(phone, firstName, lastName);
        normalised = { status: result?.panNumber ? 'success' : 'no_match', result };
      } else if (key === 'panFetch') {
        result = await kycService.validatePan(pan);
        normalised = { status: 'success', result };
      } else if (key === 'fraudShieldLite') {
        result = await signzyService.fraudShieldLite({
          phoneNumber: phone, name: fullName,
          email: raw.borrowerDetails?.email || '',
          pincode: raw.kycData?.pincode || '',
          ipAddress: '',
        });
        normalised = { status: 'success', result };
      } else if (key === 'employmentBasic') {
        result = await signzyService.getCurrentEmployer(phone, pan);
        normalised = { status: result?.isEmployed ? 'success' : 'not_employed', result };
      } else if (key === 'gstIncome') {
        result = await signzyService.gstIncomeByPan(pan);
        normalised = { status: result?.gstins?.length ? 'success' : 'no_match', result };
      } else if (key === 'bankVerification') {
        result = await bankService.pennyDrop({
          accountNumber: raw.bankDetails?.accountNumber || '',
          ifsc: raw.bankDetails?.ifsc || '',
          name: fullName,
          mobile: phone,
        });
        normalised = { status: result?.verified ? 'success' : 'failed', result };
      } else if (key === 'cibilBureau') {
        const credit = await kycService.softPull({
          pan, name: fullName, firstName, lastName, phone,
          gender: raw.borrowerDetails?.gender || raw.kycData?.gender || 'Male',
          dob: raw.borrowerDetails?.dob || raw.kycData?.dob || '',
          address: raw.borrowerDetails?.address || raw.kycData?.address || '',
          pincode: raw.borrowerDetails?.pincode || raw.kycData?.pincode || '',
        });
        normalised = { status: 'success', result: credit?._signzy || credit };
      } else {
        Alert.alert('Cannot retry', `No retry handler is wired for "${key}".`);
        setRetryingKey(null);
        return;
      }

      // Optimistic local update — show the new entry immediately.
      const updated = {
        ...raw,
        signzyVerifications: {
          ...(raw.signzyVerifications || {}),
          [key]: { ...normalised, fetchedAt: new Date().toISOString() },
        },
      };
      setApplication((prev) => getFullApplication({ ...prev, _rawState: updated, signzyVerifications: updated.signzyVerifications }));

      // Persist to Firestore so it survives refresh and other roles see it.
      await saveApplicationToDb(updated);
      Alert.alert('Verification re-fired', `${key} ${normalised.status === 'success' ? 'succeeded' : `returned: ${normalised.status}`}.`);
    } catch (err) {
      console.log('[StaffDetail] retry', key, 'failed:', err?.message);
      Alert.alert('Retry failed', err?.message || `Couldn't re-fire ${key}.`);
      // Log the new failure too so the audit trail is honest.
      const raw = application._rawState || {};
      const updated = {
        ...raw,
        signzyVerifications: {
          ...(raw.signzyVerifications || {}),
          [key]: { status: 'failed', error: { message: err?.message || 'retry failed' }, fetchedAt: new Date().toISOString() },
        },
      };
      try { await saveApplicationToDb(updated); } catch (_) { /* ignore */ }
      setApplication((prev) => getFullApplication({ ...prev, _rawState: updated, signzyVerifications: updated.signzyVerifications }));
    } finally {
      setRetryingKey(null);
    }
  };

  const handleActionConfirm = async () => {
    if (actionModalType === 'call') {
      Linking.openURL(`tel:${application.customerPhone}`).catch(() => {});
      setActionModalVisible(false);
      return;
    }

    if (actionModalType === 'reject' && !actionComment.trim()) {
      Alert.alert('Comment Required', 'Please provide a reason for rejection.');
      return;
    }

    setActionSaving(true);
    const newStatus = actionModalType === 'approve' ? 'fully_eligible' : 'not_eligible';
    const actionData = {
      action: actionModalType,
      by: user?.name || user?.phone || 'Unknown',
      role: user?.role || 'admin',
      comment: actionComment.trim(),
      at: new Date().toISOString(),
    };

    setApplication((prev) => ({
      ...prev,
      status: newStatus,
      adminAction: actionData,
      ...(actionModalType === 'reject' ? { eligibilityResult: { eligible: false, status: 'not_eligible', adminRejectionReason: actionComment.trim() } } : {}),
    }));

    const appId = application.id || application.applicationId;
    if (isFirebaseConfigured() && appId) {
      try {
        const payload = {
          status: newStatus,
          adminAction: actionData,
          _updatedAt: serverTimestamp(),
        };
        if (actionModalType === 'reject') {
          payload.eligibilityResult = { eligible: false, status: 'not_eligible', adminRejectionReason: actionComment.trim() };
        }
        await setDoc(doc(db, 'applications', appId), payload, { merge: true });
        console.log('[StaffDetail]', actionModalType, ':', appId);
      } catch (e) {
        console.log('[StaffDetail] Action save failed:', e?.message);
      }
    }

    setActionSaving(false);
    setActionModalVisible(false);
  };
  /**
   * Shows all raw API responses, extracted images/documents, ITR PDFs,
   * and KYC XML/JSON in one place so admin / credit / operations can
   * inspect the source data behind every verification.
   */
  const [expandedRawSections, setExpandedRawSections] = useState({});
  const [rawDataFromDb, setRawDataFromDb] = useState(null);
  const [rawDataLoading, setRawDataLoading] = useState(false);
  const toggleRawSection = (key) =>
    setExpandedRawSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const RawJsonBlock = ({ title, data, sectionKey }) => {
    if (!data) return null;
    const expanded = expandedRawSections[sectionKey];
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const preview = jsonStr.length > 300 ? jsonStr.slice(0, 300) + '...' : jsonStr;

    return (
      <View style={{ marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => toggleRawSection(sectionKey)}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 8,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>{title}</Text>
          <Text style={{ color: colors.teal, fontSize: 12 }}>
            {expanded ? 'Collapse ▲' : `Expand ▼ (${(jsonStr.length / 1024).toFixed(1)} KB)`}
          </Text>
        </TouchableOpacity>
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: 8,
            padding: 10,
            marginTop: 6,
            maxHeight: expanded ? undefined : 120,
            overflow: 'hidden',
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'monospace' }}>
            {expanded ? jsonStr : preview}
          </Text>
        </View>
      </View>
    );
  };

  const renderRawData = () => {
    // Lazy-load raw data from Firestore subcollection on first render
    if (!rawDataFromDb && !rawDataLoading && application.id) {
      setRawDataLoading(true);
      loadAllRawData(application.id).then((data) => {
        setRawDataFromDb(data || {});
        setRawDataLoading(false);
      }).catch(() => {
        setRawDataFromDb({});
        setRawDataLoading(false);
      });
    }

    const kycData = application.kycData || {};
    const signzy = application.signzyVerifications || {};
    const kycImages = Array.isArray(kycData.images) ? kycData.images : [];
    const kycDocs = Array.isArray(kycData.documents) ? kycData.documents : [];
    const dbRaw = rawDataFromDb || {};
    const hasAny =
      kycImages.length > 0 ||
      kycDocs.length > 0 ||
      kycData.rawResponse ||
      Object.keys(signzy).length > 0;

    if (!hasAny) {
      return (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Raw Data</Text>
          <Text style={{ color: colors.textSecondary }}>
            No raw data available yet. API responses, images, and documents
            will appear here as verifications complete.
          </Text>
        </Card>
      );
    }

    return (
      <>
        {/* KYC Extracted Images */}
        {kycImages.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              KYC Images ({kycImages.length})
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
              All images extracted from {kycData.method || 'KYC source'}. Tap to zoom.
            </Text>
            {kycImages.map((img, idx) => (
              <AspectImage
                key={img.sequence || idx}
                uri={img.uri}
                label={`${img.label || 'Document ' + (idx + 1)}${img.code ? ' (code: ' + img.code + ')' : ''}`}
                colors={colors}
                onPress={() => setZoomImage({ uri: img.uri, label: img.label || `Document ${idx + 1}` })}
              />
            ))}
          </Card>
        )}

        {/* KYC Identity Documents */}
        {kycDocs.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              KYC Identity Documents ({kycDocs.length})
            </Text>
            {kycDocs.map((doc, idx) => (
              <View
                key={doc.sequence || idx}
                style={{
                  paddingVertical: 8,
                  borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                  {doc.label} — {doc.number}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                  Type: {doc.type} · Status: {doc.verificationStatus || 'N/A'}
                  {doc.dateOfIssue ? ` · Issued: ${doc.dateOfIssue}` : ''}
                  {doc.dateOfExpiry ? ` · Expires: ${doc.dateOfExpiry}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* ITR PDFs */}
        {signzy.itrPull?.status === 'success' && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              ITR Documents
            </Text>
            {(signzy.itrPull.result?.itrByYear || []).map((yr, idx) => (
              <View key={yr.assessmentYear || idx} style={{ paddingVertical: 6 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                  AY {yr.assessmentYear} — {yr.itrType}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Filed: {yr.filingDate} · Ack: {yr.acknowledgementNumber}
                </Text>
                {yr.pdfUrl ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(yr.pdfUrl).catch(() => {})}
                    style={{ marginTop: 4 }}
                  >
                    <Text style={{ color: colors.teal, fontSize: 13 }}>Download ITR PDF →</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </Card>
        )}

        {/* Raw JSON Responses */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Raw API Responses
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
            Complete JSON payloads from each API call for audit and debugging.
            Tap to expand.
            {rawDataLoading ? ' Loading from database...' : ''}
          </Text>

          {/* KYC raw response — from subcollection or inline */}
          {(kycData.rawResponse || dbRaw.kyc_rawResponse || dbRaw.kyc_raw) && (
            <RawJsonBlock
              title={`KYC Response (${kycData.method || 'unknown'})`}
              data={kycData.rawResponse || dbRaw.kyc_rawResponse || dbRaw.kyc_raw}
              sectionKey="kyc_raw"
            />
          )}

          {/* Each Signzy verification raw response */}
          {Object.entries(signzy).map(([key, entry]) => {
            if (!entry) return null;
            const label = {
              employmentBasic: 'Employment (UAN Basic)',
              phonePrefill: 'Phone Prefill',
              fraudShieldLite: 'FraudShield Lite',
              gstIncome: 'GST Income',
              itrPull: 'ITR Pull',
              form26AS: 'Form 26AS',
            }[key] || key;

            // Try inline rawResponse first, then subcollection
            const rawData =
              entry.result?.rawResponse ||
              dbRaw[`signzy_${key}_rawResponse`] ||
              entry.result ||
              entry.error ||
              entry;

            return (
              <RawJsonBlock
                key={key}
                title={`${label} (${entry.status || 'unknown'})`}
                data={rawData}
                sectionKey={`signzy_${key}`}
              />
            );
          })}

          {/* ITR JSON per year from subcollection */}
          {Object.keys(dbRaw)
            .filter((k) => k.startsWith('itr_') && k.endsWith('_json'))
            .sort()
            .reverse()
            .map((k) => (
              <RawJsonBlock
                key={k}
                title={`ITR JSON (${k.replace('itr_', '').replace('_json', '')})`}
                data={dbRaw[k]}
                sectionKey={k}
              />
            ))
          }

          {/* KYC failure history raw */}
          {Array.isArray(application.kycFailures) && application.kycFailures.length > 0 && (
            <RawJsonBlock
              title={`KYC Failures (${application.kycFailures.length})`}
              data={application.kycFailures}
              sectionKey="kyc_failures_raw"
            />
          )}
        </Card>
      </>
    );
  };

  // ─── COMMUNICATION TAB ────────────────────────────────────────────────────
  const renderCommunication = () => (
    <>
      {/* Quick Actions */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Send Communication</Text>
        <Text style={[styles.commSubtext, { color: colors.textSecondary }]}>
          Reach out to the customer for missing details or required actions.
        </Text>
        <View style={styles.commActions}>
          <Button
            title="Send SMS"
            onPress={() => { setCommType('sms'); setCommMessage(''); setShowCommModal(true); }}
            style={styles.commBtn}
          />
          <Button
            title="Send WhatsApp"
            onPress={() => { setCommType('whatsapp'); setCommMessage(''); setShowCommModal(true); }}
            variant="outline"
            style={styles.commBtn}
          />
        </View>
        <Button
          title="Call Customer"
          onPress={() => {
            Linking.openURL(`tel:${application.customerPhone}`).catch(() => {});
          }}
          variant="outline"
          style={styles.addBtn}
        />
      </Card>

      {/* Quick Templates */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Templates</Text>
        {[
          { label: 'Missing Documents', msg: `Dear ${application.customerName}, your loan application (${application.id}) requires additional documents. Please upload the pending documents at the earliest to proceed. — FINZ Team` },
          { label: 'KYC Pending', msg: `Dear ${application.customerName}, your KYC verification is pending for application ${application.id}. Please complete your KYC to continue with the loan process. — FINZ Team` },
          { label: 'Income Proof Required', msg: `Dear ${application.customerName}, we need your income proof (salary slip/bank statement) for application ${application.id}. Please upload at the earliest. — FINZ Team` },
          { label: 'eNACH/eSign Pending', msg: `Dear ${application.customerName}, please complete the eNACH mandate and eSign for your loan application ${application.id} to proceed with disbursement. — FINZ Team` },
        ].map(tmpl => (
          <TouchableOpacity
            key={tmpl.label}
            style={[styles.templateItem, { borderBottomColor: colors.border }]}
            onPress={() => { setCommType('sms'); setCommMessage(tmpl.msg); setShowCommModal(true); }}
          >
            <Text style={[styles.templateLabel, { color: colors.textPrimary }]}>{tmpl.label}</Text>
            <Text style={[styles.templateArrow, { color: colors.teal }]}>Send →</Text>
          </TouchableOpacity>
        ))}
      </Card>

      {/* Communication Log */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Communication Log</Text>
        {(application.communications || []).length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No communications sent yet.</Text>
        ) : (
          (application.communications || []).map(comm => (
            <View key={comm.id} style={[styles.commLogItem, { borderBottomColor: colors.border }]}>
              <View style={styles.commLogHeader}>
                <View style={[styles.commTypeBadge, {
                  backgroundColor: comm.type === 'sms' ? `${colors.teal}15` : `${colors.info}15`,
                }]}>
                  <Text style={[styles.commTypeText, {
                    color: comm.type === 'sms' ? colors.teal : colors.info,
                  }]}>
                    {comm.type.toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.commLogTime, { color: colors.textSecondary }]}>
                  {formatTimestamp(comm.sentAt)}
                </Text>
              </View>
              <Text style={[styles.commLogTo, { color: colors.textSecondary }]}>
                To: {comm.to} — By: {comm.sentBy}
              </Text>
              <Text style={[styles.commLogMsg, { color: colors.textPrimary }]}>{comm.message}</Text>
            </View>
          ))
        )}
      </Card>
    </>
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'Details': return renderDetails();
      case 'Documents': return renderDocuments();
      case 'Verifications': return renderVerifications();
      case 'Raw Data': return renderRawData();
      case 'Comments': return renderComments();
      case 'Communication': return renderCommunication();
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title={`Application ${application.id ? '#' + application.id : ''}`}
        onBack={() => navigation.goBack()}
      />

      {/* Quick Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
            {application.customerName || 'Unknown'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {application.customerPhone || ''} · {application.status ? application.status.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {canApproveReject && (
            <>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: `${colors.teal}20`, borderColor: colors.teal, marginRight: 6 }]}
                onPress={() => openActionModal('approve')}
              >
                <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700' }}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: `${colors.error}20`, borderColor: colors.error, marginRight: 6 }]}
                onPress={() => openActionModal('reject')}
              >
                <Text style={{ color: colors.error, fontSize: 11, fontWeight: '700' }}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {application.customerPhone ? (
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: `${colors.teal}10`, borderColor: colors.border }]}
              onPress={() => openActionModal('call')}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '600' }}>Call</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Tab Bar — scrollable since we have 6 tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {(userRole === 'sales' || userRole === 'operations' ? RESTRICTED_TABS : ALL_TABS).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.teal, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === tab && { color: colors.teal, fontWeight: '700' },
            ]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.teal]} />}
        showsVerticalScrollIndicator={false}
      >
        {renderTabContent()}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Document Upload Modal */}
      <Modal visible={showDocUpload} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Supporting Document</Text>
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
              Upload a document to support this application (e.g., verification report, override approval).
            </Text>
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Document Name</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={docName}
              onChangeText={setDocName}
              placeholder="e.g., Override Approval Letter"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Notes (Optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.multilineInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={docNotes}
              onChangeText={setDocNotes}
              placeholder="Any additional notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => { setShowDocUpload(false); setDocName(''); setDocNotes(''); }} variant="outline" style={styles.modalBtn} />
              <Button title="Add Document" onPress={handleAddDocument} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Communication Modal */}
      <Modal visible={showCommModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Send {commType === 'sms' ? 'SMS' : 'WhatsApp'} to Customer
            </Text>
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
              To: {application.customerName} ({application.customerPhone})
            </Text>
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Message</Text>
            <TextInput
              style={[styles.modalInput, styles.multilineInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={commMessage}
              onChangeText={setCommMessage}
              placeholder="Type your message..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={5}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowCommModal(false)} variant="outline" style={styles.modalBtn} />
              <Button title={`Send ${commType === 'sms' ? 'SMS' : 'WhatsApp'}`} onPress={handleSendCommunication} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>

      <ImageZoomModal
        visible={!!zoomImage}
        uri={zoomImage?.uri}
        label={zoomImage?.label}
        onClose={() => setZoomImage(null)}
      />

      {/* Action Modal — Approve / Reject / Call */}
      <Modal visible={actionModalVisible} transparent animationType="fade" onRequestClose={() => setActionModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.cardBg, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>
                {actionModalType === 'approve' ? '✅' : actionModalType === 'reject' ? '❌' : '📞'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                  {actionModalType === 'approve' ? 'Approve Application'
                    : actionModalType === 'reject' ? 'Reject Application'
                    : 'Call Customer'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  #{application.id} · {application.customerName}
                </Text>
              </View>
            </View>

            {/* Call details */}
            {actionModalType === 'call' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                  {application.customerPhone}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  You will be redirected to your phone dialer to call the customer.
                </Text>
              </View>
            )}

            {/* Approve/Reject details */}
            {actionModalType !== 'call' && (
              <>
                <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <InfoRow label="Application" value={`#${application.id}`} />
                  <InfoRow label="Customer" value={application.customerName || 'Unknown'} />
                  <InfoRow label="Amount" value={application.amount ? formatCurrency(application.amount) : '—'} />
                  <InfoRow label="Current Status" value={(application.status || 'unknown').replace(/_/g, ' ').toUpperCase()} />
                </View>

                {actionModalType === 'approve' && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                    This will mark the application as approved and notify the customer. Please add any comments below.
                  </Text>
                )}
                {actionModalType === 'reject' && (
                  <Text style={{ color: colors.error, fontSize: 13, marginBottom: 12 }}>
                    This will reject the application. A rejection reason is required and will be visible to the credit team.
                  </Text>
                )}

                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>
                  Comments {actionModalType === 'reject' ? '(Required)' : '(Optional)'}
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 12,
                    color: colors.textPrimary,
                    backgroundColor: colors.background,
                    fontSize: 14,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                  value={actionComment}
                  onChangeText={setActionComment}
                  placeholder={actionModalType === 'reject'
                    ? 'Enter reason for rejection...'
                    : 'Add any comments or notes...'}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />

                {/* Action by info */}
                <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginTop: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    Action by: {user?.name || user?.phone || 'Unknown'} ({user?.role || 'staff'}) · {new Date().toLocaleString('en-IN')}
                  </Text>
                </View>
              </>
            )}

            {/* Buttons */}
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1,
                  borderColor: colors.border, alignItems: 'center', marginRight: 8,
                }}
                onPress={() => setActionModalVisible(false)}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
                  backgroundColor: actionModalType === 'reject' ? colors.error
                    : actionModalType === 'call' ? colors.teal
                    : colors.teal,
                  opacity: actionSaving ? 0.6 : 1,
                }}
                onPress={handleActionConfirm}
                disabled={actionSaving}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {actionSaving ? 'Saving...'
                    : actionModalType === 'approve' ? 'Confirm Approval'
                    : actionModalType === 'reject' ? 'Confirm Rejection'
                    : 'Call Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tabBar: {
    borderBottomWidth: 1, maxHeight: 46,
  },
  tabBarContent: {
    flexDirection: 'row', paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '600', whiteSpace: 'nowrap' },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  appIdLarge: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reasonText: { fontSize: 13, lineHeight: 20 },
  scoreRow: { flexDirection: 'row', gap: 32, marginTop: 12, marginBottom: 4 },
  scoreItem: { alignItems: 'center' },
  scoreLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreValue: { fontSize: 28, fontWeight: '900', marginTop: 2 },

  // Documents
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5 },
  docInfo: { flex: 1, marginRight: 12 },
  docName: { fontSize: 14, fontWeight: '600' },
  docMeta: { fontSize: 11, marginTop: 2 },
  docNotes: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  docStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  docStatusText: { fontSize: 10, fontWeight: '700' },

  // Comments
  commentItem: {
    borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 10, marginBottom: 10,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 10 },
  commentText: { fontSize: 13, lineHeight: 19 },
  commentInput: {
    borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14,
    minHeight: 80, textAlignVertical: 'top', marginBottom: 8,
  },

  // Communication
  commSubtext: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  commActions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  commBtn: { flex: 1 },
  templateItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
  templateLabel: { fontSize: 14, fontWeight: '500' },
  templateArrow: { fontSize: 13, fontWeight: '600' },
  commLogItem: { paddingVertical: 12, borderBottomWidth: 0.5 },
  commLogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  commTypeText: { fontSize: 10, fontWeight: '700' },
  commLogTime: { fontSize: 10 },
  commLogTo: { fontSize: 11, marginBottom: 4 },
  commLogMsg: { fontSize: 13, lineHeight: 19 },

  // Shared
  addBtn: { marginTop: 8 },
  emptyText: { fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  bottomSpacer: { height: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalSubtext: { fontSize: 13, marginBottom: 16, lineHeight: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 12,
  },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1 },
});

export default StaffApplicationDetailScreen;
