import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Database, Clock, CloudOff, X } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

export const SyncIndicator: React.FC = () => {
  const { syncStatusState, sincronizarAgora, currentUser, loginGoogle, isTokenExpired, tokenExpiredAviso, reconectarESincronizar } = useSupervisao();
  const [modalAberto, setModalAberto] = useState(false);
  const [sincronizandoManual, setSincronizandoManual] = useState(false);

  const formatarDataHora = (iso: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const handleSincronizar = async () => {
    setSincronizandoManual(true);
    try {
      if (!currentUser || isTokenExpired) {
        await reconectarESincronizar();
      } else {
        await sincronizarAgora();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSincronizandoManual(false);
    }
  };

  // Renderização padronizada do badge de estado conforme requisitos de auditoria
  const renderBadge = () => {
    if (syncStatusState.status === 'SINCRONIZANDO' || sincronizandoManual) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full cursor-pointer hover:bg-blue-100 transition-colors">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span className="font-semibold">Sincronizando com Google Sheets...</span>
        </div>
      );
    }

    if (isTokenExpired) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-900 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-full cursor-pointer hover:bg-amber-200 transition-colors animate-pulse" title="Sessão Google expirada. Clique para reconectar.">
          <Clock className="w-3.5 h-3.5 text-amber-700" />
          <span className="font-semibold">● Salvo neste dispositivo — aguardando sincronização (Reconectar)</span>
        </div>
      );
    }

    if (syncStatusState.pendentesCount > 0) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-full cursor-pointer hover:bg-amber-100 transition-colors" title="Dados preservados localmente na fila segura.">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span className="font-semibold">● Salvo neste dispositivo — aguardando sincronização</span>
        </div>
      );
    }

    if (syncStatusState.status === 'ERRO') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full cursor-pointer hover:bg-red-100 transition-colors">
          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
          <span className="font-semibold">⚠ Erro de sincronização</span>
        </div>
      );
    }

    if (syncStatusState.status === 'LOCAL') {
      const horaStr = syncStatusState.ultimaSincronizacao
        ? formatarDataHora(syncStatusState.ultimaSincronizacao).split(' às ')[1]
        : null;
      return (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full cursor-pointer hover:bg-slate-200 transition-colors">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-medium">
            Dados locais {horaStr ? `• última sincronização: ${horaStr}` : ''}
          </span>
        </div>
      );
    }

    // Apenas após confirmação real e remota da API Google Sheets
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full cursor-pointer hover:bg-emerald-100 transition-colors">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span className="font-semibold">✓ Sincronizado no Google Sheets</span>
      </div>
    );
  };

  return (
    <>
      <div onClick={() => setModalAberto(true)} title="Clique para abrir detalhes da sincronização">
        {renderBadge()}
      </div>

      {/* Painel Modal de Detalhes da Sincronização */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-sm text-slate-900">Status de Sincronização</h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Hierarquia */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-600">
                <div className="font-semibold text-slate-800">Hierarquia da Base:</div>
                <div>1. Google Sheets = Fonte Oficial (Desenvolvimento)</div>
                <div>2. IndexedDB = Cópia Persistente de Trabalho</div>
                <div>3. syncQueue = Fila de Alterações Não Enviadas</div>
              </div>

              {/* Métricas */}
              <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-white">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Última sincronização com Sheets:</span>
                  <strong className="text-slate-800">{formatarDataHora(syncStatusState.ultimaSincronizacao)}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Última leitura bem-sucedida:</span>
                  <strong className="text-slate-800">{formatarDataHora(syncStatusState.ultimaLeituraSucesso)}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Última escrita bem-sucedida:</span>
                  <strong className="text-slate-800">{formatarDataHora(syncStatusState.ultimaEscritaSucesso)}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Alterações locais aguardando envio:</span>
                  <strong className={syncStatusState.pendentesCount > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                    {syncStatusState.pendentesCount} item(ns)
                  </strong>
                </div>
              </div>

              {/* Erros se houver */}
              {syncStatusState.erros && syncStatusState.erros.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-red-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    <span>Avisos de Sincronização:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {syncStatusState.erros.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Usuário Google */}
              <div className="flex items-center justify-between text-slate-500 pt-1">
                <span>Conta Google Workspace:</span>
                <span className="font-semibold text-slate-700">{currentUser?.email || 'Não autenticado'}</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={sincronizandoManual}
                onClick={handleSincronizar}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoManual ? 'animate-spin' : ''}`} />
                <span>{sincronizandoManual ? 'Sincronizando...' : 'Sincronizar agora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
