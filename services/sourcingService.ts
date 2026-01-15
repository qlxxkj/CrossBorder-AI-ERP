
/**
 * 1688 真实搜货服务模块
 * 注意：由于 1688 官方 API 对个人开发者不友好，推荐对接 RapidAPI 上的 1688 镜像服务。
 * 请在环境变量中配置 SOURCING_API_KEY 和 SOURCING_API_URL。
 */

const API_KEY = process.env.SOURCING_API_KEY;
const API_URL = process.env.SOURCING_API_URL || 'https://1688-search-by-image.p.rapidapi.com/search';
const CORS_PROXY = 'https://corsproxy.io/?';

export interface SourcingProduct {
  id: string;
  title: string;
  price: string;
  image: string;
  url: string;
}

export const search1688ByImage = async (imageUrl: string): Promise<SourcingProduct[]> => {
  if (!API_KEY) {
    throw new Error("Missing SOURCING_API_KEY. Please provide a valid 1688 API Key in Settings.");
  }

  try {
    // 步骤 1：如果图片是外部链接，建议先转为 Base64 或直接传 URL (取决于 API 提供商)
    // 多数 RapidAPI 接口支持直接传入 imageUrl
    
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(API_URL)}?url=${encodeURIComponent(imageUrl)}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': new URL(API_URL).hostname
      }
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || "Failed to fetch from 1688 API");
    }

    const data = await response.json();
    
    // 步骤 2：数据结构映射 (根据不同 API 商的返回结构进行适配)
    // 此处假设为标准 RapidAPI 1688 搜索返回
    const items = data.result?.items || data.items || [];
    
    return items.map((item: any) => ({
      id: item.num_iid || item.productId || String(Math.random()),
      title: item.title || "1688 Product",
      price: `¥${item.price || item.promotion_price || '0.00'}`,
      image: item.pic_url || item.imageUrl,
      url: item.detail_url || `https://detail.1688.com/offer/${item.num_iid}.html`
    })).slice(0, 8); // 返回前 8 个结果

  } catch (error: any) {
    console.error("1688 Sourcing API Error:", error);
    throw error;
  }
};
