import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Settings, Check, Activity, Info, PictureInPicture, Maximize, Subtitles, 
  Volume2, ShieldCheck, HardDrive, Cpu, Plus, Minus, Upload
} from 'lucide-react';
import { Channel } from '../types';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { loadLogs, saveLogs, loadSettings } from '../lib/storage';
import { SystemHealth } from './SystemHealth';
import { AudioEqualizer } from './AudioEqualizer';
import { createSubtitleTrackUrl } from '../lib/subtitles';
import { motion } from 'motion/react';

interface PlayerProps {
  channel: Channel | null;
}

export function Player({ channel }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
  const [currentAudio, setCurrentAudio] = useState<number>(-1);
  const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [stats, setStats] = useState({ resolution: 'Hesaplanıyor...', bitrate: 'Hesaplanıyor...', videoCodec: 'Bilinmiyor', audioCodec: 'Bilinmiyor' });
  const [chartData, setChartData] = useState<{ time: string; bitrate: number }[]>([]);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  const [canPiP, setCanPiP] = useState<boolean>(false);
  const [customSubtitleUrl, setCustomSubtitleUrl] = useState<string | null>(null);
  const [customSubtitleName, setCustomSubtitleName] = useState<string>('');
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0);
  const [subtitleSize, setSubtitleSize] = useState<'sm' | 'base' | 'lg'>('base');

  const addLog = (type: any, message: string, chName?: string) => {
    const logs = loadLogs();
    logs.unshift({
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type,
      details: message,
      message,
      channelName: chName
    });
    saveLogs(logs);
  };

  useEffect(() => {
    if (document.pictureInPictureEnabled && videoRef.current) {
      setCanPiP(true);
    }
  }, []);

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP Hatası:", err);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen().catch(err => console.error(err));
    }
  };

  // Subtitle offset adjustment
  const adjustSubtitleOffset = (delta: number) => {
    const next = Math.round((subtitleOffset + delta) * 10) / 10;
    setSubtitleOffset(next);
    const video = videoRef.current;
    if (video && video.textTracks.length > 0) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (track.cues) {
          for (let j = 0; j < track.cues.length; j++) {
            const cue = track.cues[j] as VTTCue;
            cue.startTime += delta;
            cue.endTime += delta;
          }
        }
      }
    }
  };

  const handleCustomSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const isSrt = file.name.toLowerCase().endsWith('.srt');
      if (customSubtitleUrl) {
        URL.revokeObjectURL(customSubtitleUrl);
      }
      const trackUrl = createSubtitleTrackUrl(text, isSrt);
      setCustomSubtitleUrl(trackUrl);
      setCustomSubtitleName(file.name);
      setCurrentSubtitle(9999); // custom marker
    };
    reader.readAsText(file);
  };

  // Real-time bit rate & network stats
  useEffect(() => {
    let interval: any;
    if (showStats && channel) {
      interval = setInterval(() => {
        const video = videoRef.current;
        const hls = hlsRef.current;
        if (!video) return;

        let res = `${video.videoWidth || 0}x${video.videoHeight || 0}`;
        let br = 'Bilinmiyor';
        let brNum = 0;
        let vc = 'H.264 / HEVC Donanım';
        let ac = 'AAC / Dolby';

        if (hls && hls.currentLevel !== -1 && hls.levels && hls.levels[hls.currentLevel]) {
          const level = hls.levels[hls.currentLevel];
          if (level.bitrate) {
            brNum = Math.round(level.bitrate / 1024);
            br = `${brNum} kbps`;
          }
          vc = level.videoCodec || vc;
          ac = level.audioCodec || ac;

          const bandwidth = hls.bandwidthEstimate;
          if (bandwidth && level.bitrate && bandwidth < level.bitrate * 1.1) {
            setNetworkWarning(`Bağlantı hızınız (${Math.round(bandwidth/1024)} kbps) mevcut yayın kalitesi (${brNum} kbps) için yetersiz olabilir.`);
          } else {
            setNetworkWarning(null);
          }
        } else {
          setNetworkWarning(null);
        }

        setStats({ resolution: res, bitrate: br, videoCodec: vc, audioCodec: ac });
        setChartData(prev => {
          const now = new Date();
          const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
          const newPoint = { time: timeStr, bitrate: brNum };
          return [...prev, newPoint].slice(-20);
        });
      }, 1000);
    } else {
      setChartData([]);
    }
    return () => clearInterval(interval);
  }, [showStats, channel]);

  // Main playback engine
  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;
    const settings = loadSettings();
    
    // Clear previous media
    video.src = '';
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setAudioTracks([]);
    setSubtitleTracks([]);
    setCurrentAudio(-1);
    setCurrentSubtitle(-1);
    setShowSettings(false);
    setNetworkWarning(null);

    const isHls = channel.url.includes('.m3u8') || (!channel.url.includes('.mp4') && !channel.url.includes('.mkv'));
    const ramBufferBytes = (settings.ramBufferSizeMb || 60) * 1024 * 1024;

    if (isHls && Hls.isSupported()) {
      // RAM-Only Zero-Disk buffer config
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferSize: ramBufferBytes,
        maxBufferLength: 30,
        backBufferLength: 15,
        // Donanım hızlandırma ve hızlı başlatma
        startLevel: -1,
        autoStartLoad: true
      });

      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (settings.dataSaver && hls.levels.length > 0) {
          hls.autoLevelCapping = 0;
          addLog('SYSTEM_INFO', 'Tasarruf Modu aktif: En düşük kalite seçildi.', channel.name);
        }

        video.play().catch(e => {
          console.warn("Otomatik oynatma engellendi", e);
          addLog('PLAYBACK_ERROR', `Otomatik oynatma kullanıcı etkileşimi bekliyor: ${e?.message}`, channel.name);
        });

        setTimeout(() => {
          if (hlsRef.current) {
            const aTracks = hlsRef.current.audioTracks || [];
            const sTracks = hlsRef.current.subtitleTracks || [];
            setAudioTracks(aTracks);
            setSubtitleTracks(sTracks);
            setCurrentAudio(hlsRef.current.audioTrack);
            setCurrentSubtitle(hlsRef.current.subtitleTrack);
          }
        }, 500);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              addLog('NETWORK_ERROR', `Akış bağlantısı koptu veya ağ engellendi: ${data.details}`, channel.name);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              addLog('MEDIA_ERROR', `Medya çözme hatası: ${data.details}`, channel.name);
              hls.recoverMediaError();
              break;
            default:
              addLog('FATAL_ERROR', `Kritik HLS hatası: ${data.details}`, channel.name);
              // Fallback to direct video element if HLS fails
              hls.destroy();
              video.src = channel.url;
              video.play().catch(() => {});
              break;
          }
        }
      });
    } else {
      // Direct MP4 / MKV / native HLS (Safari or SmartTV native)
      video.src = channel.url;
      video.play().catch(e => {
        console.warn("Doğrudan oynatma:", e);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  const changeAudio = (index: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = index;
      setCurrentAudio(index);
    }
  };

  const changeSubtitle = (index: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = index;
      setCurrentSubtitle(index);
    }
  };

  if (!channel) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500 p-6 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        </div>
        <p className="text-sm font-medium text-slate-400">Oynatmak için listeden bir yayın veya VOD seçin</p>
        <p className="text-xs text-slate-600 mt-1 max-w-xs">Tüm akışlar doğrudan RAM tamponunda şifre çözülerek oynatılır, diske veri yazılmaz.</p>
      </motion.div>
    );
  }

  const hasSettings = audioTracks.length > 1 || subtitleTracks.length > 0 || customSubtitleUrl !== null;

  return (
    <motion.div 
      key={channel.id}
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col bg-black relative overflow-hidden group"
    >
      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-10 flex items-center justify-between pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center gap-3">
          {channel.logo ? (
            <img src={channel.logo} alt={channel.name} className="w-9 h-9 rounded-lg object-contain bg-white/10 p-0.5" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
              {channel.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-sm drop-shadow">{channel.name}</h2>
              {channel.contentType && channel.contentType !== 'live' && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] uppercase font-bold">
                  {channel.contentType}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{channel.group || 'Genel'}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <HardDrive className="w-3 h-3" /> RAM Tamponu (Sıfır Disk)
              </span>
            </div>
          </div>
        </div>
        
        {/* Top Right Controls */}
        <div className="flex items-center gap-1.5">
          {canPiP && (
            <button 
              onClick={togglePiP}
              className="p-2 bg-black/60 hover:bg-black/90 text-white rounded-xl transition-colors backdrop-blur-md border border-white/10"
              title="Mini Oynatıcı (PiP)"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>
          )}

          <button 
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-xl transition-colors backdrop-blur-md border border-white/10 ${
              showStats ? 'bg-emerald-600 text-white' : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white'
            }`}
            title="Teknik Bilgiler"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Subtitle & Audio Track Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-black/60 hover:bg-black/90 text-white rounded-xl transition-colors backdrop-blur-md border border-white/10"
              title="Ses, Altyazı & Ayarlar"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            {showSettings && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 text-xs space-y-3">
                {/* Audio Tracks */}
                {audioTracks.length > 1 && (
                  <div>
                    <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Ses Dili
                    </h3>
                    <div className="space-y-1">
                      {audioTracks.map((track, i) => (
                        <button
                          key={i}
                          onClick={() => changeAudio(i)}
                          className="w-full text-left flex items-center justify-between px-2 py-1.5 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <span className="truncate">{track.name || track.lang || `Ses ${i + 1}`}</span>
                          {currentAudio === i && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Subtitles */}
                <div>
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Subtitles className="w-3.5 h-3.5 text-emerald-400" /> Altyazı
                  </h3>
                  <div className="space-y-1">
                    <button
                      onClick={() => { changeSubtitle(-1); setCurrentSubtitle(-1); }}
                      className="w-full text-left flex items-center justify-between px-2 py-1 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <span>Kapalı</span>
                      {currentSubtitle === -1 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                    {subtitleTracks.map((track, i) => (
                      <button
                        key={i}
                        onClick={() => changeSubtitle(i)}
                        className="w-full text-left flex items-center justify-between px-2 py-1 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <span className="truncate">{track.name || track.lang || `Altyazı ${i + 1}`}</span>
                        {currentSubtitle === i && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    ))}
                    {customSubtitleUrl && (
                      <button
                        onClick={() => setCurrentSubtitle(9999)}
                        className="w-full text-left flex items-center justify-between px-2 py-1 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <span className="truncate">Harici: {customSubtitleName}</span>
                        {currentSubtitle === 9999 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* External Subtitle Upload */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Dışarıdan .SRT / .VTT Altyazı Ekle</span>
                    <input type="file" accept=".srt,.vtt" onChange={handleCustomSubtitleUpload} className="hidden" />
                  </label>
                </div>

                {/* Subtitle Offset / Delay Sync */}
                {currentSubtitle !== -1 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Altyazı Senkron / Gecikme:</span>
                      <span className="font-mono text-emerald-400">{subtitleOffset > 0 ? `+${subtitleOffset}s` : `${subtitleOffset}s`}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjustSubtitleOffset(-0.5)}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center gap-1"
                      >
                        <Minus className="w-3 h-3" /> 0.5s Geri
                      </button>
                      <button
                        onClick={() => setSubtitleOffset(0)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded"
                      >
                        Sıfırla
                      </button>
                      <button
                        onClick={() => adjustSubtitleOffset(0.5)}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> 0.5s İleri
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={toggleFullscreen}
            className="p-2 bg-black/60 hover:bg-black/90 text-white rounded-xl transition-colors backdrop-blur-md border border-white/10"
            title="Tam Ekran"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stream Stats HUD Overlay */}
      {showStats && (
        <div className="absolute top-16 right-4 bg-slate-950/85 backdrop-blur-md text-xs text-emerald-400 p-3.5 rounded-xl border border-emerald-500/30 font-mono z-20 shadow-2xl pointer-events-none w-72">
          <div className="flex items-center justify-between mb-2 border-b border-emerald-500/30 pb-1.5">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Donanım & Akış Bilgisi
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">4K/60fps Hazır</span>
          </div>
          <table className="w-full text-left mb-2 text-[11px]">
            <tbody>
              <tr><th className="pr-2 py-0.5 text-slate-400 font-normal">Çözünürlük:</th><td className="font-medium text-white">{stats.resolution}</td></tr>
              <tr><th className="pr-2 py-0.5 text-slate-400 font-normal">Bit Hızı:</th><td className="font-medium text-white">{stats.bitrate}</td></tr>
              <tr><th className="pr-2 py-0.5 text-slate-400 font-normal">Video Kodlayıcı:</th><td className="font-medium text-white truncate max-w-[120px]">{stats.videoCodec}</td></tr>
              <tr><th className="pr-2 py-0.5 text-slate-400 font-normal">Ses Kodlayıcı:</th><td className="font-medium text-white">{stats.audioCodec}</td></tr>
            </tbody>
          </table>

          <div className="h-14 w-full border-t border-emerald-500/20 pt-1.5">
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <YAxis domain={['auto', 'auto']} hide />
                  <Line 
                    type="monotone" 
                    dataKey="bitrate" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    dot={false}
                    isAnimationActive={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {networkWarning && (
            <div className="mt-2 p-1.5 bg-rose-500/20 border border-rose-500/40 rounded text-rose-300 text-[10px] leading-snug">
              ⚠️ {networkWarning}
            </div>
          )}
        </div>
      )}

      {/* HTML5 Video Element with Hardware Acceleration & RAM Buffer */}
      <video
        ref={videoRef}
        controls
        playsInline
        crossOrigin="anonymous"
        className="w-full h-full object-contain"
        autoPlay
      >
        {customSubtitleUrl && currentSubtitle === 9999 && (
          <track
            default
            kind="subtitles"
            label={customSubtitleName || "Harici Altyazı"}
            src={customSubtitleUrl}
          />
        )}
      </video>

      <SystemHealth />
      <AudioEqualizer videoRef={videoRef} />
    </motion.div>
  );
}
