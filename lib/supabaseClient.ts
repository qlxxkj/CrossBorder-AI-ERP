import { createClient } from '@supabase/supabase-js';

/**
 * 支持多种环境变量命名方式：
 * 1. process.env (Vercel/Node 标准)
 * 2. import.meta.env (Vite 标准)
 */
const getEnv = (key: string) => {
  // @ts-ignore
  return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || (import.meta as any).env?.[`VITE_${key}`] || '';
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

// 检查是否配置了有效的 URL
const isConfigured = supabaseUrl && supabaseUrl !== 'https://placeholder-url.supabase.co' && supabaseUrl !== '';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = () => isConfigured;
