
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
 * Deducts credits based on actual token usage and logs the usage.
 */
export const deductCreditsByTokens = async (
  userId: string, 
  tokens: number, 
  serviceName: string, 
  actionType: 'optimization' | 'translation'
): Promise<{ success: boolean; message?: string }> => {
  // 1. Get unit prices for coefficient calculation
  const { data: prices } = await supabase
    .from('billing_management')
    .select('service_name, price_usd')
    .eq('category', 'unit_price');
  
  // Base: DeepSeek (1000 tokens = 1 credit if price is same)
  const deepseekPrice = prices?.find(p => p.service_name?.toLowerCase() === 'deepseek')?.price_usd || 0.001; // Fallback if not set
  const currentServicePrice = prices?.find(p => p.service_name?.toLowerCase() === serviceName.toLowerCase())?.price_usd || deepseekPrice;

  // Coefficient = Other AI Engine Price / DeepSeek Price
  const coefficient = currentServicePrice / deepseekPrice;
  
  // Credits = (Tokens / 1000) * Coefficient
  const cost = Number(((tokens / 1000) * coefficient).toFixed(4));

  // 2. Get current profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('credits_used')
    .eq('id', userId)
    .single();

  if (!profile) return { success: false, message: 'Profile not found' };

  // 3. Update used credits
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ credits_used: profile.credits_used + cost })
    .eq('id', userId);

  if (updateError) return { success: false, message: updateError.message };

  // 4. Log usage
  const logData = {
    user_id: userId,
    service_name: serviceName,
    action_type: actionType,
    tokens_used: tokens,
    credits_deducted: cost,
    created_at: new Date().toISOString()
  };

  const { error: logError } = await supabase
    .from('usage_logs')
    .insert([logData]);

  if (logError) {
    console.error("CRITICAL: Failed to write usage log to Supabase:", logError);
    console.error("Log data attempted:", logData);
  } else {
    console.log(`Successfully logged credit usage: ${cost} credits for ${serviceName} ${actionType} (Tokens: ${tokens}, Coeff: ${coefficient.toFixed(4)})`);
  }

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
