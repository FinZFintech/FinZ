/**
 * Reference data for the Higher Education (study-abroad) loan flow.
 *
 * The shape is intentionally a static, hierarchical object — country →
 * states → universities → courses. The volume here is small enough that
 * shipping it inline beats a network round-trip; the higher-ed picker
 * screens read this directly via the helpers at the bottom of the file.
 *
 * When a real partner data source comes online, swap the helpers'
 * implementation to fetch from the backend; the screen API stays the
 * same.
 */

export const HIGHER_EDUCATION_CATALOG = {
  US: {
    countryName: 'United States',
    flag: '🇺🇸',
    states: {
      CA: {
        stateName: 'California',
        universities: [
          {
            id: 'us_ca_stanford',
            name: 'Stanford University',
            city: 'Stanford',
            ranking: 3,
            courses: [
              { id: 'ms_cs', name: 'MS in Computer Science', durationMonths: 24, indicativeAnnualFeeUsd: 60000 },
              { id: 'mba',   name: 'MBA',                    durationMonths: 24, indicativeAnnualFeeUsd: 80000 },
              { id: 'ms_ee', name: 'MS in Electrical Engg',  durationMonths: 24, indicativeAnnualFeeUsd: 58000 },
            ],
          },
          {
            id: 'us_ca_ucb',
            name: 'University of California, Berkeley',
            city: 'Berkeley',
            ranking: 6,
            courses: [
              { id: 'ms_eecs', name: 'MS in EECS',  durationMonths: 24, indicativeAnnualFeeUsd: 45000 },
              { id: 'mba_eve', name: 'Evening MBA', durationMonths: 36, indicativeAnnualFeeUsd: 72000 },
            ],
          },
        ],
      },
      MA: {
        stateName: 'Massachusetts',
        universities: [
          {
            id: 'us_ma_mit',
            name: 'Massachusetts Institute of Technology',
            city: 'Cambridge',
            ranking: 1,
            courses: [
              { id: 'ms_cs',   name: 'MS in Computer Science',     durationMonths: 24, indicativeAnnualFeeUsd: 62000 },
              { id: 'ms_data', name: 'MS in Data Science',         durationMonths: 18, indicativeAnnualFeeUsd: 65000 },
              { id: 'mba',     name: 'MBA (Sloan)',                durationMonths: 24, indicativeAnnualFeeUsd: 84000 },
            ],
          },
          {
            id: 'us_ma_harvard',
            name: 'Harvard University',
            city: 'Cambridge',
            ranking: 2,
            courses: [
              { id: 'mba',  name: 'MBA (HBS)',  durationMonths: 24, indicativeAnnualFeeUsd: 78000 },
              { id: 'llm',  name: 'LL.M.',      durationMonths: 12, indicativeAnnualFeeUsd: 75000 },
            ],
          },
        ],
      },
      NY: {
        stateName: 'New York',
        universities: [
          {
            id: 'us_ny_columbia',
            name: 'Columbia University',
            city: 'New York',
            ranking: 9,
            courses: [
              { id: 'ms_cs', name: 'MS in Computer Science', durationMonths: 24, indicativeAnnualFeeUsd: 56000 },
              { id: 'mba',   name: 'MBA',                    durationMonths: 24, indicativeAnnualFeeUsd: 82000 },
            ],
          },
          {
            id: 'us_ny_nyu',
            name: 'New York University',
            city: 'New York',
            ranking: 35,
            courses: [
              { id: 'ms_fin',  name: 'MS in Finance',         durationMonths: 12, indicativeAnnualFeeUsd: 65000 },
              { id: 'mba',     name: 'MBA (Stern)',           durationMonths: 24, indicativeAnnualFeeUsd: 76000 },
            ],
          },
        ],
      },
    },
  },

  UK: {
    countryName: 'United Kingdom',
    flag: '🇬🇧',
    states: {
      ENG: {
        stateName: 'England',
        universities: [
          {
            id: 'uk_eng_oxford',
            name: 'University of Oxford',
            city: 'Oxford',
            ranking: 4,
            courses: [
              { id: 'mphil_cs', name: 'MPhil in Computer Science', durationMonths: 24, indicativeAnnualFeeUsd: 48000 },
              { id: 'mba',      name: 'MBA (Saïd)',                durationMonths: 12, indicativeAnnualFeeUsd: 70000 },
            ],
          },
          {
            id: 'uk_eng_imperial',
            name: 'Imperial College London',
            city: 'London',
            ranking: 7,
            courses: [
              { id: 'msc_cs',     name: 'MSc in Computing',         durationMonths: 12, indicativeAnnualFeeUsd: 42000 },
              { id: 'msc_finance',name: 'MSc Finance',              durationMonths: 12, indicativeAnnualFeeUsd: 50000 },
            ],
          },
          {
            id: 'uk_eng_ucl',
            name: 'University College London',
            city: 'London',
            ranking: 8,
            courses: [
              { id: 'msc_cs',  name: 'MSc Computer Science',  durationMonths: 12, indicativeAnnualFeeUsd: 38000 },
              { id: 'mba',     name: 'MBA',                   durationMonths: 15, indicativeAnnualFeeUsd: 55000 },
            ],
          },
        ],
      },
      SCT: {
        stateName: 'Scotland',
        universities: [
          {
            id: 'uk_sct_edinburgh',
            name: 'University of Edinburgh',
            city: 'Edinburgh',
            ranking: 22,
            courses: [
              { id: 'msc_ai', name: 'MSc Artificial Intelligence', durationMonths: 12, indicativeAnnualFeeUsd: 35000 },
            ],
          },
        ],
      },
    },
  },

  CA: {
    countryName: 'Canada',
    flag: '🇨🇦',
    states: {
      ON: {
        stateName: 'Ontario',
        universities: [
          {
            id: 'ca_on_uoft',
            name: 'University of Toronto',
            city: 'Toronto',
            ranking: 21,
            courses: [
              { id: 'masc_cs', name: 'MASc Computer Science', durationMonths: 16, indicativeAnnualFeeUsd: 45000 },
              { id: 'mba',     name: 'MBA (Rotman)',          durationMonths: 24, indicativeAnnualFeeUsd: 65000 },
            ],
          },
          {
            id: 'ca_on_waterloo',
            name: 'University of Waterloo',
            city: 'Waterloo',
            ranking: 112,
            courses: [
              { id: 'meng_se',  name: 'MEng Software Engg',    durationMonths: 16, indicativeAnnualFeeUsd: 32000 },
            ],
          },
        ],
      },
      BC: {
        stateName: 'British Columbia',
        universities: [
          {
            id: 'ca_bc_ubc',
            name: 'University of British Columbia',
            city: 'Vancouver',
            ranking: 34,
            courses: [
              { id: 'msc_cs',  name: 'MSc Computer Science',  durationMonths: 24, indicativeAnnualFeeUsd: 36000 },
              { id: 'mba',     name: 'MBA (Sauder)',          durationMonths: 16, indicativeAnnualFeeUsd: 60000 },
            ],
          },
        ],
      },
    },
  },

  AU: {
    countryName: 'Australia',
    flag: '🇦🇺',
    states: {
      NSW: {
        stateName: 'New South Wales',
        universities: [
          {
            id: 'au_nsw_unsw',
            name: 'University of New South Wales',
            city: 'Sydney',
            ranking: 19,
            courses: [
              { id: 'meng_cs', name: 'Master of IT',        durationMonths: 24, indicativeAnnualFeeUsd: 40000 },
              { id: 'mba',     name: 'MBA (AGSM)',           durationMonths: 24, indicativeAnnualFeeUsd: 60000 },
            ],
          },
        ],
      },
      VIC: {
        stateName: 'Victoria',
        universities: [
          {
            id: 'au_vic_melb',
            name: 'University of Melbourne',
            city: 'Melbourne',
            ranking: 14,
            courses: [
              { id: 'mc_it',  name: 'Master of Information Technology', durationMonths: 24, indicativeAnnualFeeUsd: 38000 },
              { id: 'mba',    name: 'MBA (MBS)',                         durationMonths: 18, indicativeAnnualFeeUsd: 58000 },
            ],
          },
        ],
      },
    },
  },

  DE: {
    countryName: 'Germany',
    flag: '🇩🇪',
    states: {
      BY: {
        stateName: 'Bavaria',
        universities: [
          {
            id: 'de_by_tum',
            name: 'Technical University of Munich',
            city: 'Munich',
            ranking: 37,
            courses: [
              { id: 'msc_cs',  name: 'MSc Informatics',  durationMonths: 24, indicativeAnnualFeeUsd: 6000 },
              { id: 'msc_dse', name: 'MSc Data Engg',    durationMonths: 24, indicativeAnnualFeeUsd: 6000 },
            ],
          },
        ],
      },
    },
  },
};

// ─── Helpers (screen-facing API) ──────────────────────────────────────────────

export function listCountries() {
  return Object.entries(HIGHER_EDUCATION_CATALOG).map(([code, c]) => ({
    code, name: c.countryName, flag: c.flag,
  }));
}

export function listStates(countryCode) {
  const country = HIGHER_EDUCATION_CATALOG[countryCode];
  if (!country) return [];
  return Object.entries(country.states).map(([code, s]) => ({
    code, name: s.stateName,
  }));
}

export function listUniversities(countryCode, stateCode) {
  const state = HIGHER_EDUCATION_CATALOG[countryCode]?.states?.[stateCode];
  if (!state) return [];
  return state.universities.map((u) => ({
    id: u.id, name: u.name, city: u.city, ranking: u.ranking,
  }));
}

export function listCourses(countryCode, stateCode, universityId) {
  const state = HIGHER_EDUCATION_CATALOG[countryCode]?.states?.[stateCode];
  const uni = state?.universities?.find((u) => u.id === universityId);
  if (!uni) return [];
  return uni.courses;
}

export function findUniversity(countryCode, stateCode, universityId) {
  const state = HIGHER_EDUCATION_CATALOG[countryCode]?.states?.[stateCode];
  return state?.universities?.find((u) => u.id === universityId) || null;
}

export function findCountry(countryCode) {
  const c = HIGHER_EDUCATION_CATALOG[countryCode];
  if (!c) return null;
  return { code: countryCode, name: c.countryName, flag: c.flag };
}

export function findState(countryCode, stateCode) {
  const s = HIGHER_EDUCATION_CATALOG[countryCode]?.states?.[stateCode];
  if (!s) return null;
  return { code: stateCode, name: s.stateName };
}
