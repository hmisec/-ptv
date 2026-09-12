import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { ChannelList } from './components/ChannelList';
import { Player } from './components/Player';
import { EpgPanel } from './components/EpgPanel';
import { Playlist, Channel } from './types';
import { savePlaylists, loadPlaylists, saveRecents, loadRecents, loadSettings } from './lib/storage';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { parseM3U } from './lib/m3u';
import { fetchXtreamPlaylist } from './lib/xtream';
// Import the generated logo
import logoUrl from './assets/images/guvenli_iptv_logo_1789203403167.jpg';

export default function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [recentChannelIds, setRecentChannelIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [appSettings, setAppSettings] = useState(() => loadSettings());

  useEffect(() => {
    const handleSettingsChange = () => setAppSettings(loadSettings());
    window.addEventListener('app-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('app-settings-changed', handleSettingsChange);
  }, []);

  useEffect(() => {
    // İlk yüklemede listeleri al
    const loaded = loadPlaylists();
    setPlaylists(loaded);
    if (loaded.length > 0) {
      setActivePlaylistId(loaded[0].id);
    }
    setRecentChannelIds(loadRecents());

    // Splash screen zamanlayıcı
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Background Sync Mechanism (Runs every 60 minutes)
  useEffect(() => {
    const syncPlaylists = async () => {
      const settings = loadSettings();
      if (playlists.length === 0 || settings.dataSaver) return;
      setIsSyncing(true);
      
      let updatedCount = 0;
      const newPlaylists = [...playlists];

      for (let i = 0; i < newPlaylists.length; i++) {
        const pl = newPlaylists[i];
        let newChannels: Channel[] | null = null;
        
        try {
          if (pl.xtreamAuth) {
            newChannels = await fetchXtreamPlaylist(pl.xtreamAuth.url, pl.xtreamAuth.user, pl.xtreamAuth.pass);
          } else if (pl.sourceUrl) {
            const response = await fetch(pl.sourceUrl);
            if (response.ok) {
              const content = await response.text();
              newChannels = parseM3U(content);
            }
          }

          if (newChannels && newChannels.length > 0) {
            // Preserve favorites
            const favIds = new Set(pl.channels.filter(c => c.isFavorite).map(c => c.id));
            const updatedChannels = newChannels.map(c => ({
              ...c,
              isFavorite: favIds.has(c.id)
            }));
            
            newPlaylists[i] = { ...pl, channels: updatedChannels };
            updatedCount++;
          }
        } catch (e) {
          console.error(`Sync failed for playlist ${pl.name}:`, e);
        }
      }

      if (updatedCount > 0) {
        setPlaylists(newPlaylists);
        savePlaylists(newPlaylists);
        
        // Update active channel if needed
        if (activeChannel) {
          const updatedActivePlaylist = newPlaylists.find(p => p.id === activePlaylistId);
          if (updatedActivePlaylist) {
            const updatedActiveChannel = updatedActivePlaylist.channels.find(c => c.id === activeChannel.id);
            if (updatedActiveChannel) {
              setActiveChannel(updatedActiveChannel);
            }
          }
        }
      }
      setIsSyncing(false);
    };

    const intervalId = setInterval(syncPlaylists, 60 * 60 * 1000); // 1 saatte bir senkronize et
    
    // Uygulama ilk açıldığında 5 saniye sonra bir senkronizasyon tetikle
    const initialTimeout = setTimeout(syncPlaylists, 5000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(initialTimeout);
    };
  }, [playlists.length]); // Sadece liste sayısı değiştiğinde yeniden kur

  const handleSelectChannel = (channel: Channel | null) => {
    setActiveChannel(channel);
    if (channel) {
      setRecentChannelIds(prev => {
        const newRecents = [channel.id, ...prev.filter(id => id !== channel.id)].slice(0, 50);
        saveRecents(newRecents);
        return newRecents;
      });
    }
  };

  const handleAddPlaylist = (name: string, channels: Channel[], xtreamAuth?: any, sourceUrl?: string) => {
    if (channels.length === 0) {
      alert("Herhangi bir kanal bulunamadı.");
      return;
    }

    const newPlaylist: Playlist = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      channels,
      createdAt: Date.now(),
      xtreamAuth,
      sourceUrl
    };

    const updated = [...playlists, newPlaylist];
    setPlaylists(updated);
    savePlaylists(updated);
    setActivePlaylistId(newPlaylist.id);
  };

  const handleDeletePlaylist = (id: string) => {
    const updated = playlists.filter(p => p.id !== id);
    setPlaylists(updated);
    savePlaylists(updated);
    if (activePlaylistId === id) {
      setActivePlaylistId(updated.length > 0 ? updated[0].id : null);
      setActiveChannel(null);
    }
  };

  const handleToggleFavorite = (channelId: string) => {
    if (!activePlaylistId) return;

    const updated = playlists.map(p => {
      if (p.id === activePlaylistId) {
        return {
          ...p,
          channels: p.channels.map(c => c.id === channelId ? { ...c, isFavorite: !c.isFavorite } : c)
        };
      }
      return p;
    });

    setPlaylists(updated);
    savePlaylists(updated);

    if (activeChannel?.id === channelId) {
      setActiveChannel(updated.find(p => p.id === activePlaylistId)!.channels.find(c => c.id === channelId) || null);
    }
  };

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);

  if (showSplash) {
    return (
      <div className="flex h-screen w-full bg-slate-950 items-center justify-center flex-col font-sans">
        <div className="w-32 h-32 mb-6 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 animate-pulse">
          <img src={logoUrl} alt="Güvenli IPTV Logo" className="w-full h-full object-cover" />
        </div>
        <div className="flex items-center gap-2 text-emerald-500">
          <ShieldCheck className="w-5 h-5" />
          <h1 className="text-xl font-bold tracking-wider">GÜVENLİ IPTV</h1>
        </div>
        <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest">Şifreli & Yerel</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        :root {
          --color-emerald-400: ${appSettings.themeColor};
          --color-emerald-500: ${appSettings.themeColor};
          --color-emerald-600: ${appSettings.themeColor};
        }
      `}</style>
      <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-slate-200">
        <Sidebar 
          playlists={playlists}
          activePlaylistId={activePlaylistId}
          onSelectPlaylist={setActivePlaylistId}
          onAddPlaylist={handleAddPlaylist}
          onDeletePlaylist={handleDeletePlaylist}
        />
        
        <AnimatePresence mode="wait">
          {activePlaylist ? (
            <motion.div
              key="channel-list"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full flex-shrink-0"
            >
              <ChannelList 
                channels={activePlaylist.channels}
                activeChannelId={activeChannel?.id || null}
                onSelectChannel={handleSelectChannel}
                onToggleFavorite={handleToggleFavorite}
                recentChannelIds={recentChannelIds}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty-state"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full items-center justify-center p-8 text-center"
            >
              <ShieldAlert className="w-12 h-12 text-slate-700 mb-4" />
              <h2 className="text-lg font-medium text-slate-300 mb-2">Gizlilik Odaklı</h2>
              <p className="text-sm text-slate-500">Kanal izlemeye başlamak için yeni bir oynatma listesi ekleyin. Verileriniz tamamen cihazınızda şifreli kalır.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0 relative">
          <AnimatePresence>
            {isSyncing && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full text-xs flex items-center gap-2 z-50 pointer-events-none backdrop-blur-md"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                Kanal Listeleri Arka Planda Güncelleniyor...
              </motion.div>
            )}
          </AnimatePresence>
          <Player channel={activeChannel} />
          <EpgPanel channel={activeChannel} playlist={activePlaylist} />
        </div>
      </div>
    </>
  );
}

