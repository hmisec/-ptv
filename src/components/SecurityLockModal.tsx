import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, Fingerprint, KeyRound, AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';
import { verifyPin, authenticateWithBiometrics, isBiometricsAvailable, wipeAllAppData } from '../lib/security';
import { loadSettings } from '../lib/storage';

interface SecurityLockModalProps {
  title?: string;
  description?: string;
  storedPinHash?: string;
  allowBiometric?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
  isAppLock?: boolean;
}

export function SecurityLockModal({
  title = 'Güvenlik Kilidi',
  description = 'Devam etmek için lütfen PIN kodunuzu girin veya biyometrik doğrulama yapın.',
  storedPinHash,
  allowBiometric = true,
  onSuccess,
  onCancel,
  isAppLock = false
}: SecurityLockModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  const currentSettings = loadSettings();
  const effectivePinHash = storedPinHash || currentSettings.pinHash || currentSettings.pinCode || '';

  useEffect(() => {
    isBiometricsAvailable().then(avail => {
      setHasBiometric(avail);
      if (avail && allowBiometric) {
        // Auto trigger biometric prompt
        handleBiometricAuth();
      }
    });
  }, []);

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    const success = await authenticateWithBiometrics();
    setIsAuthenticating(false);
    if (success) {
      onSuccess();
    }
  };

  const handleKeyClick = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length >= 4) {
        if (!effectivePinHash || verifyPin(nextPin, effectivePinHash)) {
          onSuccess();
        } else if (nextPin.length === 6) {
          // Trigger error shake
          setError(true);
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) {
      handleKeyClick(e.key);
    } else if (e.key === 'Backspace') {
      handleDelete();
    } else if (e.key === 'Escape' && onCancel && !isAppLock) {
      onCancel();
    }
  };

  const handlePanicWipe = async () => {
    await wipeAllAppData();
    window.location.reload();
  };

  return (
    <div 
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 outline-none"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center text-center shadow-2xl text-white"
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400">
          <Lock className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold mb-1 tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400 mb-6 max-w-xs">{description}</p>

        {/* PIN Indicators */}
        <div className={`flex items-center gap-3 mb-6 ${error ? 'animate-bounce text-red-500' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border transition-all ${
                pin.length > i 
                  ? error ? 'bg-red-500 border-red-500' : 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/50'
                  : 'bg-slate-800 border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-400 mb-4 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Hatalı PIN Kodu
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full mb-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyClick(num)}
              className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 text-lg font-semibold text-white active:scale-95 transition-all"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={!hasBiometric || isAuthenticating}
            onClick={handleBiometricAuth}
            className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 flex items-center justify-center text-emerald-400 active:scale-95 transition-all disabled:opacity-30"
            title="Parmak İzi / FaceID"
          >
            <Fingerprint className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={() => handleKeyClick('0')}
            className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 text-lg font-semibold text-white active:scale-95 transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all"
          >
            ←
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between w-full pt-2 border-t border-slate-800 text-xs">
          {onCancel && !isAppLock ? (
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-white py-1 transition-colors"
            >
              İptal
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">Cihaz Koruması Aktif</span>
          )}

          <button
            type="button"
            onClick={() => setShowWipeConfirm(true)}
            className="text-rose-400 hover:text-rose-300 py-1 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> PIN Unuttum (Sıfırla)
          </button>
        </div>

        {showWipeConfirm && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-left text-xs">
            <p className="text-red-300 font-semibold mb-1 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              Tüm Veriler Silinecek!
            </p>
            <p className="text-slate-400 mb-3 text-[11px]">
              Sıfır veri toplama mimarisi nedeniyle PIN kurtarma sunucusu yoktur. Cihazdaki tüm listeler ve ayarlar kalıcı olarak temizlenecektir.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePanicWipe}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-1.5 rounded-lg text-xs transition-colors"
              >
                Onayla ve Sıfırla
              </button>
              <button
                type="button"
                onClick={() => setShowWipeConfirm(false)}
                className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg text-xs transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
