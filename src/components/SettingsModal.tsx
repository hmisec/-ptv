import React, { useState, useEffect, useMemo } from 'react';
import { X, Moon, Sun, Download, Shield, Terminal, Battery, GripVertical, Eye, EyeOff, Palette } from 'lucide-react';
import { exportBackup, loadSettings, saveSettings, cleanupEpgCache } from '../lib/storage';
import { ErrorLogsModal } from './ErrorLogsModal';
import { Playlist, AppSettings } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  playlists: Playlist[];
}

export function SettingsModal({ onClose, playlists }: SettingsModalProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [password, setPassword] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ dataSaver: false, categoryOrder: [], hiddenCategories: [] });
  const [cleanupMessage, setCleanupMessage] = useState('');

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    playlists.forEach(pl => {
      pl.channels.forEach(c => {
        if (c.group) cats.add(c.group);
      });
    });
    return Array.from(cats);
  }, [playlists]);

  const [orderedCats, setOrderedCats] = useState<string[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (document.documentElement.classList.contains('light-mode')) {
      setTheme('light');
    }
    const loaded = loadSettings();
    setSettings(loaded);
    
    const initialOrder = loaded.categoryOrder.length > 0 ? loaded.categoryOrder : allCategories;
    // ensure all current categories are in the ordered list
    const missing = allCategories.filter(c => !initialOrder.includes(c));
    setOrderedCats([...initialOrder.filter(c => allCategories.includes(c)), ...missing]);
  }, [allCategories]);

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  };

  const handleExport = () => {
    exportBackup(password || undefined);
    alert('Yedekleme dosyası başarıyla indirildi!');
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    // Refresh page to apply global setting changes if necessary
    window.dispatchEvent(new Event('app-settings-changed'));
  };

  const toggleDataSaver = () => {
    updateSettings({ ...settings, dataSaver: !settings.dataSaver });
  };

  const toggleCategoryVisibility = (cat: string) => {
    const hidden = new Set(settings.hiddenCategories);
    if (hidden.has(cat)) hidden.delete(cat);
    else hidden.add(cat);
    updateSettings({ ...settings, hiddenCategories: Array.from(hidden) });
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const items = [...orderedCats];
    const draggedItem = items[draggedIdx];
    items.splice(draggedIdx, 1);
    items.splice(index, 0, draggedItem);
    setDraggedIdx(index);
    setOrderedCats(items);
  };

  const onDragEnd = () => {
    setDraggedIdx(null);
    updateSettings({ ...settings, categoryOrder: orderedCats });
  };

  const handleCleanup = () => {
    const deleted = cleanupEpgCache();
    setCleanupMessage(`Temizlik tamamlandı. ${deleted} adet eski/süresi geçmiş EPG verisi silindi.`);
    setTimeout(() => setCleanupMessage(''), 4000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-semibold text-white">Ayarlar & Yedekleme</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Tema Ayarı */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Görünüm</h3>
            <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
              <button
                onClick={() => toggleTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-md transition-colors ${
                  theme === 'dark' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Moon className="w-4 h-4" /> Karanlık
              </button>
              <button
                onClick={() => toggleTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-md transition-colors ${
                  theme === 'light' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Sun className="w-4 h-4" /> Aydınlık
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg mt-2">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Palette className="w-4 h-4 text-emerald-500" /> Vurgu Rengi
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={settings.themeColor || '#10b981'}
                  onChange={(e) => updateSettings({ ...settings, themeColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  title="Özel Vurgu Rengi Seçin"
                />
                <button 
                  onClick={() => updateSettings({ ...settings, themeColor: '#10b981' })}
                  className="text-xs text-slate-500 hover:text-slate-300 underline"
                >
                  Sıfırla
                </button>
              </div>
            </div>
          </div>

          {/* Tasarruf Modu */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Battery className="w-4 h-4" /> Güç & Veri Tasarrufu
            </h3>
            <div 
              onClick={toggleDataSaver}
              className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                settings.dataSaver ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div>
                <p className={`text-sm font-medium ${settings.dataSaver ? 'text-emerald-400' : 'text-slate-300'}`}>Tasarruf Modu</p>
                <p className="text-xs text-slate-500">Yavaş internet için EPG'yi kapatır ve düşük bit hızını zorlar.</p>
              </div>
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${settings.dataSaver ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.dataSaver ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            {/* Ön Bellek Temizleme */}
            <div className="pt-2">
              <button 
                onClick={handleCleanup}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg p-2 text-sm transition-colors"
              >
                EPG Önbelleğini Temizle
              </button>
              {cleanupMessage && (
                <p className="text-[10px] text-emerald-400 mt-2 text-center">{cleanupMessage}</p>
              )}
            </div>
          </div>

          {/* Kategori Yönetimi */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <GripVertical className="w-4 h-4" /> Görünüm Ayarları (Kategoriler)
            </h3>
            <p className="text-xs text-slate-500 mb-2">Kategorileri sürükleyip bırakarak sıralayabilir veya gizleyebilirsiniz.</p>
            <div className="bg-slate-950 border border-slate-800 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-800/50">
              {orderedCats.length === 0 ? (
                <p className="text-xs text-slate-500 p-4 text-center">Önce bir liste ekleyin.</p>
              ) : (
                orderedCats.map((cat, index) => {
                  const isHidden = settings.hiddenCategories.includes(cat);
                  return (
                    <div 
                      key={cat}
                      draggable
                      onDragStart={(e) => onDragStart(e, index)}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDragEnd={onDragEnd}
                      className="flex items-center justify-between p-2 hover:bg-slate-900 cursor-move"
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <GripVertical className="w-4 h-4 text-slate-600" />
                        <span className={isHidden ? 'line-through text-slate-500' : ''}>{cat}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleCategoryVisibility(cat); }}
                        className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Dışa Aktar */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" /> Güvenli Dışa Aktar
            </h3>
            <p className="text-xs text-slate-500">
              Oynatma listelerinizi, favorilerinizi ve son izlenenlerinizi şifrelenmiş bir dosya olarak indirin.
            </p>
            
            <div className="space-y-2">
              <input 
                type="password"
                placeholder="Yedekleme Şifresi (İsteğe Bağlı)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-[10px] text-emerald-500/80 pl-1">
                Şifre girmezseniz cihazınıza özel yerel anahtarla şifrelenir. Başka cihaza aktarmak için şifre belirleyin.
              </p>
            </div>

            <button 
              onClick={handleExport}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg p-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 mt-2"
            >
              <Download className="w-4 h-4" />
              Yedeği İndir (.secureiptv)
            </button>
          </div>

          {/* Hata Günlükleri */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Sistem Kayıtları
            </h3>
            <button 
              onClick={() => setShowLogs(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg p-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              Hata Raporlarını Görüntüle
            </button>
          </div>
        </div>
      </div>

      {showLogs && <ErrorLogsModal onClose={() => setShowLogs(false)} />}
    </div>
  );
}
