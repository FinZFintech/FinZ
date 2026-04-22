/**
 * Occupation Master Data for LOS Journey
 * Field 1: Occupation Category
 * Field 2: Occupation list mapped by category
 */

// Occupation categories that are entirely blocked — no loan offered.
export const BLOCKED_CATEGORIES = new Set(['pep']);

// Individual occupations that are blocked regardless of category.
// Matched case-insensitively against the selected occupation.
export const BLOCKED_OCCUPATIONS = [
  'police', 'state police', 'traffic police', 'ips officer',
  'home guard', 'home guards',
  'lawyer', 'advocate', 'independent lawyer',
  'politician', 'mla', 'mp', 'minister', 'political party worker',
  'relative of politician', 'government board member',
  'actor', 'actress',
  'influencer', 'youtuber', 'content creator',
];

/**
 * Returns true if the given category + occupation is blocked.
 */
export const isOccupationBlocked = (categoryId, occupation) => {
  if (BLOCKED_CATEGORIES.has(categoryId)) return true;
  if (!occupation) return false;
  const lower = occupation.toLowerCase().trim();
  return BLOCKED_OCCUPATIONS.some((b) => lower === b || lower.includes(b));
};

export const BLOCKED_OCCUPATION_MESSAGE =
  'We are unable to process loan applications for this occupation category due to our risk policy. Please contact support for more information.';

export const OCCUPATION_CATEGORIES = [
  { id: 'salaried_private', label: 'Salaried – Private Sector', allowFreeText: true, freeTextLabel: 'Company Name', freeTextPlaceholder: 'Enter company name (min 3 characters)' },
  { id: 'salaried_govt', label: 'Salaried – Government / PSU', allowFreeText: true, freeTextLabel: 'Department / Organization', freeTextPlaceholder: 'e.g., Indian Railways, SBI, LIC' },
  { id: 'defence', label: 'Salaried – Defence / Police / Paramilitary' },
  { id: 'professional_regulated', label: 'Professional – Regulated' },
  { id: 'self_employed_business', label: 'Self-Employed – Business Owner' },
  { id: 'self_employed_professional', label: 'Self-Employed – Professional' },
  { id: 'freelancer_gig', label: 'Freelancer / Gig Worker' },
  { id: 'agriculturist', label: 'Agriculturist' },
  { id: 'homemaker', label: 'Homemaker' },
  { id: 'student', label: 'Student' },
  { id: 'retired', label: 'Retired / Pensioner' },
  { id: 'pep', label: 'Politically Exposed Person (PEP) / Related' },
];

export const OCCUPATION_MAP = {
  salaried_private: [
    { group: 'Corporate / IT', items: ['Software Engineer', 'Developer', 'Data Analyst', 'Product Manager', 'IT Support Executive', 'Cyber Security Analyst', 'Business Analyst', 'HR Executive', 'Recruiter', 'Accountant', 'Finance Executive', 'Marketing Executive', 'Sales Executive', 'Operations Executive', 'Customer Support Executive', 'BPO Executive', 'Call Center Agent'] },
    { group: 'Industrial / Manufacturing', items: ['Factory Worker', 'Machine Operator', 'Technician', 'Electrician', 'Mechanic', 'Supervisor', 'Plant Manager', 'Quality Analyst'] },
    { group: 'Retail / Field', items: ['Sales Promoter', 'Store Manager', 'Delivery Executive', 'Field Sales Officer', 'Collection Agent', 'Warehouse Executive'] },
  ],
  salaried_govt: [
    { group: null, items: ['Government School Teacher', 'Professor (Government College)', 'Clerk', 'Income Tax Officer', 'GST Officer', 'Railway Employee', 'PSU Bank Employee', 'LIC Employee', 'Municipal Corporation Staff', 'State Government Officer', 'Central Government Officer', 'Public Sector Engineer', 'Judge', 'Court Clerk'] },
  ],
  defence: [
    { group: null, items: ['Army Personnel', 'Navy Personnel', 'Air Force Personnel', 'CRPF Personnel', 'BSF Personnel', 'CISF Personnel', 'State Police', 'Traffic Police', 'IPS Officer', 'Military Officer'] },
  ],
  professional_regulated: [
    { group: null, items: ['Doctor', 'Dentist', 'Chartered Accountant', 'Company Secretary', 'Cost Accountant', 'Lawyer', 'Advocate', 'Architect', 'Engineer', 'Pharmacist', 'Interior Designer', 'Chartered Engineer', 'Actuary', 'Pilot', 'Nurse'] },
  ],
  self_employed_business: [
    { group: 'Retail', items: ['Grocery/Kirana Shop Owner', 'Retail Store Owner', 'Medical Store Owner', 'Mobile Shop Owner', 'Garment Shop Owner', 'Electronics Shop Owner', 'Hardware Store Owner'] },
    { group: 'Food', items: ['Restaurant Owner', 'Cafe Owner', 'Bakery Owner', 'Catering Business'] },
    { group: 'Manufacturing', items: ['Small Manufacturer', 'Fabrication Unit Owner', 'Printing Press Owner', 'Furniture Manufacturer'] },
    { group: 'Services', items: ['Travel Agency Owner', 'Coaching Institute Owner', 'Gym Owner', 'Salon Owner', 'Event Management Business', 'Real Estate Broker', 'Insurance Agent', 'DSA'] },
    { group: 'Transport', items: ['Fleet Owner', 'Truck Owner', 'Taxi Owner'] },
  ],
  self_employed_professional: [
    { group: null, items: ['Self-Practicing Doctor', 'Independent Lawyer', 'Chartered Accountant (Practice)', 'Architect (Practice)', 'Consultant', 'Financial Advisor', 'Tax Consultant', 'Therapist', 'Physiotherapist'] },
  ],
  freelancer_gig: [
    { group: 'Platform Based', items: ['Swiggy/Zomato/Blinkit/Zepto/Porter Delivery Partner', 'Urbanclap/YesMadam Service Partner', 'Uber/Ola/Rapido Driver', 'Bluedart/Delhivery Delivery Associate', 'Amazon/Flipkart Delivery Associate', 'Daily Worker', 'Amazon/Flipkart/Meesho Seller', 'Online Seller'] },
    { group: 'Online Work', items: ['YouTuber', 'Content Creator', 'Influencer', 'Graphic Designer', 'Web Developer', 'Digital Marketer', 'Online Tutor', 'Affiliate Marketer', 'Trader (Stock / Crypto)'] },
    { group: 'Informal', items: ['Daily Wage Worker', 'Contractor Worker', 'Construction Worker'] },
  ],
  agriculturist: [
    { group: null, items: ['Farmer', 'Dairy Farmer', 'Poultry Farmer', 'Plantation Owner', 'Agricultural Laborer'] },
  ],
  homemaker: [
    { group: null, items: ['Homemaker'] },
  ],
  student: [
    { group: null, items: ['Student (No Income)', 'Student (Part Time)'] },
  ],
  retired: [
    { group: null, items: ['Retired Government Employee', 'Retired PSU Employee', 'Retired Private Employee', 'Defence Pensioner'] },
  ],
  pep: [
    { group: null, items: ['Politician', 'MLA', 'MP', 'Minister', 'Political Party Worker', 'Relative of Politician', 'Government Board Member'] },
  ],
};

/**
 * Returns a flat list of all occupations for a given category, optionally filtered by search.
 */
export const getOccupationsForCategory = (categoryId, search = '') => {
  const groups = OCCUPATION_MAP[categoryId] || [];
  const results = [];
  const lowerSearch = search.toLowerCase().trim();

  for (const group of groups) {
    const filtered = lowerSearch
      ? group.items.filter((item) => item.toLowerCase().includes(lowerSearch))
      : group.items;
    if (filtered.length > 0) {
      results.push({ group: group.group, items: filtered });
    }
  }
  return results;
};

/**
 * Returns flat array of all occupation strings for a category.
 */
export const getFlatOccupations = (categoryId) => {
  const groups = OCCUPATION_MAP[categoryId] || [];
  return groups.flatMap((g) => g.items);
};
