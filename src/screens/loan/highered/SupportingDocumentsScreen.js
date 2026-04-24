import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image,
  TextInput,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../../../components/common/Header';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import StepIndicator from '../../../components/common/StepIndicator';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { useTheme } from '../../../store/ThemeContext';
import { useLoan } from '../../../store/LoanContext';
import { useAuth } from '../../../store/AuthContext';
import { formatCurrency } from '../../../utils/helpers';
import useFocusScroller from '../../../hooks/useFocusScroller';

/**
 * Supporting documents step for higher-education (abroad) loans.
 *
 * The standard education flow only collects KYC images via CKYC /
 * DigiLocker. Abroad loans need additional underwriting evidence —
 * offer letter, passport, visa, fund-transfer proof, financial
 * statements, etc. Customer can upload them here; sales / credit
 * staff can also upload from the admin detail screen.
 *
 * Each picked file is stashed on state.supportingDocuments via
 * ADD_SUPPORTING_DOCUMENT — applicationDbService strips the inline
 * blob and uploads it to Cloudinary on the next save (same path the
 * KYC images take).
 */

const COLLATERAL_TYPES = [
  { code: 'property',          label: 'Property (Residential / Commercial)' },
  { code: 'fixed_deposit',     label: 'Fixed Deposit' },
  { code: 'lic_policy',        label: 'LIC Policy' },
  { code: 'shares',            label: 'Shares' },
  { code: 'mutual_funds',      label: 'Mutual Funds' },
  { code: 'gold',              label: 'Gold' },
  { code: 'other',             label: 'Other' },
];

const SELF_CONTRIBUTION_SOURCES = [
  { code: 'own_savings',          label: 'Own Savings' },
  { code: 'family',               label: 'Family Contribution' },
  { code: 'scholarship',          label: 'Scholarship / Grant' },
  { code: 'sponsor',              label: 'Sponsor Funded' },
  { code: 'fixed_deposit_release',label: 'Fixed Deposit Release' },
  { code: 'mixed',                label: 'Mixed Sources' },
];

const MORATORIUM_TYPES = [
  { code: 'principal_only',          label: 'Principal moratorium', hint: 'Pay interest during course; principal EMIs start later' },
  { code: 'simple_interest',         label: 'Simple interest only', hint: 'Pay simple interest monthly during the course period' },
  { code: 'principal_and_interest',  label: 'Full moratorium',      hint: 'No payments during course; interest accrues' },
];

// Build the document checklist dynamically — collateral and self-
// contribution proofs become required only when the user actually
// pledges collateral / declares contribution above ₹0.
function buildDocChecklist(collateral, selfContribution) {
  const list = [
    { code: 'offer_letter',    label: 'University / College Offer Letter',     required: true,  hint: 'Conditional or unconditional admission letter' },
    { code: 'fee_breakup',     label: 'Tuition Fee Break-up',                  required: true },
    { code: 'bank_statements', label: 'Last 12 months bank statements (PDF)',  required: true },
    { code: 'salary_slips',    label: 'Last 6 months salary slips',            required: true,  hint: 'Of co-applicants / guarantor' },
    { code: 'itr',             label: 'ITR (last 2 years)',                    required: true,  hint: 'Of co-applicants / guarantor' },
    { code: 'passport',        label: 'Passport (front + back)',               required: false, hint: 'Required for abroad programs' },
    { code: 'visa',            label: 'Student Visa / I-20 / CAS',             required: false, hint: 'For abroad — required before disbursement' },
    { code: 'gre_gmat',        label: 'GRE / GMAT / IELTS Score',              required: false },
    { code: 'sponsor_letter',  label: 'Sponsor Affidavit / Letter',            required: false },
  ];
  if (collateral?.offered) {
    list.push({
      code: 'collateral_doc',
      label: 'Collateral Title / Ownership Documents',
      required: true,
      hint: 'Sale deed, FD certificate, share statement, etc.',
    });
    list.push({
      code: 'collateral_valuation',
      label: 'Collateral Valuation Report',
      required: false,
      hint: 'Optional — bank may commission its own valuer',
    });
  }
  if (selfContribution?.amountInr && selfContribution.amountInr > 0) {
    list.push({
      code: 'self_contribution_proof',
      label: 'Self-Contribution Proof',
      required: true,
      hint: 'Bank statement / FD / scholarship letter showing the declared amount',
    });
  }
  return list;
}

const SupportingDocumentsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { user } = useAuth();
  const [pickingCode, setPickingCode] = useState(null);
  const { scrollRef, anchorProps, scrollToAnchor } = useFocusScroller();

  const docs = state.supportingDocuments || [];
  // Group what the user already uploaded by required-doc code.
  const uploadedBy = docs.reduce((acc, d) => {
    const c = d.code || 'misc';
    if (!acc[c]) acc[c] = [];
    acc[c].push(d);
    return acc;
  }, {});

  const sourceTag = user?.role && user.role !== 'customer' ? user.role : 'customer';

  const moratorium = state.moratorium || { optedIn: false };
  const collateral = state.collateral || { offered: false };
  const selfContribution = state.selfContribution || { amountInr: 0 };

  // Required-docs list reacts to collateral / self-contribution choices.
  const REQUIRED_DOCS = buildDocChecklist(collateral, selfContribution);

  const totalCost = state.studentDetails?.balanceFee || 0;
  const declaredContribution = Number(selfContribution.amountInr) || 0;
  const balanceLoanAmount = Math.max(totalCost - declaredContribution, 0);

  const pickAndAttach = async (def) => {
    try {
      setPickingCode(def.code);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // Web-fallback: read via FileReader → base64 so the same upload
      // pipeline (Cloudinary via applicationDbService) can take it.
      let base64Data = null;
      let dataUri = asset.uri;
      const mime = asset.mimeType || (asset.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      if (asset.uri && asset.uri.startsWith('data:')) {
        dataUri = asset.uri;
        base64Data = asset.uri.split(',')[1] || null;
      } else if (asset.file && typeof FileReader !== 'undefined') {
        // expo-document-picker on web exposes the File object directly.
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            dataUri = reader.result;
            base64Data = String(reader.result).split(',')[1] || null;
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(asset.file);
        });
      }

      dispatch({
        type: 'ADD_SUPPORTING_DOCUMENT',
        payload: {
          code: def.code,
          label: def.label,
          fileName: asset.name || `${def.code}.${mime.includes('pdf') ? 'pdf' : 'jpg'}`,
          contentType: mime,
          uri: dataUri,
          data: base64Data,
          size: asset.size || null,
          source: sourceTag,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.log('[SupportingDocuments] picker failed:', err?.message);
      Alert.alert('Upload failed', err?.message || 'Could not attach the file. Please try again.');
    } finally {
      setPickingCode(null);
    }
  };

  const remove = (id) => {
    dispatch({ type: 'REMOVE_SUPPORTING_DOCUMENT', payload: id });
  };

  const allRequiredUploaded = REQUIRED_DOCS
    .filter((d) => d.required)
    .every((d) => (uploadedBy[d.code] || []).length > 0);

  const handleProceed = () => {
    if (!allRequiredUploaded) {
      Alert.alert(
        'Missing required documents',
        'Please upload all required documents before continuing. You can upload more later from your application page.',
      );
      return;
    }
    navigation.navigate('PanVerification');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Supporting Documents" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={1} />
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Card>
          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            Higher-education loans need extra underwriting evidence.
            Declare any collateral and self-contribution below, pick a
            moratorium option if applicable, and upload the documents.
            PDFs and images both work — you can return here later to add
            anything you missed.
          </Text>
        </Card>

        {/* ── Moratorium ── */}
        <View {...anchorProps('moratorium')}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
              Moratorium {moratorium.optedIn ? '✓' : '(optional)'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const becomingActive = !moratorium.optedIn;
                dispatch({
                  type: 'SET_MORATORIUM',
                  payload: { optedIn: becomingActive, type: moratorium.type || 'simple_interest', monthsRequested: moratorium.monthsRequested || (state.studentDetails?.courseDurationMonths || 24) },
                });
                // Once moratorium is enabled, the type picker mounts —
                // bring the new field into view so the next action (the
                // type selection) is the focal point.
                if (becomingActive) scrollToAnchor('moratoriumType');
                else scrollToAnchor('selfContribution');
              }}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                borderWidth: 1, borderColor: colors.teal,
              }}
            >
              <Text style={{ color: colors.teal, fontSize: 12, fontWeight: '700' }}>
                {moratorium.optedIn ? 'Disable' : '+ Enable'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 18 }}>
            Defer EMI repayments while the course is ongoing (and optionally
            for a buffer period after). Lender's actual policy ceiling
            applies; sales / credit will confirm the final approved
            moratorium during processing.
          </Text>

          {moratorium.optedIn && (
            <View style={{ marginTop: 10 }} {...anchorProps('moratoriumType')}>
              {MORATORIUM_TYPES.map((t) => {
                const isSel = (moratorium.type || 'simple_interest') === t.code;
                return (
                  <TouchableOpacity
                    key={t.code}
                    onPress={() => {
                      dispatch({ type: 'SET_MORATORIUM', payload: { type: t.code } });
                      // Type chosen → next field is the duration input.
                      scrollToAnchor('moratoriumDuration');
                    }}
                    style={{
                      padding: 10, borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isSel ? colors.teal : colors.cardBorder,
                      backgroundColor: isSel ? `${colors.teal}14` : 'transparent',
                      marginBottom: 6,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                      {isSel ? '◉' : '○'}  {t.label}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {t.hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View {...anchorProps('moratoriumDuration')}>
                <Input
                  label="Moratorium duration requested (months)"
                  keyboardType="numeric"
                  value={String(moratorium.monthsRequested || '')}
                  onChangeText={(v) => dispatch({ type: 'SET_MORATORIUM', payload: { monthsRequested: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 } })}
                  placeholder="e.g. 24"
                />
              </View>
            </View>
          )}
        </Card>
        </View>

        {/* ── Self-contribution ── */}
        <View {...anchorProps('selfContribution')}>
        <Card>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Self-Contribution</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6, marginBottom: 10, lineHeight: 18 }}>
            Declare how much of the total course cost you'll contribute outside
            the loan (savings, family, scholarship, etc.). The loan amount
            requested = total course cost − self-contribution.
          </Text>
          <Input
            label={`Total course cost: ${formatCurrency(totalCost)}`}
            value={String(declaredContribution || '')}
            onChangeText={(v) => {
              const num = parseInt(v.replace(/[^0-9]/g, ''), 10) || 0;
              const wasZero = !declaredContribution;
              dispatch({
                type: 'SET_SELF_CONTRIBUTION',
                payload: { amountInr: num },
              });
              // First time the user enters a positive amount the source
              // picker mounts — bring it into view.
              if (wasZero && num > 0) scrollToAnchor('selfContributionSource');
            }}
            placeholder="Self-contribution amount in ₹"
            keyboardType="numeric"
          />
          {declaredContribution > 0 ? (
            <View {...anchorProps('selfContributionSource')}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, marginTop: 6 }}>
                Loan amount you're requesting:{' '}
                <Text style={{ color: colors.teal, fontWeight: '700' }}>
                  {formatCurrency(balanceLoanAmount)}
                </Text>
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 8, fontWeight: '600' }}>Source</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {SELF_CONTRIBUTION_SOURCES.map((s) => {
                  const isSel = selfContribution.sourceType === s.code;
                  return (
                    <TouchableOpacity
                      key={s.code}
                      onPress={() => {
                        dispatch({ type: 'SET_SELF_CONTRIBUTION', payload: { sourceType: s.code } });
                        scrollToAnchor('collateral');
                      }}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
                        borderWidth: 1,
                        borderColor: isSel ? colors.teal : colors.cardBorder,
                        backgroundColor: isSel ? colors.teal : 'transparent',
                        marginRight: 6, marginBottom: 6,
                      }}
                    >
                      <Text style={{ color: isSel ? '#fff' : colors.textPrimary, fontSize: 11, fontWeight: '600' }}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Input
                label="Source description (optional)"
                value={selfContribution.sourceDescription || ''}
                onChangeText={(v) => dispatch({ type: 'SET_SELF_CONTRIBUTION', payload: { sourceDescription: v } })}
                placeholder="e.g. Father's savings + 50% scholarship from XYZ"
              />
            </View>
          ) : null}
        </Card>
        </View>

        {/* ── Collateral ── */}
        <View {...anchorProps('collateral')}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
              Collateral {collateral.offered ? '✓' : '(optional)'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const becomingActive = !collateral.offered;
                dispatch({
                  type: 'SET_COLLATERAL',
                  payload: becomingActive
                    ? { offered: true, type: collateral.type || 'property', valuationCurrency: 'INR' }
                    : { offered: false },
                });
                if (becomingActive) scrollToAnchor('collateralType');
                else scrollToAnchor('docs');
              }}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                borderWidth: 1, borderColor: colors.teal,
              }}
            >
              <Text style={{ color: colors.teal, fontSize: 12, fontWeight: '700' }}>
                {collateral.offered ? 'Remove' : '+ Pledge collateral'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 18 }}>
            Pledging collateral can unlock a larger loan amount, lower interest
            rate, or both. Property must be free of existing encumbrance.
          </Text>

          {collateral.offered && (
            <View style={{ marginTop: 10 }} {...anchorProps('collateralType')}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {COLLATERAL_TYPES.map((t) => {
                  const isSel = (collateral.type || 'property') === t.code;
                  return (
                    <TouchableOpacity
                      key={t.code}
                      onPress={() => {
                        dispatch({ type: 'SET_COLLATERAL', payload: { type: t.code } });
                        scrollToAnchor('collateralValue');
                      }}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
                        borderWidth: 1,
                        borderColor: isSel ? colors.teal : colors.cardBorder,
                        backgroundColor: isSel ? colors.teal : 'transparent',
                        marginRight: 6, marginBottom: 6,
                      }}
                    >
                      <Text style={{ color: isSel ? '#fff' : colors.textPrimary, fontSize: 11, fontWeight: '600' }}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View {...anchorProps('collateralValue')}>
                <Input
                  label="Indicative market value (₹)"
                  value={String(collateral.marketValue || '')}
                  onChangeText={(v) => dispatch({ type: 'SET_COLLATERAL', payload: { marketValue: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 } })}
                  placeholder="e.g. 5000000"
                  keyboardType="numeric"
                />
              </View>
              <Input
                label="Owner name"
                value={collateral.ownerName || ''}
                onChangeText={(v) => dispatch({ type: 'SET_COLLATERAL', payload: { ownerName: v } })}
                placeholder="e.g. Same as borrower / Father / etc."
              />
              <Input
                label="Owner relationship to student"
                value={collateral.ownerRelationship || ''}
                onChangeText={(v) => dispatch({ type: 'SET_COLLATERAL', payload: { ownerRelationship: v } })}
                placeholder="e.g. Self, Father, Mother"
              />
              <Input
                label="Identifier (account no. / property reg. / certificate no.)"
                value={collateral.identifier || ''}
                onChangeText={(v) => dispatch({ type: 'SET_COLLATERAL', payload: { identifier: v } })}
                placeholder="As per ownership document"
              />
              <Input
                label="Address / location of collateral (if applicable)"
                value={collateral.address || ''}
                onChangeText={(v) => dispatch({ type: 'SET_COLLATERAL', payload: { address: v } })}
                placeholder="Optional for FDs / shares / MFs"
              />
              <Input
                label="Existing encumbrance (if any)"
                value={collateral.encumbrance || ''}
                onChangeText={(v) => dispatch({ type: 'SET_COLLATERAL', payload: { encumbrance: v } })}
                placeholder="e.g. Loan from XYZ Bank, ₹15L outstanding"
              />
            </View>
          )}
        </Card>
        </View>

        <View {...anchorProps('docs')} />

        {REQUIRED_DOCS.map((def) => {
          const filesForCode = uploadedBy[def.code] || [];
          const have = filesForCode.length > 0;
          return (
            <Card key={def.code} accent={def.required ? (have ? colors.teal : colors.warning) : undefined}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                    {def.label}{' '}
                    <Text style={{ color: def.required ? colors.error : colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {def.required ? 'REQUIRED' : 'optional'}
                    </Text>
                  </Text>
                  {def.hint ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                      {def.hint}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => pickAndAttach(def)}
                  disabled={pickingCode === def.code}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
                    borderWidth: 1, borderColor: colors.teal,
                    opacity: pickingCode === def.code ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: colors.teal, fontSize: 12, fontWeight: '700' }}>
                    {pickingCode === def.code ? 'Picking…' : (have ? '+ Add another' : '+ Upload')}
                  </Text>
                </TouchableOpacity>
              </View>

              {filesForCode.map((d) => (
                <View
                  key={d.id}
                  style={{
                    marginTop: 12, padding: 10, borderRadius: 8,
                    borderWidth: 1, borderColor: colors.cardBorder,
                    flexDirection: 'row', alignItems: 'center',
                  }}
                >
                  {d.contentType?.startsWith('image/') && d.uri ? (
                    <Image
                      source={{ uri: d.uri }}
                      style={{ width: 40, height: 40, borderRadius: 6, marginRight: 10 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 40, height: 40, borderRadius: 6, marginRight: 10,
                        backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>📄</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                      {d.fileName}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {d.source === 'customer' ? 'You uploaded' : `Uploaded by ${d.source}`}
                      {d.size ? `   •   ${(d.size / 1024).toFixed(0)} KB` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => remove(d.id)}>
                    <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          );
        })}

        <Button
          title={allRequiredUploaded ? 'Continue to PAN Verification' : 'Upload all required to continue'}
          onPress={handleProceed}
          disabled={!allRequiredUploaded}
          style={{ marginTop: 16 }}
        />
        <TouchableOpacity
          onPress={() => navigation.navigate('PanVerification')}
          style={{ alignSelf: 'center', marginTop: 12 }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12, textDecorationLine: 'underline' }}>
            Skip for now (sales will request later)
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <FloatingAssistButton />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  intro: { fontSize: 13, lineHeight: 19 },
});

export default SupportingDocumentsScreen;
