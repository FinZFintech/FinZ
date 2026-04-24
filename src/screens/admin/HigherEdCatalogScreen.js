import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { EntityFormModal, ConfirmModal } from '../../components/common/CatalogModals';
import { useTheme } from '../../store/ThemeContext';
import {
  loadActiveCatalog, saveCatalogOverride, clearCatalogOverride,
} from '../../services/higherEducationCatalogService';

/**
 * Admin editor for the Higher Education catalog.
 *
 * Lets staff add / remove countries, states, universities and courses
 * (plus their fees). Persists the override via
 * higherEducationCatalogService → Firestore + AsyncStorage cache. The
 * selection screen picks up the override automatically next time the
 * customer opens it.
 *
 * The shape mirrors HIGHER_EDUCATION_CATALOG verbatim — the payload
 * the selection screen consumes is exactly what this editor produces.
 */

const blankCourse = () => ({
  id: '',
  name: '',
  durationMonths: 24,
  feeCurrency: 'INR',
  indicativeAnnualFee: 0,
});
const blankUniversity = () => ({
  id: '',
  name: '',
  city: '',
  ranking: null,
  courses: [blankCourse()],
});

const HigherEdCatalogScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openCountry, setOpenCountry] = useState(null);
  const [openState, setOpenState] = useState(null);
  const [openUni, setOpenUni] = useState(null);

  // Themed "add entity" modal. `kind` selects which field config to
  // render (country / state / university / course) and `scope` carries
  // the parent-entity codes the new entity is nested under (e.g. for a
  // course: { countryCode, stateCode, uniId }). `onSubmit` and
  // `onCancel` are bound by the opener helpers below.
  const [entityModal, setEntityModal] = useState({ visible: false, kind: null, scope: {}, initial: {} });
  // Themed confirm dialog — replaces window.confirm for deletes /
  // reset-to-bundled.
  const [confirmModal, setConfirmModal] = useState({ visible: false });

  const openEntityModal = (kind, scope = {}, initial = {}) => {
    setEntityModal({ visible: true, kind, scope, initial });
  };
  const closeEntityModal = () => setEntityModal((m) => ({ ...m, visible: false }));

  const askConfirm = (cfg, onConfirm) => {
    setConfirmModal({
      visible: true,
      destructive: true,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      emoji: '🗑️',
      ...cfg,
      onConfirm: () => {
        setConfirmModal({ visible: false });
        onConfirm?.();
      },
      onCancel: () => setConfirmModal({ visible: false }),
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const active = await loadActiveCatalog();
        // Deep clone so edits don't mutate the bundled module
        setCatalog(JSON.parse(JSON.stringify(active)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Field configs for each entity kind ──
  // Each block shapes the EntityFormModal — declarative so the same
  // modal component renders country / state / university / course.
  const fieldConfigs = useMemo(() => ({
    country: {
      title: 'Add Country',
      subtitle: 'Country becomes a top-level option in the higher-ed picker.',
      emoji: '🌍',
      fields: [
        { key: 'code',        label: 'Country code', hint: 'ISO-like 2-letter code (e.g. IN, US, FR)', required: true, upperCase: true, maxLength: 3, placeholder: 'IN' },
        { key: 'countryName', label: 'Country name', required: true, placeholder: 'India' },
        { key: 'flag',        label: 'Flag emoji',   placeholder: '🇮🇳', default: '🌐' },
        { key: 'isDomestic',  label: 'Mark as domestic', hint: 'India-based programs show without USD conversion.', type: 'toggle', trueLabel: 'Domestic', falseLabel: 'Abroad' },
      ],
    },
    state: {
      title: 'Add State / Region',
      subtitle: 'Nested under the selected country.',
      emoji: '📍',
      fields: [
        { key: 'code',      label: 'State code', hint: 'Short code (e.g. KA, CA, NY)', required: true, upperCase: true, maxLength: 4, placeholder: 'KA' },
        { key: 'stateName', label: 'State name', required: true, placeholder: 'Karnataka' },
      ],
    },
    university: {
      title: 'Add University / College',
      subtitle: 'Creates a new university within this state. Add courses afterwards.',
      emoji: '🏛️',
      fields: [
        { key: 'name',    label: 'University / College name', required: true, placeholder: 'Indian Institute of Science' },
        { key: 'city',    label: 'City', placeholder: 'Bangalore' },
        { key: 'ranking', label: 'Ranking (optional)', type: 'number', placeholder: 'e.g. 225', hint: 'Global / local rank — leave blank to skip.' },
      ],
    },
    course: {
      title: 'Add Course',
      subtitle: 'Course offered under this university.',
      emoji: '🎓',
      fields: [
        { key: 'name',                 label: 'Course name',     required: true, placeholder: 'M.Tech Computer Science' },
        { key: 'durationMonths',       label: 'Duration (months)', required: true, type: 'number', placeholder: '24', default: 24 },
        { key: 'feeCurrency',          label: 'Fee currency',    type: 'segmented',
          default: 'INR',
          options: [
            { value: 'INR', label: '₹ INR' },
            { value: 'USD', label: '$ USD' },
          ],
        },
        { key: 'indicativeAnnualFee',  label: 'Indicative annual fee', required: true, type: 'number', placeholder: '250000', hint: 'In the chosen currency.' },
      ],
    },
  }), []);

  // ── Modal submit handlers ──
  const submitEntity = useCallback((values) => {
    const kind = entityModal.kind;
    const scope = entityModal.scope || {};

    if (kind === 'country') {
      const code = String(values.code || '').toUpperCase();
      if (!code) { closeEntityModal(); return; }
      if (catalog[code]) {
        Alert.alert('Already exists', `Country ${code} is already in the catalog.`);
        return;
      }
      setCatalog((prev) => ({
        ...prev,
        [code]: {
          countryName: values.countryName || code,
          flag: values.flag || '🌐',
          isDomestic: !!values.isDomestic,
          states: {},
        },
      }));
      setOpenCountry(code);
    } else if (kind === 'state') {
      const code = String(values.code || '').toUpperCase();
      const { countryCode } = scope;
      if (!code || !countryCode) { closeEntityModal(); return; }
      if (catalog[countryCode]?.states?.[code]) {
        Alert.alert('Already exists', `State ${code} is already in this country.`);
        return;
      }
      setCatalog((prev) => ({
        ...prev,
        [countryCode]: {
          ...prev[countryCode],
          states: {
            ...prev[countryCode].states,
            [code]: { stateName: values.stateName || code, universities: [] },
          },
        },
      }));
      setOpenState(`${countryCode}/${code}`);
    } else if (kind === 'university') {
      const { countryCode, stateCode } = scope;
      if (!countryCode || !stateCode) { closeEntityModal(); return; }
      const id = `${countryCode}_${stateCode}_${Date.now()}`.toLowerCase();
      const newUni = {
        ...blankUniversity(),
        id,
        name: values.name || '',
        city: values.city || '',
        ranking: values.ranking || null,
        courses: [],
      };
      setCatalog((prev) => {
        const st = prev[countryCode].states[stateCode];
        return {
          ...prev,
          [countryCode]: {
            ...prev[countryCode],
            states: {
              ...prev[countryCode].states,
              [stateCode]: { ...st, universities: [...st.universities, newUni] },
            },
          },
        };
      });
      setOpenUni(id);
    } else if (kind === 'course') {
      const { countryCode, stateCode, uniId } = scope;
      if (!countryCode || !stateCode || !uniId) { closeEntityModal(); return; }
      const id = `course_${Date.now()}`;
      const newCourse = {
        id,
        name: values.name || '',
        durationMonths: values.durationMonths || 24,
        feeCurrency: values.feeCurrency || 'INR',
        indicativeAnnualFee: values.indicativeAnnualFee || 0,
      };
      setCatalog((prev) => ({
        ...prev,
        [countryCode]: {
          ...prev[countryCode],
          states: {
            ...prev[countryCode].states,
            [stateCode]: {
              ...prev[countryCode].states[stateCode],
              universities: prev[countryCode].states[stateCode].universities.map((u) => {
                if (u.id !== uniId) return u;
                return { ...u, courses: [...u.courses, newCourse] };
              }),
            },
          },
        },
      }));
    }

    closeEntityModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityModal.kind, entityModal.scope, catalog]);

  const updateCountry = (code, patch) => {
    setCatalog((prev) => ({
      ...prev,
      [code]: { ...prev[code], ...patch },
    }));
  };

  const addCountry = () => openEntityModal('country');

  const deleteCountry = (code) => {
    askConfirm(
      {
        title: `Delete ${catalog[code].countryName}?`,
        message: 'This removes the country along with every state, university and course nested under it. Customers will no longer see these options.',
      },
      () => setCatalog((prev) => {
        const out = { ...prev };
        delete out[code];
        return out;
      }),
    );
  };

  const addState = (countryCode) => openEntityModal('state', { countryCode });

  const updateState = (countryCode, stateCode, patch) => {
    setCatalog((prev) => ({
      ...prev,
      [countryCode]: {
        ...prev[countryCode],
        states: {
          ...prev[countryCode].states,
          [stateCode]: { ...prev[countryCode].states[stateCode], ...patch },
        },
      },
    }));
  };

  const deleteState = (countryCode, stateCode) => {
    askConfirm(
      {
        title: `Delete ${catalog[countryCode].states[stateCode].stateName}?`,
        message: 'Universities and courses under this state will also be removed.',
      },
      () => setCatalog((prev) => {
        const states = { ...prev[countryCode].states };
        delete states[stateCode];
        return { ...prev, [countryCode]: { ...prev[countryCode], states } };
      }),
    );
  };

  const addUniversity = (countryCode, stateCode) => openEntityModal('university', { countryCode, stateCode });

  const updateUniversity = (countryCode, stateCode, uniId, patch) => {
    setCatalog((prev) => ({
      ...prev,
      [countryCode]: {
        ...prev[countryCode],
        states: {
          ...prev[countryCode].states,
          [stateCode]: {
            ...prev[countryCode].states[stateCode],
            universities: prev[countryCode].states[stateCode].universities.map(
              (u) => (u.id === uniId ? { ...u, ...patch } : u),
            ),
          },
        },
      },
    }));
  };

  const deleteUniversity = (countryCode, stateCode, uniId) => {
    const uniName = (catalog?.[countryCode]?.states?.[stateCode]?.universities || [])
      .find((u) => u.id === uniId)?.name || 'this university';
    askConfirm(
      {
        title: `Delete ${uniName}?`,
        message: 'All courses under this university will be removed.',
      },
      () => setCatalog((prev) => ({
        ...prev,
        [countryCode]: {
          ...prev[countryCode],
          states: {
            ...prev[countryCode].states,
            [stateCode]: {
              ...prev[countryCode].states[stateCode],
              universities: prev[countryCode].states[stateCode].universities.filter((u) => u.id !== uniId),
            },
          },
        },
      })),
    );
  };

  const updateCourse = (countryCode, stateCode, uniId, courseIdx, patch) => {
    setCatalog((prev) => ({
      ...prev,
      [countryCode]: {
        ...prev[countryCode],
        states: {
          ...prev[countryCode].states,
          [stateCode]: {
            ...prev[countryCode].states[stateCode],
            universities: prev[countryCode].states[stateCode].universities.map((u) => {
              if (u.id !== uniId) return u;
              return {
                ...u,
                courses: u.courses.map((c, i) => (i === courseIdx ? { ...c, ...patch } : c)),
              };
            }),
          },
        },
      },
    }));
  };

  const addCourse = (countryCode, stateCode, uniId) => openEntityModal('course', { countryCode, stateCode, uniId });

  const deleteCourse = (countryCode, stateCode, uniId, courseIdx) => {
    const uni = (catalog?.[countryCode]?.states?.[stateCode]?.universities || [])
      .find((u) => u.id === uniId);
    const courseName = uni?.courses?.[courseIdx]?.name || `course #${courseIdx + 1}`;
    askConfirm(
      {
        title: `Delete "${courseName}"?`,
        message: 'Customers will no longer see this course on the picker.',
      },
      () => setCatalog((prev) => ({
        ...prev,
        [countryCode]: {
          ...prev[countryCode],
          states: {
            ...prev[countryCode].states,
            [stateCode]: {
              ...prev[countryCode].states[stateCode],
              universities: prev[countryCode].states[stateCode].universities.map((u) => {
                if (u.id !== uniId) return u;
                return { ...u, courses: u.courses.filter((_, i) => i !== courseIdx) };
              }),
            },
          },
        },
      })),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCatalogOverride(catalog);
      Alert.alert('Saved', 'Catalog override saved. Customers will see the updated list on their next pick.');
    } catch (err) {
      Alert.alert('Save failed', err?.message || 'Could not save the catalog. Check Firestore connectivity.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToBundled = () => {
    askConfirm(
      {
        title: 'Reset to bundled catalog?',
        message: 'Your overrides will be discarded and the default country / state / university list will be restored. Customers see the bundled list on their next pick.',
        emoji: '↺',
        destructive: false,
        confirmLabel: 'Reset',
      },
      async () => {
        setSaving(true);
        try {
          await clearCatalogOverride();
          const fresh = await loadActiveCatalog();
          setCatalog(JSON.parse(JSON.stringify(fresh)));
          Alert.alert('Reset', 'Reset to the bundled catalog.');
        } finally {
          setSaving(false);
        }
      },
    );
  };

  if (loading || !catalog) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Higher Ed Catalog" onBack={() => navigation.goBack()} />
        <Text style={{ color: colors.textSecondary, padding: 16 }}>Loading catalog…</Text>
      </View>
    );
  }

  const lbl = (val) => ({ color: colors.textSecondary, fontSize: 11, marginTop: 8, marginBottom: 4, fontWeight: '600' });
  const inp = {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, borderColor: colors.cardBorder, color: colors.textPrimary,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Higher Ed Catalog" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            Manage the country / state / university / course list customers see in the
            Higher Education flow. Saved overrides apply to all devices via Firestore.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
            <Button title="Reset" variant="outline" onPress={handleResetToBundled} disabled={saving} />
            <Button title="+ Country" variant="outline" onPress={addCountry} />
          </View>
        </Card>

        {Object.entries(catalog).map(([countryCode, country]) => {
          const open = openCountry === countryCode;
          return (
            <Card key={countryCode}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setOpenCountry(open ? null : countryCode)} style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
                    {open ? '▼' : '▶'} {country.flag} {country.countryName} ({countryCode})
                    {country.isDomestic ? '  •  domestic' : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteCountry(countryCode)}>
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                </TouchableOpacity>
              </View>

              {open && (
                <View style={{ marginTop: 10 }}>
                  <Text style={lbl()}>Country name</Text>
                  <TextInput
                    value={country.countryName}
                    onChangeText={(v) => updateCountry(countryCode, { countryName: v })}
                    style={inp}
                  />
                  <Text style={lbl()}>Flag emoji</Text>
                  <TextInput
                    value={country.flag}
                    onChangeText={(v) => updateCountry(countryCode, { flag: v })}
                    style={inp}
                  />
                  <TouchableOpacity
                    onPress={() => updateCountry(countryCode, { isDomestic: !country.isDomestic })}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={{ color: colors.teal, fontSize: 12, fontWeight: '600' }}>
                      {country.isDomestic ? '✓ Marked domestic' : '○ Mark as domestic'} (toggle)
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>States</Text>
                    <TouchableOpacity onPress={() => addState(countryCode)}>
                      <Text style={{ color: colors.teal, fontSize: 12, fontWeight: '700' }}>+ Add state</Text>
                    </TouchableOpacity>
                  </View>

                  {Object.entries(country.states || {}).map(([stateCode, st]) => {
                    const stKey = `${countryCode}/${stateCode}`;
                    const sOpen = openState === stKey;
                    return (
                      <View
                        key={stateCode}
                        style={{
                          marginTop: 10, padding: 10, borderRadius: 8,
                          borderWidth: 1, borderColor: colors.cardBorder,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => setOpenState(sOpen ? null : stKey)} style={{ flex: 1 }}>
                            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                              {sOpen ? '▼' : '▶'} {st.stateName} ({stateCode}) — {(st.universities || []).length} univ.
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteState(countryCode, stateCode)}>
                            <Text style={{ color: colors.error, fontSize: 11, fontWeight: '700' }}>Delete</Text>
                          </TouchableOpacity>
                        </View>

                        {sOpen && (
                          <View style={{ marginTop: 8 }}>
                            <Text style={lbl()}>State name</Text>
                            <TextInput
                              value={st.stateName}
                              onChangeText={(v) => updateState(countryCode, stateCode, { stateName: v })}
                              style={inp}
                            />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12 }}>Universities</Text>
                              <TouchableOpacity onPress={() => addUniversity(countryCode, stateCode)}>
                                <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700' }}>+ Add university</Text>
                              </TouchableOpacity>
                            </View>

                            {(st.universities || []).map((u) => {
                              const uOpen = openUni === u.id;
                              return (
                                <View
                                  key={u.id}
                                  style={{
                                    marginTop: 8, padding: 10, borderRadius: 8,
                                    borderWidth: 1, borderColor: colors.cardBorder,
                                    backgroundColor: colors.cardBg,
                                  }}
                                >
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <TouchableOpacity onPress={() => setOpenUni(uOpen ? null : u.id)} style={{ flex: 1 }}>
                                      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12 }}>
                                        {uOpen ? '▼' : '▶'} {u.name || '(unnamed)'} — {u.courses.length} courses
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => deleteUniversity(countryCode, stateCode, u.id)}>
                                      <Text style={{ color: colors.error, fontSize: 11, fontWeight: '700' }}>Delete</Text>
                                    </TouchableOpacity>
                                  </View>

                                  {uOpen && (
                                    <View style={{ marginTop: 6 }}>
                                      <Text style={lbl()}>ID</Text>
                                      <TextInput
                                        value={u.id}
                                        onChangeText={(v) => updateUniversity(countryCode, stateCode, u.id, { id: v })}
                                        style={inp}
                                      />
                                      <Text style={lbl()}>Name</Text>
                                      <TextInput
                                        value={u.name}
                                        onChangeText={(v) => updateUniversity(countryCode, stateCode, u.id, { name: v })}
                                        style={inp}
                                      />
                                      <Text style={lbl()}>City / College affiliated</Text>
                                      <TextInput
                                        value={u.city}
                                        onChangeText={(v) => updateUniversity(countryCode, stateCode, u.id, { city: v })}
                                        style={inp}
                                      />
                                      <Text style={lbl()}>Ranking (number, optional)</Text>
                                      <TextInput
                                        value={u.ranking == null ? '' : String(u.ranking)}
                                        onChangeText={(v) => updateUniversity(countryCode, stateCode, u.id, {
                                          ranking: v.trim() ? parseInt(v, 10) || null : null,
                                        })}
                                        keyboardType="numeric"
                                        style={inp}
                                      />

                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                                        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12 }}>Courses</Text>
                                        <TouchableOpacity onPress={() => addCourse(countryCode, stateCode, u.id)}>
                                          <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700' }}>+ Add course</Text>
                                        </TouchableOpacity>
                                      </View>

                                      {u.courses.map((c, ci) => (
                                        <View
                                          key={ci}
                                          style={{
                                            marginTop: 8, padding: 8, borderRadius: 6,
                                            borderWidth: 1, borderColor: colors.cardBorder,
                                          }}
                                        >
                                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Course #{ci + 1}</Text>
                                            <TouchableOpacity onPress={() => deleteCourse(countryCode, stateCode, u.id, ci)}>
                                              <Text style={{ color: colors.error, fontSize: 11, fontWeight: '700' }}>Delete</Text>
                                            </TouchableOpacity>
                                          </View>
                                          <Text style={lbl()}>ID</Text>
                                          <TextInput
                                            value={c.id}
                                            onChangeText={(v) => updateCourse(countryCode, stateCode, u.id, ci, { id: v })}
                                            style={inp}
                                          />
                                          <Text style={lbl()}>Name</Text>
                                          <TextInput
                                            value={c.name}
                                            onChangeText={(v) => updateCourse(countryCode, stateCode, u.id, ci, { name: v })}
                                            style={inp}
                                          />
                                          <Text style={lbl()}>Duration (months)</Text>
                                          <TextInput
                                            value={String(c.durationMonths || '')}
                                            onChangeText={(v) => updateCourse(countryCode, stateCode, u.id, ci, {
                                              durationMonths: parseInt(v, 10) || 0,
                                            })}
                                            keyboardType="numeric"
                                            style={inp}
                                          />
                                          <Text style={lbl()}>Currency (INR or USD)</Text>
                                          <TouchableOpacity
                                            onPress={() => updateCourse(countryCode, stateCode, u.id, ci, {
                                              feeCurrency: c.feeCurrency === 'INR' ? 'USD' : 'INR',
                                            })}
                                          >
                                            <Text style={{ color: colors.teal, fontSize: 12, fontWeight: '600' }}>
                                              {c.feeCurrency || 'INR'} (tap to toggle)
                                            </Text>
                                          </TouchableOpacity>
                                          <Text style={lbl()}>Indicative annual fee (in {c.feeCurrency || 'INR'})</Text>
                                          <TextInput
                                            value={String(c.indicativeAnnualFee || '')}
                                            onChangeText={(v) => updateCourse(countryCode, stateCode, u.id, ci, {
                                              indicativeAnnualFee: parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0,
                                            })}
                                            keyboardType="numeric"
                                            style={inp}
                                          />
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>

      {/* Themed add-entity modal — country / state / university / course */}
      {entityModal.kind ? (
        <EntityFormModal
          visible={entityModal.visible}
          title={fieldConfigs[entityModal.kind].title}
          subtitle={fieldConfigs[entityModal.kind].subtitle}
          emoji={fieldConfigs[entityModal.kind].emoji}
          fields={fieldConfigs[entityModal.kind].fields}
          initial={entityModal.initial}
          submitLabel="Add"
          onCancel={closeEntityModal}
          onSubmit={submitEntity}
        />
      ) : null}

      {/* Themed confirm dialog — used for deletes + reset-to-bundled */}
      <ConfirmModal {...confirmModal} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
});

export default HigherEdCatalogScreen;
