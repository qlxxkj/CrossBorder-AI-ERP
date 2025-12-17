import { createClient } from '@supabase/supabase-js';

// In a real Vercel environment, these are set in the project settings.
// These variables must be prefixed with NEXT_PUBLIC_ for the browser to see them in Next.js,
// but since we are in a plain Vite/ESM environment, we check both common patterns.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// If the URL is missing or is the placeholder, we should avoid making calls that cause "Failed to fetch"
const isConfigured = supabaseUrl && supabaseUrl !== 'https://placeholder-url.supabase.co';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = () => isConfigured;
