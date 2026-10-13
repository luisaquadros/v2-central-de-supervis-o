import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmacaoExclusaoModalProps {
  isOpen: boolean;
  itemNome: string;
  descricaoAfetada?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export const ConfirmacaoExclusaoModal: React.FC<ConfirmacaoExclusaoModalProps> = ({
  isOpen,
  itemNome,
  descricaoAfetada,
  onConfirmar,
  onCancelar,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="text-base font-bold text-slate-900">Confirmar Exclusão</h3>
          </div>
          <button
            onClick={onCancelar}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3 text-xs text-slate-600">
          <p className="text-sm font-semibold text-slate-900">
            Tem certeza de que deseja excluir <span className="text-red-700 underline font-bold">{itemNome}</span>?
          </p>
          <p className="text-slate-500 leading-relaxed">
            {descricaoAfetada || 'Esta ação removerá o registro da visualização operacional. Você terá uma janela para desfazer a ação imediatamente.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onCancelar}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold text-xs text-slate-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};
