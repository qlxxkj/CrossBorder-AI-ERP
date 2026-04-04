
import { supabase } from './supabaseClient';
import { UserProfile, BillingManagement } from '../types';

/**
 * Pre-checks if a user has any credits remaining.
 */
export const checkUserCredits = async (userId: string): Promise<{ success: boolean; message?: string }> => {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return { success: false, message: 'User profile not found' };
  }

  const userProfile = profile as UserProfile;

  // Monthly reset check
  const now = new Date();
  const lastReset = userProfile.last_credit_reset_at ? new Date(userProfile.last_credit_reset_at) : new Date(0);
  const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
  
  if (isNewMonth) {
    await supabase
      .from('user_profiles')
      .update({ 
        credits_total: 100, 
        credits_used: 0, 
        last_credit_reset_at: now.toISOString() 
      })
      .eq('id', userId);
    return { success: true };
  }

  const remaining = userProfile.credits_total - userProfile.credits_used;
  if (remaining <= 0) {
    return { success: false, message: 'Insufficient credits. Please top up.' };
  }

  return { success: true };
};

/**
 * Deducts credits based on actual token usage.
 */
export const deductCreditsByTokens = async (userId: string, tokens: number): Promise<{ success: boolean; message?: string }> => {
  // 1. Get tokens per credit setting
  const { data: config } = await supabase
    .from('billing_management')
    .select('value')
    .eq('category', 'credit_setting')
    .eq('unit_type', 'token_per_credit')
    .maybeSingle();
  
  const tokensPerCredit = config?.value || 1000;
  const cost = tokens / tokensPerCredit;

  // 2. Get current profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('credits_used')
    .eq('id', userId)
    .single();

  if (!profile) return { success: false, message: 'Profile not found' };

  // 3. Update used credits
  const { error } = await supabase
    .from('user_profiles')
    .update({ credits_used: profile.credits_used + cost })
    .eq('id', userId);

  if (error) return { success: false, message: error.message };
  return { success: true };
};

// Keep old function for compatibility but update its logic to use token-based if needed, 
// or just mark it as deprecated. Actually, I'll update it to be a simple pre-check for now.
export const checkAndDeductCredits = async (
  userId: string,
  _serviceName?: string,
  _actionType?: string
): Promise<{ success: boolean; message?: string }> => {
  return checkUserCredits(userId);
};
