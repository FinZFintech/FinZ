import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Pressable, Platform,
} from 'react-native';
import { useTheme } from '../../store/ThemeContext';

/**
 * Themed in-app replacements for `window.prompt` / `window.confirm`
 * used by the Higher Ed Catalog admin screen.
 *
 * EntityFormModal — centred dialog for collecting structured input
 *   (country / state / university / course). Caller passes:
 *     • visible         boolean
 *     • title / subtitle
 *     • emoji           big icon above the title
 *     • fields          [{ key, label, hint?, placeholder?, type,
 *                         options?, keyboardType?, required?, maxLength? }]
 *         type: 'text' | 'number' | 'toggle' | 'segmented'
 *     • initial         partial values keyed by field.key
 *     • submitLabel, cancelLabel
 *     • onSubmit(values)
 *     • onCancel()
 *
 * ConfirmModal — yes / no dialog with destructive styling option.
 *     • visible, title, message, destructive?, confirmLabel,
 *       cancelLabel, onConfirm, onCancel
 *
 * Both modals trap focus inside the card (hairline shadow, rounded
 * corners, theme-aware colours) and close on backdrop press.
 */

// ─── EntityFormModal ────────────────────────────────────────────────────────

export function EntityFormModal({
  visible,
  title,
  subtitle,
  emoji,
  fields = [],
  initial = {},
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onSubmit,
  onCancel,
}) {
  const { colors } = useTheme();
  const [values, setValues] = useState({});
  const [error, setError] = useState('');

  // Re-seed the form every time the modal is re-opened so reused
  // instances don't leak state across entities.
  useEffect(() => {
    if (visible) {
      const seed = {};
      for (const f of fields) {
        if (initial[f.key] !== undefined) seed[f.key] = initial[f.key];
        else if (f.default !== undefined) seed[f.key] = f.default;
        else if (f.type === 'toggle') seed[f.key] = false;
        else if (f.type === 'number') seed[f.key] = '';
        else seed[f.key] = '';
      }
      setValues(seed);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = () => {
    // Validate required fields.
    for (const f of fields) {
      if (f.required) {
        const v = values[f.key];
        if (v === undefined || v === null || String(v).trim() === '') {
          setError(`${f.label} is required.`);
          return;
        }
      }
      if (f.type === 'number' && values[f.key] !== '' && values[f.key] !== null && values[f.key] !== undefined) {
        const n = Number(String(values[f.key]).replace(/[^0-9.-]/g, ''));
        if (Number.isNaN(n)) {
          setError(`${f.label} must be a number.`);
          return;
        }
      }
    }
    // Normalise outputs — trim text, coerce numbers, apply upper case.
    const out = {};
    for (const f of fields) {
      let v = values[f.key];
      if (typeof v === 'string') v = f.trim === false ? v : v.trim();
      if (f.upperCase && typeof v === 'string') v = v.toUpperCase();
      if (f.type === 'number') {
        const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
        v = Number.isFinite(n) ? n : (f.default ?? 0);
      }
      out[f.key] = v;
    }
    onSubmit?.(out);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
              shadowColor: colors.textPrimary,
            },
          ]}
        >
          {/* Top accent bar in teal — matches the other themed cards */}
          <View style={[styles.accent, { backgroundColor: colors.teal }]} />

          <View style={styles.headerRow}>
            {emoji ? (
              <View style={[styles.emojiBadge, { backgroundColor: `${colors.teal}1A`, borderColor: `${colors.teal}55` }]}>
                <Text style={styles.emoji}>{emoji}</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
              ) : null}
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {fields.map((f) => (
              <FieldRenderer
                key={f.key}
                field={f}
                value={values[f.key]}
                onChange={(v) => { setError(''); set(f.key, v); }}
                colors={colors}
              />
            ))}
          </ScrollView>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: `${colors.error}14`, borderColor: `${colors.error}55` }]}>
              <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>⚠ {error}</Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.btnOutline, { borderColor: colors.cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.btnPrimary, { backgroundColor: colors.teal }]}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Per-field renderer ─────────────────────────────────────────────────────

function FieldRenderer({ field, value, onChange, colors }) {
  const label = (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{field.label}</Text>
      {field.required ? (
        <Text style={[styles.required, { color: colors.error }]}>required</Text>
      ) : null}
    </View>
  );
  const hint = field.hint ? (
    <Text style={[styles.hint, { color: colors.textSecondary }]}>{field.hint}</Text>
  ) : null;

  if (field.type === 'toggle') {
    const active = !!value;
    return (
      <View style={styles.fieldBlock}>
        {label}
        {hint}
        <TouchableOpacity
          onPress={() => onChange(!active)}
          activeOpacity={0.8}
          style={[
            styles.toggle,
            {
              backgroundColor: active ? colors.teal : (colors.inputBg || colors.cardBg),
              borderColor: active ? colors.teal : colors.cardBorder,
            },
          ]}
        >
          <View
            style={[
              styles.toggleDot,
              {
                backgroundColor: '#FFFFFF',
                transform: [{ translateX: active ? 22 : 2 }],
              },
            ]}
          />
        </TouchableOpacity>
        <Text style={{ color: active ? colors.teal : colors.textSecondary, fontSize: 12, marginTop: 6, fontWeight: '600' }}>
          {active ? (field.trueLabel || 'On') : (field.falseLabel || 'Off')}
        </Text>
      </View>
    );
  }

  if (field.type === 'segmented') {
    return (
      <View style={styles.fieldBlock}>
        {label}
        {hint}
        <View style={styles.segmentedWrap}>
          {(field.options || []).map((opt) => {
            const active = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onChange(opt.value)}
                activeOpacity={0.8}
                style={[
                  styles.segment,
                  {
                    backgroundColor: active ? colors.teal : 'transparent',
                    borderColor: active ? colors.teal : colors.cardBorder,
                  },
                ]}
              >
                <Text style={{
                  color: active ? '#FFFFFF' : colors.textPrimary,
                  fontWeight: '600', fontSize: 12,
                }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // text / number
  return (
    <View style={styles.fieldBlock}>
      {label}
      {hint}
      <TextInput
        value={value === undefined || value === null ? '' : String(value)}
        onChangeText={onChange}
        placeholder={field.placeholder || ''}
        placeholderTextColor={colors.textSecondary}
        keyboardType={field.keyboardType || (field.type === 'number' ? 'numeric' : 'default')}
        autoCapitalize={field.upperCase ? 'characters' : (field.autoCapitalize || 'sentences')}
        maxLength={field.maxLength}
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg || colors.cardBg,
            borderColor: colors.cardBorder,
            color: colors.textPrimary,
          },
        ]}
      />
    </View>
  );
}

// ─── ConfirmModal ───────────────────────────────────────────────────────────

export function ConfirmModal({
  visible,
  title = 'Are you sure?',
  message,
  emoji = '⚠️',
  destructive = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const { colors } = useTheme();
  const accent = destructive ? colors.error : colors.teal;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
              shadowColor: colors.textPrimary,
              maxWidth: 420,
            },
          ]}
        >
          <View style={[styles.accent, { backgroundColor: accent }]} />
          <View style={styles.confirmHeader}>
            <View style={[styles.emojiBadge, { backgroundColor: `${accent}1A`, borderColor: `${accent}55` }]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <Text style={[styles.title, { color: colors.textPrimary, marginTop: 12 }]}>{title}</Text>
            {message ? (
              <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>{message}</Text>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.btnOutline, { borderColor: colors.cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.btnPrimary, { backgroundColor: accent }]}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(10, 15, 25, 0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  card: {
    width: '100%', maxWidth: 480, borderRadius: 18, borderWidth: 1,
    overflow: 'hidden', padding: 20,
    ...Platform.select({
      web: { boxShadow: '0 20px 40px rgba(0,0,0,0.25)' },
      default: { elevation: 8, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    }),
  },
  accent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 4,
  },
  emojiBadge: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  emoji: { fontSize: 24 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  fieldBlock: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '600' },
  required: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  hint: { fontSize: 11, marginTop: 2, marginBottom: 4, fontStyle: 'italic' },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, marginTop: 6,
  },
  toggle: {
    width: 48, height: 26, borderRadius: 13, borderWidth: 1, marginTop: 6,
    justifyContent: 'center',
  },
  toggleDot: { width: 22, height: 22, borderRadius: 11 },
  segmentedWrap: { flexDirection: 'row', marginTop: 6, flexWrap: 'wrap' },
  segment: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    marginRight: 8, marginBottom: 6,
  },
  errorBox: {
    padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 4, marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 10,
  },
  btnOutline: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  btnPrimary: {
    paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10,
  },
  confirmHeader: { alignItems: 'center', paddingVertical: 4, marginBottom: 8 },
  confirmMessage: { fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 19 },
});
