/**
 * Reference data for the Higher Education loan flow.
 *
 * Covers both domestic (India) and study-abroad universities. The shape
 * is a static, hierarchical object — country → states → universities →
 * courses. The volume is small enough that shipping it inline beats a
 * network round-trip; the higher-ed picker screens read this directly
 * via the helpers at the bottom of the file. When a real partner data
 * source comes online, swap the helpers' implementation to fetch from
 * the backend; the screen API stays the same.
 *
 * Each course carries `feeCurrency` ('INR' | 'USD') and
 * `indicativeAnnualFee` (in that currency) so the picker can show INR
 * directly for Indian programs and apply a USD→INR conversion only for
 * foreign tuition.
 */

// USD → INR rate used for indicative loan-amount math on foreign
// programs. Conservative; sales / credit can override the auto-computed
// figure on the picker screen.
export const USD_TO_INR_RATE = 83;

export const HIGHER_EDUCATION_CATALOG = {
  IN: {
    countryName: 'India',
    flag: '🇮🇳',
    isDomestic: true,
    states: {
      KA: {
        stateName: 'Karnataka',
        universities: [
          {
            id: 'in_ka_iisc',
            name: 'Indian Institute of Science',
            city: 'Bangalore',
            ranking: 225,
            courses: [
              { id: 'me_cs',  name: 'M.Tech Computer Science',  durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 250000 },
              { id: 'mba',    name: 'M.Mgmt',                    durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 1000000 },
            ],
          },
          {
            id: 'in_ka_iimb',
            name: 'Indian Institute of Management Bangalore',
            city: 'Bangalore',
            ranking: 50,
            courses: [
              { id: 'pgp',    name: 'PGP (MBA)',                durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 1300000 },
              { id: 'epgp',   name: 'EPGP (Executive)',         durationMonths: 12, feeCurrency: 'INR', indicativeAnnualFee: 3300000 },
            ],
          },
          {
            id: 'in_ka_christ',
            name: 'Christ University',
            city: 'Bangalore',
            ranking: null,
            courses: [
              { id: 'btech_cs', name: 'B.Tech Computer Science', durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 250000 },
              { id: 'mba',      name: 'MBA',                     durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 600000 },
            ],
          },
        ],
      },
      MH: {
        stateName: 'Maharashtra',
        universities: [
          {
            id: 'in_mh_iitb',
            name: 'IIT Bombay',
            city: 'Mumbai',
            ranking: 149,
            courses: [
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 230000 },
              { id: 'mtech',  name: 'M.Tech',                 durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 80000 },
              { id: 'msc',    name: 'M.Sc',                   durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 50000 },
            ],
          },
          {
            id: 'in_mh_nmims',
            name: 'NMIMS University',
            city: 'Mumbai',
            ranking: null,
            courses: [
              { id: 'mba',    name: 'MBA',                    durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 1100000 },
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 350000 },
            ],
          },
          {
            id: 'in_mh_symbiosis',
            name: 'Symbiosis International (SIBM Pune)',
            city: 'Pune',
            ranking: null,
            courses: [
              { id: 'mba',    name: 'MBA',                    durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 1150000 },
            ],
          },
        ],
      },
      DL: {
        stateName: 'Delhi (NCR)',
        universities: [
          {
            id: 'in_dl_iitd',
            name: 'IIT Delhi',
            city: 'New Delhi',
            ranking: 197,
            courses: [
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 230000 },
              { id: 'mtech',  name: 'M.Tech',                 durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 80000 },
            ],
          },
          {
            id: 'in_dl_du',
            name: 'University of Delhi',
            city: 'New Delhi',
            ranking: null,
            courses: [
              { id: 'ba',     name: 'BA (Hons)',              durationMonths: 36, feeCurrency: 'INR', indicativeAnnualFee: 30000 },
              { id: 'mcom',   name: 'M.Com',                  durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 25000 },
              { id: 'mba',    name: 'MBA (FMS)',              durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 195000 },
            ],
          },
          {
            id: 'in_dl_iiitd',
            name: 'IIIT Delhi',
            city: 'New Delhi',
            ranking: null,
            courses: [
              { id: 'btech_cs', name: 'B.Tech CSE',           durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 400000 },
              { id: 'mtech',    name: 'M.Tech CSE',           durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 200000 },
            ],
          },
        ],
      },
      TN: {
        stateName: 'Tamil Nadu',
        universities: [
          {
            id: 'in_tn_iitm',
            name: 'IIT Madras',
            city: 'Chennai',
            ranking: 285,
            courses: [
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 230000 },
              { id: 'mtech',  name: 'M.Tech',                 durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 80000 },
            ],
          },
          {
            id: 'in_tn_vit',
            name: 'VIT Vellore',
            city: 'Vellore',
            ranking: null,
            courses: [
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 220000 },
              { id: 'mba',    name: 'MBA',                    durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 350000 },
            ],
          },
        ],
      },
      WB: {
        stateName: 'West Bengal',
        universities: [
          {
            id: 'in_wb_iitkgp',
            name: 'IIT Kharagpur',
            city: 'Kharagpur',
            ranking: 271,
            courses: [
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 230000 },
              { id: 'mba',    name: 'MBA (VGSoM)',            durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 600000 },
            ],
          },
          {
            id: 'in_wb_iimcal',
            name: 'IIM Calcutta',
            city: 'Kolkata',
            ranking: 60,
            courses: [
              { id: 'pgp',    name: 'PGDM',                   durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 1400000 },
            ],
          },
        ],
      },
      TS: {
        stateName: 'Telangana',
        universities: [
          {
            id: 'in_ts_iith',
            name: 'IIT Hyderabad',
            city: 'Hyderabad',
            ranking: null,
            courses: [
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 230000 },
              { id: 'mtech',  name: 'M.Tech',                 durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 80000 },
            ],
          },
          {
            id: 'in_ts_isb',
            name: 'Indian School of Business',
            city: 'Hyderabad',
            ranking: 39,
            courses: [
              { id: 'pgpm',   name: 'PGP (MBA)',              durationMonths: 12, feeCurrency: 'INR', indicativeAnnualFee: 4400000 },
            ],
          },
        ],
      },
      UP: {
        stateName: 'Uttar Pradesh',
        universities: [
          {
            id: 'in_up_iitk',
            name: 'IIT Kanpur',
            city: 'Kanpur',
            ranking: 263,
            courses: [
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 230000 },
              { id: 'mtech',  name: 'M.Tech',                 durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 80000 },
            ],
          },
          {
            id: 'in_up_amity',
            name: 'Amity University Noida',
            city: 'Noida',
            ranking: null,
            courses: [
              { id: 'btech',  name: 'B.Tech',                 durationMonths: 48, feeCurrency: 'INR', indicativeAnnualFee: 350000 },
              { id: 'mba',    name: 'MBA',                    durationMonths: 24, feeCurrency: 'INR', indicativeAnnualFee: 500000 },
            ],
          },
        ],
      },
    },
  },

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
              { id: 'ms_cs', name: 'MS in Computer Science', durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 60000 },
              { id: 'mba',   name: 'MBA',                    durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 80000 },
              { id: 'ms_ee', name: 'MS in Electrical Engg',  durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 58000 },
            ],
          },
          {
            id: 'us_ca_ucb',
            name: 'University of California, Berkeley',
            city: 'Berkeley',
            ranking: 6,
            courses: [
              { id: 'ms_eecs', name: 'MS in EECS',  durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 45000 },
              { id: 'mba_eve', name: 'Evening MBA', durationMonths: 36, feeCurrency: 'USD', indicativeAnnualFee: 72000 },
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
              { id: 'ms_cs',   name: 'MS in Computer Science',     durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 62000 },
              { id: 'ms_data', name: 'MS in Data Science',         durationMonths: 18, feeCurrency: 'USD', indicativeAnnualFee: 65000 },
              { id: 'mba',     name: 'MBA (Sloan)',                durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 84000 },
            ],
          },
          {
            id: 'us_ma_harvard',
            name: 'Harvard University',
            city: 'Cambridge',
            ranking: 2,
            courses: [
              { id: 'mba',  name: 'MBA (HBS)',  durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 78000 },
              { id: 'llm',  name: 'LL.M.',      durationMonths: 12, feeCurrency: 'USD', indicativeAnnualFee: 75000 },
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
              { id: 'ms_cs', name: 'MS in Computer Science', durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 56000 },
              { id: 'mba',   name: 'MBA',                    durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 82000 },
            ],
          },
          {
            id: 'us_ny_nyu',
            name: 'New York University',
            city: 'New York',
            ranking: 35,
            courses: [
              { id: 'ms_fin',  name: 'MS in Finance',         durationMonths: 12, feeCurrency: 'USD', indicativeAnnualFee: 65000 },
              { id: 'mba',     name: 'MBA (Stern)',           durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 76000 },
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
              { id: 'mphil_cs', name: 'MPhil in Computer Science', durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 48000 },
              { id: 'mba',      name: 'MBA (Saïd)',                durationMonths: 12, feeCurrency: 'USD', indicativeAnnualFee: 70000 },
            ],
          },
          {
            id: 'uk_eng_imperial',
            name: 'Imperial College London',
            city: 'London',
            ranking: 7,
            courses: [
              { id: 'msc_cs',     name: 'MSc in Computing',         durationMonths: 12, feeCurrency: 'USD', indicativeAnnualFee: 42000 },
              { id: 'msc_finance',name: 'MSc Finance',              durationMonths: 12, feeCurrency: 'USD', indicativeAnnualFee: 50000 },
            ],
          },
          {
            id: 'uk_eng_ucl',
            name: 'University College London',
            city: 'London',
            ranking: 8,
            courses: [
              { id: 'msc_cs',  name: 'MSc Computer Science',  durationMonths: 12, feeCurrency: 'USD', indicativeAnnualFee: 38000 },
              { id: 'mba',     name: 'MBA',                   durationMonths: 15, feeCurrency: 'USD', indicativeAnnualFee: 55000 },
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
              { id: 'msc_ai', name: 'MSc Artificial Intelligence', durationMonths: 12, feeCurrency: 'USD', indicativeAnnualFee: 35000 },
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
              { id: 'masc_cs', name: 'MASc Computer Science', durationMonths: 16, feeCurrency: 'USD', indicativeAnnualFee: 45000 },
              { id: 'mba',     name: 'MBA (Rotman)',          durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 65000 },
            ],
          },
          {
            id: 'ca_on_waterloo',
            name: 'University of Waterloo',
            city: 'Waterloo',
            ranking: 112,
            courses: [
              { id: 'meng_se',  name: 'MEng Software Engg',    durationMonths: 16, feeCurrency: 'USD', indicativeAnnualFee: 32000 },
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
              { id: 'msc_cs',  name: 'MSc Computer Science',  durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 36000 },
              { id: 'mba',     name: 'MBA (Sauder)',          durationMonths: 16, feeCurrency: 'USD', indicativeAnnualFee: 60000 },
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
              { id: 'meng_cs', name: 'Master of IT',        durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 40000 },
              { id: 'mba',     name: 'MBA (AGSM)',           durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 60000 },
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
              { id: 'mc_it',  name: 'Master of Information Technology', durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 38000 },
              { id: 'mba',    name: 'MBA (MBS)',                         durationMonths: 18, feeCurrency: 'USD', indicativeAnnualFee: 58000 },
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
              { id: 'msc_cs',  name: 'MSc Informatics',  durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 6000 },
              { id: 'msc_dse', name: 'MSc Data Engg',    durationMonths: 24, feeCurrency: 'USD', indicativeAnnualFee: 6000 },
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
    code, name: c.countryName, flag: c.flag, isDomestic: !!c.isDomestic,
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
  return { code: countryCode, name: c.countryName, flag: c.flag, isDomestic: !!c.isDomestic };
}

export function findState(countryCode, stateCode) {
  const s = HIGHER_EDUCATION_CATALOG[countryCode]?.states?.[stateCode];
  if (!s) return null;
  return { code: stateCode, name: s.stateName };
}

/**
 * Convert an annual fee (in its native currency) to INR rupees, then
 * multiply by years to get the total indicative loan amount. INR
 * courses pass through unchanged; USD courses are multiplied by
 * USD_TO_INR_RATE.
 */
export function computeIndicativeTotalInr(course, years) {
  if (!course) return 0;
  const annual = Number(course.indicativeAnnualFee) || 0;
  const rate = course.feeCurrency === 'USD' ? USD_TO_INR_RATE : 1;
  return Math.round(annual * rate * Math.max(1, years || 1));
}
