
import { createClient } from '@supabase/supabase-js';

/**
 * 注意：在 Vite 环境下，必须使用完整的 process.env.VARIABLE_NAME 形式，
 * 才能被 vite.config.ts 中的 define 插件正确识别并替换。
 */
const getEnv = (key: string): string => {
  try {
    // 优先尝试直接访问（Vite 会在这里做字符串替换）
    // 如果没有被替换，回退到全局对象访问
    if (key === 'SUPABASE_URL') return process.env.SUPABASE_URL || '';
    if (key === 'SUPABASE_ANON_KEY') return process.env.SUPABASE_ANON_KEY || '';
    return '';
  } catch (e) {
    return '';
  }
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

// 检查是否配置了有效的 URL 且不是占位符
const isConfigured = 
  supabaseUrl !== '' && 
  supabaseUrl !== 'https://placeholder-url.supabase.co';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = () => isConfigured;
