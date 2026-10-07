import React from 'react';
import { RotateCcw, X, CheckCircle2 } from 'lucide-react';

interface ToastDesfazerProps {
  itemNome: string;
  onDesfazer: () => void;
  onDismiss: () => void;
}

export const ToastDesfazer: React.FC<ToastDesfazerProps> = ({
  itemNome,
  onDesfazer,
  onDismiss,
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-200 max-w-sm">
      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      <div className="text-xs flex-1 truncate">
        <span className="font-semibold">{itemNome}</span> excluído.
      </div>
      <button
        onClick={onDesfazer}
        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Desfazer</span>
      </button>
      <button
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
        title="Fechar aviso"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
