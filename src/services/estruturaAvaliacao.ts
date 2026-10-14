/**
 * Estrutura ADITIVA e versionada da avaliação (4 abas novas). Nenhuma aba existente é alterada:
 * `criterios_avaliacao`, `avaliacoes` e `avaliacoes_completas` continuam sendo a fonte oficial de critérios e notas.
 *
 *  config_avaliacao      configuração do cálculo por turma + período + critério (uma linha por versão)
 *  rubricas_avaliacao    definição da rubrica (subcritérios, pesos, descritores) — uma linha por versão
 *  avaliacao_rascunhos   níveis escolhidos / ajustes / histórico (rascunho; nunca é a nota oficial)
 *  evidencias_avaliacao  evidências por referência a registros existentes (sem copiar conteúdo clínico)
 *
 * As abas são únicas (não se cria aba por semestre): período, turma e versão são colunas.
 */
import type { ConfigCalculo, Subcriterio, TipoCriterio } from './avaliacaoEngine';
import type { ConfiguracaoCriterio } from './avaliacaoAdaptador';
import type { AjusteRss } from './rssEntregas';
import { subcriteriosParaEngine, type DefinicaoSubcriterio, type RascunhoAvaliacao, type RubricaVersao, type StatusRubrica, type TipoEstagio, type SelecaoNivel, type EventoHistorico } from './rubricasAvaliacao';

export const ABAS_AVALIACAO = {
  config_avaliacao: {
    pk: 'config_id',
    colunas: ['config_id', 'periodo_id', 'turma_id', 'criterio_id', 'versao', 'status', 'tipo_calculo', 'tipo_estagio', 'config_json', 'rubrica_id', 'motivo_alteracao', 'criado_em', 'criado_por', 'aprovado_em', 'aprovado_por'],
  },
  rubricas_avaliacao: {
    pk: 'rubrica_chave',
    colunas: ['rubrica_chave', 'rubrica_id', 'versao', 'criterio_id', 'turma_id', 'periodo_id', 'tipo_estagio', 'status', 'subcriterios_json', 'peso_total', 'origem', 'motivo_alteracao', 'criado_em', 'criado_por', 'aprovado_em', 'aprovado_por'],
  },
  avaliacao_rascunhos: {
    pk: 'rascunho_id',
    colunas: ['rascunho_id', 'matricula_id', 'grupo_id', 'turma_id', 'escopo', 'criterio_id', 'rubrica_id', 'rubrica_versao', 'pesos_json', 'selecoes_json', 'status', 'historico_json', 'atualizado_em', 'atualizado_por'],
  },
  /** Correções auditáveis de associação de RSS (semana/unidade) e observações pontuais. A fonte `registros_semanais` nunca é alterada. */
  rss_ajustes: {
    pk: 'ajuste_id',
    colunas: ['ajuste_id', 'tipo', 'registro_id', 'turma_id', 'unidade_tipo', 'unidade_id', 'semana', 'semana_original', 'unidade_original_tipo', 'unidade_original_id', 'observacao', 'status', 'criado_em', 'criado_por', 'atualizado_em'],
  },
  evidencias_avaliacao: {
    pk: 'evidencia_id',
    colunas: ['evidencia_id', 'periodo_id', 'turma_id', 'matricula_id', 'grupo_id', 'data', 'origem', 'criterio_id', 'subcriterio_id', 'polaridade', 'observacao', 'responsavel', 'referencia_tabela', 'referencia_id', 'preliminar', 'criado_em', 'atualizado_em'],
  },
} as const;
export type NomeAbaAvaliacao = keyof typeof ABAS_AVALIACAO;
export const NOMES_ABAS_AVALIACAO = Object.keys(ABAS_AVALIACAO) as NomeAbaAvaliacao[];

export type OrigemEvidencia = 'SUPERVISAO' | 'ENTREGA_DOCUMENTAL' | 'ATIVIDADE_AVALIATIVA' | 'OBSERVACAO_PROFESSORA' | 'CONTRIBUICAO_MONITORA';
export type PolaridadeEvidencia = 'POSITIVO' | 'DESENVOLVER' | 'NEUTRO';
export const ORIGENS_EVIDENCIA: OrigemEvidencia[] = ['SUPERVISAO', 'ENTREGA_DOCUMENTAL', 'ATIVIDADE_AVALIATIVA', 'OBSERVACAO_PROFESSORA', 'CONTRIBUICAO_MONITORA'];

export interface EvidenciaAvaliacao {
  evidencia_id: string;
  periodo_id: string;
  turma_id: string;
  matricula_id: string;
  grupo_id?: string;
  data: string;
  origem: OrigemEvidencia;
  criterio_id?: string;
  subcriterio_id?: string;
  polaridade: PolaridadeEvidencia;
  /** observação objetiva e curta; não copiar conteúdo clínico: prefira a referência ao registro de origem */
  observacao: string;
  responsavel: string;
  referencia_tabela?: string;
  referencia_id?: string;
  /** contribuição de monitora é preliminar até a professora usar */
  preliminar: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ConfigAvaliacao {
  config_id: string;
  periodo_id: string;
  turma_id: string;
  criterio_id: string;
  versao: number;
  status: 'rascunho' | 'aprovada' | 'arquivada';
  tipo_calculo: TipoCriterio;
  tipo_estagio?: TipoEstagio;
  config: ConfigCalculo;
  rubrica_id?: string;
  motivo_alteracao?: string;
  criado_em: string; criado_por: string; aprovado_em?: string; aprovado_por?: string;
}

// ---------------------------------------------------------------------------------------------
// JSON tolerante: JSON inválido nunca derruba a leitura nem vira dado silenciosamente vazio.
// ---------------------------------------------------------------------------------------------
function lerJson<T>(v: unknown, padrao: T): { valor: T; erro: boolean } {
  if (v === null || v === undefined || String(v).trim() === '') return { valor: padrao, erro: false };
  try { return { valor: JSON.parse(String(v)) as T, erro: false }; } catch { return { valor: padrao, erro: true }; }
}
const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const booleano = (v: unknown) => v === true || ['TRUE', 'VERDADEIRO', '1', 'SIM'].includes(texto(v).trim().toUpperCase());
const inteiro = (v: unknown, padrao = 1) => { const n = Number(texto(v).replace(',', '.')); return Number.isInteger(n) && n > 0 ? n : padrao; };

export const chaveRubrica = (rubricaId: string, versao: number) => `${rubricaId}#v${versao}`;

export function rubricaParaLinha(r: RubricaVersao): Record<string, unknown> {
  return {
    rubrica_chave: chaveRubrica(r.rubrica_id, r.versao), rubrica_id: r.rubrica_id, versao: r.versao, criterio_id: r.criterio_id,
    turma_id: r.turma_id, periodo_id: r.periodo_id, tipo_estagio: r.tipo_estagio, status: r.status,
    subcriterios_json: JSON.stringify(r.subcriterios), peso_total: r.peso_total, origem: r.origem,
    motivo_alteracao: r.motivo_alteracao ?? '', criado_em: r.criado_em, criado_por: r.criado_por,
    aprovado_em: r.aprovado_em ?? '', aprovado_por: r.aprovado_por ?? '',
  };
}
export function linhaParaRubrica(l: Record<string, unknown>): { rubrica: RubricaVersao | null; problema?: string } {
  const subs = lerJson<DefinicaoSubcriterio[]>(l.subcriterios_json, []);
  if (subs.erro || !Array.isArray(subs.valor)) return { rubrica: null, problema: 'subcriterios_json inválido' };
  const status = texto(l.status) as StatusRubrica;
  return {
    rubrica: {
      rubrica_id: texto(l.rubrica_id), versao: inteiro(l.versao), criterio_id: texto(l.criterio_id), turma_id: texto(l.turma_id),
      periodo_id: texto(l.periodo_id), tipo_estagio: (texto(l.tipo_estagio) || 'OUTRO') as TipoEstagio,
      status: status === 'aprovada' ? 'aprovada' : 'rascunho', subcriterios: subs.valor,
      peso_total: Number(texto(l.peso_total).replace(',', '.')) || 0, origem: texto(l.origem),
      criado_em: texto(l.criado_em), criado_por: texto(l.criado_por),
      aprovado_em: texto(l.aprovado_em) || undefined, aprovado_por: texto(l.aprovado_por) || undefined,
      motivo_alteracao: texto(l.motivo_alteracao) || undefined,
    },
  };
}

export function rascunhoParaLinha(r: RascunhoAvaliacao, turmaId: string, por: string): Record<string, unknown> {
  return {
    rascunho_id: r.rascunho_id, matricula_id: r.matricula_id, grupo_id: r.grupo_id ?? '', turma_id: turmaId, escopo: r.escopo,
    criterio_id: r.criterio_id, rubrica_id: r.rubrica_id, rubrica_versao: r.rubrica_versao,
    pesos_json: JSON.stringify(r.pesos), selecoes_json: JSON.stringify(r.selecoes), status: r.status,
    historico_json: JSON.stringify(r.historico), atualizado_em: r.atualizado_em, atualizado_por: por,
  };
}
export function linhaParaRascunho(l: Record<string, unknown>): { rascunho: RascunhoAvaliacao | null; problema?: string } {
  const pesos = lerJson<Record<string, number>>(l.pesos_json, {});
  const sel = lerJson<SelecaoNivel[]>(l.selecoes_json, []);
  const his = lerJson<EventoHistorico[]>(l.historico_json, []);
  if (pesos.erro || sel.erro || his.erro || !Array.isArray(sel.valor) || !Array.isArray(his.valor)) return { rascunho: null, problema: 'JSON do rascunho inválido' };
  return {
    rascunho: {
      rascunho_id: texto(l.rascunho_id), matricula_id: texto(l.matricula_id), grupo_id: texto(l.grupo_id) || undefined,
      escopo: texto(l.escopo) === 'COLETIVA' ? 'COLETIVA' : 'INDIVIDUAL', criterio_id: texto(l.criterio_id),
      rubrica_id: texto(l.rubrica_id), rubrica_versao: inteiro(l.rubrica_versao), pesos: pesos.valor, selecoes: sel.valor,
      status: texto(l.status) === 'CONFIRMADA' ? 'CONFIRMADA' : 'RASCUNHO', historico: his.valor, atualizado_em: texto(l.atualizado_em),
    },
  };
}

export function configParaLinha(c: ConfigAvaliacao): Record<string, unknown> {
  return {
    config_id: c.config_id, periodo_id: c.periodo_id, turma_id: c.turma_id, criterio_id: c.criterio_id, versao: c.versao,
    status: c.status, tipo_calculo: c.tipo_calculo, tipo_estagio: c.tipo_estagio ?? '', config_json: JSON.stringify(c.config ?? {}),
    rubrica_id: c.rubrica_id ?? '', motivo_alteracao: c.motivo_alteracao ?? '', criado_em: c.criado_em, criado_por: c.criado_por,
    aprovado_em: c.aprovado_em ?? '', aprovado_por: c.aprovado_por ?? '',
  };
}
const TIPOS_CALCULO: TipoCriterio[] = ['single', 'proportional', 'continuous', 'rubric', 'manual', 'hybrid'];
export function linhaParaConfig(l: Record<string, unknown>): { config: ConfigAvaliacao | null; problema?: string } {
  const cfg = lerJson<ConfigCalculo>(l.config_json, {});
  const tipo = texto(l.tipo_calculo).trim().toLowerCase() as TipoCriterio;
  if (cfg.erro) return { config: null, problema: 'config_json inválido' };
  if (!TIPOS_CALCULO.includes(tipo)) return { config: null, problema: 'tipo_calculo desconhecido' };
  const st = texto(l.status);
  return {
    config: {
      config_id: texto(l.config_id), periodo_id: texto(l.periodo_id), turma_id: texto(l.turma_id), criterio_id: texto(l.criterio_id),
      versao: inteiro(l.versao), status: st === 'aprovada' || st === 'arquivada' ? st : 'rascunho', tipo_calculo: tipo,
      tipo_estagio: (texto(l.tipo_estagio) || undefined) as TipoEstagio | undefined, config: cfg.valor,
      rubrica_id: texto(l.rubrica_id) || undefined, motivo_alteracao: texto(l.motivo_alteracao) || undefined,
      criado_em: texto(l.criado_em), criado_por: texto(l.criado_por),
      aprovado_em: texto(l.aprovado_em) || undefined, aprovado_por: texto(l.aprovado_por) || undefined,
    },
  };
}

export function evidenciaParaLinha(e: EvidenciaAvaliacao): Record<string, unknown> {
  return { ...e, grupo_id: e.grupo_id ?? '', criterio_id: e.criterio_id ?? '', subcriterio_id: e.subcriterio_id ?? '',
    referencia_tabela: e.referencia_tabela ?? '', referencia_id: e.referencia_id ?? '', preliminar: e.preliminar ? 'TRUE' : 'FALSE' };
}
export function linhaParaEvidencia(l: Record<string, unknown>): EvidenciaAvaliacao {
  const origem = texto(l.origem) as OrigemEvidencia;
  const pol = texto(l.polaridade) as PolaridadeEvidencia;
  return {
    evidencia_id: texto(l.evidencia_id), periodo_id: texto(l.periodo_id), turma_id: texto(l.turma_id), matricula_id: texto(l.matricula_id),
    grupo_id: texto(l.grupo_id) || undefined, data: texto(l.data),
    origem: ORIGENS_EVIDENCIA.includes(origem) ? origem : 'OBSERVACAO_PROFESSORA',
    criterio_id: texto(l.criterio_id) || undefined, subcriterio_id: texto(l.subcriterio_id) || undefined,
    polaridade: pol === 'POSITIVO' || pol === 'DESENVOLVER' ? pol : 'NEUTRO', observacao: texto(l.observacao),
    responsavel: texto(l.responsavel), referencia_tabela: texto(l.referencia_tabela) || undefined, referencia_id: texto(l.referencia_id) || undefined,
    preliminar: booleano(l.preliminar), criado_em: texto(l.criado_em), atualizado_em: texto(l.atualizado_em),
  };
}

// ---------------------------------------------------------------------------------------------
// Resolução da configuração por turma + período (versão aprovada mais recente; histórico preservado)
// ---------------------------------------------------------------------------------------------
export function configVigente(configs: ConfigAvaliacao[], turmaId: string, periodoId: string, criterioId: string): ConfigAvaliacao | null {
  return configs
    .filter(c => c.turma_id === turmaId && c.periodo_id === periodoId && c.criterio_id === criterioId && c.status === 'aprovada')
    .sort((a, b) => b.versao - a.versao)[0] ?? null;
}
export function rubricaDaVersao(rubricas: RubricaVersao[], rubricaId: string, versao: number): RubricaVersao | null {
  return rubricas.find(r => r.rubrica_id === rubricaId && r.versao === versao) ?? null;
}

/**
 * Configuração por critério para a engine. A rubrica só calcula prévia se a versão do RASCUNHO estiver aprovada;
 * os subcritérios vêm da versão guardada no rascunho do aluno (mudanças futuras da rubrica não o alteram).
 */
export function configPorCriterioDoAluno(p: {
  configs: ConfigAvaliacao[]; rubricas: RubricaVersao[]; rascunhos: RascunhoAvaliacao[];
  turmaId: string; periodoId: string; criterioIds: string[]; matriculaId: string;
}): Record<string, ConfiguracaoCriterio> {
  const out: Record<string, ConfiguracaoCriterio> = {};
  for (const criterioId of p.criterioIds) {
    const cfg = configVigente(p.configs, p.turmaId, p.periodoId, criterioId);
    if (!cfg) continue; // sem configuração aprovada: critério continua manual
    const entrada: ConfiguracaoCriterio = { tipo: cfg.tipo_calculo, config: { ...cfg.config } };
    const rasc = p.rascunhos.find(r => r.matricula_id === p.matriculaId && r.criterio_id === criterioId && r.escopo === 'INDIVIDUAL')
      ?? undefined;
    if (rasc) {
      const rub = rubricaDaVersao(p.rubricas, rasc.rubrica_id, rasc.rubrica_versao);
      if (rub) {
        entrada.subcriterios = subcriteriosParaEngine(rub, rasc) as Subcriterio[];
        if (rub.status !== 'aprovada') delete entrada.config!.agregacao; // rubrica não aprovada: sem cálculo
        else entrada.config!.agregacao = entrada.config!.agregacao ?? 'soma';
      }
    }
    out[criterioId] = entrada;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Diagnóstico do esquema real (somente leitura)
// ---------------------------------------------------------------------------------------------
export interface DiagnosticoAba { aba: NomeAbaAvaliacao; situacao: 'ausente' | 'ok' | 'colunas_faltando'; faltando: string[]; extras: string[] }
export function diagnosticarEstrutura(cabecalhosReais: Partial<Record<string, string[]>>): DiagnosticoAba[] {
  return NOMES_ABAS_AVALIACAO.map(aba => {
    const real = cabecalhosReais[aba];
    const esperado: readonly string[] = ABAS_AVALIACAO[aba].colunas;
    if (!real || real.length === 0) return { aba, situacao: 'ausente' as const, faltando: [...esperado], extras: [] };
    const limpo = real.map(h => String(h).trim());
    const faltando = esperado.filter(c => !limpo.includes(c));
    return { aba, situacao: faltando.length ? 'colunas_faltando' as const : 'ok' as const, faltando, extras: limpo.filter(h => h && !esperado.includes(h)) };
  });
}

// ---------------------------------------------------------------------------------------------
// RSS: correções de associação e observações (aba `rss_ajustes`)
// ---------------------------------------------------------------------------------------------
export function ajusteParaLinha(a: AjusteRss): Record<string, unknown> {
  return {
    ajuste_id: a.ajuste_id, tipo: a.tipo, registro_id: a.registro_id ?? '', turma_id: a.turma_id, unidade_tipo: a.unidade_tipo ?? '', unidade_id: a.unidade_id ?? '',
    semana: a.semana ?? '', semana_original: a.semana_original ?? '', unidade_original_tipo: a.unidade_original_tipo ?? '', unidade_original_id: a.unidade_original_id ?? '',
    observacao: a.observacao ?? '', status: a.status, criado_em: a.criado_em, criado_por: a.criado_por, atualizado_em: a.atualizado_em ?? a.criado_em,
  };
}
const semanaOuNulo = (v: unknown): number | null => { const n = Number(texto(v)); return Number.isInteger(n) && n >= 1 ? n : null; };
const tipoUnidade = (v: unknown): 'MATRICULA' | 'GRUPO' | undefined => { const t = texto(v).toUpperCase(); return t === 'MATRICULA' || t === 'GRUPO' ? t : undefined; };
export function linhaParaAjuste(l: Record<string, unknown>): AjusteRss {
  return {
    ajuste_id: texto(l.ajuste_id), tipo: texto(l.tipo).toUpperCase() === 'OBSERVACAO' ? 'OBSERVACAO' : 'ASSOCIAR',
    registro_id: texto(l.registro_id) || undefined, turma_id: texto(l.turma_id), unidade_tipo: tipoUnidade(l.unidade_tipo), unidade_id: texto(l.unidade_id) || undefined,
    semana: semanaOuNulo(l.semana), semana_original: semanaOuNulo(l.semana_original), unidade_original_tipo: tipoUnidade(l.unidade_original_tipo) ?? null,
    unidade_original_id: texto(l.unidade_original_id) || null, observacao: texto(l.observacao) || undefined,
    status: texto(l.status).toUpperCase() === 'REVOGADO' ? 'REVOGADO' : 'ATIVO',
    criado_em: texto(l.criado_em), criado_por: texto(l.criado_por), atualizado_em: texto(l.atualizado_em) || undefined,
  };
}
