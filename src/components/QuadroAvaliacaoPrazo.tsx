import { useMemo } from 'react';
import type { Avaliacao, CriterioAvaliacao, Ocorrencia } from '../types';
import { formatarPontos, type DadosCriterio, type PeriodoAvaliacao, type StatusCriterio } from '../services/avaliacaoEngine';
import { resumirNotasMatricula } from '../services/avaliacaoResumo';
import type { ConfiguracaoCriterio } from '../services/avaliacaoAdaptador';

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
  disciplinaId?: string;
  periodo?: PeriodoAvaliacao;
  extrasPorCriterio?: Record<string, DadosCriterio>;
  configPorCriterio?: Record<string, ConfiguracaoCriterio>;
}

/**
 * Quadro somente leitura. Nota OFICIAL em destaque; prévia (se houver) rotulada como não oficial;
 * divergências apenas sinalizadas. Sem média parcial, nota convertida para 10 nem projeção.
 */
export default function QuadroAvaliacaoPrazo({ criterios, avaliacoes, ocorrencias, matriculaId, turmaId, disciplinaId, periodo, extrasPorCriterio, configPorCriterio }: Props) {
  const resumo = useMemo(() => resumirNotasMatricula({
    criterios, avaliacoes, matriculaId: null, turmaId, disciplinaId, ocorrencias: ocorrencias.filter(o => o.matricula_id === matriculaId),
    periodo, extrasPorCriterio, configPorCriterio,
  }), [criterios, avaliacoes, ocorrencias, matriculaId, turmaId, disciplinaId, periodo, extrasPorCriterio, configPorCriterio]);
  const resultado = resumo.resultado;

  const observacaoDe = (criterioId: string) =>
    avaliacoes.find(a => a.criterio_id === criterioId)?.observacao?.trim() || '';

  if (resultado.criterios.length === 0) return null;
  const mostrarPrevias = Math.abs(resultado.totalComPrevias - resultado.totalOficial) > 0.005;
  return (
    <section aria-label="Avaliação até o prazo" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-900">Avaliação até o prazo</h3>
      <ul className="divide-y divide-slate-100">
        {resultado.criterios.map(c => {
          const obs = observacaoDe(c.id);
          const temDetalhe = c.subcriterios.length > 0 || c.deducoes.length > 0 || c.alertas.length > 0 || !!obs || c.previa !== null;
          const linha = (
            <div className="grid grid-cols-[1fr_auto] gap-x-3 items-center py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.nome}</p>
                <p className="text-xs text-slate-500">{c.situacao || ROTULO_STATUS[c.status]} · valor {formatarPontos(c.maxPontos)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{formatarPontos(c.oficial)}</p>
                {c.oficial === null && c.previa !== null && (
                  <p className="text-[11px] text-indigo-700 tabular-nums">prévia {formatarPontos(c.previa)}</p>
                )}
              </div>
            </div>
          );
          return (
            <li key={c.id}>
              {temDetalhe ? (
                <details>
                  <summary className="cursor-pointer list-none">{linha}<span className="text-xs text-indigo-600">▾ Ver critérios avaliados</span></summary>
                  <div className="pb-2 text-xs text-slate-600 space-y-1">
                    {c.subcriterios.map(s => (
                      <p key={s.id}>{s.nome}{s.nivel ? ` — ${s.nivel.toLowerCase().replace('_', ' ')}` : ''}{s.maxPontos !== undefined ? ` (valor ${formatarPontos(s.maxPontos)})` : ''}</p>
                    ))}
                    {c.previa !== null && <p>Prévia calculada: {formatarPontos(c.previa)} (não oficial)</p>}
                    {c.prazo && <p>Prazo: {c.prazo.replace('_', ' ')}</p>}
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
        <span className="text-sm font-semibold text-slate-700">Acumulado oficial até o prazo</span>
        <span className="text-base font-bold text-slate-900 tabular-nums">{formatarPontos(resultado.totalOficial)} <span className="text-xs font-normal text-slate-500">de {formatarPontos(resultado.totalMaximo)}</span></span>
      </div>
      {mostrarPrevias && (
        <p className="text-xs text-indigo-700">Com prévias (não oficial, só para conferência): {formatarPontos(resultado.totalComPrevias)}</p>
      )}
      {resultado.divergencias.length > 0 && (
        <div className="text-xs text-amber-700 space-y-0.5" role="status">
          {resultado.divergencias.map(d => (
            <p key={d.criterioId}>Divergência em {d.nome}: oficial {formatarPontos(d.oficial)} × prévia {formatarPontos(d.previa)}. A nota oficial foi mantida.</p>
          ))}
        </div>
      )}
      {resultado.invalidas.length > 0 && (
        <p className="text-xs text-red-700" role="alert">{resultado.invalidas.length} nota(s) inválida(s) na base: fora do acumulado, conferir.</p>
      )}
      {resultado.sinalizacoes.map(s => <p key={s.ocorrenciaId} className="text-xs text-red-700">{s.mensagem}</p>)}
      {resultado.ocorrenciasPendentes.length > 0 && (
        <p className="text-xs text-amber-700">{resultado.ocorrenciasPendentes.length} ocorrência(s) aguardando decisão da professora; nenhum desconto foi aplicado.</p>
      )}
      <p className="text-xs text-slate-500">Valores acumulados referem-se apenas ao percurso registrado até o prazo e não correspondem à nota final.</p>
    </section>
  );
}
