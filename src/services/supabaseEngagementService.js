import { supabase } from '../config/supabase';

const DAILY_TIPS = [
  { title: 'Build Your Credit Score', tip: 'Pay your EMIs on time to maintain a healthy credit score above 750.' },
  { title: 'Emergency Fund', tip: 'Keep at least 3 months of EMI amount as an emergency fund before taking a loan.' },
  { title: 'Compare Interest Rates', tip: 'Always compare interest rates from multiple lenders before finalizing your loan.' },
  { title: 'Read the Fine Print', tip: 'Check for hidden charges like processing fees, prepayment penalties, and late payment fees.' },
  { title: 'Document Checklist', tip: 'Keep your PAN, Aadhaar, bank statements, and salary slips ready for faster loan approval.' },
  { title: 'Loan Tenure Strategy', tip: 'Shorter tenure means higher EMI but lower total interest. Choose based on your repayment capacity.' },
  { title: 'Credit Utilization', tip: 'Keep your credit card utilization below 30% to maintain a good credit score.' },
];

export const supabaseEngagementService = {
  async getDailyTip() {
    const dayIndex = new Date().getDate() % DAILY_TIPS.length;
    return DAILY_TIPS[dayIndex];
  },

  async checkCreditScore(panNumber) {
    // Credit score check would integrate with a bureau API.
    // Store the check attempt for tracking.
    return {
      score: 750,
      range: { min: 300, max: 900 },
      factors: [
        { factor: 'Payment History', impact: 'positive' },
        { factor: 'Credit Utilization', impact: 'positive' },
        { factor: 'Credit Age', impact: 'neutral' },
      ],
    };
  },

  async getOffers() {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { offers: data || [] };
  },

  async submitReferral(referralData) {
    const { data, error } = await supabase
      .from('referrals')
      .insert(referralData)
      .select()
      .single();
    if (error) throw error;
    return { referral: data, message: 'Referral submitted successfully' };
  },

  async getDailyCheckIn(userId) {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_check_ins')
      .select('*')
      .eq('user_id', userId)
      .eq('check_in_date', today)
      .single();
    return data;
  },

  async performCheckIn(userId) {
    const today = new Date().toISOString().split('T')[0];

    // Get yesterday's check-in for streak calculation
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { data: lastCheckIn } = await supabase
      .from('daily_check_ins')
      .select('streak_count')
      .eq('user_id', userId)
      .eq('check_in_date', yesterday.toISOString().split('T')[0])
      .single();

    const streakCount = lastCheckIn ? lastCheckIn.streak_count + 1 : 1;
    const rewardPoints = Math.min(streakCount * 10, 100); // Max 100 points per day

    const { data, error } = await supabase
      .from('daily_check_ins')
      .upsert(
        {
          user_id: userId,
          check_in_date: today,
          streak_count: streakCount,
          reward_points: rewardPoints,
        },
        { onConflict: 'user_id,check_in_date' }
      )
      .select()
      .single();

    if (error) throw error;
    return { checkIn: data, streakCount, rewardPoints };
  },
};
