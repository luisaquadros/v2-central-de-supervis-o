/**
 * Engine de avaliação (camada pura, sem leitura/escrita de dados).
 *
 * Separa quatro coisas que nunca se misturam:
 *  - OFICIAL: nota já lançada pela professora (tabela `avaliacoes`). A engine nunca a altera.
 *  - PRÉVIA: pontuação derivada de regra/rubrica/proporção. Diagnóstico, nunca gravada sozinha.
 *  - PRAZO: cumprimento de entrega. Dimensão própria; não gera nota nem desconto sem regra expressa.
 *  - DIVERGÊNCIA: diferença entre oficial e prévia, apenas sinalizada.
 *
 * Invariantes: ausente = null (nunca zero); inválido é sinalizado e fica fora da soma; sem média
 * parcial, nota convertida para 10 ou projeção; participação/desempenho não vêm do tempo decorrido.
 */

export type StatusCriterio = 'calculado' | 'a_conferir' | 'nao_avaliado' | 'aguardando_decisao' | 'concluido';
export type TipoCriterio = 'single' | 'proportional' | 'continuous' | 'rubric' | 'manual' | 'hybrid';
export type AgregacaoRubrica = 'soma' | 'media_ponderada' | 'normalizacao';
export type SituacaoEntrega = 'antecipado' | 'no_prazo' | 'apos_prazo' | 'desconhecido';
export type NivelDesempenho = 'EXCELENTE' | 'ADEQUADO' | 'PARCIAL' | 'INSUFICIENTE' | 'NAO_ATENDIDO' | 'NAO_AVALIADO';

/** Fração do peso do subcritério por nível. NAO_AVALIADO = sem pontuação (null), nunca zero. */
export const FATOR_NIVEL: Record<NivelDesempenho, number | null> = {
  EXCELENTE: 1, ADEQUADO: 0.75, PARCIAL: 0.5, INSUFICIENTE: 0.25, NAO_ATENDIDO: 0, NAO_AVALIADO: null,
};

export interface AjusteManual { nota: number; justificativa: string }

export interface Subcriterio {
  id: string;
  criterioId: string;
  nome: string;
  descricao?: string;
  maxPontos?: number;
  peso?: number;
  /** nota direta (legado/lançamento manual) */
  nota?: number | null;
  /** nível escolhido; a pontuação é maxPontos × FATOR_NIVEL */
  nivel?: NivelDesempenho | null;
  /** ajuste da professora: só vale com justificativa */
  ajuste?: AjusteManual | null;
  status?: string;
  descritores?: unknown[];
  observacoes?: string;
  [extra: string]: unknown;
}

export interface Deducao {
  regraId: string;
  origem: string;
  /** identifica o fato gerador (ex.: id da ocorrência/entrega) para evitar dupla penalização */
  origemId?: string;
  criterioId: string;
  valor: number;
  justificativa: string;
  automatica: boolean;
}

export interface RegraAtraso { regraId: string; valor: number; justificativa: string }

export interface ConfigCalculo {
  /** proportional: previa = valorBruto / denominador × maxPontos (prova: 10; registros: total do semestre) */
  denominador?: number;
  /** rubric/hybrid: sem agregação declarada a engine não calcula prévia (preserva o lançamento manual) */
  agregacao?: AgregacaoRubrica;
  /** desconto por atraso: só existe com regra expressa e configurada */
  regraAtraso?: RegraAtraso;
}

export interface DadosCriterio {
  /** nota OFICIAL lançada (em pontos do critério) */
  nota?: unknown;
  /** proportional: numerador (nota bruta da prova, registros concluídos...) */
  valorBruto?: unknown;
  esperadosAteOPrazo?: number | null;
  /** cumprimento de prazo (dimensão separada da qualidade) */
  entrega?: SituacaoEntrega | null;
  naoAvaliado?: boolean;
  aConferir?: boolean;
  concluido?: boolean;
}

export interface EntradaCriterio {
  id: string;
  disciplinaId: string;
  nome: string;
  tipo: TipoCriterio;
  maxPontos: number;
  subcriterios?: Subcriterio[];
  config?: ConfigCalculo;
  dados?: DadosCriterio;
  deducoes?: Deducao[];
}

export interface OcorrenciaAvaliacao {
  id: string;
  tipo: string;
  criterioId?: string;
  subcriterioId?: string;
  deducaoAutomatica: boolean;
  valorDeducao?: number;
  regraId?: string;
  origem?: string;
  justificativa?: string;
  /** ocorrência ética relevante: gera sinalização separada, nunca desconto automático */
  eticaRelevante?: boolean;
  status: 'registrada' | 'aguardando_decisao' | 'aplicada' | 'ignorada';
}

export interface PeriodoAvaliacao {
  rotulo: string;
  esperadosRegistros?: number;
  totalRegistros?: number;
}

export interface ResultadoCriterio {
  id: string;
  nome: string;
  tipo: TipoCriterio;
  maxPontos: number;
  /** nota oficial válida lançada, ou null */
  oficial: number | null;
  /** prévia calculada (não oficial), ou null */
  previa: number | null;
  /** soma dos subcritérios já avaliados quando a rubrica está incompleta (não entra em totais) */
  previaParcial: number | null;
  /** oficial ?? previa — pontuação considerada */
  score: number | null;
  origem: 'oficial' | 'previa' | null;
  status: StatusCriterio;
  invalida: boolean;
  prazo: SituacaoEntrega | null;
  deducoes: Deducao[];
  subcriterios: Subcriterio[];
  situacao: string;
  alertas: string[];
}

export interface Divergencia { criterioId: string; nome: string; oficial: number; previa: number; diferenca: number }
export interface Sinalizacao { tipo: 'ETICA'; ocorrenciaId: string; mensagem: string }

export interface ResultadoAvaliacao {
  criterios: ResultadoCriterio[];
  /** soma só das notas oficiais válidas */
  totalOficial: number;
  /** soma de oficial, ou prévia onde não há oficial (diagnóstico; não é nota) */
  totalComPrevias: number;
  totalMaximo: number;
  divergencias: Divergencia[];
  invalidas: string[];
  pendentes: string[];
  ocorrenciasPendentes: OcorrenciaAvaliacao[];
  sinalizacoes: Sinalizacao[];
}

const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const TOLERANCIA = 0.005; // precisão de exibição (2 casas)

/** Leitura de célula/valor: ausente → null; texto não numérico → invalido=true (nunca zero). */
export function lerNumero(v: unknown): { valor: number | null; invalido: boolean } {
  if (v === null || v === undefined) return { valor: null, invalido: false };
  if (typeof v === 'number') return Number.isFinite(v) ? { valor: v, invalido: false } : { valor: null, invalido: true };
  const t = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return { valor: null, invalido: false };
  const n = Number(t);
  return Number.isFinite(n) ? { valor: n, invalido: false } : { valor: null, invalido: true };
}

/** Compatibilidade: valor numérico ou null (inválido também vira null; use lerNumero para distinguir). */
export function numeroOuNulo(v: unknown): number | null { return lerNumero(v).valor; }

/** Exibição em pt-BR com 2 casas; a precisão interna é mantida. */
export function formatarPontos(v: number | null | undefined): string {
  if (!finito(v)) return '—';
  return (Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',');
}

/** Pontuação de um subcritério: ajuste justificado > nível > nota direta. */
export function pontuarSubcriterio(s: Subcriterio): { valor: number | null; origem: 'ajuste' | 'nivel' | 'nota' | null; alerta?: string } {
  const max = finito(s.maxPontos) ? s.maxPontos : undefined;
  if (s.ajuste) {
    const ok = finito(s.ajuste.nota) && typeof s.ajuste.justificativa === 'string' && s.ajuste.justificativa.trim() !== ''
      && s.ajuste.nota >= 0 && (max === undefined || s.ajuste.nota <= max + 1e-9);
    if (ok) return { valor: s.ajuste.nota, origem: 'ajuste' };
    return { valor: null, origem: null, alerta: `Ajuste de "${s.nome}" sem justificativa ou fora do limite; ignorado.` };
  }
  if (s.nivel && s.nivel !== 'NAO_AVALIADO') {
    const f = FATOR_NIVEL[s.nivel];
    if (f === null || f === undefined) return { valor: null, origem: null, alerta: `Nível desconhecido em "${s.nome}".` };
    if (max === undefined) return { valor: null, origem: null, alerta: `"${s.nome}" sem peso para aplicar o nível.` };
    return { valor: max * f, origem: 'nivel' };
  }
  if (s.nivel === 'NAO_AVALIADO') return { valor: null, origem: null };
  const n = lerNumero(s.nota);
  if (n.invalido) return { valor: null, origem: null, alerta: `Nota inválida em "${s.nome}".` };
  if (n.valor !== null && (n.valor < 0 || (max !== undefined && n.valor > max + 1e-9))) {
    return { valor: null, origem: null, alerta: `Nota fora do limite em "${s.nome}".` };
  }
  return { valor: n.valor, origem: n.valor === null ? null : 'nota' };
}

function agregarRubrica(c: EntradaCriterio, agregacao: AgregacaoRubrica, alertas: string[]):
  { previa: number | null; parcial: number | null } {
  const subs = c.subcriterios || [];
  if (subs.length === 0) return { previa: null, parcial: null };
  const pts = subs.map(s => {
    const r = pontuarSubcriterio(s);
    if (r.alerta) alertas.push(r.alerta);
    return r.valor;
  });
  const avaliados = pts.filter(finito);
  const parcial = avaliados.length ? avaliados.reduce((a, v) => a + v, 0) : null;
  if (avaliados.length !== subs.length) return { previa: null, parcial };
  const nums = pts as number[];
  if (agregacao === 'soma') return { previa: nums.reduce((a, v) => a + v, 0), parcial };
  if (agregacao === 'media_ponderada') {
    if (subs.some(s => !finito(s.peso))) return { previa: null, parcial };
    return { previa: nums.reduce((a, v, i) => a + v * (subs[i].peso as number), 0), parcial };
  }
  const maxRub = subs.reduce((a, s) => a + (finito(s.maxPontos) ? s.maxPontos : 0), 0);
  if (maxRub <= 0) return { previa: null, parcial };
  return { previa: (nums.reduce((a, v) => a + v, 0) / maxRub) * c.maxPontos, parcial };
}

export function calcularCriterio(c: EntradaCriterio, periodo?: PeriodoAvaliacao): ResultadoCriterio {
  const d = c.dados || {};
  const cfg = c.config || {};
  const r: ResultadoCriterio = {
    id: c.id, nome: c.nome, tipo: c.tipo, maxPontos: c.maxPontos,
    oficial: null, previa: null, previaParcial: null, score: null, origem: null,
    status: 'nao_avaliado', invalida: false, prazo: d.entrega ?? null, deducoes: [],
    subcriterios: (c.subcriterios || []).map(s => ({ ...s })), situacao: '', alertas: [],
  };

  // 1) nota OFICIAL: preservada; inválida/fora do limite é sinalizada e fica fora da soma
  const nota = lerNumero(d.nota);
  if (nota.invalido) {
    r.invalida = true; r.alertas.push('Nota inválida na base; conferir. Não entra no acumulado.');
  } else if (nota.valor !== null && (nota.valor < -1e-9 || nota.valor > c.maxPontos + 1e-9)) {
    r.invalida = true; r.alertas.push(`Nota fora do limite (0 a ${c.maxPontos}); conferir. Não entra no acumulado.`);
  } else r.oficial = nota.valor;

  // 2) PRÉVIA (nunca altera a oficial)
  if (c.tipo === 'proportional') {
    const bruto = lerNumero(d.valorBruto);
    const den = cfg.denominador;
    if (bruto.invalido || (bruto.valor !== null && (bruto.valor < 0 || (finito(den) && bruto.valor > den + 1e-9)))) {
      r.alertas.push('Valor bruto inválido para o cálculo proporcional.');
    } else if (bruto.valor !== null && finito(den) && den > 0) r.previa = (bruto.valor / den) * c.maxPontos;
    const ate = finito(d.esperadosAteOPrazo) ? d.esperadosAteOPrazo : periodo?.esperadosRegistros;
    if (bruto.valor !== null && finito(den) && finito(ate)) r.situacao = `${bruto.valor} de ${ate} até o prazo · ${den} no semestre`;
  } else if ((c.tipo === 'rubric' || c.tipo === 'hybrid') && cfg.agregacao) {
    const ag = agregarRubrica(c, cfg.agregacao, r.alertas);
    r.previa = ag.previa; r.previaParcial = ag.parcial;
  }

  // 3) PRAZO é dimensão própria: só desconta com regra expressa, e apenas sobre a prévia
  if (d.entrega === 'apos_prazo') {
    const ra = cfg.regraAtraso;
    if (ra && ra.regraId && finito(ra.valor) && ra.valor > 0 && ra.justificativa && r.previa !== null) {
      r.deducoes.push({ regraId: ra.regraId, origem: 'entrega', origemId: `entrega:${c.id}`, criterioId: c.id,
        valor: ra.valor, justificativa: ra.justificativa, automatica: true });
    }
  } else if (d.entrega === 'desconhecido') r.alertas.push('Cumprimento do prazo a conferir.');

  for (const x of c.deducoes || []) {
    if (x.automatica && finito(x.valor) && x.valor > 0 && x.regraId && x.origem && x.justificativa) r.deducoes.push(x);
  }
  if (r.previa !== null && r.deducoes.length > 0) r.previa = Math.max(0, r.previa - r.deducoes.reduce((a, x) => a + x.valor, 0));
  if (r.previa !== null && (r.previa < -1e-9 || r.previa > c.maxPontos + 1e-9)) {
    r.alertas.push(`Prévia fora do limite (0 a ${c.maxPontos}); descartada.`); r.previa = null;
  }

  // 4) considerado e status
  r.score = r.oficial ?? r.previa;
  r.origem = r.oficial !== null ? 'oficial' : r.previa !== null ? 'previa' : null;
  if (d.naoAvaliado) { r.status = 'nao_avaliado'; r.situacao = 'Não avaliado nesta etapa'; r.score = null; r.origem = null; r.oficial = null; r.previa = null; return r; }
  if (d.aConferir || r.invalida) {
    r.status = 'a_conferir'; r.score = null; r.origem = null;
    r.situacao = r.invalida ? 'Nota inválida — conferir' : 'A conferir';
    return r;
  }
  if (r.score !== null) {
    r.status = d.concluido ? 'concluido' : 'calculado';
    if (!r.situacao) r.situacao = r.origem === 'oficial' ? 'Nota lançada' : 'Prévia calculada (não oficial)';
  } else if ((c.tipo === 'rubric' || c.tipo === 'hybrid') && r.subcriterios.length > 0) {
    r.status = 'aguardando_decisao';
    r.situacao = cfg.agregacao ? 'Rubrica incompleta' : 'Fórmula da rubrica não aprovada';
  } else r.situacao = r.situacao || 'Sem nota lançada';
  return r;
}

/** Ocorrências nunca descontam sem regra cadastrada: ficam aguardando decisão. Éticas geram sinalização. */
export function classificarOcorrencias(ocs: OcorrenciaAvaliacao[]): { aplicaveis: Deducao[]; pendentes: OcorrenciaAvaliacao[]; sinalizacoes: Sinalizacao[] } {
  const aplicaveis: Deducao[] = [];
  const pendentes: OcorrenciaAvaliacao[] = [];
  const sinalizacoes: Sinalizacao[] = [];
  for (const o of ocs) {
    if (o.eticaRelevante && o.status !== 'ignorada') {
      sinalizacoes.push({ tipo: 'ETICA', ocorrenciaId: o.id, mensagem: 'Ocorrência ética relevante: análise da professora (sem desconto automático).' });
    }
    const regraValida = o.deducaoAutomatica && finito(o.valorDeducao) && o.valorDeducao > 0
      && !!o.regraId && !!o.origem && !!o.justificativa && !!o.criterioId && !o.eticaRelevante;
    if (regraValida && o.status !== 'ignorada') {
      aplicaveis.push({ regraId: o.regraId!, origem: o.origem!, origemId: `ocorrencia:${o.id}`, criterioId: o.criterioId!,
        valor: o.valorDeducao!, justificativa: o.justificativa!, automatica: true });
    } else if (o.status === 'registrada' || o.status === 'aguardando_decisao') pendentes.push(o);
  }
  return { aplicaveis, pendentes, sinalizacoes };
}

export function calcularAvaliacao(
  criterios: EntradaCriterio[],
  opcoes: { periodo?: PeriodoAvaliacao; ocorrencias?: OcorrenciaAvaliacao[] } = {},
): ResultadoAvaliacao {
  const { aplicaveis, pendentes, sinalizacoes } = classificarOcorrencias(opcoes.ocorrencias || []);
  const usadas = new Set<string>(); // evita dupla penalização do mesmo fato em critérios diferentes
  const resultados = criterios.map(c => {
    const extras: Deducao[] = [];
    for (const x of aplicaveis.filter(y => y.criterioId === c.id)) {
      if (x.origemId && usadas.has(x.origemId)) continue;
      if (x.origemId) usadas.add(x.origemId);
      extras.push(x);
    }
    const proprias = (c.deducoes || []).filter(x => {
      if (!x.origemId) return true;
      if (usadas.has(x.origemId)) return false;
      usadas.add(x.origemId); return true;
    });
    return calcularCriterio({ ...c, deducoes: [...proprias, ...extras] }, opcoes.periodo);
  });
  const valido = (r: ResultadoCriterio) => r.status !== 'a_conferir' && r.status !== 'nao_avaliado';
  const totalOficial = resultados.filter(r => valido(r) && finito(r.oficial)).reduce((a, r) => a + (r.oficial as number), 0);
  const totalComPrevias = resultados.filter(r => valido(r) && finito(r.score)).reduce((a, r) => a + (r.score as number), 0);
  const divergencias: Divergencia[] = resultados
    .filter(r => finito(r.oficial) && finito(r.previa) && Math.abs((r.oficial as number) - (r.previa as number)) > TOLERANCIA)
    .map(r => ({ criterioId: r.id, nome: r.nome, oficial: r.oficial as number, previa: r.previa as number,
      diferenca: (r.previa as number) - (r.oficial as number) }));
  return {
    criterios: resultados,
    totalOficial, totalComPrevias,
    totalMaximo: criterios.reduce((a, c) => a + c.maxPontos, 0),
    divergencias,
    invalidas: resultados.filter(r => r.invalida).map(r => r.id),
    pendentes: resultados.filter(r => r.score === null && !r.invalida).map(r => r.id),
    ocorrenciasPendentes: pendentes, sinalizacoes,
  };
}

export interface ProblemaAuditoria { codigo: string; mensagem: string; criterioId?: string }

/** Auditoria automática: invariantes do resultado e preservação da estrutura de entrada. */
export function auditarAvaliacao(entrada: EntradaCriterio[], res: ResultadoAvaliacao): ProblemaAuditoria[] {
  const p: ProblemaAuditoria[] = [];
  const somaMax = entrada.reduce((a, c) => a + c.maxPontos, 0);
  if (Math.abs(somaMax - res.totalMaximo) > 1e-9) p.push({ codigo: 'SOMA_MAXIMA', mensagem: 'Soma dos valores máximos divergente.' });
  if (res.criterios.length !== entrada.length) p.push({ codigo: 'CRITERIO_PERDIDO', mensagem: 'Número de critérios mudou.' });
  const soma = res.criterios.filter(r => r.status !== 'a_conferir' && r.status !== 'nao_avaliado' && finito(r.oficial))
    .reduce((a, r) => a + (r.oficial as number), 0);
  if (Math.abs(soma - res.totalOficial) > 1e-9) p.push({ codigo: 'TOTAL_OFICIAL', mensagem: 'Total oficial diverge da soma das notas oficiais.' });
  for (const r of res.criterios) {
    const e = entrada.find(x => x.id === r.id);
    if (!e) { p.push({ codigo: 'CRITERIO_PERDIDO', mensagem: 'Critério ausente na entrada.', criterioId: r.id }); continue; }
    if (finito(r.score) && (r.score < 0 || r.score > r.maxPontos + 1e-9)) p.push({ codigo: 'FORA_DO_LIMITE', mensagem: 'Pontuação fora do limite.', criterioId: r.id });
    const bruta = lerNumero(e.dados?.nota);
    if (bruta.valor === null && !bruta.invalido && r.oficial !== null) p.push({ codigo: 'NULL_VIROU_VALOR', mensagem: 'Ausência convertida em nota.', criterioId: r.id });
    if (bruta.valor !== null && r.oficial !== null && Math.abs(bruta.valor - r.oficial) > 1e-12) p.push({ codigo: 'OFICIAL_ALTERADA', mensagem: 'Nota oficial foi alterada pela engine.', criterioId: r.id });
    if ((e.subcriterios || []).length !== r.subcriterios.length) p.push({ codigo: 'SUBCRITERIO_PERDIDO', mensagem: 'Subcritérios não preservados.', criterioId: r.id });
    for (const dd of r.deducoes) {
      if (!dd.regraId || !dd.origem || !dd.justificativa || !(dd.valor > 0)) p.push({ codigo: 'DEDUCAO_SEM_REGRA', mensagem: 'Dedução sem regra válida.', criterioId: r.id });
    }
    if ((r.status === 'a_conferir' || r.status === 'nao_avaliado') && r.score !== null) p.push({ codigo: 'STATUS_COM_SCORE', mensagem: 'Status sem pontuação com score.', criterioId: r.id });
  }
  return p;
}
