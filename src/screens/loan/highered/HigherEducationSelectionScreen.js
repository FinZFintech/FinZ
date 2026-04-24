import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import Header from '../../../components/common/Header';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import StepIndicator from '../../../components/common/StepIndicator';
import FloatingAssistButton from '../../../components/common/FloatingAssistButton';
import { useTheme } from '../../../store/ThemeContext';
import { useLoan } from '../../../store/LoanContext';
import { LOAN_TYPES } from '../../../config/constants';
import {
  listCountries, listStates, listUniversities, listCourses,
  computeIndicativeTotalInr, USD_TO_INR_RATE,
} from '../../../services/higherEducationData';
import { getHigherEdCatalog } from '../../../services/higherEducationCatalogService';

/**
 * Entry screen for the Higher Education loan flow.
 *
 * Covers both domestic (India) and study-abroad programs. The four-step
 * picker (country → state → university → course) replaces the
 * registration-number lookup the standard education flow uses. Once
 * the user confirms, we save selections onto state.studentDetails
 * (same shape the rest of the journey already reads) plus a
 * higherEducationDetails slice for the fields specific to this type,
 * then hand off to BorrowerSelection — every downstream screen is
 * shared.
 *
 * Catalog can be overridden by the admin (see
 * higherEducationCatalogService) — if overrides exist we use those,
 * else we fall back to the static bundled catalog.
 */
const HigherEducationSelectionScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { dispatch } = useLoan();

  const [country, setCountry] = useState(null); // { code, name, flag, isDomestic }
  const [stateSel, setStateSel] = useState(null); // { code, name }
  const [university, setUniversity] = useState(null); // { id, name, city, ranking }
  const [course, setCourse] = useState(null); // { id, name, durationMonths, feeCurrency, indicativeAnnualFee }
  const [yearsOfCourse, setYearsOfCourse] = useState('2');
  const [estimatedTotalCostInr, setEstimatedTotalCostInr] = useState('');
  const [search, setSearch] = useState('');
  // Catalog overrides applied by the admin — loaded once on mount;
  // re-sourced per picker via listCountries / listStates / ... so the
  // admin can swap in a custom entity without us blocking the render.
  const [catalogReady, setCatalogReady] = useState(false);
  const [helpers, setHelpers] = useState({
    listCountries, listStates, listUniversities, listCourses,
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const custom = await getHigherEdCatalog();
        if (cancelled || !custom) return;
        setHelpers(custom);
      } finally {
        if (!cancelled) setCatalogReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const countries = useMemo(() => helpers.listCountries(), [helpers]);
  const states = useMemo(() => (country ? helpers.listStates(country.code) : []), [helpers, country]);
  const universities = useMemo(
    () => (country && stateSel ? helpers.listUniversities(country.code, stateSel.code) : []),
    [helpers, country, stateSel],
  );
  const courses = useMemo(
    () => (country && stateSel && university
      ? helpers.listCourses(country.code, stateSel.code, university.id)
      : []),
    [helpers, country, stateSel, university],
  );

  const filteredUniversities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return universities;
    return universities.filter((u) =>
      u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q));
  }, [universities, search]);

  const handleProceed = () => {
    if (!country || !stateSel || !university || !course) {
      Alert.alert('Incomplete selection', 'Please pick a country, state, university and course before continuing.');
      return;
    }
    const years = Math.max(1, parseInt(yearsOfCourse, 10) || 1);
    const indicativeTotalInr = computeIndicativeTotalInr(course, years);
    const inrFromUser = parseInt(String(estimatedTotalCostInr).replace(/[^0-9]/g, ''), 10);

    // Total cost (₹). If the user gave one, trust it; otherwise use the
    // catalog's indicative number (already in INR — INR courses pass
    // through, USD courses are converted in computeIndicativeTotalInr).
    const balanceFee = inrFromUser && inrFromUser > 0
      ? inrFromUser
      : indicativeTotalInr;

    const isDomestic = !!country.isDomestic;

    dispatch({ type: 'SET_LOAN_TYPE', payload: LOAN_TYPES.HIGHER_EDUCATION });

    // Reuse the institute slot for the university so every downstream
    // screen that already reads state.instituteDetails (admin detail
    // cards, status logic, header subtitle) lights up unchanged.
    dispatch({
      type: 'SET_INSTITUTE',
      payload: {
        id: university.id,
        name: university.name,
        city: university.city,
        country: country.name,
        state: stateSel.name,
        ranking: university.ranking,
        isManual: false,
        isDomestic,
        isAbroad: !isDomestic,
      },
    });

    dispatch({
      type: 'SET_STUDENT',
      payload: {
        regNo: isDomestic ? 'DOMESTIC' : 'ABROAD',
        studentName: '',           // captured later (borrower or via co-applicant)
        fatherName: '',
        courseName: course.name,
        courseDurationMonths: course.durationMonths,
        courseId: course.id,
        instituteName: university.name,
        phone: '',
        email: '',
        balanceFee,
        isManual: false,
        isDomestic,
        isAbroad: !isDomestic,
      },
    });

    // Higher-ed specific structured slice — staff dashboards /
    // underwriting render this block per-application.
    dispatch({
      type: 'SET_HIGHER_EDUCATION_DETAILS',
      payload: {
        country,
        state: stateSel,
        university,
        course,
        isDomestic,
        yearsOfCourse: years,
        feeCurrency: course.feeCurrency || 'INR',
        indicativeAnnualFee: course.indicativeAnnualFee || 0,
        indicativeTotalInr,
        userProvidedTotalCostInr: inrFromUser || null,
      },
    });

    navigation.navigate('BorrowerSelection');
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const SectionTitle = ({ children }) => (
    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{children}</Text>
  );

  const Chip = ({ label, selected, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.teal : colors.cardBg,
          borderColor: selected ? colors.teal : colors.cardBorder,
        },
      ]}
      activeOpacity={0.7}
    >
      <Text style={{
        color: selected ? '#FFFFFF' : colors.textPrimary,
        fontWeight: '600',
        fontSize: 13,
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Higher Education Loan" onBack={() => navigation.goBack()} />
      <StepIndicator currentStep={0} />
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Card>
          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            Loans for higher-education programs — both within India and abroad.
            Pick the country (India for domestic colleges), state, university
            and course; we'll plug it into the rest of your application.
          </Text>
        </Card>

        {/* Country */}
        <Card>
          <SectionTitle>1. Country</SectionTitle>
          <View style={styles.chipRow}>
            {countries.map((c) => (
              <Chip
                key={c.code}
                label={`${c.flag}  ${c.name}`}
                selected={country?.code === c.code}
                onPress={() => {
                  setCountry(c);
                  setStateSel(null);
                  setUniversity(null);
                  setCourse(null);
                }}
              />
            ))}
          </View>
        </Card>

        {/* State */}
        {country && (
          <Card>
            <SectionTitle>2. State / Region in {country.name}</SectionTitle>
            {states.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>No states configured for this country yet.</Text>
            ) : (
              <View style={styles.chipRow}>
                {states.map((s) => (
                  <Chip
                    key={s.code}
                    label={s.name}
                    selected={stateSel?.code === s.code}
                    onPress={() => {
                      setStateSel(s);
                      setUniversity(null);
                      setCourse(null);
                    }}
                  />
                ))}
              </View>
            )}
          </Card>
        )}

        {/* University */}
        {country && stateSel && (
          <Card>
            <SectionTitle>3. University in {stateSel.name}</SectionTitle>
            <TextInput
              placeholder="Search universities…"
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              style={[
                styles.searchInput,
                { borderColor: colors.cardBorder, color: colors.textPrimary, backgroundColor: colors.inputBg || colors.cardBg },
              ]}
            />
            {filteredUniversities.map((u) => {
              const isSel = university?.id === u.id;
              return (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => { setUniversity(u); setCourse(null); }}
                  style={[styles.uniRow, {
                    backgroundColor: isSel ? `${colors.teal}14` : 'transparent',
                    borderColor: isSel ? colors.teal : colors.cardBorder,
                  }]}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{u.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {u.city}{u.ranking ? `   •   QS rank #${u.ranking}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: isSel ? colors.teal : colors.textSecondary, fontSize: 18 }}>
                    {isSel ? '✓' : '›'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {filteredUniversities.length === 0 && (
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                No universities matched "{search}".
              </Text>
            )}
          </Card>
        )}

        {/* Course */}
        {country && stateSel && university && (
          <Card>
            <SectionTitle>4. Course at {university.name}</SectionTitle>
            {courses.map((c) => {
              const isSel = course?.id === c.id;
              const annual = Number(c.indicativeAnnualFee) || 0;
              const cur = c.feeCurrency || 'INR';
              const feeText = cur === 'INR'
                ? `₹${annual.toLocaleString('en-IN')}`
                : `$${annual.toLocaleString()}`;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCourse(c)}
                  style={[styles.uniRow, {
                    backgroundColor: isSel ? `${colors.teal}14` : 'transparent',
                    borderColor: isSel ? colors.teal : colors.cardBorder,
                  }]}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Duration: {c.durationMonths} months  •  Indicative annual fee: {feeText}
                    </Text>
                  </View>
                  <Text style={{ color: isSel ? colors.teal : colors.textSecondary, fontSize: 18 }}>
                    {isSel ? '✓' : '›'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        {/* Cost summary */}
        {course && (
          <Card>
            <SectionTitle>5. Estimated Loan Amount</SectionTitle>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
              Years to fund (we'll multiply the annual fee accordingly)
            </Text>
            <View style={styles.chipRow}>
              {['1', '2', '3', '4'].map((y) => (
                <Chip
                  key={y}
                  label={`${y} year${y === '1' ? '' : 's'}`}
                  selected={yearsOfCourse === y}
                  onPress={() => setYearsOfCourse(y)}
                />
              ))}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 12 }}>
              Or override total cost in INR (optional)
            </Text>
            <TextInput
              placeholder="e.g. 5000000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={estimatedTotalCostInr}
              onChangeText={setEstimatedTotalCostInr}
              style={[
                styles.searchInput,
                { borderColor: colors.cardBorder, color: colors.textPrimary, backgroundColor: colors.inputBg || colors.cardBg, marginTop: 6 },
              ]}
            />
            <Text style={{ color: colors.textPrimary, fontSize: 13, marginTop: 12 }}>
              Indicative loan amount:{' '}
              <Text style={{ color: colors.teal, fontWeight: '700' }}>
                ₹{(() => {
                  const inr = parseInt(String(estimatedTotalCostInr).replace(/[^0-9]/g, ''), 10);
                  if (inr && inr > 0) return inr.toLocaleString('en-IN');
                  const years = Math.max(1, parseInt(yearsOfCourse, 10) || 1);
                  return computeIndicativeTotalInr(course, years).toLocaleString('en-IN');
                })()}
              </Text>
            </Text>
            {course.feeCurrency === 'USD' ? (
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                Foreign tuition shown converted at ₹{USD_TO_INR_RATE}/USD. Actual disbursement uses the live rate.
              </Text>
            ) : null}
          </Card>
        )}

        <Button
          title="Continue"
          onPress={handleProceed}
          disabled={!course}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
      <FloatingAssistButton />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  intro: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1,
    marginRight: 8, marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, marginBottom: 10,
  },
  uniRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
    marginBottom: 8,
  },
});

export default HigherEducationSelectionScreen;
