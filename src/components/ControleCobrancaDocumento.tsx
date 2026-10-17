import React, { useState } from 'react';
import { useSupervisao } from '../context/SupervisaoContext';
import { lerCobranca, ultimaCobranca, type CanalCobranca, type SituacaoCobranca } from '../services/cobrancasDocumentais';

const canais: {value:CanalCobranca;label:string}[]=[
  {value:'EMAIL',label:'E-mail'},{value:'WHATSAPP',label:'WhatsApp'},
  {value:'PRESENCIAL',label:'Presencial'},{value:'OUTRO',label:'Outro'}
];
const situacoes: {value:SituacaoCobranca;label:string}[]=[
  {value:'CONTATO_ENVIADO',label:'Cobrança enviada'},
  {value:'AGUARDANDO_RETORNO',label:'Aguardando regularização'},
  {value:'RESPONDEU_PENDENTE',label:'Respondeu, documento pendente'},
  {value:'RECEBIDO_A_CONFERIR',label:'Documento recebido, a conferir'},
  {value:'ENCERRADA',label:'Acompanhamento encerrado (administrativo)'}
];
const rotulo = (s:SituacaoCobranca) => situacoes.find(x=>x.value===s)?.label || s;
export const ControleCobrancaDocumento:React.FC<{matriculaId:string;tipo:string;nome:string}> = ({matriculaId,tipo,nome})=>{
  const {configuracoes,selectedPeriodoId,registrarCobrancaDocumento} = useSupervisao();
  const {eventos} = lerCobranca(configuracoes,selectedPeriodoId,matriculaId,tipo);
  const ultimo = ultimaCobranca(eventos);
  const [aberto,setAberto]=useState(false);
  const [data,setData]=useState('');
  const [canal,setCanal]=useState<CanalCobranca>('EMAIL');
  const [situacao,setSituacao]=useState<SituacaoCobranca>('CONTATO_ENVIADO');
  const [nota,setNota]=useState('');
  const [salvando,setSalvando]=useState(false);
  const [erro,setErro]=useState('');
  const [resultado,setResultado]=useState('');
  const enviar=async()=>{
    if(salvando) return;
    setSalvando(true);setErro('');setResultado('');
    try{
      await registrarCobrancaDocumento(matriculaId,tipo,{data_contato:data,canal,situacao,nota:nota.trim()});
      setNota('');setData('');setAberto(false);
      setResultado('Contato registrado. Confira no indicador de sincronização a confirmação de envio à planilha.');
    }catch(e){setErro(e instanceof Error?e.message:'Erro ao salvar contato.');}
    finally{setSalvando(false);}
  };
  return <div className="mt-3 border border-slate-200 rounded-xl bg-slate-50 p-3 text-xs" aria-label={'Acompanhamento de documentação: '+nome}>
    <div className="flex flex-wrap justify-between items-center gap-2">
      <div className="space-y-1">
        <p className="font-bold text-slate-900">Acompanhamento da cobrança · {tipo.replaceAll('_',' ')}</p>
        {ultimo
          ? <p className="text-slate-700">Último contato: <strong>{rotulo(ultimo.situacao)}</strong> · {ultimo.canal} · {ultimo.data_contato || 'data do contato não informada'}</p>
          : <p className="text-amber-800">Nenhum contato registrado para este documento.</p>}
      </div>
      <button type="button" onClick={()=>setAberto(v=>!v)} className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white font-semibold text-teal-900">
        {aberto?'Cancelar':'Registrar cobrança/retorno'}
      </button>
    </div>
    {aberto && <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
      <label className="font-semibold text-slate-700">Data do contato (opcional)
        <input type="date" value={data} onChange={e=>setData(e.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white p-2" />
      </label>
      <label className="font-semibold text-slate-700">Canal
        <select value={canal} onChange={e=>setCanal(e.target.value as CanalCobranca)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white p-2">
          {canais.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}
        </select>
      </label>
      <label className="font-semibold text-slate-700 md:col-span-2">Situação do acompanhamento
        <select value={situacao} onChange={e=>setSituacao(e.target.value as SituacaoCobranca)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white p-2">
          {situacoes.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <label className="font-semibold text-slate-700 md:col-span-2">Observação breve (opcional; não incluir dados clínicos)
        <textarea rows={2} maxLength={250} value={nota} onChange={e=>setNota(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 bg-white" placeholder="Ex.: reforçado prazo, aguardando documento assinado"/>
      </label>
      <div className="md:col-span-2 flex items-center flex-wrap justify-between gap-2">
        <p className="text-slate-600">Sem data informada, o histórico registra apenas quando o lançamento foi feito.</p>
        <button type="button" disabled={salvando} onClick={()=>void enviar()}
          className="min-h-10 rounded-lg bg-slate-900 text-white px-4 font-semibold disabled:opacity-50">
          {salvando?'Salvando…':'Salvar acompanhamento'}
        </button>
      </div>
    </div>}
    {eventos.length>0 && <details className="mt-2 border-t border-slate-200 pt-2">
      <summary className="cursor-pointer text-teal-900 font-semibold">Histórico de contatos ({eventos.length})</summary>
      <ol className="mt-2 space-y-2">
        {[...eventos].reverse().map(e=><li key={e.id} className="rounded-lg bg-white border border-slate-200 p-2 text-slate-700">
          <strong>{rotulo(e.situacao)}</strong> · {e.canal} · Contato: {e.data_contato || 'sem data informada'}
          <p className="text-slate-500">Registrado em {new Date(e.registrado_em).toLocaleString('pt-BR')}</p>
          {e.nota && <p className="mt-1 whitespace-pre-wrap break-words">{e.nota}</p>}
        </li>)}
      </ol>
    </details>}
    {erro && <p role="alert" className="mt-2 font-medium text-red-700">{erro}</p>}
    {resultado && <p role="status" className="mt-2 text-teal-800">{resultado}</p>}
    <p className="mt-2 text-slate-500">O contato é administrativo e não altera o status da entrega original. Confirme a documentação na ficha do estudante.</p>
  </div>;
};
