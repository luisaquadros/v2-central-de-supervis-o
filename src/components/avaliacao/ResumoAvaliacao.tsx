import { useState, useId } from 'react';
import QuadroAvaliacaoPrazo from '../QuadroAvaliacaoPrazo';
import { formatarPontos } from '../../services/avaliacaoEngine';
import { resumirNotasMatricula } from '../../services/avaliacaoResumo';
import type { Avaliacao, CriterioAvaliacao, Ocorrencia } from '../../types';
import type { ConfiguracaoCriterio } from '../../services/avaliacaoAdaptador';
import type { EvidenciaAvaliacao } from '../../services/estruturaAvaliacao';

interface Props {
  criterios: CriterioAvaliacao[]; avaliacoes: Avaliacao[]; ocorrencias: Ocorrencia[]; evidencias: EvidenciaAvaliacao[];
  matriculaId: string; turmaId: string; disciplinaId?: string;
  configPorCriterio: Record<string, ConfiguracaoCriterio>;
  rss: { realizados: number; esperados: number; total: number } | null;
  pendenciasDocumentos: string[];
  irParaRubricas: () => void;
}
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Parcial: o que existe até a data de referência. Final: composição e conferência. Nenhum dos dois projeta nota nem calcula média. */
export default function ResumoAvaliacao(p: Props) {
  const painelId = useId();
  const [modo, setModo] = useState<'PARCIAL' | 'FINAL'>('PARCIAL');
  const [ref, setRef] = useState(new Date().toISOString().slice(0, 10));
  const resumo = resumirNotasMatricula({ criterios: p.criterios, avaliacoes: p.avaliacoes, matriculaId: null, turmaId: p.turmaId, disciplinaId: p.disciplinaId,
    ocorrencias: p.ocorrencias, configPorCriterio: p.configPorCriterio });
  const r = resumo.resultado;
  const avaliados = r.criterios.filter(c => c.oficial !== null);
  const evAteData = p.evidencias.filter(e => e.matricula_id === p.matriculaId && e.data <= ref && (!e.preliminar)).sort((a, b) => b.data.localeCompare(a.data));
  const positivos = evAteData.filter(e => e.polaridade === 'POSITIVO'), desenvolver = evAteData.filter(e => e.polaridade === 'DESENVOLVER');
  const pendencias: string[] = [];
  for (const c of r.criterios) {
    if (c.invalida) pendencias.push(`${c.nome}: nota inválida na base`);
    else if (c.status === 'aguardando_decisao') pendencias.push(`${c.nome}: aguardando decisão (rubrica sem fórmula aprovada ou incompleta)`);
    else if (c.oficial === null) pendencias.push(`${c.nome}: sem nota oficial`);
  }
  r.divergencias.forEach(d => pendencias.push(`${d.nome}: prévia ${formatarPontos(d.previa)} difere da nota oficial ${formatarPontos(d.oficial)}`));
  r.ocorrenciasPendentes.forEach(o => pendencias.push(`Ocorrência ${o.id} aguardando decisão`));
  r.sinalizacoes.forEach(s => pendencias.push(s.mensagem));
  p.pendenciasDocumentos.forEach(d => pendencias.push(d));

  return (
    <div className="space-y-4" aria-label="Resumo da avaliação">
      <div role="tablist" aria-label="Momento da avaliação" onKeyDown={e => {
          const novo = e.key === 'Home' ? 'PARCIAL' : e.key === 'End' ? 'FINAL' : ['ArrowLeft','ArrowRight'].includes(e.key) ? modo === 'PARCIAL' ? 'FINAL' : 'PARCIAL' : null;
          if (novo) { e.preventDefault();setModo(novo);document.getElementById(`${painelId}-${novo}`)?.focus(); }
        }} className="inline-flex rounded-lg border border-slate-300 p-0.5 text-xs">
        <button role="tab" id={`${painelId}-PARCIAL`} aria-controls={`${painelId}-painel`} tabIndex={modo === 'PARCIAL' ? 0 : -1} aria-selected={modo === 'PARCIAL'} onClick={() => setModo('PARCIAL')} className={`min-h-[44px]! rounded-md px-4 ${modo === 'PARCIAL' ? 'bg-slate-800 text-white' : 'text-slate-700'}`}>Avaliação parcial</button>
        <button role="tab" id={`${painelId}-FINAL`} aria-controls={`${painelId}-painel`} tabIndex={modo === 'FINAL' ? 0 : -1} aria-selected={modo === 'FINAL'} onClick={() => setModo('FINAL')} className={`min-h-[44px]! rounded-md px-4 ${modo === 'FINAL' ? 'bg-slate-800 text-white' : 'text-slate-700'}`}>Avaliação final</button>
      </div>

      <div role="tabpanel" id={`${painelId}-painel`} aria-labelledby={`${painelId}-${modo}`}>
      {modo === 'PARCIAL' ? (
        <>
          <label className="block text-xs text-slate-600">Data de referência
            <input type="date" value={ref} onChange={e => setRef(e.target.value)} className="mt-1 block min-h-[44px]! rounded-lg border border-slate-300 px-3 text-sm" />
          </label>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Critérios com nota oficial</dt><dd className="font-bold">{avaliados.length} de {r.criterios.length}</dd></div>
            <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Ainda não avaliados</dt><dd className="font-bold">{r.criterios.length - avaliados.length}</dd></div>
            <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Registros semanais</dt><dd className="font-bold">{p.rss ? `${p.rss.realizados} de ${p.rss.esperados} esperados` : '—'}</dd></div>
            <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Evidências até {dataBr(ref)}</dt><dd className="font-bold">{evAteData.length}</dd></div>
          </dl>
          <QuadroAvaliacaoPrazo criterios={p.criterios} avaliacoes={p.avaliacoes} ocorrencias={p.ocorrencias} matriculaId={p.matriculaId} turmaId={p.turmaId} disciplinaId={p.disciplinaId} configPorCriterio={p.configPorCriterio} />
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><h4 className="text-sm font-semibold text-emerald-900">Aspectos positivos observados</h4>
              <ul className="mt-1 list-disc pl-5 text-xs text-emerald-900 space-y-0.5">{positivos.slice(0, 4).map(e => <li key={e.evidencia_id}>{e.observacao}</li>)}{!positivos.length && <li className="list-none -ml-5">Nenhuma evidência positiva registrada.</li>}</ul></section>
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-3"><h4 className="text-sm font-semibold text-amber-900">Aspectos a desenvolver</h4>
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-900 space-y-0.5">{desenvolver.slice(0, 4).map(e => <li key={e.evidencia_id}>{e.observacao}</li>)}{!desenvolver.length && <li className="list-none -ml-5">Nenhuma evidência a desenvolver registrada.</li>}</ul></section>
          </div>
          <p className="text-xs text-slate-500">Avaliação parcial: não há nota final, média parcial nem projeção.</p>
        </>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="prisma-table w-full text-left text-sm">
              <caption className="sr-only">Composição dos critérios</caption>
              <thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Critério</th><th className="p-2 text-right">Valor</th><th className="p-2 text-right">Oficial</th><th className="p-2 text-right">Prévia</th><th className="p-2">Situação</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{r.criterios.map(c => (
                <tr key={c.id}><td className="p-2 font-medium">{c.nome}</td><td data-label="Valor" className="p-2 text-right tabular-nums">{formatarPontos(c.maxPontos)}</td><td data-label="Oficial" className="p-2 text-right tabular-nums">{formatarPontos(c.oficial)}</td>
                  <td data-label="Prévia" className="p-2 text-right tabular-nums text-indigo-700">{formatarPontos(c.previa)}</td><td data-label="Situação" className="p-2">{c.situacao}</td></tr>))}</tbody>
              <tfoot><tr className="bg-slate-50 font-bold"><td className="p-2">Total oficial</td><td className="p-2 text-right tabular-nums">{formatarPontos(r.totalMaximo)}</td><td className="p-2 text-right tabular-nums">{formatarPontos(r.totalOficial)}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
          <section className={`rounded-xl border p-3 ${pendencias.length ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
            <h4 className="text-sm font-semibold">{pendencias.length ? `Conferir antes de confirmar (${pendencias.length})` : 'Nenhuma pendência de conferência encontrada'}</h4>
            {pendencias.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs space-y-0.5">{pendencias.map(x => <li key={x}>{x}</li>)}</ul>}
          </section>
          <button onClick={p.irParaRubricas} className="min-h-[44px]! rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Preencher rubricas e confirmar notas</button>
          <p className="text-xs text-slate-500">A nota só se torna oficial pela sua confirmação explícita na aba Rubricas.</p>
        </>
      )}
      </div>
    </div>
  );
}
