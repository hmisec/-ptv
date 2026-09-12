import { Channel } from '../types';

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
          logo: s.stream_icon || ''
        });
      });
    }
    
    return channels;
  } catch (error) {
    console.error("Xtream API Hatası:", error);
    throw new Error('Xtream sunucusuna bağlanılamadı. CORS veya hatalı bilgi olabilir.');
  }
}
