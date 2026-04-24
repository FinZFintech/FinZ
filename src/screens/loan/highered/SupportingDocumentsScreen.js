import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../../../components/common/Header';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import StepIndicator from '../../../components/common/StepIndicator';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { useTheme } from '../../../store/ThemeContext';
import { useLoan } from '../../../store/LoanContext';
import { useAuth } from '../../../store/AuthContext';

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

const REQUIRED_DOCS = [
  { code: 'offer_letter',    label: 'University Offer Letter',     required: true,  hint: 'Conditional or unconditional admission letter' },
  { code: 'passport',        label: 'Passport (front + back)',     required: true },
  { code: 'visa',            label: 'Student Visa / I-20 / CAS',   required: false, hint: 'Optional at application; required before disbursement' },
  { code: 'fee_breakup',     label: 'Tuition Fee Break-up',         required: true },
  { code: 'gre_gmat',        label: 'GRE / GMAT / IELTS Score',    required: false },
  { code: 'bank_statements', label: 'Last 12 months bank statements (PDF)', required: true },
  { code: 'salary_slips',    label: 'Last 6 months salary slips',  required: true,  hint: 'Of co-applicants / guarantor' },
  { code: 'itr',             label: 'ITR (last 2 years)',           required: true,  hint: 'Of co-applicants / guarantor' },
  { code: 'collateral_doc',  label: 'Collateral / Property docs',   required: false, hint: 'If pledging collateral' },
  { code: 'sponsor_letter',  label: 'Sponsor Affidavit / Letter',   required: false },
];

const SupportingDocumentsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { state, dispatch } = useLoan();
  const { user } = useAuth();
  const [pickingCode, setPickingCode] = useState(null);

  const docs = state.supportingDocuments || [];
  // Group what the user already uploaded by required-doc code.
  const uploadedBy = docs.reduce((acc, d) => {
    const c = d.code || 'misc';
    if (!acc[c]) acc[c] = [];
    acc[c].push(d);
    return acc;
  }, {});

  const sourceTag = user?.role && user.role !== 'customer' ? user.role : 'customer';

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
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Card>
          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            Higher-education (abroad) loans need extra underwriting evidence.
            Upload the documents below — PDFs and images both work. You can
            return here later to add anything you missed.
          </Text>
        </Card>

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
