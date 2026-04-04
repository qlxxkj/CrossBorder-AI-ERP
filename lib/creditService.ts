
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

  // 3. Get cost from billing_configs (specific engine + action)
  const { data: specificConfig } = await supabase
    .from('billing_configs')
    .select('credit_cost')
    .eq('service_name', serviceName)
    .eq('action_type', actionType)
    .maybeSingle();

  let cost = specificConfig?.credit_cost;

  // 4. If no specific engine cost, check billing_unit_prices (general action cost)
  if (cost === undefined || cost === null) {
    const unitType = actionType === 'optimization' ? 'credit_per_optimization' : 'credit_per_translation';
    const { data: generalConfig } = await supabase
      .from('billing_unit_prices')
      .select('value')
      .eq('unit_type', unitType)
      .maybeSingle();
    
    cost = generalConfig?.value;
  }

  // 5. Default costs if still not configured
  if (cost === undefined || cost === null) {
    cost = actionType === 'optimization' ? 5 : 2;
  }

  // 6. Check balance
  const remaining = currentCreditsTotal - currentCreditsUsed;
  if (remaining < cost) {
    return { 
      success: false, 
      message: `Insufficient credits. Required: ${cost}, Available: ${remaining}` 
    };
  }

  // 7. Deduct credits
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ credits_used: currentCreditsUsed + cost })
    .eq('id', userId);

  if (updateError) {
    return { success: false, message: 'Failed to deduct credits: ' + updateError.message };
  }

  return { success: true };
};
