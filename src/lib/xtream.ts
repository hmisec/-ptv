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
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const cacheKey = `${baseUrl}_${user}`;
  
  if (xtreamCache.has(cacheKey)) {
    return xtreamCache.get(cacheKey);
  }

  try {
    // 1. Live Categories & Streams
    const [catRes, streamRes] = await Promise.all([
      fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_live_categories`),
      fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_live_streams`)
    ]);

    if (!catRes.ok || !streamRes.ok) throw new Error('Sunucuya veya canlı yayınlara bağlanılamadı.');
    
    const categories = await catRes.json();
    const streams = await streamRes.json();

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
        // 2. VOD (Movies)
        const [vodCatRes, vodStreamRes] = await Promise.all([
          fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_vod_categories`),
          fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_vod_streams`)
        ]);

        if (vodCatRes.ok && vodStreamRes.ok) {
          const vodCats = await vodCatRes.json();
          const vodStreams = await vodStreamRes.json();

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
        }
      } catch (vodErr) {
        console.warn('VOD fetch skipped or failed:', vodErr);
      }

      try {
        // 3. Series (Diziler)
        const [seriesCatRes, seriesRes] = await Promise.all([
          fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_series_categories`),
          fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_series`)
        ]);

        if (seriesCatRes.ok && seriesRes.ok) {
          const sCats = await seriesCatRes.json();
          const seriesList = await seriesRes.json();

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
        }
      } catch (seriesErr) {
        console.warn('Series fetch skipped or failed:', seriesErr);
      }
    }

    const result: XtreamFullResult = { channels, vodChannels, seriesChannels };
    xtreamCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Xtream API Hatası:", error);
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
  const baseUrl = auth.url.endsWith('/') ? auth.url.slice(0, -1) : auth.url;
  const cacheKey = `series_info_${seriesId}`;
  if (xtreamCache.has(cacheKey)) {
    return xtreamCache.get(cacheKey);
  }

  try {
    const res = await fetch(`${baseUrl}/player_api.php?username=${auth.user}&password=${auth.pass}&action=get_series_info&series_id=${seriesId}`);
    if (!res.ok) throw new Error('Dizi detayları alınamadı.');

    const data = await res.json();
    const seasonsList: Season[] = [];
    const episodesMap: Record<number, Episode[]> = {};

    if (data.seasons && Array.isArray(data.seasons)) {
      data.seasons.forEach((s: any) => {
        seasonsList.push({
          seasonNumber: s.season_number ?? 1,
          name: s.name || `Sezon ${s.season_number}`,
          episodeCount: s.episode_count || 0
        });
      });
    }

    if (data.episodes && typeof data.episodes === 'object') {
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
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  try {
    const res = await fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_short_epg&stream_id=${streamId}&limit=20`);
    if (!res.ok) return [];
    
    const data = await res.json();
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
