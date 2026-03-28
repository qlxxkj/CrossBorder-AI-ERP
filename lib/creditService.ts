
import { supabase } from './supabaseClient';
import { UserProfile, BillingConfig } from '../types';

/**
 * Checks if a user has enough credits for an AI action and deducts them if so.
 * Also handles the monthly reset of 100 free credits.
 */
export const checkAndDeductCredits = async (
  userId: string,
  serviceName: string,
  actionType: 'optimization' | 'translation'
): Promise<{ success: boolean; message?: string }> => {
  // 1. Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return { success: false, message: 'User profile not found' };
  }

  const userProfile = profile as UserProfile;

  // 2. Check for monthly reset
  const now = new Date();
  const lastReset = userProfile.last_credit_reset_at ? new Date(userProfile.last_credit_reset_at) : new Date(0);
  
  const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
  
  let currentCreditsTotal = userProfile.credits_total;
  let currentCreditsUsed = userProfile.credits_used;

  if (isNewMonth) {
    // Reset to 100 free credits (non-cumulative)
    currentCreditsTotal = 100;
    currentCreditsUsed = 0;
    
    await supabase
      .from('user_profiles')
      .update({ 
        credits_total: 100, 
        credits_used: 0, 
        last_credit_reset_at: now.toISOString() 
      })
      .eq('id', userId);
  }

  // 3. Get cost from billing_configs
  const { data: config } = await supabase
    .from('billing_configs')
    .select('credit_cost')
    .eq('service_name', serviceName)
    .eq('action_type', actionType)
    .single();

  // Default costs if not configured
  const cost = config?.credit_cost ?? (actionType === 'optimization' ? 5 : 2);

  // 4. Check balance
  const remaining = currentCreditsTotal - currentCreditsUsed;
  if (remaining < cost) {
    return { 
      success: false, 
      message: `Insufficient credits. Required: ${cost}, Available: ${remaining}` 
    };
  }

  // 5. Deduct credits
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ credits_used: currentCreditsUsed + cost })
    .eq('id', userId);

  if (updateError) {
    return { success: false, message: 'Failed to deduct credits: ' + updateError.message };
  }

  return { success: true };
};
