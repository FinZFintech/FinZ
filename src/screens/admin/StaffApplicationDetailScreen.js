import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, Linking,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import InfoRow from '../../components/common/InfoRow';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { smsService } from '../../services/smsService';

// ─── Tabs ────────────────────────────────────────────────────────────────────
const TABS = ['Details', 'Documents', 'Comments', 'Communication'];

// ─── Mock full application data builder ──────────────────────────────────────
function getFullApplication(app) {
  return {
    ...app,
    // Customer details
    customerEmail: app.customerEmail || 'customer@email.com',
    customerDob: app.customerDob || '15/06/2000',
    customerGender: app.customerGender || 'Male',
    customerAddress: app.customerAddress || '123, MG Road, Bangalore, Karnataka - 560001',
    // Student / borrower
    studentName: app.studentName || app.customerName,
    fatherName: app.fatherName || 'Rajesh ' + (app.customerName || '').split(' ').pop(),
    courseName: app.courseName || 'B.Tech Computer Science',
    regNo: app.regNo || 'REG' + (app.id || '').replace(/[^0-9]/g, ''),
    borrowerType: app.borrowerType || 'Self',
    // PAN & Credit
    panNumber: app.panNumber || 'ABCDE1234F',
    creditScore: app.creditScore || null,
    riskScore: app.riskScore || null,
    // KYC
    kycMethod: app.kycMethod || (app.status !== 'draft' ? 'DigiLocker' : null),
    kycStatus: app.kycStatus || (app.status === 'kyc_completed' || app.status === 'selfie_verified' ? 'Verified' : 'Pending'),
    aadhaarLast4: app.aadhaarLast4 || '4321',
    // Bank
    bankName: app.bankName || 'State Bank of India',
    accountNumber: app.accountNumber || 'XXXX XXXX 5678',
    ifscCode: app.ifscCode || 'SBIN0001234',
    pennyDropStatus: app.pennyDropStatus || 'Verified',
    // Income
    monthlyIncome: app.monthlyIncome || 45000,
    incomeSource: app.incomeSource || 'Bank Statement',
    foirRatio: app.foirRatio || '38%',
    // Loan product
    product: app.product || 'Education Loan - EMI',
    interestRate: app.interestRate || 14,
    tenure: app.tenure || 12,
    processingFee: app.processingFee || '2% + GST',
    emi: app.emi || Math.round(app.amount * 0.09),
    // eNACH / eSign
    enachStatus: app.enachStatus || 'Pending',
    esignStatus: app.esignStatus || 'Pending',
    // Documents
    documents: app.documents || [
      { id: 'doc_1', name: 'PAN Card', type: 'identity', uploadedAt: '2026-03-28', status: 'verified' },
      { id: 'doc_2', name: 'Aadhaar Card', type: 'identity', uploadedAt: '2026-03-28', status: 'verified' },
      { id: 'doc_3', name: 'Fee Receipt', type: 'academic', uploadedAt: '2026-03-27', status: 'pending_review' },
      { id: 'doc_4', name: 'Bank Statement (3 months)', type: 'financial', uploadedAt: '2026-03-27', status: 'verified' },
      { id: 'doc_5', name: 'Admission Letter', type: 'academic', uploadedAt: '2026-03-26', status: 'verified' },
      { id: 'doc_6', name: 'Selfie Photo', type: 'verification', uploadedAt: '2026-03-28', status: 'verified' },
    ],
    // Comments / activity log
    comments: app.comments || [
      { id: 'c1', author: 'System', role: 'system', text: 'Application created', timestamp: '2026-03-25T10:00:00Z' },
      { id: 'c2', author: 'Sales Executive', role: 'sales', text: 'Contacted customer, guided through institute selection', timestamp: '2026-03-26T11:30:00Z' },
      { id: 'c3', author: 'System', role: 'system', text: 'PAN verification completed', timestamp: '2026-03-27T09:15:00Z' },
      { id: 'c4', author: 'Credit Officer', role: 'credit', text: 'Credit score is satisfactory. Proceeding with income verification.', timestamp: '2026-03-28T14:00:00Z' },
    ],
    // Staff documents
    staffDocuments: app.staffDocuments || [],
    // Communication log
    communications: app.communications || [
      { id: 'comm_1', type: 'sms', to: app.customerPhone || '9876543210', message: 'Your loan application has been received. Application ID: ' + (app.id || 'N/A'), sentAt: '2026-03-25T10:05:00Z', sentBy: 'System' },
    ],
  };
}

const StaffApplicationDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const appData = route.params?.application || {};
  const [application, setApplication] = useState(() => getFullApplication(appData));
  const [activeTab, setActiveTab] = useState('Details');
  const [refreshing, setRefreshing] = useState(false);

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

      {/* Customer Details */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Customer Details</Text>
        <InfoRow label="Name" value={application.customerName} />
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

      {/* KYC Details */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>KYC Verification</Text>
        <InfoRow label="KYC Method" value={application.kycMethod || 'Not Started'} />
        <InfoRow label="KYC Status" value={application.kycStatus} highlight={application.kycStatus === 'Verified'} />
        <InfoRow label="Aadhaar (Last 4)" value={'XXXX ' + application.aadhaarLast4} />
      </Card>

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
        <InfoRow label="Monthly Income" value={formatCurrency(application.monthlyIncome)} />
        <InfoRow label="Income Source" value={application.incomeSource} />
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

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
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
      </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 8,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 12, fontWeight: '600' },
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
