import { DohProvider } from '../types';

export interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DohResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: { name: string; type: number }[];
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
}

export const DOH_ENDPOINTS: Record<Exclude<DohProvider, 'disabled' | 'custom'>, { name: string; url: string; description: string; privacyPolicy: string }> = {
  cloudflare: {
    name: 'Cloudflare 1.1.1.1 (Gizlilik Odaklı)',
    url: 'https://cloudflare-dns.com/dns-query',
    description: 'Sıfır IP kaydı, DNSSEC korumalı ve en hızlı küresel DNS.',
    privacyPolicy: 'Sıfır Log, 24 saat içinde geçici önbellek silinir.'
  },
  quad9: {
    name: 'Quad9 9.9.9.9 (Zararlı Yazılım Bloklamalı)',
    url: 'https://dns.quad9.net/dns-query',
    description: 'İsviçre gizlilik yasalarına tabi, kötü amaçlı siteleri ve izleyicileri engeller.',
    privacyPolicy: 'Kesinlikle kişisel IP kaydı tutmaz (GDPR uyumlu).'
  },
  google: {
    name: 'Google DoH 8.8.8.8',
    url: 'https://dns.google/resolve',
    description: 'Yüksek kullanılabilirlik ve küresel Anycast DNS ağı.',
    privacyPolicy: 'DoH standart sorgu çözümleme.'
  }
};

/**
 * Resolves a hostname using DNS-over-HTTPS (DoH) directly from the client.
 * Bypasses local ISP DNS queries preventing ISP DNS hijacking and tracking.
 */
export async function resolveDoH(
  hostname: string,
  provider: DohProvider = 'cloudflare',
  customUrl?: string
): Promise<{ success: boolean; ips: string[]; latencyMs: number; error?: string; providerUsed: string }> {
  if (provider === 'disabled') {
    return {
      success: false,
      ips: [],
      latencyMs: 0,
      error: 'DoH devre dışı. Standart İSS DNS kullanılıyor.',
      providerUsed: 'Sistem / İSS DNS'
    };
  }

  let endpoint = '';
  let providerName = '';

  if (provider === 'custom' && customUrl) {
    endpoint = customUrl;
    providerName = 'Özel DoH Sunucusu';
  } else if (provider in DOH_ENDPOINTS) {
    const p = DOH_ENDPOINTS[provider as keyof typeof DOH_ENDPOINTS];
    endpoint = p.url;
    providerName = p.name;
  } else {
    endpoint = DOH_ENDPOINTS.cloudflare.url;
    providerName = DOH_ENDPOINTS.cloudflare.name;
  }

  // Clean hostname (remove http/https/port/path)
  let cleanHost = hostname.trim();
  try {
    if (cleanHost.startsWith('http://') || cleanHost.startsWith('https://')) {
      cleanHost = new URL(cleanHost).hostname;
    } else if (cleanHost.includes(':')) {
      cleanHost = cleanHost.split(':')[0];
    } else if (cleanHost.includes('/')) {
      cleanHost = cleanHost.split('/')[0];
    }
  } catch {
    // keep as is
  }

  const startTime = performance.now();

  try {
    // Cloudflare & Quad9 accept application/dns-json
    const url = new URL(endpoint);
    url.searchParams.set('name', cleanHost);
    url.searchParams.set('type', 'A');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        success: false,
        ips: [],
        latencyMs,
        error: `DoH sunucusu HTTP ${response.status} hatası döndürdü.`,
        providerUsed: providerName
      };
    }

    const json: DohResponse = await response.json();
    const ips: string[] = [];

    if (json.Answer && Array.isArray(json.Answer)) {
      for (const ans of json.Answer) {
        // Type 1 is A record (IPv4), Type 28 is AAAA record (IPv6)
        if (ans.type === 1 || ans.type === 28) {
          ips.push(ans.data);
        }
      }
    }

    if (ips.length === 0) {
      return {
        success: false,
        ips: [],
        latencyMs,
        error: 'DNS kaydı bulunamadı (NXDOMAIN veya boş yanıt).',
        providerUsed: providerName
      };
    }

    return {
      success: true,
      ips,
      latencyMs,
      providerUsed: providerName
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      ips: [],
      latencyMs,
      error: err?.message || 'DoH sorgusu başarısız oldu (CORS veya ağ engeli).',
      providerUsed: providerName
    };
  }
}
