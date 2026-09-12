import { Playlist } from '../types';
import { encryptData, decryptData } from './security';

const PLAYLISTS_KEY = 'secure_iptv_playlists';

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
