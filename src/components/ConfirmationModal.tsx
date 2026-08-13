import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AlertTriangle } from 'lucide-react';

export function ConfirmationModal() {
  const { confirmModal, setConfirmModal } = useAppStore();
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    setTypedText('');
  }, [confirmModal]);

  if (!confirmModal) return null;

  const isDanger = confirmModal.variant === 'danger';
  const requireText = confirmModal.requireText;
  const isMatch = !requireText || typedText.trim().toLowerCase() === requireText.toLowerCase();

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-sm rounded-[24px] border border-border shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
        <div className={`p-3 rounded-full mb-3 ${isDanger ? 'bg-rose-500/10 text-rose-600' : 'bg-primary/10 text-primary'}`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold tracking-tight mb-1">{confirmModal.title}</h3>
        <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed px-2">{confirmModal.description}</p>

        {requireText && (
          <div className="w-full mb-5 text-left">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 text-center">
              Digite <span className="text-rose-600 dark:text-rose-400 font-extrabold">"{requireText}"</span> para habilitar:
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={`Digite "${requireText}"`}
              className="w-full px-3 py-2 text-xs font-semibold text-center border border-border/60 bg-muted/30 rounded-xl outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:font-normal text-foreground"
              autoFocus
            />
          </div>
        )}

        <div className="flex w-full gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmModal(null)}
            className="flex-1 py-2.5 bg-muted text-foreground text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-muted/80 transition-colors font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!isMatch}
            onClick={() => {
              if (isMatch) {
                confirmModal.onConfirm();
                setConfirmModal(null);
              }
            }}
            className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
              !isMatch
                ? 'opacity-40 bg-muted text-muted-foreground cursor-not-allowed'
                : isDanger 
                ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
