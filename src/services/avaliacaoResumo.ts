/**
 * Serviço compartilhado do resumo de notas OFICIAIS por matrícula.
 * Substitui as somas duplicadas de AvaliacaoView e AlunoFichaView. Nota ausente = null; inválida é
 * sinalizada (nunca zero); a soma usa apenas notas oficiais válidas. Não grava nada.
 */
import type { Avaliacao, CriterioAvaliacao, Ocorrencia } from '../types';
import { calcularAvaliacao, lerNumero, type ResultadoAvaliacao, type EntradaCriterio, type PeriodoAvaliacao, type DadosCriterio } from './avaliacaoEngine';
import { entradasDaMatricula, ocorrenciasParaAvaliacao, selecionarCriteriosAplicaveis, type ConfiguracaoCriterio } from './avaliacaoAdaptador';

export interface ResumoNotas {
  entradas: EntradaCriterio[];
  resultado: ResultadoAvaliacao;
  totalOficial: number;
  totalMaximo: number;
  /** critérios com nota oficial válida lançada */
  lancados: number;
  /** critérios com nota inválida (sinalizados; fora da soma) */
  invalidos: string[];
}

export function resumirNotasMatricula(p: {
  criterios: CriterioAvaliacao[];
  avaliacoes: Avaliacao[];
  matriculaId: string | null;
  turmaId: string;
  disciplinaId?: string;
  ocorrencias?: Ocorrencia[];
  periodo?: PeriodoAvaliacao;
  extrasPorCriterio?: Record<string, DadosCriterio>;
  configPorCriterio?: Record<string, ConfiguracaoCriterio>;
}): ResumoNotas {
  const entradas = entradasDaMatricula(p.criterios, p.avaliacoes, p.matriculaId, p.turmaId,
    p.extrasPorCriterio, p.configPorCriterio, p.disciplinaId);
  const resultado = calcularAvaliacao(entradas, {
    periodo: p.periodo,
    ocorrencias: p.ocorrencias ? ocorrenciasParaAvaliacao(p.ocorrencias, p.matriculaId) : [],
  });
  return {
    entradas, resultado,
    totalOficial: resultado.totalOficial,
    totalMaximo: resultado.totalMaximo,
    lancados: resultado.criterios.filter(c => c.oficial !== null).length,
    invalidos: resultado.invalidas,
  };
}

export { selecionarCriteriosAplicaveis };

/** Soma só valores numéricos válidos (ausente/inválido ficam de fora; nunca viram zero na soma silenciosa). */
export function somarNotasValidas(valores: unknown[]): { total: number; invalidos: number } {
  let total = 0, invalidos = 0;
  for (const v of valores) {
    const n = lerNumero(v);
    if (n.invalido) invalidos++;
    else if (n.valor !== null) total += n.valor;
  }
  return { total, invalidos };
}
