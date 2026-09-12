import { Channel, EpgProgram } from '../types';

const decodeBase64 = (str: string) => {
  if (!str) return '';
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    try {
      return atob(str);
    } catch (e2) {
      return str;
    }
  }
};

export async function fetchXtreamPlaylist(url: string, user: string, pass: string): Promise<Channel[]> {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  try {
    // 1. Kategorileri al
    const catRes = await fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_live_categories`);
    if (!catRes.ok) throw new Error('Sunucuya bağlanılamadı.');
    const categories = await catRes.json();
    
    // 2. Kanalları al
    const streamRes = await fetch(`${baseUrl}/player_api.php?username=${user}&password=${pass}&action=get_live_streams`);
    if (!streamRes.ok) throw new Error('Kanallar alınamadı.');
    const streams = await streamRes.json();
    
    // Hızlı arama için kategorileri map'le
    const catMap = new Map();
    if (Array.isArray(categories)) {
      categories.forEach((c: any) => {
        catMap.set(c.category_id, c.category_name);
      });
    }

    // Kendi Channel formatımıza dönüştür
    const channels: Channel[] = [];
    if (Array.isArray(streams)) {
      streams.forEach((s: any) => {
        channels.push({
          id: `xtream_${s.stream_id}`,
          name: s.name || 'Bilinmeyen Kanal',
          url: `${baseUrl}/live/${user}/${pass}/${s.stream_id}.ts`, // Çoğu xtream sunucusu .ts destekler
          group: catMap.get(s.category_id) || 'Genel',
          logo: s.stream_icon || '',
          streamId: s.stream_id
        });
      });
    }
    
    return channels;
  } catch (error) {
    console.error("Xtream API Hatası:", error);
    throw new Error('Xtream sunucusuna bağlanılamadı. CORS veya hatalı bilgi olabilir.');
  }
}

export async function fetchXtreamEpg(url: string, user: string, pass: string, streamId: string | number): Promise<EpgProgram[]> {
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
