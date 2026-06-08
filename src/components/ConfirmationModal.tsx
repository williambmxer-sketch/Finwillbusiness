import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { AlertTriangle } from 'lucide-react';

export function ConfirmationModal() {
  const { confirmModal, setConfirmModal } = useAppStore();

  if (!confirmModal) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-sm rounded-[24px] border border-border shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
        <div className="p-3 bg-primary/10 text-primary rounded-full mb-3">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold tracking-tight mb-1">{confirmModal.title}</h3>
        <p className="text-[11px] text-muted-foreground mb-5 leading-relaxed px-2">{confirmModal.description}</p>
        
        <div className="flex w-full gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmModal(null)}
            className="flex-1 py-2 bg-muted text-foreground text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-muted/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              confirmModal.onConfirm();
              setConfirmModal(null);
            }}
            className="flex-1 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-primary/90 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
