/**
 * Liga a estrutura avaliativa EXISTENTE (criterios_avaliacao + avaliacoes + ocorrencias) à engine.
 * Somente leitura: não grava nem altera nenhuma tabela. Sem configuração, o critério é "manual":
 * usa a nota já lançada, exatamente como o app faz hoje. Nenhuma fórmula é inferida pelo nome do critério.
 *
 * Fontes de configuração (todas opcionais e aditivas):
 *  - colunas opcionais em criterios_avaliacao: tipo_calculo, config_calculo_json, subcriterios_json;
 *  - `ConfiguracaoCriterio` vinda das tabelas de configuração por turma/período (avaliacaoConfig.ts).
 */
import type { CriterioAvaliacao, Avaliacao, Ocorrencia } from '../types';
import {
  lerNumero,
  type ConfigCalculo, type DadosCriterio, type EntradaCriterio, type OcorrenciaAvaliacao,
  type Subcriterio, type TipoCriterio,
} from './avaliacaoEngine';

const TIPOS: TipoCriterio[] = ['single', 'proportional', 'continuous', 'rubric', 'manual', 'hybrid'];

export interface ConfiguracaoCriterio {
  tipo?: TipoCriterio;
  config?: ConfigCalculo;
  subcriterios?: Subcriterio[];
}

function jsonOuNulo<T>(v: unknown): T | null {
  if (typeof v !== 'string' || v.trim() === '') return null;
  try { return JSON.parse(v) as T; } catch { return null; }
}

/** Critérios aplicáveis: um único filtro para todas as telas (turma, disciplina, ativo e instrumento). */
export function selecionarCriteriosAplicaveis(
  criterios: CriterioAvaliacao[],
  alvo: { turmaId?: string; disciplinaId?: string; instrumento?: string },
): CriterioAvaliacao[] {
  return criterios
    .filter(c => {
      if (c.ativo === false) return false;
      if (c.turma_id && alvo.turmaId && c.turma_id !== alvo.turmaId) return false;
      if (c.disciplina_id && alvo.disciplinaId && c.disciplina_id !== alvo.disciplinaId) return false;
      if (alvo.instrumento !== undefined) {
        const inst = String(c.instrumento_avaliacao || c.instrumento || '').trim();
        if (alvo.instrumento === 'Avaliação do estágio') return inst === '';
        return inst === '' ? true : inst === alvo.instrumento.trim();
      }
      return true;
    })
    .sort((a, b) => (lerNumero(a.ordem).valor ?? 0) - (lerNumero(b.ordem).valor ?? 0));
}

export function criterioDaPlanilha(
  c: CriterioAvaliacao,
  nota: Avaliacao | undefined,
  extras: DadosCriterio = {},
  configuracao?: ConfiguracaoCriterio,
): EntradaCriterio {
  const tipoBruto = String(c.tipo_calculo ?? '').trim().toLowerCase() as TipoCriterio;
  const subsPlanilha = jsonOuNulo<Subcriterio[]>(c.subcriterios_json) || [];
  const tipo: TipoCriterio = configuracao?.tipo ?? (TIPOS.includes(tipoBruto) ? tipoBruto : 'manual');
  const subs = configuracao?.subcriterios ?? subsPlanilha;
  return {
    id: c.criterio_id,
    disciplinaId: String(c.disciplina_id ?? ''),
    nome: c.nome,
    tipo,
    maxPontos: lerNumero(c.nota_maxima).valor ?? 0,
    subcriterios: subs.map(s => ({ ...s, criterioId: c.criterio_id })),
    config: configuracao?.config ?? jsonOuNulo<ConfigCalculo>(c.config_calculo_json) ?? undefined,
    // a nota entra CRUA: a engine distingue ausente (null), inválida (sinalizada) e zero explícito
    dados: { nota: nota ? nota.nota : null, ...extras },
  };
}

/** Entradas da engine para uma matrícula. `avaliacoes` pode vir pré-filtrada (matriculaId omitido). */
export function entradasDaMatricula(
  criterios: CriterioAvaliacao[],
  avaliacoes: Avaliacao[],
  matriculaId: string | null,
  turmaId: string,
  extrasPorCriterio: Record<string, DadosCriterio> = {},
  configPorCriterio: Record<string, ConfiguracaoCriterio> = {},
  disciplinaId?: string,
): EntradaCriterio[] {
  return selecionarCriteriosAplicaveis(criterios, { turmaId, disciplinaId }).map(c => criterioDaPlanilha(
    c,
    avaliacoes.find(a => a.criterio_id === c.criterio_id && (matriculaId === null || a.matricula_id === matriculaId)),
    extrasPorCriterio[c.criterio_id],
    configPorCriterio[c.criterio_id],
  ));
}

/** Ocorrências existentes entram como "registrada" e SEM desconto automático (nenhuma regra cadastrada). */
export function ocorrenciasParaAvaliacao(ocs: Ocorrencia[], matriculaId: string | null): OcorrenciaAvaliacao[] {
  return ocs.filter(o => matriculaId === null || o.matricula_id === matriculaId).map(o => ({
    id: o.ocorrencia_id, tipo: o.tipo, deducaoAutomatica: false, status: 'registrada' as const,
  }));
}
