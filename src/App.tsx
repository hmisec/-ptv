import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChannelList } from './components/ChannelList';
import { Player } from './components/Player';
import { Playlist, Channel } from './types';
import { savePlaylists, loadPlaylists } from './lib/storage';
import { ShieldAlert } from 'lucide-react';

export default function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  useEffect(() => {
    // İlk yüklemede listeleri al
    const loaded = loadPlaylists();
    setPlaylists(loaded);
    if (loaded.length > 0) {
      setActivePlaylistId(loaded[0].id);
    }
  }, []);

  const handleAddPlaylist = (name: string, channels: Channel[]) => {
    if (channels.length === 0) {
      alert("Herhangi bir kanal bulunamadı.");
      return;
    }

    const newPlaylist: Playlist = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      channels,
      createdAt: Date.now()
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

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-slate-200">
      <Sidebar 
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        onSelectPlaylist={setActivePlaylistId}
        onAddPlaylist={handleAddPlaylist}
        onDeletePlaylist={handleDeletePlaylist}
      />
      
      {activePlaylist ? (
        <ChannelList 
          channels={activePlaylist.channels}
          activeChannelId={activeChannel?.id || null}
          onSelectChannel={setActiveChannel}
        />
      ) : (
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full items-center justify-center p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-slate-700 mb-4" />
          <h2 className="text-lg font-medium text-slate-300 mb-2">Gizlilik Odaklı</h2>
          <p className="text-sm text-slate-500">Kanal izlemeye başlamak için yeni bir oynatma listesi ekleyin. Verileriniz tamamen cihazınızda şifreli kalır.</p>
        </div>
      )}

      <Player channel={activeChannel} />
    </div>
  );
}

