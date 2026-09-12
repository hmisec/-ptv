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

export function encryptData(data: string): string {
  const key = getEncryptionKey();
  return CryptoJS.AES.encrypt(data, key).toString();
}

export function decryptData(encryptedData: string): string | null {
  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch (error) {
    console.error('Veri çözme hatası, veri bozuk veya yetkisiz erişim.', error);
    return null;
  }
}
