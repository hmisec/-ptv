import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Channel } from '../types';
import { Search, Play, Heart, History, ArrowUpDown, FolderTree, ChevronDown, ChevronRight, List as ListIcon, Sparkles } from 'lucide-react';
import { loadSettings } from '../lib/storage';

interface ChannelListProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  activeChannelId: string | null;
  onToggleFavorite: (channelId: string) => void;
  recentChannelIds: string[];
}

const getQualityRank = (name: string) => {
  const upper = name.toUpperCase();
  if (upper.includes('4K') || upper.includes('UHD')) return 5;
  if (upper.includes('FHD') || upper.includes('1080')) return 4;
  if (upper.includes('HD') || upper.includes('720')) return 3;
  if (upper.includes('SD') || upper.includes('480')) return 2;
  return 1;
};

export function ChannelList({ channels, onSelectChannel, activeChannelId, onToggleFavorite, recentChannelIds }: ChannelListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('Hepsi');
  const [sortType, setSortType] = useState<string>('default');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showRecentsOnly, setShowRecentsOnly] = useState(false);
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'folder'>('list');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hoveredChannel, setHoveredChannel] = useState<Channel | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [settings, setSettings] = useState(loadSettings());
  
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSmartTag, setActiveSmartTag] = useState<string | null>(null);

  const SMART_TAGS = ['Spor', 'Haber', 'Film', 'Çocuk'];

  const getSmartTags = (channelName: string, groupName: string) => {
    const searchStr = `${channelName} ${groupName}`.toLowerCase();
    const tags: string[] = [];
    
    if (/(spor|sport|football|soccer|basket|nba|bein|s-sport|tivibu spor|eurosport|tenis|f1|formula 1)/.test(searchStr)) tags.push('Spor');
    if (/(haber|news|cnn|bbc|bloomberg|ntv|trthaber|a haber|haberturk|trt haber)/.test(searchStr)) tags.push('Haber');
    if (/(film|movie|cinema|sinema|hbo|netflix|disney|prime|action|comedy)/.test(searchStr)) tags.push('Film');
    if (/(çocuk|kid|cartoon|disney channel|nickelodeon|trt çocuk|minika|baby)/.test(searchStr)) tags.push('Çocuk');
    
    return tags;
  };

  useEffect(() => {
    const saved = localStorage.getItem('secure_iptv_recent_searches');
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleSearchSubmit = () => {
    if (searchTerm.trim().length > 1) {
      const updated = [searchTerm.trim(), ...recentSearches.filter(s => s !== searchTerm.trim())].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('secure_iptv_recent_searches', JSON.stringify(updated));
    }
  };

  useEffect(() => {
    const handleSettingsChange = () => setSettings(loadSettings());
    window.addEventListener('app-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('app-settings-changed', handleSettingsChange);
  }, []);

  const groups = useMemo(() => {
    const allGroups = new Set(channels.map(c => c.group));
    let validGroups = Array.from(allGroups).filter(g => !settings.hiddenCategories.includes(g));
    
    // Sort based on settings
    validGroups.sort((a, b) => {
      const idxA = settings.categoryOrder.indexOf(a);
      const idxB = settings.categoryOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return ['Hepsi', ...validGroups];
  }, [channels, settings]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const recommendedChannels = useMemo(() => {
    if (recentChannelIds.length === 0) return [];
    
    // Alışkanlık analizi: Son izlenen kanalların hangi gruplarda olduğuna bak
    const recentGroups = new Map<string, number>();
    channels.forEach(c => {
      if (recentChannelIds.includes(c.id) && c.group) {
        recentGroups.set(c.group, (recentGroups.get(c.group) || 0) + 1);
      }
    });

    // En çok izlenen ilk 3 grubu bul
    const topGroups = Array.from(recentGroups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);

    if (topGroups.length === 0) return [];

    // Bu gruplardaki ama henüz izlenmemiş veya favorilerde olmayan kanallardan seç
    return channels.filter(c => 
      topGroups.includes(c.group) && 
      !recentChannelIds.includes(c.id) &&
      !settings.hiddenCategories.includes(c.group)
    ).slice(0, 50); // En fazla 50 öneri
  }, [channels, recentChannelIds, settings]);

  const filteredChannels = useMemo(() => {
    let baseChannels = showRecommendedOnly ? recommendedChannels : channels;

    let result = baseChannels.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroup === 'Hepsi' || c.group === selectedGroup;
      const matchesFavorite = !showFavoritesOnly || c.isFavorite;
      const isRecent = recentChannelIds.includes(c.id);
      const matchesRecent = !showRecentsOnly || isRecent;
      const notHidden = !settings.hiddenCategories.includes(c.group);
      
      const smartTags = activeSmartTag ? getSmartTags(c.name, c.group) : [];
      const matchesSmartTag = activeSmartTag ? smartTags.includes(activeSmartTag) : true;

      return matchesSearch && matchesGroup && matchesFavorite && matchesRecent && notHidden && matchesSmartTag;
    });

    if (showRecentsOnly && sortType === 'default') {
      result.sort((a, b) => {
        const indexA = recentChannelIds.indexOf(a.id);
        const indexB = recentChannelIds.indexOf(b.id);
        return indexA - indexB;
      });
    } else if (sortType !== 'default') {
      result.sort((a, b) => {
        if (sortType === 'name-asc') return a.name.localeCompare(b.name);
        if (sortType === 'name-desc') return b.name.localeCompare(a.name);
        if (sortType === 'group') {
          const groupCmp = a.group.localeCompare(b.group);
          if (groupCmp !== 0) return groupCmp;
          return a.name.localeCompare(b.name);
        }
        if (sortType === 'quality') {
          const qA = getQualityRank(a.name);
          const qB = getQualityRank(b.name);
          if (qA !== qB) return qB - qA;
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
    }

    return result;
  }, [channels, recommendedChannels, searchTerm, selectedGroup, showFavoritesOnly, showRecentsOnly, showRecommendedOnly, recentChannelIds, sortType, settings]);

  const groupedFilteredChannels = useMemo(() => {
    const map = new Map<string, Channel[]>();
    filteredChannels.forEach(c => {
      const g = c.group || 'Diğer';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    });
    
    // Sort based on settings
    return Array.from(map.entries()).sort((a, b) => {
      const idxA = settings.categoryOrder.indexOf(a[0]);
      const idxB = settings.categoryOrder.indexOf(b[0]);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredChannels, settings]);

  const handleToggleTab = (tab: 'fav' | 'recents' | 'recommended') => {
    setShowFavoritesOnly(tab === 'fav' ? !showFavoritesOnly : false);
    setShowRecentsOnly(tab === 'recents' ? !showRecentsOnly : false);
    setShowRecommendedOnly(tab === 'recommended' ? !showRecommendedOnly : false);
  };

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Hızlı kanal ara..."
              value={searchTerm}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit();
              }}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-emerald-500)] transition-colors"
            />
            {isSearchFocused && recentSearches.length > 0 && !searchTerm && (
              <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden text-sm">
                <div className="px-3 py-2 text-[10px] uppercase text-slate-500 font-semibold bg-slate-950/50">Son Aramalar</div>
                {recentSearches.map((s, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center gap-2"
                    onClick={() => {
                      setSearchTerm(s);
                      setIsSearchFocused(false);
                    }}
                  >
                    <History className="w-3 h-3 text-slate-500" />
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={() => handleToggleTab('fav')}
            className={`p-2 rounded-lg border transition-colors ${
              showFavoritesOnly 
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-500' 
                : 'bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
            title="Sadece Favorileri Göster"
          >
            <Heart className={`w-5 h-5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
          </button>
          <button 
            onClick={() => handleToggleTab('recents')}
            className={`p-2 rounded-lg border transition-colors ${
              showRecentsOnly 
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-500' 
                : 'bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
            title="Son İzlenenler"
          >
            <History className="w-5 h-5" />
          </button>
          <button 
            onClick={() => handleToggleTab('recommended')}
            className={`p-2 rounded-lg border transition-colors ${
              showRecommendedOnly 
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' 
                : 'bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
            title="Senin İçin Önerilenler"
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode(viewMode === 'list' ? 'folder' : 'list')}
            className={`p-2 rounded-lg border transition-colors ${
              viewMode === 'folder'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500' 
                : 'bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
            title={viewMode === 'folder' ? 'Liste Görünümü' : 'Klasör Görünümü'}
          >
            {viewMode === 'folder' ? <ListIcon className="w-5 h-5" /> : <FolderTree className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select 
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 appearance-none"
              title="Kategori Filtresi"
            >
              {groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          
          <div className="relative flex-1">
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 appearance-none"
              title="Sıralama"
            >
              <option value="default">Varsayılan</option>
              <option value="name-asc">A-Z</option>
              <option value="name-desc">Z-A</option>
              <option value="group">Kategori</option>
              <option value="quality">Kalite (4K-HD)</option>
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <ArrowUpDown className="w-3 h-3" />
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {SMART_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveSmartTag(activeSmartTag === tag ? null : tag)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-semibold transition-colors border ${
                activeSmartTag === tag
                  ? 'bg-[var(--color-emerald-500)] text-white border-[var(--color-emerald-500)]'
                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChannels.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Kanal bulunamadı.
          </div>
        ) : viewMode === 'folder' ? (
          <div className="divide-y divide-slate-800">
            {groupedFilteredChannels.map(([groupName, groupChannels]) => {
              const isCollapsed = collapsedGroups.has(groupName);
              return (
                <div key={groupName} className="flex flex-col">
                  <div 
                    onClick={() => toggleGroup(groupName)}
                    className="flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-800 cursor-pointer sticky top-0 z-10 border-b border-slate-800/50"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      <span className="text-sm font-semibold text-slate-300">{groupName}</span>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full">{groupChannels.length}</span>
                  </div>
                  
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="divide-y divide-slate-800/50 overflow-hidden"
                      >
                        {groupChannels.map(channel => (
                          <div
                            key={channel.id}
                            onClick={() => onSelectChannel(channel)}
                            onMouseEnter={(e) => { setHoveredChannel(channel); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                            onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setHoveredChannel(null)}
                            className={`group flex items-center gap-3 p-3 pl-8 cursor-pointer transition-colors ${
                              activeChannelId === channel.id 
                                ? 'bg-slate-800 border-l-2 border-emerald-500' 
                                : 'hover:bg-slate-800/50 border-l-2 border-transparent'
                            }`}
                          >
                            <div className="w-8 h-8 rounded bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                              {channel.logo ? (
                                <img src={channel.logo} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                              ) : (
                                <Play className="w-3 h-3 text-slate-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-medium truncate ${
                                activeChannelId === channel.id ? 'text-[var(--color-emerald-400)]' : 'text-slate-200 group-hover:text-white'
                              }`}>
                                {channel.name}
                              </h3>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(channel.id);
                              }}
                              className={`p-1.5 rounded-full transition-all ${
                                channel.isFavorite 
                                  ? 'text-rose-500 hover:text-rose-400' 
                                  : 'text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100'
                              }`}
                              title={channel.isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                            >
                              <Heart className={`w-4 h-4 ${channel.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            <AnimatePresence initial={false}>
              {filteredChannels.map(channel => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  onMouseEnter={(e) => { setHoveredChannel(channel); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredChannel(null)}
                  className={`group flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                    activeChannelId === channel.id 
                      ? 'bg-slate-800 border-l-2 border-[var(--color-emerald-500)]' 
                      : 'hover:bg-slate-800/50 border-l-2 border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 rounded bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                    {channel.logo ? (
                      <img src={channel.logo} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                    ) : (
                      <Play className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate ${
                      activeChannelId === channel.id ? 'text-[var(--color-emerald-400)]' : 'text-slate-200 group-hover:text-white'
                    }`}>
                      {channel.name}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">{channel.group}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel.id);
                    }}
                    className={`p-1.5 rounded-full transition-all ${
                      channel.isFavorite 
                        ? 'text-rose-500 hover:text-rose-400' 
                        : 'text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100'
                    }`}
                    title={channel.isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                  >
                    <Heart className={`w-4 h-4 ${channel.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {hoveredChannel && (
        <div 
          className="fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-lg p-3 w-64 pointer-events-none"
          style={{ 
            left: hoverPos.x + 20, 
            top: hoverPos.y > window.innerHeight - 150 ? hoverPos.y - 120 : hoverPos.y + 20
          }}
        >
          <div className="flex gap-3 mb-2">
            <div className="w-12 h-12 bg-slate-950/50 rounded flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-800">
              {hoveredChannel.logo ? (
                <img src={hoveredChannel.logo} alt="" className="w-full h-full object-contain p-1" />
              ) : (
                <Play className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-200 truncate">{hoveredChannel.name}</h4>
              <p className="text-xs text-emerald-400 truncate">{hoveredChannel.group || 'Kategorisiz'}</p>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-950 p-2 rounded border border-slate-800 overflow-hidden text-ellipsis whitespace-nowrap">
            {hoveredChannel.url}
          </div>
        </div>
      )}
    </div>
  );
}
