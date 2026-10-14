/**
 * Liga a estrutura avaliativa EXISTENTE (criterios_avaliacao + avaliacoes + ocorrencias) à engine.
 * Somente leitura: não grava nem altera nenhuma tabela. Sem configuração de cálculo, o critério é
 * tratado como "manual" e usa a nota já lançada, exatamente como o app faz hoje.
 *
 * Colunas OPCIONAIS reconhecidas em criterios_avaliacao (ausentes hoje; nada é criado na planilha):
 *   tipo_calculo (single|proportional|continuous|rubric|manual|hybrid), config_calculo_json,
 *   subcriterios_json.
 */
import type { CriterioAvaliacao, Avaliacao, Ocorrencia } from '../types';
import {
  numeroOuNulo,
  type ConfigCalculo, type DadosCriterio, type EntradaCriterio, type OcorrenciaAvaliacao,
  type Subcriterio, type TipoCriterio,
} from './avaliacaoEngine';

const TIPOS: TipoCriterio[] = ['single', 'proportional', 'continuous', 'rubric', 'manual', 'hybrid'];

function jsonOuNulo<T>(v: unknown): T | null {
  if (typeof v !== 'string' || v.trim() === '') return null;
  try { return JSON.parse(v) as T; } catch { return null; }
}

export function criterioDaPlanilha(c: CriterioAvaliacao, nota: Avaliacao | undefined, extras: DadosCriterio = {}): EntradaCriterio {
  const tipoBruto = String(c.tipo_calculo ?? '').trim().toLowerCase() as TipoCriterio;
  const subs = jsonOuNulo<Subcriterio[]>(c.subcriterios_json) || [];
  const tipo: TipoCriterio = TIPOS.includes(tipoBruto) ? tipoBruto : 'manual';
  return {
    id: c.criterio_id,
    disciplinaId: String(c.disciplina_id ?? ''),
    nome: c.nome,
    tipo,
    maxPontos: numeroOuNulo(c.nota_maxima) ?? 0,
    subcriterios: subs.map(s => ({ ...s, criterioId: c.criterio_id })),
    config: jsonOuNulo<ConfigCalculo>(c.config_calculo_json) || undefined,
    dados: { nota: nota ? numeroOuNulo(nota.nota) : null, ...extras },
  };
}

/** Critérios ativos da turma, na ordem da planilha, com a nota já lançada da matrícula. */
export function entradasDaMatricula(
  criterios: CriterioAvaliacao[],
  avaliacoes: Avaliacao[],
  matriculaId: string,
  turmaId: string,
  extrasPorCriterio: Record<string, DadosCriterio> = {},
): EntradaCriterio[] {
  return criterios
    .filter(c => c.ativo !== false && (!c.turma_id || c.turma_id === turmaId))
    .sort((a, b) => (numeroOuNulo(a.ordem) ?? 0) - (numeroOuNulo(b.ordem) ?? 0))
    .map(c => criterioDaPlanilha(
      c,
      avaliacoes.find(a => a.matricula_id === matriculaId && a.criterio_id === c.criterio_id),
      extrasPorCriterio[c.criterio_id],
    ));
}

/** Ocorrências existentes entram como "registrada" e SEM desconto automático (nenhuma regra cadastrada). */
export function ocorrenciasParaAvaliacao(ocs: Ocorrencia[], matriculaId: string): OcorrenciaAvaliacao[] {
  return ocs.filter(o => o.matricula_id === matriculaId).map(o => ({
    id: o.ocorrencia_id, tipo: o.tipo, deducaoAutomatica: false, status: 'registrada' as const,
  }));
}
