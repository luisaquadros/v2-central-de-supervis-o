import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  FileText,
  UserCheck,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { NavTab, NotificacaoDerivada } from '../types';

interface NotificationBellProps {
  onNavigate: (tab: NavTab, param?: string) => void;
  onOpenSupervisao?: (turmaId: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNavigate,
  onOpenSupervisao,
}) => {
  const { getNotificacoesDerivadas } = useSupervisao();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notificacoes = getNotificacoesDerivadas();
  const requerAcao = notificacoes.filter(n => n.categoria === 'REQUER_ACAO');
  const informativas = notificacoes.filter(n => n.categoria === 'INFORMATIVO');

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif: NotificacaoDerivada) => {
    setIsOpen(false);

    if (notif.tipo === 'CHAMADA_PENDENTE' && notif.turma_id && onOpenSupervisao) {
      // Abre direto a supervisão da turma para salvar a chamada
      onOpenSupervisao(notif.turma_id);
      return;
    }

    if (notif.targetTab) {
      onNavigate(notif.targetTab, notif.targetParam);
    }
  };

  const getNotifIcon = (tipo: NotificacaoDerivada['tipo']) => {
    switch (tipo) {
      case 'CHAMADA_PENDENTE':
        return <UserCheck className="w-4 h-4 text-red-600" />;
      case 'JUSTIFICATIVA_PENDENTE':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'PRAZO_HOJE':
      case 'PRAZO_VENCIDO':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'ESTUDO_DIRIGIDO_PENDENTE':
        return <FileText className="w-4 h-4 text-amber-600" />;
      case 'FERIADO':
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'SUPERVISAO_HOJE':
        return <Clock className="w-4 h-4 text-emerald-600" />;
      default:
        return <Info className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        title="Notificações operacionais"
        aria-label="Notificações"
      >
        <Bell className="w-4 h-4" />
        {requerAcao.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {requerAcao.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm">Notificações Operacionais</span>
            </div>
            <div className="flex items-center gap-2">
              {requerAcao.length > 0 && (
                <span className="bg-red-500/20 text-red-300 font-semibold px-2 py-0.5 rounded text-[11px]">
                  {requerAcao.length} ação necessária
                </span>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notificacoes.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-700">Tudo em dia!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Nenhuma pendência operacional ou prazo urgente no momento.
                </p>
              </div>
            ) : (
              <>
                {/* 1. SEÇÃO: REQUER AÇÃO */}
                {requerAcao.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1.5 bg-red-50 text-red-900 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      <span>Requer Ação ({requerAcao.length})</span>
                    </div>
                    {requerAcao.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className="p-3 hover:bg-slate-50 flex items-start justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">{getNotifIcon(n.tipo)}</div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {n.titulo}
                            </span>
                            <span className="text-slate-600 text-[11px] mt-0.5 block">
                              {n.mensagem}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. SEÇÃO: INFORMATIVO */}
                {informativas.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1.5 bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-3 h-3 text-slate-500" />
                      <span>Informativo ({informativas.length})</span>
                    </div>
                    {informativas.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className="p-3 hover:bg-slate-50 flex items-start justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">{getNotifIcon(n.tipo)}</div>
                          <div>
                            <span className="font-semibold text-slate-800 block leading-tight">
                              {n.titulo}
                            </span>
                            <span className="text-slate-500 text-[11px] mt-0.5 block">
                              {n.mensagem}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
