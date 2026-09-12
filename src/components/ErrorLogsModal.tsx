import React, { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, Terminal, Trash2 } from 'lucide-react';
import { ErrorLog } from '../types';
import { loadLogs, saveLogs } from '../lib/storage';

interface ErrorLogsModalProps {
  onClose: () => void;
}

export function ErrorLogsModal({ onClose }: ErrorLogsModalProps) {
  const [logs, setLogs] = useState<ErrorLog[]>([]);

  useEffect(() => {
    setLogs(loadLogs());
  }, []);

  const clearLogs = () => {
    if (confirm("Tüm günlükleri temizlemek istediğinize emin misiniz?")) {
      saveLogs([]);
      setLogs([]);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('tr-TR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-semibold text-white">Sistem & Hata Günlüğü</h2>
          </div>
          <div className="flex items-center gap-3">
            {logs.length > 0 && (
              <button 
                onClick={clearLogs}
                className="text-xs flex items-center gap-1 text-slate-400 hover:text-rose-500 transition-colors bg-slate-800 px-2 py-1 rounded"
              >
                <Trash2 className="w-3 h-3" />
                Temizle
              </button>
            )}
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto bg-slate-950 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
              <AlertCircle className="w-8 h-8 opacity-50" />
              <p>Hiç hata günlüğü bulunmuyor.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800/50 pb-1 mb-1">
                    <span className="text-rose-400 font-bold">[{log.type}]</span>
                    <span>{formatDate(log.timestamp)}</span>
                    {log.channelName && (
                      <span className="text-emerald-400 truncate max-w-[200px] ml-auto">Kanal: {log.channelName}</span>
                    )}
                  </div>
                  <div className="text-slate-300 break-words whitespace-pre-wrap">
                    {log.details}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
