import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform,
} from 'react-native';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useTheme } from '../../store/ThemeContext';
import {
  loadActiveCatalog, saveCatalogOverride, clearCatalogOverride,
} from '../../services/higherEducationCatalogService';

// Web-only browser prompts. On mobile we degrade to a non-interactive
// path (returns null / true) — admin tooling realistically runs on web.
const webPrompt = (msg, def = '') =>
  (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.prompt === 'function')
    ? window.prompt(msg, def)
    : null;
const webConfirm = (msg) =>
  (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function')
    ? window.confirm(msg)
    : true;

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

  const updateCountry = (code, patch) => {
    setCatalog((prev) => ({
      ...prev,
      [code]: { ...prev[code], ...patch },
    }));
  };

  const addCountry = () => {
    const code = webPrompt('Country code (2 letters, e.g. IN, US, FR):');
    if (!code) return;
    const upper = code.toUpperCase();
    if (catalog[upper]) { Alert.alert('Already exists', `Country ${upper} is already in the catalog.`); return; }
    setCatalog((prev) => ({
      ...prev,
      [upper]: { countryName: upper, flag: '🌐', isDomestic: false, states: {} },
    }));
    setOpenCountry(upper);
  };

  const deleteCountry = (code) => {
    if (!webConfirm(`Delete country "${catalog[code].countryName}" and everything under it?`)) return;
    setCatalog((prev) => {
      const out = { ...prev };
      delete out[code];
      return out;
    });
  };

  const addState = (countryCode) => {
    const code = webPrompt('State code (e.g. CA, KA, DL):');
    if (!code) return;
    const upper = code.toUpperCase();
    setCatalog((prev) => {
      const country = prev[countryCode];
      if (country.states[upper]) { Alert.alert('Already exists', `State ${upper} is already in this country.`); return prev; }
      return {
        ...prev,
        [countryCode]: {
          ...country,
          states: { ...country.states, [upper]: { stateName: upper, universities: [] } },
        },
      };
    });
    setOpenState(`${countryCode}/${upper}`);
  };

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
    if (!webConfirm(`Delete state "${catalog[countryCode].states[stateCode].stateName}"?`)) return;
    setCatalog((prev) => {
      const states = { ...prev[countryCode].states };
      delete states[stateCode];
      return { ...prev, [countryCode]: { ...prev[countryCode], states } };
    });
  };

  const addUniversity = (countryCode, stateCode) => {
    setCatalog((prev) => {
      const stateObj = prev[countryCode].states[stateCode];
      const newUni = { ...blankUniversity(), id: `${countryCode}_${stateCode}_${Date.now()}`.toLowerCase() };
      return {
        ...prev,
        [countryCode]: {
          ...prev[countryCode],
          states: {
            ...prev[countryCode].states,
            [stateCode]: { ...stateObj, universities: [...stateObj.universities, newUni] },
          },
        },
      };
    });
  };

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
    if (!webConfirm('Delete this university and all its courses?')) return;
    setCatalog((prev) => ({
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
    }));
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

  const addCourse = (countryCode, stateCode, uniId) => {
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
              return { ...u, courses: [...u.courses, blankCourse()] };
            }),
          },
        },
      },
    }));
  };

  const deleteCourse = (countryCode, stateCode, uniId, courseIdx) => {
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
              return { ...u, courses: u.courses.filter((_, i) => i !== courseIdx) };
            }),
          },
        },
      },
    }));
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

  const handleResetToBundled = async () => {
    if (!webConfirm('Reset to the bundled catalog (your overrides will be lost)?')) return;
    setSaving(true);
    try {
      await clearCatalogOverride();
      const fresh = await loadActiveCatalog();
      setCatalog(JSON.parse(JSON.stringify(fresh)));
      Alert.alert('Reset', 'Reset to the bundled catalog.');
    } finally {
      setSaving(false);
    }
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
});

export default HigherEdCatalogScreen;
