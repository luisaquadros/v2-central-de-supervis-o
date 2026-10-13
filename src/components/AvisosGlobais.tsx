import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, RotateCcw, X } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { Botao, Janela } from './ui';

/** Avisos que valem para o app inteiro: salvamento, desfazer exclusão, confirmação e reconexão. */
export const AvisosGlobais: React.FC = () => {
  const {
    aviso, limparAviso, pedidoExclusao, confirmarExclusao, cancelarExclusao,
    ultimaExclusao, desfazerExclusao, dispensarDesfazer, precisaReconectar, syncStatusState, loginGoogle, isLoggingIn,
  } = useSupervisao();

  // O "Desfazer" fica disponível por 10 segundos.
  useEffect(() => {
    if (!ultimaExclusao) return;
    const t = setTimeout(dispensarDesfazer, 10000);
    return () => clearTimeout(t);
  }, [ultimaExclusao, dispensarDesfazer]);

  return (
    <>
      {precisaReconectar && syncStatusState.pendentesCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl shadow-lg p-3 flex items-center gap-3">
          <CloudOff className="w-5 h-5 shrink-0" />
          <p className="text-sm flex-1">
            <strong>{syncStatusState.pendentesCount} alteração(ões)</strong> salvas neste aparelho. O acesso do Google expirou; conecte para enviar à planilha.
          </p>
          <Botao variante="primario" tamanho="sm" onClick={loginGoogle} disabled={isLoggingIn}>
            {isLoggingIn ? 'Conectando…' : 'Conectar'}
          </Botao>
        </div>
      )}

      {ultimaExclusao ? (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm flex-1"><strong>{ultimaExclusao.nome}</strong> excluído(a).</span>
          <Botao variante="destaque" tamanho="sm" onClick={desfazerExclusao} icone={<RotateCcw className="w-4 h-4" />}>Desfazer</Botao>
          <button onClick={dispensarDesfazer} aria-label="Fechar" className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      ) : aviso && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-sm text-sm font-semibold ${
            aviso.tipo === 'erro' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          {aviso.tipo === 'erro' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          <span className="flex-1">{aviso.texto}</span>
          <button onClick={limparAviso} aria-label="Fechar" className="p-1 opacity-70 hover:opacity-100 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {pedidoExclusao && (
        <Janela
          titulo="Excluir?"
          aoFechar={cancelarExclusao}
          largura="sm"
          rodape={<>
            <Botao onClick={cancelarExclusao}>Cancelar</Botao>
            <Botao variante="perigo" onClick={() => void confirmarExclusao()}>Excluir</Botao>
          </>}
        >
          <p className="text-slate-800"><strong>{pedidoExclusao.nome}</strong> será removido(a) da planilha.</p>
          <p className="text-sm text-slate-500 mt-2">{pedidoExclusao.descricao || 'Você terá 10 segundos para desfazer.'}</p>
        </Janela>
      )}
    </>
  );
};
