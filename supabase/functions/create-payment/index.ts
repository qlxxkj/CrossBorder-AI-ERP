
// 部署路径: supabase/functions/create-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// 声明 Deno 全局变量以满足编译器
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * 原生 RSA-SHA256 签名 - 用于支付宝
 */
async function signWithRsa2(content: string, privateKeyPem: string): Promise<string> {
  const base64 = privateKeyPem
    .replace(/-----BEGIN[A-Z ]*-----/g, "")
    .replace(/-----END[A-Z ]*-----/g, "")
    .replace(/[\s\r\n]/g, "")
    .trim();
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(content)
  );

  const uint8 = new Uint8Array(signature);
  let result = "";
  for (let i = 0; i < uint8.byteLength; i++) {
    result += String.fromCharCode(uint8[i]);
  }
  return btoa(result);
}

/**
 * 获取 PayPal Access Token
 */
async function getPayPalAccessToken(clientId: string, clientSecret: string, baseUrl: string) {
  // 严格检查并去空格
  const cleanId = clientId.trim();
  const cleanSecret = clientSecret.trim();
  const auth = btoa(`${cleanId}:${cleanSecret}`);
  
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`PayPal Auth Failed: ${errorData.error_description || errorData.message || response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, amount, planName, method: payMethod } = await req.json()

    if (payMethod === 'alipay') {
      const appId = (Deno.env.get("ALIPAY_APP_ID") || "").trim();
      const privateKeyPem = (Deno.env.get("ALIPAY_PRIVATE_KEY") || "").trim();

      if (!appId || !privateKeyPem) throw new Error("缺少支付宝配置环境变量");

      const now = new Date();
      const timestamp = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Asia/Shanghai'
      }).format(now).replace(/\//g, '-');

      const params: Record<string, string> = {
        app_id: appId,
        method: 'alipay.trade.page.pay',
        format: 'JSON',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: timestamp,
        version: '1.0',
        return_url: 'https://www.70kj.vip/#/billing?status=success',
        notify_url: 'https://qxgkagprwozrbddhoosw.supabase.co/functions/v1/payment-webhook',
        biz_content: JSON.stringify({
          out_trade_no: orderId,
          product_code: 'FAST_INSTANT_TRADE_PAY',
          total_amount: amount.toString(),
          subject: `AMZBot ERP - ${planName}`,
          timeout_express: '30m'
        })
      };

      const sortedKeys = Object.keys(params).sort();
      const signContent = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
      const signature = await signWithRsa2(signContent, privateKeyPem);

      const finalUrl = new URL('https://openapi.alipay.com/gateway.do');
      sortedKeys.forEach(key => finalUrl.searchParams.append(key, params[key]));
      finalUrl.searchParams.append('sign', signature);

      return new Response(JSON.stringify({ url: finalUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } else if (payMethod === 'paypal') {
      const clientId = (Deno.env.get("PAYPAL_CLIENT_ID") || "").trim();
      const clientSecret = (Deno.env.get("PAYPAL_CLIENT_SECRET") || "").trim();
      const mode = (Deno.env.get("PAYPAL_MODE") || "sandbox").toLowerCase().trim();
      
      // 判定是否为生产环境：支持 'live' 或 'production'
      const isLive = mode === "live" || mode === "production";
      const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

      if (!clientId || !clientSecret) {
        throw new Error("PayPal credentials missing in environment variables.");
      }

      console.log(`[PayPal] Initiating order ${orderId} in ${isLive ? 'LIVE' : 'SANDBOX'} mode. (Mode detected: ${mode})`);

      try {
        const accessToken = await getPayPalAccessToken(clientId, clientSecret, baseUrl);

        const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
              reference_id: orderId.toString().substring(0, 50),
              amount: {
                currency_code: "USD",
                value: amount.toString()
              },
              description: `AMZBot ERP Subscription - ${planName}`
            }],
            application_context: {
              brand_name: "AMZBot ERP",
              landing_page: "BILLING",
              user_action: "PAY_NOW",
              return_url: "https://www.70kj.vip/#/billing?status=success",
              cancel_url: "https://www.70kj.vip/#/billing?status=cancel",
              shipping_preference: "NO_SHIPPING"
            }
          })
        });

        const orderData = await response.json();

        if (!response.ok) {
          console.error("[PayPal API Error]", JSON.stringify(orderData));
          throw new Error(orderData.message || "PayPal Order Creation Failed");
        }

        const approveLink = orderData.links.find((link: any) => link.rel === "approve");
        
        if (!approveLink) {
          throw new Error("PayPal did not return an approval link. Please check your merchant account status.");
        }

        console.log("[PayPal] Order created successfully:", orderData.id);

        return new Response(JSON.stringify({ url: approveLink.href }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      } catch (authErr: any) {
        console.error("[PayPal Auth/Order Error]", authErr.message);
        throw authErr;
      }
    } else {
      throw new Error("Unsupported payment method");
    }

  } catch (error: any) {
    console.error("[Fatal Error]", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})
