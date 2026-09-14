import CryptoJS from 'crypto-js';

// Güvenli yerel şifreleme anahtarı (cihaza özgü)
// Normalde bu anahtar sunucudan veya kullanıcıdan alınır, ancak
// tamamen yerel ve bağımsız bir mimari için tarayıcıya özgü rastgele 
// bir anahtar oluşturup sadece session'da veya local'de tutabiliriz.
// Güvenliği artırmak için sabit bir string yerine uygulamanın ilk açılışında oluşturulan
// bir anahtar kullanacağız.

const ENCRYPTION_KEY_ID = 'secure_iptv_encryption_key';

function getEncryptionKey(): string {
  let key = localStorage.getItem(ENCRYPTION_KEY_ID);
  if (!key) {
    // 256-bit rastgele anahtar oluştur
    key = CryptoJS.lib.WordArray.random(256 / 8).toString();
    localStorage.setItem(ENCRYPTION_KEY_ID, key);
  }
  return key;
}

export function encryptData(data: string, customKey?: string): string {
  const key = customKey || getEncryptionKey();
  return CryptoJS.AES.encrypt(data, key).toString();
}

export function decryptData(encryptedData: string, customKey?: string): string | null {
  try {
    const key = customKey || getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch (error) {
    console.error('Veri çözme hatası, veri bozuk veya yetkisiz erişim.', error);
    return null;
  }
}

// PIN Hashing using SHA-256 with device-bound salt
export function hashPin(pin: string): string {
  const salt = getEncryptionKey().slice(0, 16);
  return CryptoJS.SHA256(`${salt}:${pin}`).toString();
}

export function verifyPin(enteredPin: string, storedHash: string): boolean {
  if (!storedHash) return false;
  const hash = hashPin(enteredPin);
  return hash === storedHash;
}

// Check if device supports Biometrics (WebAuthn Platform Authenticator: TouchID, FaceID, Windows Hello, Android Biometrics)
export async function isBiometricsAvailable(): Promise<boolean> {
  if (window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

// Request Biometric authentication using WebAuthn credential assertion
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Prompt user with hardware platform authenticator
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname || 'localhost',
      }
    });
    return !!credential;
  } catch (err: any) {
    // If not registered or user cancels, return false
    console.warn('Biometric auth prompt failed or was cancelled:', err);
    return false;
  }
}

// Register WebAuthn platform credential for the device
export async function registerBiometrics(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const challenge = new Uint8Array(32);
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(challenge);
    window.crypto.getRandomValues(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Güvenli IPTV Zero-Knowledge', id: window.location.hostname || 'localhost' },
        user: {
          id: userId,
          name: 'iptv-user',
          displayName: 'IPTV Kullanıcısı'
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000
      }
    });
    return !!credential;
  } catch (err) {
    console.warn('Biometric registration error:', err);
    return false;
  }
}

// Adult (+18) content detector for automated lock
export function isAdultContent(channelName: string, groupName: string): boolean {
  const combined = `${channelName} ${groupName}`.toLowerCase();
  const adultPatterns = [
    'xxx', 'adult', '+18', '18+', 'porn', 'erotic', 'erotik', 'playboy',
    'redlight', 'penthouse', 'brazzers', 'hustler', 'babes', 'yetişkin',
    'yetiskin', 'for adults', 'cinsellik'
  ];
  return adultPatterns.some(pattern => combined.includes(pattern));
}

// Sıfır İz / Acil Durum: Cihazdaki tüm verileri kalıcı ve geri dönülemez olarak sil
export async function wipeAllAppData(): Promise<void> {
  try {
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Clear indexedDB databases if any
    if (window.indexedDB && window.indexedDB.databases) {
      const dbs = await window.indexedDB.databases();
      dbs.forEach(db => {
        if (db.name) window.indexedDB.deleteDatabase(db.name);
      });
    }
  } catch (e) {
    console.error('Veri temizleme hatası:', e);
  }
}
