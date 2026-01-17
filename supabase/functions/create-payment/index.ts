
// 部署路径: supabase/functions/create-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import AlipaySdk from 'npm:alipay-sdk@3.6.1'

// Deno 环境类型声明
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // 1. 处理预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, amount, planName, method } = await req.json()

    if (!orderId || !amount) {
      throw new Error("Payload Error: orderId and amount are required.")
    }

    // 2. 获取并检查配置
    const appId = Deno.env.get("ALIPAY_APP_ID")
    let privateKey = Deno.env.get("ALIPAY_PRIVATE_KEY")
    const alipayPublicKey = Deno.env.get("ALIPAY_PUBLIC_KEY")

    if (!appId || !privateKey) {
      console.error("Missing Secrets: ALIPAY_APP_ID or ALIPAY_PRIVATE_KEY is not set.");
      throw new Error("Configuration Error: Please set ALIPAY_APP_ID and ALIPAY_PRIVATE_KEY in Supabase Project Settings -> Edge Functions -> Secrets.");
    }

    // 3. 私钥格式化修复 (处理在 UI 粘贴时可能产生的换行符丢失问题)
    if (privateKey && !privateKey.includes('\n') && privateKey.startsWith('-----')) {
      // 如果私钥是长字符串但没有换行，SDK 可能会报错
      console.log("Normalizing private key format...");
    }

    let finalUrl = "";

    if (method === 'alipay') {
      try {
        const alipaySdk = new AlipaySdk({
          appId: appId,
          privateKey: privateKey,
          alipayPublicKey: alipayPublicKey,
          gateway: 'https://openapi.alipay.com/gateway.do',
          signType: 'RSA2',
        });

        // 生成支付跳转链接
        finalUrl = alipaySdk.pageExec('alipay.trade.page.pay', {
          bizContent: {
            out_trade_no: orderId,
            product_code: 'FAST_INSTANT_TRADE_PAY',
            total_amount: amount.toString(),
            subject: `AMZBot Subscription - ${planName}`,
            timeout_express: '30m',
          },
          returnUrl: 'https://www.70kj.vip/#/billing?status=success',
          notifyUrl: 'https://qxgkagprwozrbddhoosw.supabase.co/functions/v1/payment-webhook',
        });
      } catch (sdkErr: any) {
        console.error("Alipay SDK Init Error:", sdkErr.message);
        throw new Error(`SDK Error: ${sdkErr.message}`);
      }
    } else {
      finalUrl = `https://www.paypal.com/checkoutnow?order_id=${orderId}`;
    }

    return new Response(
      JSON.stringify({ url: finalUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error("Edge Function Exception:", error.message);
    
    // 返回具体错误供前端排查
    return new Response(
      JSON.stringify({ 
        error: error.message,
        hint: "Check Supabase Edge Function logs for details" 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 // 返回 400 状态码
      }
    )
  }
})
