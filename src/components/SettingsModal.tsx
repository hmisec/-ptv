import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Moon, Sun, Download, Upload, Shield, Terminal, Battery, GripVertical, 
  Eye, EyeOff, Palette, Globe, KeyRound, Fingerprint, Tv, Zap, HardDrive, 
  Trash2, RefreshCw, Check, AlertCircle, Radio
} from 'lucide-react';
import { exportBackup, importBackup, loadSettings, saveSettings, cleanupEpgCache } from '../lib/storage';
import { ErrorLogsModal } from './ErrorLogsModal';
import { Playlist, AppSettings, DohProvider, UserAgentProfile, ThemeMode } from '../types';
import { resolveDoH, DOH_ENDPOINTS } from '../lib/doh';
import { hashPin, isBiometricsAvailable, registerBiometrics, wipeAllAppData } from '../lib/security';

interface SettingsModalProps {
  onClose: () => void;
  playlists: Playlist[];
  onOpenP2pSync?: () => void;
}

type TabType = 'general' | 'privacy' | 'security' | 'engine' | 'backup';

export function SettingsModal({ onClose, playlists, onOpenP2pSync }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('privacy');
  const [showLogs, setShowLogs] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [cleanupMessage, setCleanupMessage] = useState('');
  
  // Backup password
  const [backupPass, setBackupPass] = useState('');
  const [importPass, setImportPass] = useState('');
  const [importStatus, setImportStatus] = useState<{ text: string; isError: boolean } | null>(null);

  // Security / PIN
  const [newPin, setNewPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinMessage, setPinMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);

  // DoH Test
  const [dohTestHost, setDohTestHost] = useState('cloudflare.com');
  const [dohTestResult, setDohTestResult] = useState<any>(null);
  const [isTestingDoh, setIsTestingDoh] = useState(false);

  // Wipe confirm
  const [showWipeModal, setShowWipeModal] = useState(false);

  // Category ordering
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    playlists.forEach(pl => {
      pl.channels.forEach(c => {
        if (c.group) cats.add(c.group);
      });
    });
    return Array.from(cats);
  }, [playlists]);

  const [orderedCats, setOrderedCats] = useState<string[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    isBiometricsAvailable().then(setBiometricSupported);

    const initialOrder = settings.categoryOrder.length > 0 ? settings.categoryOrder : allCategories;
    const missing = allCategories.filter(c => !initialOrder.includes(c));
    setOrderedCats([...initialOrder.filter(c => allCategories.includes(c)), ...missing]);
  }, [allCategories]);

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    
    // Apply Theme to html element
    document.documentElement.classList.remove('light-mode', 'oled-mode');
    if (newSettings.theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else if (newSettings.theme === 'oled') {
      document.documentElement.classList.add('oled-mode');
    }

    if (newSettings.leanbackMode) {
      document.body.classList.add('leanback-active');
    } else {
      document.body.classList.remove('leanback-active');
    }

    window.dispatchEvent(new Event('app-settings-changed'));
  };

  const handleExport = () => {
    exportBackup(backupPass || undefined);
    alert('Şifrelenmiş yedek dosyası (.secureiptv) indirildi!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importBackup(content, importPass || undefined);
      if (res.success) {
        setImportStatus({ text: res.message, isError: false });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setImportStatus({ text: res.message, isError: true });
      }
    };
    reader.readAsText(file);
  };

  const handleSetPin = () => {
    if (newPin.length < 4) {
      setPinMessage({ text: 'PIN kodu en az 4 haneli olmalıdır.', isError: true });
      return;
    }
    if (newPin !== pinConfirm) {
      setPinMessage({ text: 'PIN kodları eşleşmiyor!', isError: true });
      return;
    }

    const hashed = hashPin(newPin);
    updateSettings({
      ...settings,
      pinProtection: true,
      pinCode: hashed
    });
    setNewPin('');
    setPinConfirm('');
    setPinMessage({ text: 'PIN koruması başarıyla etkinleştirildi!', isError: false });
    setTimeout(() => setPinMessage(null), 3000);
  };

  const handleRemovePin = () => {
    updateSettings({
      ...settings,
      pinProtection: false,
      pinCode: undefined,
      biometricAuth: false
    });
    setPinMessage({ text: 'PIN koruması kaldırıldı.', isError: false });
    setTimeout(() => setPinMessage(null), 3000);
  };

  const handleEnableBiometric = async () => {
    const success = await registerBiometrics();
    if (success) {
      updateSettings({ ...settings, biometricAuth: true });
      alert('Biyometrik kilit başarıyla bağlandı!');
    } else {
      alert('Biyometrik kimlik doğrulayıcı kaydedilemedi veya iptal edildi.');
    }
  };

  const handleTestDoH = async () => {
    setIsTestingDoh(true);
    setDohTestResult(null);
    const res = await resolveDoH(dohTestHost, settings.dohProvider, settings.dohCustomUrl);
    setDohTestResult(res);
    setIsTestingDoh(false);
  };

  const handlePanicWipe = async () => {
    await wipeAllAppData();
    window.location.reload();
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const items = [...orderedCats];
    const draggedItem = items[draggedIdx];
    items.splice(draggedIdx, 1);
    items.splice(index, 0, draggedItem);
    setDraggedIdx(index);
    setOrderedCats(items);
  };

  const onDragEnd = () => {
    setDraggedIdx(null);
    updateSettings({ ...settings, categoryOrder: orderedCats });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Güvenlik, Gizlilik & Ayarlar</h2>
              <p className="text-[11px] text-slate-500">Sıfır Telemetri & Yerel AES-256 Şifreli Mimari</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 overflow-x-auto px-3 pt-2 gap-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'privacy' 
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Gizlilik & DoH
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'security' 
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> Kilit & Biyometri
          </button>
          <button
            onClick={() => setActiveTab('engine')}
            className={`px-3 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'engine' 
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" /> User-Agent & RAM
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'general' 
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" /> TV & Görünüm
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'backup' 
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" /> Yedekleme & P2P
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* TAB 1: PRIVACY & DOH */}
          {activeTab === 'privacy' && (
            <div className="space-y-5">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-emerald-300">Sıfır İz & Doğrudan İletişim (No-Proxy)</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    IPTV sunucusuyla iletişim aracı bir proxy veya kayıt tutucu sunucu olmadan doğrudan gerçekleşir. 
                    İzleyici (telemetri), Firebase Analytics veya analitik betiği bulunmaz.
                  </p>
                </div>
              </div>

              {/* DoH Ayarı */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-400" /> DNS Over HTTPS (DoH) Çözücüsü
                    </h3>
                    <p className="text-xs text-slate-500">
                      İnternet Servis Sağlayıcınızın (İSS) DNS üzerinden IPTV akışlarını tespit etmesini ve engellemesini önler.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {(['cloudflare', 'quad9', 'google'] as const).map((prov) => (
                    <div
                      key={prov}
                      onClick={() => updateSettings({ ...settings, dohProvider: prov })}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        settings.dohProvider === prov 
                          ? 'bg-emerald-500/15 border-emerald-500 text-white' 
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs capitalize">{prov}</span>
                        {settings.dohProvider === prov && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {DOH_ENDPOINTS[prov].privacyPolicy}
                      </p>
                    </div>
                  ))}
                </div>

                {/* DoH Test & Leak Tool */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 mt-3">
                  <span className="text-xs font-medium text-slate-300">DoH Çözümleme & Sızıntı Test Aracı</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="IPTV Alan Adı veya Host (örn. iptv-server.com)"
                      value={dohTestHost}
                      onChange={(e) => setDohTestHost(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleTestDoH}
                      disabled={isTestingDoh}
                      className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {isTestingDoh ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Çözümle'}
                    </button>
                  </div>

                  {dohTestResult && (
                    <div className={`p-2.5 rounded-lg text-xs font-mono mt-2 ${
                      dohTestResult.success ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50' : 'bg-rose-950/40 text-rose-300 border border-rose-800/50'
                    }`}>
                      <div className="flex justify-between items-center mb-1 font-sans">
                        <span className="font-semibold">{dohTestResult.providerUsed}</span>
                        <span className="text-[10px] opacity-75">{dohTestResult.latencyMs} ms</span>
                      </div>
                      {dohTestResult.success ? (
                        <div>IP Adresleri: {dohTestResult.ips.join(', ')} (Şifreli DoH ile İSS atlandı)</div>
                      ) : (
                        <div>Hata: {dohTestResult.error}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Acil Durum / Veri Silme */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2 mb-1">
                  <Trash2 className="w-4 h-4" /> Sıfır Bilgi / Acil Durum Temizliği (Panic Button)
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Cihazınızdaki tüm listeleri, oturumları, önbellekleri ve şifrelenmiş anahtarları anında kalıcı olarak siler.
                </p>
                <button
                  onClick={() => setShowWipeModal(true)}
                  className="w-full bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/60 text-rose-300 py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Tüm Cihaz Verilerini Kalıcı Olarak Sil (Wipe)
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY & PIN */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-emerald-400" /> Biyometrik Kilit & PIN Koruması
                </h3>
                <p className="text-xs text-slate-500">
                  Uygulama açılışına veya gizli / yetişkin kategorilere erişim için PIN ve biyometri (FaceID / TouchID / Parmak İzi).
                </p>
              </div>

              {/* PIN Durumu */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-200">Uygulama Kilidi</p>
                    <p className="text-[11px] text-slate-500">
                      {settings.pinProtection ? 'PIN koruması aktif' : 'PIN koruması kapalı'}
                    </p>
                  </div>
                  {settings.pinProtection ? (
                    <button
                      onClick={handleRemovePin}
                      className="px-3 py-1 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 rounded-lg text-xs transition-colors"
                    >
                      PIN Kaldır
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">Kapalı</span>
                  )}
                </div>

                {!settings.pinProtection ? (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <p className="text-xs text-slate-400">Yeni 4-6 Haneli PIN Belirleyin:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="PIN Kodu"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white text-center tracking-widest focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="PIN Tekrar"
                        value={pinConfirm}
                        onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white text-center tracking-widest focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      onClick={handleSetPin}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-xs transition-colors"
                    >
                      PIN Kodunu Kaydet ve Etkinleştir
                    </button>
                  </div>
                ) : null}

                {pinMessage && (
                  <p className={`text-xs ${pinMessage.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {pinMessage.text}
                  </p>
                )}
              </div>

              {/* Biyometri WebAuthn */}
              {biometricSupported && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Fingerprint className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-medium text-slate-200">Biyometrik Kimlik Doğrulama</p>
                      <p className="text-[11px] text-slate-500">Cihazın Parmak İzi, FaceID veya Windows Hello kilidini kullanın.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleEnableBiometric}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      settings.biometricAuth 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {settings.biometricAuth ? 'Aktif' : 'Etkinleştir'}
                  </button>
                </div>
              )}

              {/* +18 / Yetişkin İçerik Kilidi */}
              <div 
                onClick={() => updateSettings({ ...settings, adultLock: !settings.adultLock })}
                className={`p-4 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                  settings.adultLock ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div>
                  <p className={`text-xs font-medium ${settings.adultLock ? 'text-emerald-300' : 'text-slate-300'}`}>
                    Otomatik Yetişkin (+18) İçerik Kilidi
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Yetişkin, +18 veya özel etiketli yayın kategorilerini şifreli kilit arkasına alır.
                  </p>
                </div>
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${settings.adultLock ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.adultLock ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USER-AGENT & RAM ENGINE */}
          {activeTab === 'engine' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
                  <Radio className="w-4 h-4 text-emerald-400" /> Dinamik User-Agent Maskeleme
                </h3>
                <p className="text-xs text-slate-500">
                  IPTV sağlayıcısının veya ağ izleyicilerinin cihaz tipinizi/tarayıcınızı tespit etmesini önler.
                </p>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'default', label: 'Varsayılan Sistem', desc: 'Standart tarayıcı kimliği' },
                  { id: 'vlc', label: 'VLC Media Player 3.0', desc: 'VLC/3.0.18 LibVLC/3.0.18 (Evrensel IPTV kimliği)' },
                  { id: 'smarttv_lg', label: 'LG Smart TV (webOS)', desc: 'Mozilla/5.0 (Web0S; SmartTV) Large Screen' },
                  { id: 'smarttv_samsung', label: 'Samsung Tizen Smart TV', desc: 'SamsungTV / Tizen 6.0 Media Center' },
                  { id: 'exoplayer', label: 'ExoPlayer / Media3 (Android TV)', desc: 'ExoPlayerLib/2.19.1 (Linux; Android TV)' },
                  { id: 'appletv', label: 'Apple TV / AVPlayer', desc: 'AppleCoreMedia/1.0.0.20K' },
                  { id: 'custom', label: 'Özel (Manuel Giriş)', desc: 'İstediğiniz User-Agent dizesini girin' }
                ].map((ua) => (
                  <div
                    key={ua.id}
                    onClick={() => updateSettings({ ...settings, userAgentProfile: ua.id as UserAgentProfile })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      settings.userAgentProfile === ua.id 
                        ? 'bg-emerald-500/15 border-emerald-500 text-white' 
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-slate-200">{ua.label}</span>
                      <p className="text-[11px] text-slate-500">{ua.desc}</p>
                    </div>
                    {settings.userAgentProfile === ua.id && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                ))}

                {settings.userAgentProfile === 'custom' && (
                  <input
                    type="text"
                    placeholder="Özel User-Agent (örn. VLC/3.0.18)"
                    value={settings.customUserAgent || ''}
                    onChange={(e) => updateSettings({ ...settings, customUserAgent: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              {/* RAM Buffer Boyutu */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" /> RAM Üzerinde Çalışan Arabellek (Sıfır Disk I/O)
                </h4>
                <p className="text-xs text-slate-500">
                  Yayınlar doğrudan belleğe alınır, diske geçici dosya bırakılmaz. RAM tampon boyutunu seçin:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[30, 60, 120].map(size => (
                    <button
                      key={size}
                      onClick={() => updateSettings({ ...settings, ramBufferSizeMb: size })}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        settings.ramBufferSizeMb === size
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {size} MB RAM
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GENERAL & TV LEANBACK */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              {/* Tema Seçimi */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Tema & Görünüm</h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updateSettings({ ...settings, theme: 'dark' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      settings.theme === 'dark' ? 'bg-slate-800 text-white border-slate-600 shadow' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" /> Karanlık
                  </button>
                  <button
                    onClick={() => updateSettings({ ...settings, theme: 'oled' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      settings.theme === 'oled' ? 'bg-black text-emerald-400 border-emerald-500/50 shadow' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-emerald-400" /> OLED Siyah (#000)
                  </button>
                  <button
                    onClick={() => updateSettings({ ...settings, theme: 'light' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      settings.theme === 'light' ? 'bg-slate-800 text-white border-slate-600 shadow' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" /> Aydınlık
                  </button>
                </div>
              </div>

              {/* Leanback TV Kumanda Modu */}
              <div 
                onClick={() => updateSettings({ ...settings, leanbackMode: !settings.leanbackMode })}
                className={`p-4 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                  settings.leanbackMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div>
                  <p className={`text-xs font-semibold flex items-center gap-1.5 ${settings.leanbackMode ? 'text-emerald-300' : 'text-slate-200'}`}>
                    <Tv className="w-4 h-4" /> Leanback TV / Kumanda D-Pad Modu
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Android TV / Fire TV kumandası veya klavye ok tuşları ile tam odak navigasyonu sağlar.
                  </p>
                </div>
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${settings.leanbackMode ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.leanbackMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Kanal Önizleme (Zap Mode) */}
              <div 
                onClick={() => updateSettings({ ...settings, zapMode: !settings.zapMode })}
                className={`p-4 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                  settings.zapMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div>
                  <p className={`text-xs font-semibold flex items-center gap-1.5 ${settings.zapMode ? 'text-emerald-300' : 'text-slate-200'}`}>
                    <Zap className="w-4 h-4" /> Kanal Önizleme (Zap Mode)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Kanal listesinde gezinirken mevcut yayını kesmeden arka planda mini önizleme penceresi açar.
                  </p>
                </div>
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${settings.zapMode ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.zapMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Kategori Yönetimi */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <GripVertical className="w-4 h-4" /> Kategorileri Sırala & Gizle
                </h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-800/40">
                  {orderedCats.length === 0 ? (
                    <p className="text-xs text-slate-500 p-4 text-center">Önce bir liste ekleyin.</p>
                  ) : (
                    orderedCats.map((cat, index) => {
                      const isHidden = settings.hiddenCategories.includes(cat);
                      return (
                        <div 
                          key={cat}
                          draggable
                          onDragStart={(e) => onDragStart(e, index)}
                          onDragOver={(e) => onDragOver(e, index)}
                          onDragEnd={onDragEnd}
                          className="flex items-center justify-between p-2 hover:bg-slate-900 cursor-move text-xs"
                        >
                          <div className="flex items-center gap-2 text-slate-300">
                            <GripVertical className="w-3.5 h-3.5 text-slate-600" />
                            <span className={isHidden ? 'line-through text-slate-500' : ''}>{cat}</span>
                          </div>
                          <button 
                            onClick={() => {
                              const hidden = new Set(settings.hiddenCategories);
                              if (hidden.has(cat)) hidden.delete(cat);
                              else hidden.add(cat);
                              updateSettings({ ...settings, hiddenCategories: Array.from(hidden) });
                            }}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BACKUP & P2P SYNC */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              {/* P2P Wi-Fi Sync */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300">P2P Cihazlar Arası Senkronizasyon (Wi-Fi)</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Telefon ve TV arasında bulut sunucusu olmadan favorileri ve listeleri QR kod veya eşleme koduyla aktarın.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenP2pSync) onOpenP2pSync();
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  >
                    P2P Aktarımı Başlat
                  </button>
                </div>
              </div>

              {/* Dışa Aktar */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-400" /> AES-256 Şifreli Yedek İndir
                </h4>
                <input 
                  type="password"
                  placeholder="Yedekleme Parolası (İsteğe Bağlı)"
                  value={backupPass}
                  onChange={(e) => setBackupPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button 
                  onClick={handleExport}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Şifreli Yedeği İndir (.secureiptv)
                </button>
              </div>

              {/* İçe Aktar */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-emerald-400" /> Şifreli Yedek Yükle
                </h4>
                <input 
                  type="password"
                  placeholder="Yedek Parolası (Varsa)"
                  value={importPass}
                  onChange={(e) => setImportPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <label className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Dosya Seç ve İçe Aktar (.secureiptv / .json)
                  <input type="file" accept=".secureiptv,.json,.txt" onChange={handleImportFile} className="hidden" />
                </label>
                {importStatus && (
                  <p className={`text-xs ${importStatus.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {importStatus.text}
                  </p>
                )}
              </div>

              {/* Hata Günlükleri */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-300">Yerel Hata Raporları</h4>
                  <p className="text-[11px] text-slate-500">Sunucuya gönderilmeyen yerel loglar.</p>
                </div>
                <button 
                  onClick={() => setShowLogs(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" /> Günlükleri Aç
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panic wipe confirmation modal */}
      {showWipeModal && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800 rounded-2xl p-6 max-w-sm text-center shadow-2xl">
            <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Cihazdaki Tüm Verileri Kalıcı Sil?</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Bu işlem geri alınamaz. Cihazınızdaki tüm oynatma listeleri, şifrelenmiş anahtarlar, geçmiş ve ayarlar temizlenecektir.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePanicWipe}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 rounded-xl text-xs transition-colors"
              >
                Evet, Kalıcı Olarak Sil
              </button>
              <button
                onClick={() => setShowWipeModal(false)}
                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogs && <ErrorLogsModal onClose={() => setShowLogs(false)} />}
    </div>
  );
}
