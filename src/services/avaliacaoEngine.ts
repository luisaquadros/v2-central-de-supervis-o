/**
 * Engine de cálculo da avaliação (camada pura, sem leitura/escrita de dados).
 *
 * Princípios (docs/DOCUMENTO_MESTRE.md §4 e §AVALIACAO):
 * - nunca converte ausência em zero (null permanece null);
 * - nunca gera média parcial, nota convertida para 10 ou projeção;
 * - só aplica desconto com regra objetiva cadastrada;
 * - sem fórmula configurada para rubrica/híbrido: não inventa, preserva o lançamento manual;
 * - o "prazo" é um rótulo abstrato; datas ficam na configuração do período.
 */

export type StatusCriterio = 'calculado' | 'a_conferir' | 'nao_avaliado' | 'aguardando_decisao' | 'concluido';
export type TipoCriterio = 'single' | 'proportional' | 'continuous' | 'rubric' | 'manual' | 'hybrid';
export type AgregacaoRubrica = 'soma' | 'media_ponderada' | 'normalizacao';
export type SituacaoEntrega = 'antecipado' | 'no_prazo' | 'apos_prazo' | 'desconhecido';

export interface Subcriterio {
  id: string;
  criterioId: string;
  nome: string;
  descricao?: string;
  maxPontos?: number;
  peso?: number;
  nota?: number | null;
  status?: string;
  descritores?: unknown[];
  observacoes?: string;
  [extra: string]: unknown;
}

export interface Deducao {
  regraId: string;
  origem: string;
  criterioId: string;
  valor: number;
  justificativa: string;
  automatica: boolean;
}

export interface ConfigCalculo {
  /** single: nota bruta 0..escalaBruta convertida para maxPontos. Sem escala, a nota já está em pontos. */
  escalaBruta?: number;
  /** single: critério de entrega com prazo (relatórios). */
  regra?: 'nota_escalada' | 'entrega_prazo';
  latePenalty?: number;
  /** proportional */
  totalEsperado?: number;
  /** rubric/hybrid */
  agregacao?: AgregacaoRubrica;
  /** continuous/hybrid: 'progress' usa o progresso do período; demais modos preservam lançamento. */
  calculationMode?: 'progress' | 'rubric' | 'manual' | 'hybrid';
  /** hybrid: única composição suportada, só vale se declarada. */
  hibrido?: 'min_base_rubrica';
}

export interface DadosCriterio {
  /** nota lançada manualmente (em pontos do critério, ou bruta se escalaBruta) */
  nota?: number | null;
  /** proportional */
  concluidos?: number | null;
  esperadosAteOPrazo?: number | null;
  /** entrega_prazo */
  entrega?: SituacaoEntrega | null;
  /** critério futuro / fora da etapa */
  naoAvaliado?: boolean;
  /** informação insuficiente para conferir */
  aConferir?: boolean;
  /** avaliação encerrada pela professora */
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
  status: 'registrada' | 'aguardando_decisao' | 'aplicada' | 'ignorada';
}

export interface PeriodoAvaliacao {
  rotulo: string;
  /** 0..1, configurável; não depende do relógio */
  progressRatio: number;
  esperadosRegistros?: number;
  totalRegistros?: number;
}

export interface ResultadoCriterio {
  id: string;
  nome: string;
  tipo: TipoCriterio;
  maxPontos: number;
  score: number | null;
  status: StatusCriterio;
  deducoes: Deducao[];
  subcriterios: Subcriterio[];
  /** texto de acompanhamento, ex.: "4 de 5 até o prazo · 12 no semestre" */
  situacao: string;
  alertas: string[];
}

export interface ResultadoAvaliacao {
  criterios: ResultadoCriterio[];
  totalAcumulado: number;
  totalMaximo: number;
  ocorrenciasPendentes: OcorrenciaAvaliacao[];
}

const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Converte texto de planilha (vírgula decimal) em número; vazio/ inválido → null. Nunca zero por omissão. */
export function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Exibição em pt-BR com 2 casas; a precisão interna é mantida. */
export function formatarPontos(v: number | null | undefined): string {
  if (!finito(v)) return '—';
  return (Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',');
}

function resultadoBase(c: EntradaCriterio): ResultadoCriterio {
  return {
    id: c.id, nome: c.nome, tipo: c.tipo, maxPontos: c.maxPontos,
    score: null, status: 'nao_avaliado', deducoes: [],
    subcriterios: (c.subcriterios || []).map(s => ({ ...s })),
    situacao: '', alertas: [],
  };
}

function agregarRubrica(c: EntradaCriterio, agregacao: AgregacaoRubrica): number | null {
  const subs = c.subcriterios || [];
  const avaliados = subs.filter(s => finito(s.nota));
  if (subs.length === 0 || avaliados.length !== subs.length) return null; // incompleta → não inventa
  if (agregacao === 'soma') return avaliados.reduce((a, s) => a + (s.nota as number), 0);
  if (agregacao === 'media_ponderada') {
    const pesos = avaliados.map(s => (finito(s.peso) ? s.peso : NaN));
    if (pesos.some(p => Number.isNaN(p))) return null;
    return avaliados.reduce((a, s, i) => a + (s.nota as number) * pesos[i], 0);
  }
  const maxRubrica = subs.reduce((a, s) => a + (finito(s.maxPontos) ? s.maxPontos : 0), 0);
  if (maxRubrica <= 0) return null;
  return (avaliados.reduce((a, s) => a + (s.nota as number), 0) / maxRubrica) * c.maxPontos;
}

export function calcularCriterio(c: EntradaCriterio, periodo?: PeriodoAvaliacao): ResultadoCriterio {
  const r = resultadoBase(c);
  const d = c.dados || {};
  const cfg = c.config || {};

  if (d.naoAvaliado) { r.status = 'nao_avaliado'; r.situacao = 'Não avaliado nesta etapa'; return r; }
  if (d.aConferir) { r.status = 'a_conferir'; r.situacao = 'A conferir'; return r; }

  let score: number | null = null;
  let deducoes: Deducao[] = [];

  switch (c.tipo) {
    case 'single': {
      if (cfg.regra === 'entrega_prazo') {
        const e = d.entrega ?? 'desconhecido';
        if (e === 'antecipado' || e === 'no_prazo') score = c.maxPontos;
        else if (e === 'apos_prazo') {
          const pen = finito(cfg.latePenalty) ? cfg.latePenalty : 0.10;
          score = c.maxPontos; // a penalidade entra como dedução auditável
          deducoes = [{ regraId: 'ENTREGA_APOS_PRAZO', origem: 'entrega', criterioId: c.id, valor: pen,
            justificativa: 'Entrega após o prazo', automatica: true }];
        }
        r.situacao = e === 'antecipado' ? 'Entregue antecipadamente'
          : e === 'no_prazo' ? 'Entregue dentro do prazo'
          : e === 'apos_prazo' ? 'Entregue após o prazo' : 'A conferir';
      } else {
        const bruta = numeroOuNulo(d.nota);
        if (bruta !== null) score = finito(cfg.escalaBruta) && cfg.escalaBruta > 0 ? (bruta / cfg.escalaBruta) * c.maxPontos : bruta;
        r.situacao = bruta === null ? 'Sem nota lançada' : `Nota ${formatarPontos(bruta)}`.replace(',00', ',0');
      }
      break;
    }
    case 'proportional': {
      const feitos = numeroOuNulo(d.concluidos);
      const total = finito(cfg.totalEsperado) ? cfg.totalEsperado : periodo?.totalRegistros;
      if (feitos !== null && finito(total) && total > 0) score = (feitos / total) * c.maxPontos; // denominador = total do semestre
      const ate = numeroOuNulo(d.esperadosAteOPrazo) ?? periodo?.esperadosRegistros;
      r.situacao = feitos === null ? 'Sem registro'
        : `${feitos} de ${finito(ate) ? ate : '?'} até o prazo${finito(total) ? ` · ${total} no semestre` : ''}`;
      break;
    }
    case 'continuous': {
      if (cfg.calculationMode === 'progress' && periodo && finito(periodo.progressRatio)) {
        score = c.maxPontos * periodo.progressRatio;
        r.situacao = 'Em acompanhamento';
      } else {
        const n = numeroOuNulo(d.nota);
        if (n !== null) score = n;
        r.situacao = n === null ? 'Sem regra de cálculo configurada' : 'Lançamento manual';
        if (n === null) r.status = 'aguardando_decisao';
      }
      break;
    }
    case 'rubric': {
      if (cfg.agregacao) {
        score = agregarRubrica(c, cfg.agregacao);
        r.situacao = score === null ? 'Rubrica incompleta' : 'Rubrica';
      } else {
        const n = numeroOuNulo(d.nota);
        if (n !== null) score = n; // preserva a avaliação manual existente
        r.situacao = n === null ? 'Fórmula da rubrica não definida' : 'Lançamento manual';
        if (n === null && (c.subcriterios || []).length > 0) r.status = 'aguardando_decisao';
      }
      break;
    }
    case 'manual': {
      const n = numeroOuNulo(d.nota);
      score = n;
      r.situacao = n === null ? 'Sem nota lançada' : 'Lançamento manual';
      break;
    }
    case 'hybrid': {
      if (cfg.hibrido === 'min_base_rubrica' && periodo && cfg.agregacao) {
        const rub = agregarRubrica(c, cfg.agregacao);
        if (rub !== null) score = Math.min(c.maxPontos * periodo.progressRatio, rub);
        r.situacao = score === null ? 'Rubrica incompleta' : 'Híbrido';
      } else {
        const n = numeroOuNulo(d.nota);
        if (n !== null) score = n;
        r.situacao = n === null ? 'Composição híbrida não configurada' : 'Lançamento manual';
        if (n === null) r.status = 'aguardando_decisao';
      }
      break;
    }
  }

  // Deduções explícitas (apenas as automáticas com valor válido entram no cálculo).
  for (const x of c.deducoes || []) {
    if (x.automatica && finito(x.valor) && x.valor > 0 && x.regraId && x.origem && x.justificativa) deducoes.push(x);
  }
  if (score !== null && deducoes.length > 0) {
    score = Math.max(0, score - deducoes.reduce((a, x) => a + x.valor, 0));
  }
  r.deducoes = deducoes;

  if (score !== null) {
    if (score < -1e-9 || score > c.maxPontos + 1e-9) {
      r.alertas.push(`Pontuação fora do limite (0 a ${c.maxPontos}); valor não entra no acumulado.`);
      r.status = 'a_conferir';
      return r;
    }
    r.score = score;
    r.status = d.concluido ? 'concluido' : 'calculado';
  } else if (r.status === 'nao_avaliado') {
    // sem dado e sem sinalização: continua "não avaliado" (nunca zero)
    if (c.tipo === 'single' && cfg.regra === 'entrega_prazo') r.status = 'a_conferir';
  }
  return r;
}

/** Ocorrências nunca descontam sem regra cadastrada: ficam aguardando decisão. */
export function classificarOcorrencias(ocs: OcorrenciaAvaliacao[]): { aplicaveis: Deducao[]; pendentes: OcorrenciaAvaliacao[] } {
  const aplicaveis: Deducao[] = [];
  const pendentes: OcorrenciaAvaliacao[] = [];
  for (const o of ocs) {
    const regraValida = o.deducaoAutomatica && finito(o.valorDeducao) && o.valorDeducao > 0
      && !!o.regraId && !!o.origem && !!o.justificativa && !!o.criterioId;
    if (regraValida && o.status !== 'ignorada') {
      aplicaveis.push({ regraId: o.regraId!, origem: o.origem!, criterioId: o.criterioId!, valor: o.valorDeducao!,
        justificativa: o.justificativa!, automatica: true });
    } else if (o.status === 'registrada' || o.status === 'aguardando_decisao') {
      pendentes.push(o);
    }
  }
  return { aplicaveis, pendentes };
}

export function calcularAvaliacao(
  criterios: EntradaCriterio[],
  opcoes: { periodo?: PeriodoAvaliacao; ocorrencias?: OcorrenciaAvaliacao[] } = {},
): ResultadoAvaliacao {
  const { aplicaveis, pendentes } = classificarOcorrencias(opcoes.ocorrencias || []);
  const resultados = criterios.map(c => {
    const extras = aplicaveis.filter(x => x.criterioId === c.id);
    return calcularCriterio({ ...c, deducoes: [...(c.deducoes || []), ...extras] }, opcoes.periodo);
  });
  // Acumulado: soma apenas de scores numéricos válidos de critérios calculados/concluídos.
  const totalAcumulado = resultados
    .filter(r => (r.status === 'calculado' || r.status === 'concluido') && finito(r.score))
    .reduce((a, r) => a + (r.score as number), 0);
  const totalMaximo = criterios.reduce((a, c) => a + c.maxPontos, 0);
  return { criterios: resultados, totalAcumulado, totalMaximo, ocorrenciasPendentes: pendentes };
}

export interface ProblemaAuditoria { codigo: string; mensagem: string; criterioId?: string }

/** Auditoria automática: confere invariantes do resultado e a preservação da estrutura de entrada. */
export function auditarAvaliacao(entrada: EntradaCriterio[], res: ResultadoAvaliacao): ProblemaAuditoria[] {
  const p: ProblemaAuditoria[] = [];
  const somaMax = entrada.reduce((a, c) => a + c.maxPontos, 0);
  if (Math.abs(somaMax - res.totalMaximo) > 1e-9) p.push({ codigo: 'SOMA_MAXIMA', mensagem: 'Soma dos valores máximos divergente.' });
  if (res.criterios.length !== entrada.length) p.push({ codigo: 'CRITERIO_PERDIDO', mensagem: 'Número de critérios mudou.' });
  const soma = res.criterios.filter(r => (r.status === 'calculado' || r.status === 'concluido') && finito(r.score))
    .reduce((a, r) => a + (r.score as number), 0);
  if (Math.abs(soma - res.totalAcumulado) > 1e-9) p.push({ codigo: 'TOTAL_ACUMULADO', mensagem: 'Total acumulado diverge da soma dos critérios.' });
  for (const r of res.criterios) {
    const e = entrada.find(x => x.id === r.id);
    if (!e) { p.push({ codigo: 'CRITERIO_PERDIDO', mensagem: 'Critério ausente na entrada.', criterioId: r.id }); continue; }
    if (finito(r.score) && (r.score < 0 || r.score > r.maxPontos + 1e-9)) p.push({ codigo: 'FORA_DO_LIMITE', mensagem: 'Pontuação fora do limite.', criterioId: r.id });
    if (r.score === 0 && e.dados && (e.dados.nota === null || e.dados.nota === undefined) && e.tipo === 'manual') p.push({ codigo: 'NULL_VIROU_ZERO', mensagem: 'Ausência convertida em zero.', criterioId: r.id });
    if ((e.subcriterios || []).length !== r.subcriterios.length) p.push({ codigo: 'SUBCRITERIO_PERDIDO', mensagem: 'Subcritérios não preservados.', criterioId: r.id });
    for (const dd of r.deducoes) {
      if (!dd.regraId || !dd.origem || !dd.justificativa || !(dd.valor > 0)) p.push({ codigo: 'DEDUCAO_SEM_REGRA', mensagem: 'Dedução sem regra válida.', criterioId: r.id });
    }
    if ((r.status === 'a_conferir' || r.status === 'nao_avaliado') && r.score !== null) p.push({ codigo: 'STATUS_COM_SCORE', mensagem: 'Status sem pontuação com score.', criterioId: r.id });
  }
  return p;
}
