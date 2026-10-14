import { useMemo } from 'react';
import type { Avaliacao, CriterioAvaliacao, Ocorrencia } from '../types';
import { calcularAvaliacao, formatarPontos, type PeriodoAvaliacao, type StatusCriterio } from '../services/avaliacaoEngine';
import { entradasDaMatricula, ocorrenciasParaAvaliacao } from '../services/avaliacaoAdaptador';

const ROTULO_STATUS: Record<StatusCriterio, string> = {
  calculado: 'Calculado', concluido: 'Concluído', a_conferir: 'A conferir',
  nao_avaliado: 'Não avaliado', aguardando_decisao: 'Aguardando decisão',
};

interface Props {
  criterios: CriterioAvaliacao[];
  avaliacoes: Avaliacao[];
  ocorrencias: Ocorrencia[];
  matriculaId: string;
  turmaId: string;
  periodo?: PeriodoAvaliacao;
}

/** Quadro somente leitura: acumulado até o prazo. Sem média parcial, sem nota convertida, sem projeção. */
export default function QuadroAvaliacaoPrazo({ criterios, avaliacoes, ocorrencias, matriculaId, turmaId, periodo }: Props) {
  const resultado = useMemo(() => {
    const entradas = entradasDaMatricula(criterios, avaliacoes, matriculaId, turmaId);
    return calcularAvaliacao(entradas, { periodo, ocorrencias: ocorrenciasParaAvaliacao(ocorrencias, matriculaId) });
  }, [criterios, avaliacoes, ocorrencias, matriculaId, turmaId, periodo]);

  const observacaoDe = (criterioId: string) =>
    avaliacoes.find(a => a.matricula_id === matriculaId && a.criterio_id === criterioId)?.observacao?.trim() || '';

  if (resultado.criterios.length === 0) return null;
  return (
    <section aria-label="Avaliação até o prazo" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-900">Avaliação até o prazo</h3>
      <ul className="divide-y divide-slate-100">
        {resultado.criterios.map(c => {
          const obs = observacaoDe(c.id);
          const temDetalhe = c.subcriterios.length > 0 || c.deducoes.length > 0 || c.alertas.length > 0 || !!obs;
          const linha = (
            <div className="grid grid-cols-[1fr_auto] gap-x-3 items-center py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.nome}</p>
                <p className="text-xs text-slate-500">{c.situacao || ROTULO_STATUS[c.status]} · valor {formatarPontos(c.maxPontos)}</p>
              </div>
              <p className="text-sm font-bold text-slate-900 tabular-nums">{formatarPontos(c.score)}</p>
            </div>
          );
          return (
            <li key={c.id}>
              {temDetalhe ? (
                <details>
                  <summary className="cursor-pointer list-none">{linha}<span className="text-xs text-indigo-600">▾ Ver critérios avaliados</span></summary>
                  <div className="pb-2 text-xs text-slate-600 space-y-1">
                    {c.subcriterios.map(s => (
                      <p key={s.id}>{s.nome}: {formatarPontos(s.nota ?? null)}{s.maxPontos !== undefined ? ` / ${formatarPontos(s.maxPontos)}` : ''}</p>
                    ))}
                    {c.deducoes.map((d, i) => <p key={i}>Dedução {formatarPontos(d.valor)} — {d.justificativa}</p>)}
                    {c.alertas.map((a, i) => <p key={i} className="text-amber-700">{a}</p>)}
                    {obs && <p>Observação: {obs}</p>}
                  </div>
                </details>
              ) : linha}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-slate-200 pt-2">
        <span className="text-sm font-semibold text-slate-700">Acumulado até o prazo</span>
        <span className="text-base font-bold text-slate-900 tabular-nums">{formatarPontos(resultado.totalAcumulado)} <span className="text-xs font-normal text-slate-500">de {formatarPontos(resultado.totalMaximo)}</span></span>
      </div>
      {resultado.ocorrenciasPendentes.length > 0 && (
        <p className="text-xs text-amber-700">{resultado.ocorrenciasPendentes.length} ocorrência(s) aguardando decisão da professora; nenhum desconto foi aplicado.</p>
      )}
      <p className="text-xs text-slate-500">Valores acumulados referem-se apenas ao percurso registrado até o prazo e não correspondem à nota final.</p>
    </section>
  );
}
