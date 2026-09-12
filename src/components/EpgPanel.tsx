import React, { useEffect, useState } from 'react';
import { Channel, Playlist, EpgProgram } from '../types';
import { fetchXtreamEpg } from '../lib/xtream';
import { Clock, Calendar, Battery } from 'lucide-react';
import { loadSettings, getCachedEpg, saveEpgCache } from '../lib/storage';

interface EpgPanelProps {
  channel: Channel | null;
  playlist: Playlist | undefined;
}

export function EpgPanel({ channel, playlist }: EpgPanelProps) {
  const [epgData, setEpgData] = useState<EpgProgram[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState(loadSettings());

  useEffect(() => {
    const handleSettingsChange = () => setSettings(loadSettings());
    window.addEventListener('app-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('app-settings-changed', handleSettingsChange);
  }, []);

  useEffect(() => {
    // Current time updater for progress bars
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!channel || !playlist?.xtreamAuth || !channel.streamId || settings.dataSaver) {
      setEpgData([]);
      return;
    }

    const cached = getCachedEpg(channel.streamId);
    if (cached && cached.length > 0) {
      setEpgData(cached);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const { url, user, pass } = playlist.xtreamAuth;
    fetchXtreamEpg(url, user, pass, channel.streamId)
      .then(data => {
        if (isMounted) {
          setEpgData(data);
          setLoading(false);
          if (data && data.length > 0) {
            saveEpgCache(channel.streamId as string, data);
          }
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error("EPG error", err);
          setEpgData([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [channel, playlist]);

  if (!channel) return null;

  if (settings.dataSaver) {
    return (
      <div className="h-48 border-t border-slate-800 bg-slate-900 flex flex-col items-center justify-center text-emerald-500/80">
        <Battery className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm font-medium">Tasarruf Modu Aktif</p>
        <p className="text-xs text-slate-500 mt-1">Veri ve kaynak tasarrufu için EPG (Yayın Akışı) devre dışı bırakıldı.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-48 border-t border-slate-800 bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (epgData.length === 0) {
    return (
      <div className="h-48 border-t border-slate-800 bg-slate-900 flex flex-col items-center justify-center text-slate-500">
        <Calendar className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Bu kanal için rehber bilgisi (EPG) bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="h-48 border-t border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Yayın Akışı</h3>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-stretch p-3 gap-3">
        {epgData.map((prog) => {
          const isNow = now >= prog.startTimestamp && now <= prog.stopTimestamp;
          const isPast = now > prog.stopTimestamp;
          
          let progress = 0;
          if (isNow) {
            const total = prog.stopTimestamp - prog.startTimestamp;
            const elapsed = now - prog.startTimestamp;
            progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
          }

          const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div 
              key={prog.id} 
              className={`flex-shrink-0 w-64 rounded-lg border ${
                isNow ? 'border-emerald-500/50 bg-emerald-950/20' : 
                isPast ? 'border-slate-800 bg-slate-900/50 opacity-50' : 
                'border-slate-800 bg-slate-900'
              } p-3 flex flex-col`}
            >
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                <span className={isNow ? 'text-emerald-400 font-medium' : ''}>
                  {formatTime(prog.startTimestamp)} - {formatTime(prog.stopTimestamp)}
                </span>
                {isNow && <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500 text-white">Canlı</span>}
              </div>
              <h4 className={`text-sm font-medium line-clamp-1 ${isNow ? 'text-emerald-100' : 'text-slate-200'}`}>
                {prog.title}
              </h4>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1 flex-1">
                {prog.description || 'Detay bulunmuyor.'}
              </p>
              
              {isNow && (
                <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
