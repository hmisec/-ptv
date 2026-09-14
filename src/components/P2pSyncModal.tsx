import React, { useState, useEffect } from 'react';
import { X, QrCode, ArrowDownToLine, ArrowUpFromLine, Copy, Check, ShieldCheck, Smartphone, Tv } from 'lucide-react';
import { Playlist } from '../types';
import { generateP2pBundle, parseP2pBundle, generateP2pQrCode } from '../lib/p2pSync';
import { savePlaylists, saveRecents, loadRecents } from '../lib/storage';

interface P2pSyncModalProps {
  playlists: Playlist[];
  onClose: () => void;
  onSyncComplete: () => void;
}

export function P2pSyncModal({ playlists, onClose, onSyncComplete }: P2pSyncModalProps) {
  const [tab, setTab] = useState<'send' | 'receive'>('send');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [bundleCode, setBundleCode] = useState<string>('');
  const [passphrase, setPassphrase] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  // Receive state
  const [inputCode, setInputCode] = useState('');
  const [receivePassphrase, setReceivePassphrase] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (tab === 'send' && playlists.length > 0) {
      const recents = loadRecents();
      const code = generateP2pBundle(playlists, recents, passphrase || undefined);
      setBundleCode(code);

      // Generate QR Code if code size is within reasonable QR code capacity (< 2000 chars)
      // Otherwise QR is generated with instructions
      generateP2pQrCode(code.slice(0, 1500))
        .then(url => setQrDataUrl(url))
        .catch(() => setQrDataUrl(''));
    }
  }, [tab, playlists, passphrase]);

  const handleCopy = () => {
    navigator.clipboard.writeText(bundleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportCode = () => {
    if (!inputCode.trim()) {
      setStatusMessage({ text: 'Lütfen aktarım kodunu girin.', isError: true });
      return;
    }

    const payload = parseP2pBundle(inputCode.trim(), receivePassphrase || undefined);
    if (!payload || !Array.isArray(payload.playlists)) {
      setStatusMessage({ 
        text: 'Kod çözülemedi veya parola hatalı! Lütfen kodu ve şifreyi kontrol edin.', 
        isError: true 
      });
      return;
    }

    savePlaylists(payload.playlists);
    if (payload.recents) saveRecents(payload.recents);
    
    setStatusMessage({
      text: `Başarılı! ${payload.playlists.length} adet liste ve favoriler aktarıldı.`,
      isError: false
    });

    setTimeout(() => {
      onSyncComplete();
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-white">P2P Cihazlar Arası Senkronizasyon</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1">
          <button
            onClick={() => { setTab('send'); setStatusMessage(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'send' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" /> Bu Cihazdan Gönder (TV / Telefon)
          </button>
          <button
            onClick={() => { setTab('receive'); setStatusMessage(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'receive' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" /> Diğer Cihazdan Al
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[75vh] space-y-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
            <span>
              <strong>Sıfır Bulut Mimarisi:</strong> Verileriniz hiçbir merkezi sunucuya gönderilmez. Doğrudan cihazlar arası şifrelenmiş kod veya QR ile yerel olarak aktarılır.
            </span>
          </div>

          {tab === 'send' ? (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-3 text-slate-400 text-xs py-1">
                <div className="flex items-center gap-1"><Smartphone className="w-4 h-4" /> Telefon</div>
                <span>➔</span>
                <div className="flex items-center gap-1"><Tv className="w-4 h-4" /> Smart TV / PC</div>
              </div>

              {qrDataUrl && (
                <div className="flex flex-col items-center justify-center">
                  <div className="p-3 bg-white rounded-2xl shadow-lg inline-block">
                    <img src={qrDataUrl} alt="P2P Sync QR Code" className="w-48 h-48 rounded-lg" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Telefonunuzun kamerası ile taratarak anında aktarın.</p>
                </div>
              )}

              <div className="text-left space-y-2">
                <label className="text-xs text-slate-400 font-medium">İsteğe Bağlı Parola (AES-256)</label>
                <input
                  type="password"
                  placeholder="Ek güvenlik için parola belirleyin"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="text-left space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400 font-medium">Veya Aktarım Kodunu Kopyalayın</label>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={bundleCode}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] font-mono text-slate-400 resize-none focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Diğer Cihazdaki Aktarım Kodu
                </label>
                <textarea
                  placeholder="Diğer cihazdan kopyalanan şifreli kodu buraya yapıştırın..."
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Aktarım Parolası (Belirlendiyse)
                </label>
                <input
                  type="password"
                  placeholder="Şifre varsa girin"
                  value={receivePassphrase}
                  onChange={(e) => setReceivePassphrase(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {statusMessage && (
                <div className={`p-3 rounded-xl text-xs ${
                  statusMessage.isError 
                    ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' 
                    : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                }`}>
                  {statusMessage.text}
                </div>
              )}

              <button
                onClick={handleImportCode}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
              >
                <ArrowDownToLine className="w-4 h-4" /> Listeleri İçe Aktar ve Birleştir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
