import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Channel, Episode, Season, XtreamAuth } from '../types';
import { fetchSeriesInfo } from '../lib/xtream';
import { X, Play, Film, Calendar, Star, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface SeriesModalProps {
  channel: Channel;
  auth?: XtreamAuth;
  onSelectEpisode: (episodeChannel: Channel) => void;
  onClose: () => void;
}

export function SeriesModal({ channel, auth, onSelectEpisode, onClose }: SeriesModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Record<number, Episode[]>>({});
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  useEffect(() => {
    if (!auth) {
      setError('Bu diziyi yüklemek için Xtream oturum bilgisi bulunamadı.');
      setLoading(false);
      return;
    }

    const seriesId = channel.seriesId || channel.streamId;
    if (!seriesId) {
      setError('Dizi kimliği (series_id) bulunamadı.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchSeriesInfo(auth, seriesId)
      .then((data) => {
        setSeasons(data.seasons);
        setEpisodes(data.episodes);
        if (data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0].seasonNumber);
        } else if (Object.keys(data.episodes).length > 0) {
          setSelectedSeason(Number(Object.keys(data.episodes)[0]));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Dizi detayları yüklenirken hata oluştu.');
        setLoading(false);
      });
  }, [channel, auth]);

  const currentEpisodes = episodes[selectedSeason] || [];

  const handlePlayEpisode = (ep: Episode) => {
    const episodeChannel: Channel = {
      id: `${channel.id}_s${ep.seasonNum}e${ep.episodeNum}`,
      name: `${channel.name} - S${ep.seasonNum}E${ep.episodeNum}: ${ep.title}`,
      url: ep.url,
      group: channel.group,
      logo: channel.logo,
      contentType: 'vod',
      containerExtension: ep.containerExtension
    };
    onSelectEpisode(episodeChannel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200"
      >
        {/* Header with Series Banner */}
        <div className="relative p-6 border-b border-slate-800 bg-gradient-to-b from-slate-850 to-slate-900 flex items-start gap-4">
          <div className="w-20 h-28 bg-slate-950 rounded-xl overflow-hidden flex-shrink-0 border border-slate-800 shadow-md">
            {channel.logo ? (
              <img src={channel.logo} alt={channel.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <Film className="w-8 h-8" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Dizi
              </span>
              <span className="text-xs text-slate-400">{channel.group}</span>
            </div>
            <h2 className="text-xl font-bold text-white truncate">{channel.name}</h2>
            {channel.plot && (
              <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                {channel.plot}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              {channel.rating && (
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {channel.rating}
                </span>
              )}
              {channel.releaseDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {channel.releaseDate}
                </span>
              )}
              <span>{seasons.length} Sezon</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm">Dizi ve bölüm listesi güvenli şekilde alınıyor...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-rose-400 gap-3">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : (
            <>
              {/* Seasons Sidebar */}
              <div className="w-48 border-r border-slate-800 p-3 overflow-y-auto space-y-1 bg-slate-950/40">
                <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1">Sezonlar</div>
                {seasons.map((s) => (
                  <button
                    key={s.seasonNumber}
                    onClick={() => setSelectedSeason(s.seasonNumber)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                      selectedSeason === s.seasonNumber
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <span>{s.name || `${s.seasonNumber}. Sezon`}</span>
                    {s.episodeCount ? (
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                        {s.episodeCount}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* Episodes List */}
              <div className="flex-1 p-4 overflow-y-auto space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {selectedSeason}. Sezon Bölümleri ({currentEpisodes.length})
                  </h3>
                </div>

                {currentEpisodes.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">Bu sezonda henüz bölüm bulunamadı.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {currentEpisodes.map((ep) => (
                      <div
                        key={ep.id}
                        onClick={() => handlePlayEpisode(ep)}
                        className="p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl cursor-pointer transition-all group flex items-start gap-3"
                      >
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
                              Bölüm {ep.episodeNum}
                            </span>
                            {ep.duration && (
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {ep.duration}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 truncate mt-0.5">{ep.title}</p>
                          {ep.plot && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">{ep.plot}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
