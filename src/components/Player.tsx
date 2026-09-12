import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import { Channel } from '../types';
import { Settings, Check, Info, Activity, PictureInPicture } from 'lucide-react';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import { addLog, loadSettings } from '../lib/storage';
import { AudioEqualizer } from './AudioEqualizer';
import { SystemHealth } from './SystemHealth';

interface PlayerProps {
  channel: Channel | null;
}

export function Player({ channel }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
  const [currentAudio, setCurrentAudio] = useState<number>(-1);
  const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({ resolution: '', bitrate: '', videoCodec: '', audioCodec: '' });
  const [chartData, setChartData] = useState<{time: string, bitrate: number}[]>([]);
  const [canPiP, setCanPiP] = useState(false);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);

  useEffect(() => {
    if ('pictureInPictureEnabled' in document) {
      setCanPiP(true);
    }
  }, []);

  const togglePiP = async () => {
    try {
      if (videoRef.current) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      }
    } catch (error: any) {
      console.error("PiP Hatası:", error);
      addLog('PIP_ERROR', `Resim İçinde Resim modu başlatılamadı: ${error?.message || 'Bilinmeyen hata'}`, channel?.name);
    }
  };

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
        let vc = 'Bilinmiyor';
        let ac = 'Bilinmiyor';

        if (hls && hls.currentLevel !== -1 && hls.levels && hls.levels[hls.currentLevel]) {
          const level = hls.levels[hls.currentLevel];
          if (level.bitrate) {
            brNum = Math.round(level.bitrate / 1024);
            br = `${brNum} kbps`;
          }
          vc = level.videoCodec || vc;
          ac = level.audioCodec || ac;

          // Network Health Check
          const bandwidth = hls.bandwidthEstimate; // in bps
          if (bandwidth && level.bitrate && bandwidth < level.bitrate * 1.1) {
            setNetworkWarning(`Bağlantı hızınız (${Math.round(bandwidth/1024)} kbps) mevcut yayın kalitesi (${brNum} kbps) için yetersiz olabilir. Kesintileri önlemek için Ayarlar'dan Tasarruf Modu'nu açmayı düşünebilirsiniz.`);
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
          const updated = [...prev, newPoint];
          return updated.slice(-20); // Son 20 saniyeyi tut
        });
      }, 1000);
    } else {
      setChartData([]);
    }
    return () => clearInterval(interval);
  }, [showStats, channel]);

  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;
    
    // Güvenlik: Önceki kaynağı temizle
    video.src = '';
    
    // Durumları sıfırla
    setAudioTracks([]);
    setSubtitleTracks([]);
    setCurrentAudio(-1);
    setCurrentSubtitle(-1);
    setShowSettings(false);
    
    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
      });
      hlsRef.current = hls;
      
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Tasarruf Modu: Yavaş internet için en düşük bit hızını zorla
        const settings = loadSettings();
        if (settings.dataSaver && hls.levels.length > 0) {
          // autoLevelCapping'i 0 yaparak hls.js'in sadece en düşük çözünürlüğe (0. indeks) kadar çıkmasına izin veriyoruz
          hls.autoLevelCapping = 0; 
          addLog('SYSTEM_INFO', 'Tasarruf Modu aktif: En düşük kalite seçildi.', channel.name);
        }

        video.play().catch(e => {
          console.error("Otomatik oynatma engellendi", e);
          addLog('PLAYBACK_ERROR', `Otomatik oynatma başarısız: ${e?.message}`, channel.name);
        });
        
        // HLS trackleri genellikle ilk parça yüklendikten sonra daha belirginleşir
        setTimeout(() => {
          if (hlsRef.current) {
            const aTracks = hlsRef.current.audioTracks || [];
            const sTracks = hlsRef.current.subtitleTracks || [];
            setAudioTracks(aTracks);
            setSubtitleTracks(sTracks);

            let selectedAudio = hlsRef.current.audioTrack;
            let selectedSubtitle = hlsRef.current.subtitleTrack;

            // Tarayıcı diline göre otomatik seçim
            const browserLang = navigator.language.split('-')[0].toLowerCase(); // 'tr', 'en', 'de' vb.

            // Ses dili seçimi
            if (aTracks.length > 1) {
              const preferredAudioIdx = aTracks.findIndex((t: any) => t.lang && t.lang.toLowerCase().includes(browserLang));
              if (preferredAudioIdx > -1 && preferredAudioIdx !== selectedAudio) {
                hlsRef.current.audioTrack = preferredAudioIdx;
                selectedAudio = preferredAudioIdx;
                addLog('SYSTEM_INFO', `Otomatik ses dili seçildi: ${aTracks[preferredAudioIdx].lang}`, channel.name);
              }
            }

            // Altyazı seçimi (eğer ses dili tarayıcı diliyle uyuşmuyorsa, o zaman altyazıyı aç)
            if (sTracks.length > 0) {
              const currentAudioLang = selectedAudio > -1 && aTracks[selectedAudio] ? (aTracks[selectedAudio].lang || '').toLowerCase() : '';
              
              if (!currentAudioLang.includes(browserLang)) {
                const preferredSubIdx = sTracks.findIndex((t: any) => t.lang && t.lang.toLowerCase().includes(browserLang));
                if (preferredSubIdx > -1 && preferredSubIdx !== selectedSubtitle) {
                  hlsRef.current.subtitleTrack = preferredSubIdx;
                  selectedSubtitle = preferredSubIdx;
                  addLog('SYSTEM_INFO', `Yayın dili farklı, otomatik altyazı aktif: ${sTracks[preferredSubIdx].lang}`, channel.name);
                }
              }
            }

            setCurrentAudio(selectedAudio);
            setCurrentSubtitle(selectedSubtitle);
          }
        }, 500);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              addLog('NETWORK_ERROR', `Akış bağlantısı koptu veya ağ hatası: ${data.details}`, channel.name);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              addLog('MEDIA_ERROR', `Medya çözme hatası: ${data.details}`, channel.name);
              hls.recoverMediaError();
              break;
            default:
              addLog('FATAL_ERROR', `Kritik HLS hatası: ${data.details}`, channel.name);
              hls.destroy();
              break;
          }
        }
      });

      hls.on(Hls.Events.AUDIO_TRACK_LOADED, () => {
        if (hlsRef.current) {
           setAudioTracks(hlsRef.current.audioTracks || []);
        }
      });
      
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        if (hlsRef.current) {
           setSubtitleTracks(hlsRef.current.subtitleTracks || []);
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = channel.url;
      video.addEventListener('error', () => {
        addLog('NATIVE_PLAYER_ERROR', 'Yerel Safari/iOS oynatıcısı akışı yükleyemedi.', channel.name);
      });
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => addLog('PLAYBACK_ERROR', `Otomatik oynatma başarısız: ${e?.message}`, channel.name));
      });
    }
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
        exit={{ opacity: 0 }}
        className="flex-1 flex flex-col items-center justify-center bg-black text-gray-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        <p className="text-lg">Oynatmak için bir kanal seçin</p>
      </motion.div>
    );
  }

  const hasSettings = audioTracks.length > 1 || subtitleTracks.length > 0;

  return (
    <motion.div 
      key={channel.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col bg-black relative"
    >
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {channel.logo && (
            <img src={channel.logo} alt={channel.name} className="w-10 h-10 rounded object-contain bg-white/10" />
          )}
          <h2 className="text-white font-medium text-lg drop-shadow-md">{channel.name}</h2>
        </div>
        
        <div className="flex items-center">
          {canPiP && (
            <button 
              onClick={togglePiP}
              className="p-2 mr-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm"
              title="Mini Oynatıcı (PiP)"
            >
              <PictureInPicture className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-full transition-colors backdrop-blur-sm ${showStats ? 'bg-emerald-600 text-white' : 'bg-black/50 hover:bg-black/80 text-slate-300 hover:text-white'}`}
            title="Teknik Bilgiler"
          >
            <Info className="w-5 h-5" />
          </button>
          
        {hasSettings && (
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm ml-2"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {showSettings && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden z-50">
                {audioTracks.length > 1 && (
                  <div className="p-2 border-b border-slate-800">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Ses Dili</h3>
                    {audioTracks.map((track, i) => (
                      <button
                        key={i}
                        onClick={() => changeAudio(i)}
                        className="w-full text-left flex items-center justify-between px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800 rounded transition-colors"
                      >
                        <span className="truncate">{track.name || track.lang || `Ses ${i + 1}`}</span>
                        {currentAudio === i && <Check className="w-4 h-4 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                )}
                
                {subtitleTracks.length > 0 && (
                  <div className="p-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Altyazı</h3>
                    <button
                      onClick={() => changeSubtitle(-1)}
                      className="w-full text-left flex items-center justify-between px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800 rounded transition-colors"
                    >
                      <span>Kapalı</span>
                      {currentSubtitle === -1 && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>
                    {subtitleTracks.map((track, i) => (
                      <button
                        key={i}
                        onClick={() => changeSubtitle(i)}
                        className="w-full text-left flex items-center justify-between px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800 rounded transition-colors"
                      >
                        <span className="truncate">{track.name || track.lang || `Altyazı ${i + 1}`}</span>
                        {currentSubtitle === i && <Check className="w-4 h-4 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {showStats && (
        <div className="absolute top-20 right-4 bg-black/70 backdrop-blur text-xs text-emerald-400 p-3 rounded-lg border border-emerald-500/30 font-mono z-20 shadow-xl pointer-events-none w-64">
          <div className="flex items-center gap-2 mb-2 border-b border-emerald-500/30 pb-1">
            <Activity className="w-4 h-4" />
            <span className="font-bold text-white uppercase tracking-wider">Bağlantı İstatistikleri</span>
          </div>
          <table className="w-full text-left mb-3">
            <tbody>
              <tr><th className="pr-4 py-0.5 text-slate-400 font-normal">Çözünürlük:</th><td className="font-medium text-white break-all">{stats.resolution}</td></tr>
              <tr><th className="pr-4 py-0.5 text-slate-400 font-normal">Bit Hızı:</th><td className="font-medium text-white break-all">{stats.bitrate}</td></tr>
              <tr><th className="pr-4 py-0.5 text-slate-400 font-normal">Video:</th><td className="font-medium text-white break-all">{stats.videoCodec}</td></tr>
              <tr><th className="pr-4 py-0.5 text-slate-400 font-normal">Ses:</th><td className="font-medium text-white break-all">{stats.audioCodec}</td></tr>
            </tbody>
          </table>
          <div className="h-16 w-full border-t border-emerald-500/30 pt-2">
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
            <div className="mt-3 p-2 bg-rose-500/20 border border-rose-500/50 rounded text-rose-300 text-[10px] leading-snug">
              ⚠️ {networkWarning}
            </div>
          )}
        </div>
      )}

      <video
        ref={videoRef}
        controls
        crossOrigin="anonymous"
        className="w-full h-full object-contain"
        autoPlay
      />
      <SystemHealth />
      <AudioEqualizer videoRef={videoRef} />
    </motion.div>
  );
}
