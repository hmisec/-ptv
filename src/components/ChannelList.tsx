import React, { useState, useMemo } from 'react';
import { Channel } from '../types';
import { Search, Play } from 'lucide-react';

interface ChannelListProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  activeChannelId: string | null;
}

export function ChannelList({ channels, onSelectChannel, activeChannelId }: ChannelListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('Hepsi');

  const groups = useMemo(() => {
    const allGroups = new Set(channels.map(c => c.group));
    return ['Hepsi', ...Array.from(allGroups)].sort();
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroup === 'Hepsi' || c.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [channels, searchTerm, selectedGroup]);

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Kanal ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        
        <select 
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 appearance-none"
        >
          {groups.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChannels.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Kanal bulunamadı.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredChannels.map(channel => (
              <div
                key={channel.id}
                onClick={() => onSelectChannel(channel)}
                className={`group flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                  activeChannelId === channel.id 
                    ? 'bg-slate-800 border-l-2 border-emerald-500' 
                    : 'hover:bg-slate-800/50 border-l-2 border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {channel.logo ? (
                    <img src={channel.logo} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                  ) : (
                    <Play className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-medium truncate ${
                    activeChannelId === channel.id ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'
                  }`}>
                    {channel.name}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">{channel.group}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
