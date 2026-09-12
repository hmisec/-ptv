import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Channel } from '../types';
import { Settings, Check } from 'lucide-react';

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
        video.play().catch(e => console.error("Otomatik oynatma engellendi", e));
        
        // HLS trackleri genellikle ilk parça yüklendikten sonra daha belirginleşir
        setTimeout(() => {
          if (hlsRef.current) {
            setAudioTracks(hlsRef.current.audioTracks || []);
            setSubtitleTracks(hlsRef.current.subtitleTracks || []);
            setCurrentAudio(hlsRef.current.audioTrack);
            setCurrentSubtitle(hlsRef.current.subtitleTrack);
          }
        }, 500);
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
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.error("Otomatik oynatma engellendi", e));
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
      <div className="flex-1 flex flex-col items-center justify-center bg-black text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        <p className="text-lg">Oynatmak için bir kanal seçin</p>
      </div>
    );
  }

  const hasSettings = audioTracks.length > 1 || subtitleTracks.length > 0;

  return (
    <div className="flex-1 flex flex-col bg-black relative">
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {channel.logo && (
            <img src={channel.logo} alt={channel.name} className="w-10 h-10 rounded object-contain bg-white/10" />
          )}
          <h2 className="text-white font-medium text-lg drop-shadow-md">{channel.name}</h2>
        </div>
        
        {hasSettings && (
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm"
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
      <video
        ref={videoRef}
        controls
        className="w-full h-full object-contain"
        autoPlay
      />
    </div>
  );
}
