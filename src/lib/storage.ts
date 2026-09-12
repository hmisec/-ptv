import { Playlist, ErrorLog, AppSettings, EpgProgram } from '../types';
import { encryptData, decryptData } from './security';

const PLAYLISTS_KEY = 'secure_iptv_playlists';
const RECENTS_KEY = 'secure_iptv_recents';
const LOGS_KEY = 'secure_iptv_error_logs';
const SETTINGS_KEY = 'secure_iptv_settings';
const EPG_CACHE_KEY = 'secure_iptv_epg_cache';

export const defaultSettings: AppSettings = {
  dataSaver: false,
  categoryOrder: [],
  hiddenCategories: [],
  themeColor: '#10b981',
};

// --- EPG CACHE ---
interface EpgCacheItem {
  timestamp: number; // when it was fetched
  programs: EpgProgram[];
}
type EpgCacheData = Record<string, EpgCacheItem>;

export function saveEpgCache(streamId: string, programs: EpgProgram[]): void {
  const data = loadAllEpgCache();
  data[streamId] = {
    timestamp: Date.now(),
    programs
  };
  localStorage.setItem(EPG_CACHE_KEY, encryptData(JSON.stringify(data)));
}

export function getCachedEpg(streamId: string): EpgProgram[] | null {
  const data = loadAllEpgCache();
  const item = data[streamId];
  if (!item) return null;
  
  // Cache is valid for 4 hours
  if (Date.now() - item.timestamp > 4 * 60 * 60 * 1000) {
    return null; // Expired
  }
  return item.programs;
}

function loadAllEpgCache(): EpgCacheData {
  const encrypted = localStorage.getItem(EPG_CACHE_KEY);
  if (!encrypted) return {};
  const decrypted = decryptData(encrypted);
  if (!decrypted) return {};
  try {
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

export function cleanupEpgCache(): number {
  const data = loadAllEpgCache();
  const now = Date.now();
  let deletedCount = 0;
  
  const newData: EpgCacheData = {};
  for (const [streamId, item] of Object.entries(data)) {
    // Keep items fetched within the last 24 hours, and where programs haven't ended yet
    const hasValidPrograms = item.programs.some(p => p.stopTimestamp > now);
    const isFresh = now - item.timestamp < 24 * 60 * 60 * 1000;
    
    if (isFresh && hasValidPrograms) {
      newData[streamId] = {
        timestamp: item.timestamp,
        programs: item.programs.filter(p => p.stopTimestamp > now) // Only keep future/current programs
      };
    } else {
      deletedCount++;
    }
  }
  
  if (deletedCount > 0 || Object.keys(data).length !== Object.keys(newData).length) {
    localStorage.setItem(EPG_CACHE_KEY, encryptData(JSON.stringify(newData)));
  }
  
  return deletedCount;
}
// -----------------

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings(): AppSettings {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(data) };
  } catch {
    return defaultSettings;
  }
}

export function savePlaylists(playlists: Playlist[]): void {
  const json = JSON.stringify(playlists);
  const encrypted = encryptData(json);
  localStorage.setItem(PLAYLISTS_KEY, encrypted);
}

export function loadPlaylists(): Playlist[] {
  const encrypted = localStorage.getItem(PLAYLISTS_KEY);
  if (!encrypted) return [];
  
  const decrypted = decryptData(encrypted);
  if (!decrypted) return [];
  
  try {
    return JSON.parse(decrypted) as Playlist[];
  } catch (e) {
    console.error('Oynatma listesi ayrıştırma hatası');
    return [];
  }
}

export function saveRecents(ids: string[]): void {
  const json = JSON.stringify(ids);
  const encrypted = encryptData(json);
  localStorage.setItem(RECENTS_KEY, encrypted);
}

export function loadRecents(): string[] {
  const encrypted = localStorage.getItem(RECENTS_KEY);
  if (!encrypted) return [];
  
  const decrypted = decryptData(encrypted);
  if (!decrypted) return [];
  
  try {
    return JSON.parse(decrypted) as string[];
  } catch (e) {
    return [];
  }
}

export function exportBackup(password?: string): void {
  const playlists = loadPlaylists();
  const recents = loadRecents();
  
  const backupData = JSON.stringify({ playlists, recents });
  const encryptedBackup = encryptData(backupData, password);
  
  const blob = new Blob([encryptedBackup], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `iptv_backup_${new Date().toISOString().slice(0, 10)}.secureiptv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function saveLogs(logs: ErrorLog[]): void {
  const limited = logs.slice(0, 200); // En fazla 200 log tut
  const json = JSON.stringify(limited);
  const encrypted = encryptData(json);
  localStorage.setItem(LOGS_KEY, encrypted);
}

export function loadLogs(): ErrorLog[] {
  const encrypted = localStorage.getItem(LOGS_KEY);
  if (!encrypted) return [];
  
  const decrypted = decryptData(encrypted);
  if (!decrypted) return [];
  
  try {
    return JSON.parse(decrypted) as ErrorLog[];
  } catch (e) {
    return [];
  }
}

export function addLog(type: string, details: string, channelName?: string): void {
  const logs = loadLogs();
  logs.unshift({
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    type,
    details,
    channelName
  });
  saveLogs(logs);
}
