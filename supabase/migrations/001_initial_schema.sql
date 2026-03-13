-- FinZ Database Schema for Supabase
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS / PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT UNIQUE NOT NULL,
  email TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'sales', 'credit', 'admin')),
  pan_number TEXT,
  date_of_birth DATE,
  gender TEXT,
  address JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INSTITUTES & COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS institutes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'university',
  city TEXT,
  state TEXT,
  is_active BOOLEAN DEFAULT true,
  loan_products JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  industry TEXT,
  city TEXT,
  state TEXT,
  is_active BOOLEAN DEFAULT true,
  loan_products JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LOAN APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL CHECK (loan_type IN ('education', 'coaching', 'employee')),
  status TEXT NOT NULL DEFAULT 'draft',
  amount NUMERIC(12,2),
  tenure_months INTEGER,
  interest_rate NUMERIC(5,2),
  emi_amount NUMERIC(12,2),

  -- Institute / Company reference
  institute_id UUID REFERENCES institutes(id),
  company_id UUID REFERENCES companies(id),

  -- Student / Employee details
  student_details JSONB DEFAULT '{}',
  employee_details JSONB DEFAULT '{}',

  -- Borrower info
  borrower_type TEXT CHECK (borrower_type IN ('self', 'parent')),
  borrower_details JSONB DEFAULT '{}',

  -- Product selection
  selected_product JSONB DEFAULT '{}',

  -- PAN & Credit
  pan_details JSONB DEFAULT '{}',
  credit_score INTEGER,
  credit_report JSONB DEFAULT '{}',

  -- KYC
  kyc_method TEXT,
  kyc_data JSONB DEFAULT '{}',
  selfie_verified BOOLEAN DEFAULT false,

  -- Bank details
  bank_details JSONB DEFAULT '{}',
  penny_drop_verified BOOLEAN DEFAULT false,

  -- Income
  income_data JSONB DEFAULT '{}',

  -- Eligibility
  eligibility_result JSONB DEFAULT '{}',

  -- eNACH, eSign, vKYC
  enach_status TEXT DEFAULT 'pending',
  esign_status TEXT DEFAULT 'pending',
  vkyc_status TEXT DEFAULT 'pending',

  -- Servicing
  disbursed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  remarks TEXT,

  -- Metadata
  step INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ENGAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_name TEXT NOT NULL,
  referee_phone TEXT NOT NULL,
  referee_email TEXT,
  status TEXT DEFAULT 'pending',
  reward_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_check_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_count INTEGER DEFAULT 1,
  reward_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, check_in_date)
);

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  offer_type TEXT DEFAULT 'general',
  discount_percent NUMERIC(5,2),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth_id = auth.uid());

-- Loans: users can manage their own loans; admins can see all
CREATE POLICY "Users can view own loans"
  ON loans FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

CREATE POLICY "Users can create loans"
  ON loans FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own loans"
  ON loans FOR UPDATE
  USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- Admin access for loans
CREATE POLICY "Admins can view all loans"
  ON loans FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update all loans"
  ON loans FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'));

-- Referrals: users can manage their own
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  USING (referrer_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

CREATE POLICY "Users can create referrals"
  ON referrals FOR INSERT
  WITH CHECK (referrer_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- Daily check-ins: users can manage their own
CREATE POLICY "Users can view own check-ins"
  ON daily_check_ins FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

CREATE POLICY "Users can create check-ins"
  ON daily_check_ins FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- Institutes & Companies: public read
CREATE POLICY "Anyone can view institutes"
  ON institutes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view companies"
  ON companies FOR SELECT
  USING (true);

-- Offers: public read
CREATE POLICY "Anyone can view active offers"
  ON offers FOR SELECT
  USING (is_active = true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_type ON loans(loan_type);
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_auth_id ON profiles(auth_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_daily_check_ins_user ON daily_check_ins(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA (sample institutes and companies for demo)
-- ============================================================
INSERT INTO institutes (name, code, type, city, state, loan_products) VALUES
  ('IIT Delhi', 'IITD', 'university', 'New Delhi', 'Delhi',
   '[{"name": "Education Loan", "min_amount": 100000, "max_amount": 2000000, "interest_rate": 8.5, "tenures": [12, 24, 36, 48, 60]}]'),
  ('IIM Ahmedabad', 'IIMA', 'university', 'Ahmedabad', 'Gujarat',
   '[{"name": "MBA Loan", "min_amount": 500000, "max_amount": 5000000, "interest_rate": 9.0, "tenures": [24, 36, 48, 60]}]'),
  ('BITS Pilani', 'BITS', 'university', 'Pilani', 'Rajasthan',
   '[{"name": "Education Loan", "min_amount": 200000, "max_amount": 3000000, "interest_rate": 8.75, "tenures": [12, 24, 36, 48]}]')
ON CONFLICT (code) DO NOTHING;

INSERT INTO companies (name, code, industry, city, state, loan_products) VALUES
  ('Infosys Ltd', 'INFY', 'IT Services', 'Bangalore', 'Karnataka',
   '[{"name": "Employee Loan", "min_amount": 50000, "max_amount": 500000, "interest_rate": 7.5, "tenures": [6, 12, 18, 24]}]'),
  ('TCS', 'TCS', 'IT Services', 'Mumbai', 'Maharashtra',
   '[{"name": "Employee Loan", "min_amount": 50000, "max_amount": 750000, "interest_rate": 7.0, "tenures": [6, 12, 18, 24, 36]}]'),
  ('Wipro', 'WIPRO', 'IT Services', 'Bangalore', 'Karnataka',
   '[{"name": "Employee Loan", "min_amount": 50000, "max_amount": 500000, "interest_rate": 7.75, "tenures": [6, 12, 18, 24]}]')
ON CONFLICT (code) DO NOTHING;

-- Sample offers
INSERT INTO offers (title, description, offer_type, discount_percent, valid_until) VALUES
  ('Zero Processing Fee', 'Get zero processing fee on education loans above 5 lakhs', 'education', 100, NOW() + INTERVAL '90 days'),
  ('Reduced Interest Rate', 'Special 0.5% rate reduction for top-tier institute students', 'education', NULL, NOW() + INTERVAL '60 days'),
  ('Quick Disbursal Bonus', 'Get Rs 500 cashback on loans disbursed within 48 hours', 'general', NULL, NOW() + INTERVAL '30 days')
ON CONFLICT DO NOTHING;
