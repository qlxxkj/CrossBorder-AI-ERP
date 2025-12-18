
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 加载当前环境的所有变量
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // 强制指定端口配置
    server: {
      port: 3000,
      strictPort: true, // 如果 3000 被占用，直接报错而不是随机换端口
    },  
    preview: {
      port: 3000,
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
      'process.env.OPENAI_BASE_URL': JSON.stringify(env.OPENAI_BASE_URL),
      'process.env.OPENAI_MODEL': JSON.stringify(env.OPENAI_MODEL),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
    }
  };
});
