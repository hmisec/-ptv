import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Playlist, Channel, XtreamAuth } from '../types';
import { Plus, ListVideo, Trash2, ShieldCheck, Lock, Settings } from 'lucide-react';
import { parseM3U } from '../lib/m3u';
import { fetchXtreamPlaylist, normalizeXtreamBaseUrl } from '../lib/xtream';
import { SettingsModal } from './SettingsModal';
import { P2pSyncModal } from './P2pSyncModal';

interface SidebarProps {
  playlists: Playlist[];
  activePlaylistId: string | null;
  onSelectPlaylist: (id: string) => void;
  onAddPlaylist: (name: string, channels: Channel[], xtreamAuth?: XtreamAuth, sourceUrl?: string) => void;
  onDeletePlaylist: (id: string) => void;
}

export function Sidebar({ playlists, activePlaylistId, onSelectPlaylist, onAddPlaylist, onDeletePlaylist }: SidebarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showP2pSync, setShowP2pSync] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  
  const [xtreamUrl, setXtreamUrl] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  
  const [addMode, setAddMode] = useState<'url' | 'file' | 'xtream'>('url');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newName.trim()) {
      setError('Liste adı gerekli');
      return;
    }

    try {
      setLoading(true);
      let channels: Channel[] = [];
      let auth: XtreamAuth | undefined = undefined;
      let finalSourceUrl: string | undefined = undefined;

      if (addMode === 'file') {
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (!file) {
          setError('Lütfen bir dosya seçin');
          setLoading(false);
          return;
        }
        const content = await file.text();
        channels = parseM3U(content);
      } else if (addMode === 'url') {
        if (!newUrl.trim()) {
          setError('URL gerekli');
          setLoading(false);
          return;
        }
        const response = await fetch(newUrl);
        if (!response.ok) throw new Error('Ağ hatası');
        const content = await response.text();
        channels = parseM3U(content);
        finalSourceUrl = newUrl;
      } else if (addMode === 'xtream') {
        if (!xtreamUrl || !xtreamUser || !xtreamPass) {
          setError('Tüm Xtream bilgileri gerekli');
          setLoading(false);
          return;
        }
        const cleanUrl = normalizeXtreamBaseUrl(xtreamUrl);
        if (!cleanUrl) {
          setError('Geçersiz sunucu adresi (örn: http://sunucu.com:8080)');
          setLoading(false);
          return;
        }
        channels = await fetchXtreamPlaylist(cleanUrl, xtreamUser.trim(), xtreamPass.trim());
        auth = { url: cleanUrl, user: xtreamUser.trim(), pass: xtreamPass.trim() };
      }

      onAddPlaylist(newName, channels, auth, finalSourceUrl);
      setIsAdding(false);
      setNewName('');
      setNewUrl('');
      setXtreamUrl('');
      setXtreamUser('');
      setXtreamPass('');
    } catch (err: any) {
      setError(err.message || 'Liste yüklenemedi. Lütfen kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden text-slate-300">
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <ShieldCheck className="text-emerald-500 w-6 h-6" />
        <h1 className="text-white font-bold text-lg tracking-tight">Güvenli IPTV</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Listeler</h2>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.form 
              initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
              animate={{ height: 'auto', opacity: 1, overflow: 'visible' }}
              exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
              transition={{ duration: 0.2 }}
              onSubmit={handleAdd} 
              className="bg-slate-800 p-3 rounded-lg space-y-3 mb-4"
            >
              <input 
                type="text" 
                placeholder="Liste Adı" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            
            <div className="flex gap-1 text-xs">
              <button 
                type="button" 
                onClick={() => setAddMode('url')}
                className={`flex-1 py-1 rounded transition-colors ${addMode === 'url' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                URL
              </button>
              <button 
                type="button" 
                onClick={() => setAddMode('file')}
                className={`flex-1 py-1 rounded transition-colors ${addMode === 'file' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                Dosya
              </button>
              <button 
                type="button" 
                onClick={() => setAddMode('xtream')}
                className={`flex-1 py-1 rounded transition-colors ${addMode === 'xtream' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                Xtream
              </button>
            </div>

            {addMode === 'file' && (
              <input 
                id="file-upload"
                type="file" 
                accept=".m3u,.m3u8"
                className="w-full text-sm text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-slate-300"
              />
            )}
            
            {addMode === 'url' && (
              <input 
                type="url" 
                placeholder="M3U URL" 
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            )}

            {addMode === 'xtream' && (
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="Sunucu Adresi (örn: iptv.net:8080)" 
                  value={xtreamUrl}
                  onChange={(e) => setXtreamUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <input 
                  type="text" 
                  placeholder="Kullanıcı Adı" 
                  value={xtreamUser}
                  onChange={(e) => setXtreamUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <input 
                  type="password" 
                  placeholder="Şifre" 
                  value={xtreamPass}
                  onChange={(e) => setXtreamPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500">
                  Otomatik CORS ve SSL uyumluluk motoru devrededir.
                </p>
              </div>
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded p-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Yükleniyor...' : 'Ekle'}
            </button>
          </motion.form>
        )}
        </AnimatePresence>

        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {playlists.map(pl => (
              <motion.div 
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                key={pl.id}
                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  activePlaylistId === pl.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
                onClick={() => onSelectPlaylist(pl.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <ListVideo className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-sm font-medium">{pl.name}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeletePlaylist(pl.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {playlists.length === 0 && !isAdding && (
            <p className="text-slate-500 text-sm text-center py-4">Liste bulunamadı.</p>
          )}
        </div>
      </div>
      <div className="p-4 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3 h-3 text-emerald-500" />
          <span>Şifreli Veri</span>
        </div>
        <div className="flex items-center gap-2">
          {/* We'll pass isSyncing as a prop or mock it here for UI. Actually, better to just put a global sync dot. For simplicity, let's just use a static setting button here since isSyncing is in App.tsx. I will just add the button. */}
          <button 
            onClick={() => setShowSettings(true)}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors"
            title="Ayarlar & Yedekleme"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          playlists={playlists} 
          onOpenP2pSync={() => {
            setShowSettings(false);
            setShowP2pSync(true);
          }}
        />
      )}

      {showP2pSync && (
        <P2pSyncModal
          playlists={playlists}
          onClose={() => setShowP2pSync(false)}
          onSyncComplete={() => {
            setShowP2pSync(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
