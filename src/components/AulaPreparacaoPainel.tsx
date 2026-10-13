import React, { useState } from 'react';
import { BookOpenCheck, Check, Plus, Trash2, Pencil, X } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { getHojeDataIso } from '../services/supervisaoOperacionalService';
import { PreparacaoAula } from '../types';

/** Mesmo painel no briefing e no modo aula: não duplica dados nem regras. */
export const AulaPreparacaoPainel: React.FC<{turmaId: string}> = ({turmaId}) => {
  const { preparacoesAula, adicionarPreparacaoAula, alterarPreparacaoAula, excluirPreparacaoAula } = useSupervisao();
  const [data, setData] = useState(getHojeDataIso());
  const [tipo, setTipo] = useState<PreparacaoAula['tipo']>('LEMBRETE');
  const [texto, setTexto] = useState('');
  const [edicao, setEdicao] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const atuais = preparacoesAula.filter(p => p.turma_id === turmaId);
  const pendentes = atuais.filter(p => p.status !== 'CONCLUIDO')
    .sort((a,b) => a.data_aula.localeCompare(b.data_aula) || a.criado_em.localeCompare(b.criado_em));
  const concluidas = atuais.filter(p => p.status === 'CONCLUIDO')
    .sort((a,b) => b.atualizado_em.localeCompare(a.atualizado_em));
  const formatar = (s:string) => /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s;

  const executar = async (fn:()=>Promise<void>) => {
    if(salvando) return;
    setSalvando(true);
    setErro('');
    try { await fn(); } catch(e:any) { setErro(e?.message || 'Não foi possível salvar. Tente sincronizar novamente.'); }
    finally { setSalvando(false); }
  };
  const nova = () => executar(async()=>{
    if(!texto.trim()) return;
    await adicionarPreparacaoAula({turma_id:turmaId, data_aula:data, tipo, texto});
    setTexto('');
  });

  const itemRow = (p:PreparacaoAula) => (
    <div key={p.preparacao_id} className="flex gap-2 items-start justify-between p-3 rounded-xl border border-slate-200 bg-white">
      <div className="min-w-0 flex-1">
        <div className="flex gap-2 items-center flex-wrap text-[11px] text-slate-500">
          <span className="font-semibold text-indigo-700">{p.tipo === 'PAUTA' ? 'Pauta' : p.tipo === 'LEMBRETE' ? 'Lembrete' : 'Observação'}</span>
          <time dateTime={p.data_aula}>{formatar(p.data_aula)}</time>
          {p.status === 'CONCLUIDO' && <span className="text-emerald-700">Concluído</span>}
          {p.status !== 'CONCLUIDO' && p.data_aula < getHojeDataIso() && <span className="text-amber-700">Retomar nesta aula</span>}
        </div>
        {edicao === p.preparacao_id ? (
          <div className="space-y-2 mt-2">
            <textarea value={textoEdicao} onChange={e=>setTextoEdicao(e.target.value)}
              maxLength={4000} rows={3} aria-label="Editar anotação"
              className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm"/>
            <div className="flex items-center gap-2">
              <button disabled={salvando||!textoEdicao.trim()} onClick={()=>executar(async()=>{await alterarPreparacaoAula(p.preparacao_id,{texto:textoEdicao.trim()});setEdicao(null);})} className="px-3 py-2 rounded bg-slate-900 text-white text-xs">Salvar</button>
              <button onClick={()=>setEdicao(null)} className="px-3 py-2 text-xs text-slate-600">Cancelar</button>
            </div>
          </div>
        ): <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-800">{p.texto}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button disabled={salvando} title={p.status==='CONCLUIDO'?'Reabrir item':'Concluir item'}
          aria-label={p.status==='CONCLUIDO'?'Reabrir item':'Concluir item'}
          onClick={()=>executar(()=>alterarPreparacaoAula(p.preparacao_id,{status:p.status==='CONCLUIDO'?'PENDENTE':'CONCLUIDO'}))}
          className="p-2 rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50"><Check className="w-4 h-4"/></button>
        <button disabled={salvando} title="Editar" aria-label="Editar"
          onClick={()=>{setTextoEdicao(p.texto);setEdicao(p.preparacao_id);}}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Pencil className="w-4 h-4"/></button>
        <button disabled={salvando} title="Excluir" aria-label="Excluir"
          onClick={()=>{if(window.confirm('Excluir esta anotação de preparação de aula?')) executar(()=>excluirPreparacaoAula(p.preparacao_id));}}
          className="p-2 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4"/></button>
      </div>
    </div>
  );

  return <section className="space-y-3" aria-label="Preparação da aula">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-bold text-slate-900 text-sm"><BookOpenCheck className="w-4 h-4 text-indigo-700"/> Preparação e lembretes</h3>
      <span className="text-[11px] text-slate-500">{pendentes.length} para retomar</span>
    </div>
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-slate-600 flex-1 min-w-[130px]">Data da aula
          <input type="date" value={data} onChange={e=>setData(e.target.value)}
            className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 bg-white text-slate-900 px-2"/>
        </label>
        <label className="text-xs text-slate-600 flex-1 min-w-[130px]">Tipo
          <select value={tipo} onChange={e=>setTipo(e.target.value as PreparacaoAula['tipo'])}
            className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 bg-white text-slate-900 px-2">
            <option value="LEMBRETE">Lembrete</option><option value="PAUTA">Pauta</option><option value="OBSERVACAO">Observação</option>
          </select>
        </label>
      </div>
      <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={3} maxLength={4000}
        aria-label="Escreva uma pauta, anotação ou lembrete"
        placeholder="O que preciso discutir ou lembrar nesta aula? Evite identificar pacientes."
        className="w-full p-3 border border-slate-200 bg-white text-slate-900 rounded-lg text-sm resize-y"/>
      <div className="flex justify-end">
        <button onClick={nova} disabled={salvando||!texto.trim()||!data}
          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex gap-1.5 items-center disabled:opacity-40">
          <Plus className="w-4 h-4"/>Adicionar
        </button>
      </div>
    </div>
    {erro && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</p>}
    {pendentes.length > 0
      ? <div className="space-y-2">{pendentes.map(itemRow)}</div>
      : <p className="text-xs text-slate-500">Nenhuma anotação pendente nesta turma.</p>}
    {concluidas.length > 0 && <details className="rounded-lg border border-slate-200 p-3">
      <summary className="text-xs font-semibold text-slate-700 cursor-pointer">Histórico concluído ({concluidas.length})</summary>
      <div className="space-y-2 mt-2">{concluidas.map(itemRow)}</div>
    </details>}
  </section>;
};
