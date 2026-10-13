import React from 'react';
import type { RegistroSemanal } from '../types';
import { obterSemanaRssValidada } from '../services/supervisaoOperacionalService';

/** Colunas canônicas conferidas na aba registros_semanais da base oficial. */
export const CAMPOS_TEXTO_RSS: [string,string][] = [
  ['local_pratica','Local da prática'],
  ['objetivos','Objetivos planejados e resultados'],
  ['tecnicas_atividades','Técnicas e atividades realizadas'],
  ['manejo_resposta','Intervenção, manejo e resposta observada'],
  ['compreensao_atual','Compreensão atual e hipóteses'],
  ['proximo_passo','Próximo passo'],
  ['prioridade_supervisao','Prioridade para supervisão'],
  ['duvidas_supervisao','Dúvidas para supervisão'],
  ['limitacoes','Limitações observadas'],
  ['observacao','Observações adicionais'],
  ['motivo_sem_encontro','Motivo de não realização'],
  ['encontros_referenciados','Encontros referenciados'],
];
const CAMPOS_LINK = ['link','url','link_documento','url_documento','link_rss','arquivo_url','documento_url'];

export const LeituraRss: React.FC<{ registros: RegistroSemanal[] }> = ({ registros }) => {
  const ordenados = [...registros].sort((a,b) => {
    const semanaA = Number((a as any).semana_rss ?? a.semana) || 0;
    const semanaB = Number((b as any).semana_rss ?? b.semana) || 0;
    return semanaA - semanaB || String(a.data_entrega||'').localeCompare(String(b.data_entrega||''));
  });
  if (!ordenados.length) return <p className="text-sm text-slate-500 py-3">Nenhum registro semanal vinculado a este estudante ou grupo na base consultada. Isso não comprova ausência de entrega.</p>;

  return <div className="space-y-3" aria-label="Leitura dos RSS registrados">
    <p className="text-xs text-slate-500">{ordenados.length} registro(s) encontrado(s). Exibimos os campos disponíveis na planilha, sem reconstruir conteúdo não armazenado.</p>
    {ordenados.map((r,i) => {
      const obj = r as unknown as Record<string,unknown>;
      const rawSemana = String(obj.semana_rss ?? r.semana ?? '').trim();
      const semana = rawSemana && Number(rawSemana) >= 1 && Number(rawSemana) <= 12 ? rawSemana : 'não definida';
      const encontro = String(obj.encontro_numero ?? '').trim();
      const revisao = String(obj.status_revisao ?? '').trim().toUpperCase();
      const statusTexto = revisao === 'PENDENTE_REVISAO' ? 'Em revisão'
        : obterSemanaRssValidada(r) !== null ? 'Validado' : revisao ? revisao.replaceAll('_',' ') : String(r.status || 'Não validado');
      const textos = CAMPOS_TEXTO_RSS.map(([key,label])=>({key,label,value:String(obj[key] ?? '').trim()})).filter(x=>x.value);
      const links = CAMPOS_LINK.map(key=>String(obj[key]??'').trim()).filter(v=>/^https:\/\//i.test(v));
      const conteudoDisponivel = textos.length>0 || links.length>0;
      return <details key={String(r.registro_id||i)+'-'+i} className="rounded-xl border border-slate-200 bg-white" open={ordenados.length === 1}>
        <summary className="cursor-pointer select-none p-3 sm:p-4 font-semibold text-sm text-slate-900 min-h-[44px]">
          Semana RSS {semana} · {statusTexto}{encontro ? <span className="font-normal ml-1">· Encontro {encontro}</span> : null}
          {r.data_entrega ? <span className="text-xs text-slate-500 font-normal ml-2">Entrega: {r.data_entrega}</span> : null}
        </summary>
        <div className="px-3 pb-4 sm:px-4 space-y-3 border-t border-slate-100 pt-3">
          {textos.map(x=><div key={x.key}><div className="text-xs font-semibold text-slate-600">{x.label}</div><p className="cs-reading-copy text-slate-800 whitespace-pre-wrap break-words mt-1">{x.value}</p></div>)}
          {links.map((href,i)=><a key={i} href={href} target="_blank" rel="noopener noreferrer" className="cs-reading-link inline-block text-sm font-semibold underline break-all">Abrir documento vinculado {links.length>1?i+1:''}</a>)}
          {!conteudoDisponivel && <p className="text-sm text-amber-800">A planilha contém o acompanhamento deste RSS, mas não disponibiliza seu texto ou documento neste registro.</p>}
        </div>
      </details>;
    })}
  </div>;
};
