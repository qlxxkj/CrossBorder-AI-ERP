
import { createClient } from '@supabase/supabase-js';

/**
 * 注意：在 Vite 环境下，必须使用完整的 process.env.VARIABLE_NAME 形式，
 * 才能被 vite.config.ts 中的 define 插件正确识别并替换。
 * 不要使用 process.env[key] 这种动态写法。
 */
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// 检查是否配置了有效的 URL 且不是占位符
const isConfigured = 
  supabaseUrl !== '' && 
  supabaseUrl !== 'https://placeholder-url.supabase.co';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = () => isConfigured;
