import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, X } from 'lucide-react';
type Falha = { id: string; categoria: string; horario: string };
/** Não coleta nome, mensagens de pacientes, payloads, stack ou URL da planilha. */
export function ErrorNotifier() {
  const [falha, setFalha] = useState<Falha | null>(null);
  useEffect(() => {
    const registrar = (categoria: string) => {
      const now = new Date();
      setFalha(old => old?.categoria === categoria &&
        now.getTime() - Number(old.id) < 10000 ? old : {
          id: String(now.getTime()), categoria, horario: now.toLocaleString('pt-BR')
        });
    };
    const onError = () => registrar('Falha de execução');
    const onRejection = () => registrar('Operação interrompida');
    const onBoundary = () => registrar('Erro ao renderizar tela');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('cs:ui-error', onBoundary);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('cs:ui-error', onBoundary);
    };
  }, []);
  if (!falha) return null;
  const diagnostico = `Central de Supervisão\nFalha: ${falha.categoria}\nMomento: ${falha.horario}\nConexão: ${navigator.onLine ? 'online' : 'offline'}\nSem dados acadêmicos anexados.`;
  return <div role="alert" aria-live="assertive" className="fixed z-[90] bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:w-[380px] border border-amber-400 bg-amber-50 text-amber-950 rounded-2xl shadow-xl p-4 safe-bottom">
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-2.5">
        <AlertTriangle aria-hidden className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-bold">O aplicativo encontrou um problema</p>
          <p className="text-xs mt-1">Não repita o envio sem conferir se o registro foi salvo. Você pode tentar novamente e copiar um diagnóstico sem dados pessoais.</p>
          <button type="button" onClick={() => navigator.clipboard?.writeText(diagnostico)}
            className="text-xs font-semibold underline mt-2 flex items-center gap-1">
            <Copy className="w-3.5 h-3.5" /> Copiar diagnóstico técnico
          </button>
        </div>
      </div>
      <button type="button" aria-label="Fechar aviso de erro" onClick={() => setFalha(null)} className="p-2 rounded-lg">
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>;
}
