import QRCode from 'qrcode';
import { encryptData, decryptData } from './security';
import { Playlist } from '../types';

export interface P2pPayload {
  version: number;
  timestamp: number;
  playlists: Playlist[];
  recents: string[];
}

/**
 * Creates an encrypted compact bundle for local device-to-device transfer.
 * Zero-cloud, directly encrypted with user password or local key.
 */
export function generateP2pBundle(playlists: Playlist[], recents: string[], passphrase?: string): string {
  // Strip heavy unnecessary data if needed, keep playlists and favorites
  const payload: P2pPayload = {
    version: 1,
    timestamp: Date.now(),
    playlists,
    recents
  };

  const json = JSON.stringify(payload);
  const encrypted = encryptData(json, passphrase);
  return encrypted;
}

/**
 * Parses and decrypts a received P2P bundle from TV or Phone
 */
export function parseP2pBundle(bundleString: string, passphrase?: string): P2pPayload | null {
  try {
    const decrypted = decryptData(bundleString.trim(), passphrase);
    if (!decrypted) return null;
    const data = JSON.parse(decrypted);
    if (data && Array.isArray(data.playlists)) {
      return data as P2pPayload;
    }
    return null;
  } catch (err) {
    console.error('P2P bundle decode error:', err);
    return null;
  }
}

/**
 * Generates a QR Code Data URL for instant mobile-to-TV or TV-to-mobile scanning
 */
export async function generateP2pQrCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR code generation failed:', err);
    throw err;
  }
}
