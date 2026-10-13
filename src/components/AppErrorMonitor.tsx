import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bug, Copy, X } from 'lucide-react';

type Diagnostico = { hora: string; origem: string; tipo: string };
const KEY = 'cs_diagnosticos_sessao';
const carregar = (): Diagnostico[] => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '[]').slice(-15); }
  catch { return []; }
};
/** Nunca armazena mensagens de erro, URL, stack ou conteúdo de alunos/pacientes. */
export const AppErrorMonitor: React.FC = () => {
  const [eventos,setEventos] = useState<Diagnostico[]>(carregar);
  const [aberto,setAberto] = useState(false);
  const [copiado,setCopiado] = useState(false);
  useEffect(()=>{
    const registrar = (origem: string, tipo: string) => {
      const registro = { hora:new Date().toISOString(), origem, tipo };
      setEventos(atual=>{
        const novos = [...atual,registro].slice(-15);
        try { sessionStorage.setItem(KEY,JSON.stringify(novos)); } catch {}
        return novos;
      });
    };
    const onError = (ev: Event) => {
      const e = ev as ErrorEvent;
      registrar('Interface',e.error?.name === 'TypeError' ? 'TypeError' : 'Erro de execução');
    };
    const onReject = (_ev: Event) => registrar('Operação assíncrona','Falha de operação');
    const onUi = (_ev:Event) => registrar('Tela','Falha de renderização');
    const onSave = (_ev:Event) => registrar('Gravação','Falha de sincronização');
    window.addEventListener('error',onError);
    window.addEventListener('unhandledrejection',onReject);
    window.addEventListener('cs:ui-error',onUi);
    window.addEventListener('cs:save-error',onSave);
    return ()=>{
      window.removeEventListener('error',onError);
      window.removeEventListener('unhandledrejection',onReject);
      window.removeEventListener('cs:ui-error',onUi);
      window.removeEventListener('cs:save-error',onSave);
    };
  },[]);
  if(eventos.length===0) return null;
  const copiar = async()=>{
    const txt = [
      'Central de Supervisão — diagnóstico sem dados acadêmicos',
      'Ocorrências: '+eventos.length,
      ...eventos.map(e=>`${e.hora} | ${e.origem} | ${e.tipo}`),
    ].join('\n');
    try {await navigator.clipboard.writeText(txt);setCopiado(true);}
    catch {setCopiado(false);}
  };
  return <div className="relative" role="status">
    <button onClick={()=>setAberto(v=>!v)}
      aria-label={`${eventos.length} problema(s) detectado(s) no aplicativo`}
      className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold">
      <Bug className="w-4 h-4"/><span className="hidden sm:inline">Problema</span><span>{eventos.length}</span>
    </button>
    {aberto && <div className="absolute right-0 top-full mt-2 w-[min(90vw,370px)] max-h-[75dvh] overflow-y-auto z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600"/>Problemas do aplicativo</h3>
        <button onClick={()=>setAberto(false)} aria-label="Fechar" className="p-2"><X className="w-4 h-4"/></button>
      </div>
      <p className="text-slate-600">Um problema foi detectado. Os registros continuam acessíveis quando possível. Confira o indicador de sincronização antes de sair da aula.</p>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {eventos.slice(-6).reverse().map((e,i)=><div key={i} className="rounded-lg bg-slate-50 p-2 text-slate-700">{new Date(e.hora).toLocaleString('pt-BR')} · {e.origem} · {e.tipo}</div>)}
      </div>
      <button onClick={copiar} className="rounded-lg px-3 py-2.5 bg-slate-900 text-white flex items-center gap-2 font-semibold">
        <Copy className="w-4 h-4"/>{copiado?'Diagnóstico copiado':'Copiar diagnóstico'}
      </button>
      <button onClick={()=>{setEventos([]);try{sessionStorage.removeItem(KEY);}catch{}setAberto(false);}} className="text-slate-600 underline">Limpar avisos deste dispositivo</button>
      <p className="text-slate-500">Nenhum dado pessoal é enviado automaticamente.</p>
    </div>}
  </div>;
};
