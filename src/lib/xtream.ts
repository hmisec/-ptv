import { Channel, EpgProgram, Episode, Season, XtreamAuth } from '../types';

const decodeBase64 = (str: string) => {
  if (!str) return '';
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch {
    try {
      return atob(str);
    } catch {
      return str;
    }
  }
};

// In-memory instant cache for zero latency switching
const xtreamCache = new Map<string, any>();

export interface XtreamFullResult {
  channels: Channel[];
  vodChannels: Channel[];
  seriesChannels: Channel[];
}

/**
 * Normalizes user input into a clean base URL.
 * Handles missing http://, removes trailing slashes, and strips accidental query or file paths.
 */
export function normalizeXtreamBaseUrl(raw: string): string {
  let trimmed = (raw || '').trim();
  if (!trimmed) return '';

  // Auto-prepend http:// if user omitted protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

/**
 * Resilient fetch function for Xtream APIs.
 * Automatically tries direct fetch first, and falls back to CORS proxies if
 * browser security (Mixed Content or missing Access-Control-Allow-Origin) blocks it.
 */
export async function smartXtreamFetch<T = any>(targetUrl: string, timeoutMs: number = 10000): Promise<T> {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isTargetHttp = targetUrl.startsWith('http://');

  const candidates: string[] = [];

  // If we are on HTTP or targeting HTTPS, direct connection is viable
  if (!isHttps || !isTargetHttp) {
    candidates.push(targetUrl);
  }

  // CORS/Mixed-content fallback proxies
  candidates.push(`https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`);
  candidates.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);

  // If we are on HTTPS and target is HTTP, direct fetch is guaranteed to fail, but keep as last resort
  if (isHttps && isTargetHttp) {
    candidates.push(targetUrl);
  }

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(candidate, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });
      clearTimeout(timer);

      if (!res.ok) {
        lastError = new Error(`Sunucu yanıtı: HTTP ${res.status}`);
        continue;
      }

      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        // Not valid JSON
        lastError = new Error('Sunucu geçerli bir JSON yanıtı döndürmedi.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = new Error('Sunucu bağlantısı zaman aşımına uğradı (Timeout).');
      } else {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Xtream sunucusuna bağlanılamadı.');
}

export async function fetchXtreamPlaylist(
  url: string,
  user: string,
  pass: string,
  fetchVodAndSeries: boolean = true
): Promise<Channel[]> {
  const full = await fetchXtreamFull(url, user, pass, fetchVodAndSeries);
  return [...full.channels, ...full.vodChannels, ...full.seriesChannels];
}

export async function fetchXtreamFull(
  url: string,
  user: string,
  pass: string,
  fetchVodAndSeries: boolean = true
): Promise<XtreamFullResult> {
  const baseUrl = normalizeXtreamBaseUrl(url);
  if (!baseUrl) {
    throw new Error('Geçerli bir Xtream sunucu adresi girilmedi.');
  }

  const cacheKey = `${baseUrl}_${user}`;
  if (xtreamCache.has(cacheKey)) {
    return xtreamCache.get(cacheKey);
  }

  try {
    // 0. Preliminary credentials & account status verification
    try {
      const authInfo = await smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`, 8000);
      if (authInfo && typeof authInfo === 'object') {
        if (authInfo.user_info) {
          const u = authInfo.user_info;
          if (u.auth === 0) {
            throw new Error('Giriş başarısız: Kullanıcı adı veya şifre hatalı.');
          }
          if (u.status === 'Expired') {
            throw new Error('IPTV aboneliğinizin kullanım süresi dolmuş.');
          }
          if (u.status === 'Banned') {
            throw new Error('IPTV hesabınız sunucu tarafından engellenmiş (Banned).');
          }
        }
      }
    } catch (authErr: any) {
      // If we got a definitive user auth message, rethrow immediately
      if (authErr?.message && (
        authErr.message.includes('Giriş başarısız') || 
        authErr.message.includes('kullanım süresi dolmuş') || 
        authErr.message.includes('engellenmiş')
      )) {
        throw authErr;
      }
      // If server doesn't respond to general auth or doesn't support it, continue to live streams query
    }

    // 1. Live Categories & Streams
    const [categories, streams] = await Promise.all([
      smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_categories`),
      smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`)
    ]);

    const catMap = new Map<string, string>();
    if (Array.isArray(categories)) {
      categories.forEach((c: any) => {
        catMap.set(String(c.category_id), c.category_name);
      });
    }

    const channels: Channel[] = [];
    if (Array.isArray(streams)) {
      streams.forEach((s: any) => {
        channels.push({
          id: `xtream_live_${s.stream_id}`,
          name: s.name || 'Bilinmeyen Kanal',
          url: `${baseUrl}/live/${user}/${pass}/${s.stream_id}.ts`,
          group: catMap.get(String(s.category_id)) || 'Genel',
          logo: s.stream_icon || '',
          streamId: s.stream_id,
          contentType: 'live'
        });
      });
    }

    let vodChannels: Channel[] = [];
    let seriesChannels: Channel[] = [];

    if (fetchVodAndSeries) {
      try {
        // 2. VOD (Filmler)
        const [vodCats, vodStreams] = await Promise.all([
          smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_categories`),
          smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_streams`)
        ]);

        const vodCatMap = new Map<string, string>();
        if (Array.isArray(vodCats)) {
          vodCats.forEach((c: any) => vodCatMap.set(String(c.category_id), c.category_name));
        }

        if (Array.isArray(vodStreams)) {
          vodStreams.forEach((v: any) => {
            const ext = v.container_extension || 'mp4';
            vodChannels.push({
              id: `xtream_vod_${v.stream_id}`,
              name: v.name || 'Film',
              url: `${baseUrl}/movie/${user}/${pass}/${v.stream_id}.${ext}`,
              group: vodCatMap.get(String(v.category_id)) || 'Filmler',
              logo: v.stream_icon || '',
              streamId: v.stream_id,
              contentType: 'vod',
              containerExtension: ext,
              rating: v.rating_5based ? `${v.rating_5based}/5` : v.rating,
              releaseDate: v.releaseDate || v.year
            });
          });
        }
      } catch (vodErr) {
        console.warn('VOD fetch skipped or failed:', vodErr);
      }

      try {
        // 3. Series (Diziler)
        const [sCats, seriesList] = await Promise.all([
          smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_series_categories`),
          smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_series`)
        ]);

        const seriesCatMap = new Map<string, string>();
        if (Array.isArray(sCats)) {
          sCats.forEach((c: any) => seriesCatMap.set(String(c.category_id), c.category_name));
        }

        if (Array.isArray(seriesList)) {
          seriesList.forEach((s: any) => {
            seriesChannels.push({
              id: `xtream_series_${s.series_id}`,
              name: s.name || 'Dizi',
              url: '', // series url resolved per episode
              group: seriesCatMap.get(String(s.category_id)) || 'Diziler',
              logo: s.cover || '',
              streamId: s.series_id,
              seriesId: s.series_id,
              contentType: 'series',
              plot: s.plot || '',
              rating: s.rating,
              releaseDate: s.releaseDate
            });
          });
        }
      } catch (seriesErr) {
        console.warn('Series fetch skipped or failed:', seriesErr);
      }
    }

    if (channels.length === 0 && vodChannels.length === 0 && seriesChannels.length === 0) {
      throw new Error('Xtream sunucusundan hiçbir yayın kanalı alınamadı. Bilgilerinizi kontrol edin.');
    }

    const result: XtreamFullResult = { channels, vodChannels, seriesChannels };
    xtreamCache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    console.error("Xtream API Hatası:", error);
    if (error?.message) {
      throw error;
    }
    throw new Error('Xtream sunucusuna bağlanılamadı. Doğrudan bağlantı engellenmiş veya bilgiler hatalı olabilir.');
  }
}

/**
 * Fetch detailed seasons & episodes for a series from Xtream API
 */
export async function fetchSeriesInfo(
  auth: XtreamAuth,
  seriesId: string | number
): Promise<{ seasons: Season[]; episodes: Record<number, Episode[]> }> {
  const baseUrl = normalizeXtreamBaseUrl(auth.url);
  const cacheKey = `series_info_${seriesId}`;
  if (xtreamCache.has(cacheKey)) {
    return xtreamCache.get(cacheKey);
  }

  try {
    const data = await smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(auth.user)}&password=${encodeURIComponent(auth.pass)}&action=get_series_info&series_id=${seriesId}`);
    const seasonsList: Season[] = [];
    const episodesMap: Record<number, Episode[]> = {};

    if (data && data.seasons && Array.isArray(data.seasons)) {
      data.seasons.forEach((s: any) => {
        seasonsList.push({
          seasonNumber: s.season_number ?? 1,
          name: s.name || `Sezon ${s.season_number}`,
          episodeCount: s.episode_count || 0
        });
      });
    }

    if (data && data.episodes && typeof data.episodes === 'object') {
      Object.entries(data.episodes).forEach(([seasonKey, epList]: [string, any]) => {
        const seasonNum = parseInt(seasonKey) || 1;
        if (Array.isArray(epList)) {
          episodesMap[seasonNum] = epList.map((ep: any) => {
            const ext = ep.container_extension || 'mp4';
            return {
              id: `ep_${ep.id}`,
              episodeNum: ep.episode_num ?? 1,
              seasonNum: seasonNum,
              title: ep.title || `Bölüm ${ep.episode_num}`,
              url: `${baseUrl}/series/${auth.user}/${auth.pass}/${ep.id}.${ext}`,
              duration: ep.info?.duration || '',
              plot: ep.info?.plot || '',
              containerExtension: ext
            };
          });
        }
      });
    }

    const out = { seasons: seasonsList, episodes: episodesMap };
    xtreamCache.set(cacheKey, out);
    return out;
  } catch (err) {
    console.error('Dizi bilgisi alınamadı:', err);
    return { seasons: [], episodes: {} };
  }
}

export async function fetchXtreamEpg(
  url: string,
  user: string,
  pass: string,
  streamId: string | number
): Promise<EpgProgram[]> {
  const baseUrl = normalizeXtreamBaseUrl(url);

  try {
    const data = await smartXtreamFetch(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_short_epg&stream_id=${streamId}&limit=20`, 7000);
    
    if (data && data.epg_listings && Array.isArray(data.epg_listings)) {
      return data.epg_listings.map((item: any) => {
        return {
          id: item.id || item.epg_id || Math.random().toString(),
          title: decodeBase64(item.title) || 'Bilinmeyen Program',
          description: decodeBase64(item.description) || '',
          startTimestamp: parseInt(item.start_timestamp) * 1000 || 0,
          stopTimestamp: parseInt(item.stop_timestamp) * 1000 || 0,
        };
      }).sort((a: EpgProgram, b: EpgProgram) => a.startTimestamp - b.startTimestamp);
    }
    return [];
  } catch (error) {
    console.error("EPG alınırken hata oluştu:", error);
    return [];
  }
}
