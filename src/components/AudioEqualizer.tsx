import React, { useEffect, useRef, useState } from 'react';
import { Sliders, Volume2, Mic2, Activity } from 'lucide-react';

interface AudioEqualizerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function AudioEqualizer({ videoRef }: AudioEqualizerProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<'normal' | 'bass' | 'vocal'>('normal');
  const [gains, setGains] = useState<number[]>([0, 0, 0, 0, 0]); // 60, 230, 910, 3.6k, 14k Hz
  const [drcEnabled, setDrcEnabled] = useState(false);

  const frequencies = [60, 230, 910, 3600, 14000];

  useEffect(() => {
    // We only try to initialize when user opens the panel to save resources
    if (isOpen && !audioCtxRef.current && videoRef.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaElementSource(videoRef.current);
        sourceNodeRef.current = source;

        // Create 5 bands
        const filters = frequencies.map(freq => {
          const filter = ctx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = freq;
          filter.Q.value = 1;
          filter.gain.value = 0;
          return filter;
        });
        filtersRef.current = filters;

        // Create Dynamic Range Compressor for Volume Normalization
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, ctx.currentTime);
        compressor.knee.setValueAtTime(30, ctx.currentTime);
        compressor.ratio.setValueAtTime(1, ctx.currentTime); // 1 means no compression initially
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);
        compressorRef.current = compressor;

        // Connect nodes in series: source -> f0 -> f1 -> f2 -> f3 -> f4 -> compressor -> destination
        source.connect(filters[0]);
        for (let i = 0; i < filters.length - 1; i++) {
          filters[i].connect(filters[i + 1]);
        }
        filters[filters.length - 1].connect(compressor);
        compressor.connect(ctx.destination);

      } catch (err: any) {
        console.error("Audio Context Error:", err);
        setError("Yayın kaynağı CORS kısıtlaması nedeniyle ses geliştirmelerini desteklemiyor.");
      }
    }
  }, [isOpen, videoRef]);

  useEffect(() => {
    // Update gains when state changes
    filtersRef.current.forEach((filter, i) => {
      filter.gain.value = gains[i];
    });
  }, [gains]);

  useEffect(() => {
    if (compressorRef.current && audioCtxRef.current) {
      // ratio = 1 means bypassed, ratio = 12 means heavy compression
      compressorRef.current.ratio.setTargetAtTime(drcEnabled ? 12 : 1, audioCtxRef.current.currentTime, 0.1);
    }
  }, [drcEnabled]);

  const applyPreset = (type: 'normal' | 'bass' | 'vocal') => {
    setPreset(type);
    if (type === 'normal') setGains([0, 0, 0, 0, 0]);
    else if (type === 'bass') setGains([6, 4, 0, -2, -2]);
    else if (type === 'vocal') setGains([-2, -1, 4, 5, 2]);
  };

  const handleSliderChange = (index: number, value: number) => {
    const newGains = [...gains];
    newGains[index] = value;
    setGains(newGains);
    setPreset('normal'); // Custom now
  };

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 flex items-center justify-center gap-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <Sliders className="w-4 h-4" />
        SES GELİŞTİRİCİ & EKOLAYZIR
      </button>

      {isOpen && (
        <div className="p-4 bg-slate-950">
          {error ? (
            <div className="text-rose-400 text-xs text-center p-4 border border-rose-500/20 bg-rose-500/10 rounded">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex gap-2">
                  <button 
                    onClick={() => applyPreset('normal')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${preset === 'normal' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >
                    Normal
                  </button>
                  <button 
                    onClick={() => applyPreset('bass')}
                    className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${preset === 'bass' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >
                    <Volume2 className="w-3 h-3" /> Bass Boost
                  </button>
                  <button 
                    onClick={() => applyPreset('vocal')}
                    className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${preset === 'vocal' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >
                    <Mic2 className="w-3 h-3" /> Vocal Boost
                  </button>
                </div>
                
                <button
                  onClick={() => setDrcEnabled(!drcEnabled)}
                  className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-colors border ${
                    drcEnabled 
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                      : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                  title="Farklı kanallar arasındaki ses seviyesi farklarını (patlamaları) dengeler."
                >
                  <Activity className="w-3 h-3" />
                  Ses Normalizasyonu
                </button>
              </div>

              <div className="flex justify-between items-center px-4 max-w-lg mx-auto">
                {frequencies.map((freq, i) => (
                  <div key={freq} className="flex flex-col items-center gap-3">
                    <span className="text-[10px] text-slate-500">{gains[i] > 0 ? `+${gains[i]}` : gains[i]}dB</span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={gains[i]}
                      onChange={(e) => handleSliderChange(i, parseFloat(e.target.value))}
                      className="h-24 appearance-none bg-slate-800 rounded-full w-2 outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
                      style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                    <span className="text-[10px] font-mono text-slate-400">
                      {freq >= 1000 ? `${(freq/1000).toFixed(1)}k` : freq}Hz
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
