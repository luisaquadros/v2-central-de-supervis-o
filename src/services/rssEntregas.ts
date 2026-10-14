/**
 * Controle ADMINISTRATIVO e automático das entregas de RSS (sem etapa de validação individual).
 *
 * Dois status de entrega por semana: ENTREGUE ou NAO_ENTREGUE. Semana ainda não exigível não tem status.
 * A entrega vem da fonte existente (`registros_semanais`): unidade (matrícula ou grupo) + turma + semana.
 *
 * Regras:
 *  - conta como entrega o registro com status RECEBIDO/ENTREGUE (FORA_ESCOPO não conta); `status_revisao` NÃO bloqueia;
 *  - a semana é a `semana_rss`; se estiver vazia, usa-se a data de entrega dentro de uma semana do cronograma da turma;
 *    nunca o número do encontro; sem semana nem data utilizável o registro fica "sem semana identificada" (entrega contada no total);
 *  - semanas exigíveis = semanas já encerradas no cronograma da turma (ou 1..esperados quando não há cronograma);
 *  - sem dados confiáveis da fonte (sincronização incompleta) NENHUMA semana vira NAO_ENTREGUE;
 *  - atraso é informativo (data confiável posterior ao fim da semana); não altera status nem nota;
 *  - nada aqui gera desconto; correções de associação são camadas auditáveis (`rss_ajustes`), a fonte nunca é alterada.
 */
export type StatusEntregaRss = 'ENTREGUE' | 'NAO_ENTREGUE';

export interface RegistroRssBase {
  registro_id?: unknown; semana_rss?: unknown; semana?: unknown; status?: unknown; status_revisao?: unknown;
  data_entrega?: unknown; matricula_id?: unknown; grupo_id?: unknown; turma_id?: unknown; [k: string]: unknown;
}
export interface SemanaCronograma { sequencia?: unknown; semana?: unknown; semana_inicio?: unknown; semana_fim?: unknown; turma_id?: unknown; [k: string]: unknown }

export interface AjusteRss {
  ajuste_id: string;
  tipo: 'ASSOCIAR' | 'OBSERVACAO';
  registro_id?: string;
  turma_id: string;
  /** ASSOCIAR: unidade correta; OBSERVACAO: unidade a que a observação se refere */
  unidade_tipo?: 'MATRICULA' | 'GRUPO';
  unidade_id?: string;
  semana?: number | null;
  /** valores da fonte no momento da correção (trilha) */
  semana_original?: number | null;
  unidade_original_tipo?: 'MATRICULA' | 'GRUPO' | null;
  unidade_original_id?: string | null;
  observacao?: string;
  status: 'ATIVO' | 'REVOGADO';
  criado_em: string; criado_por: string; atualizado_em?: string;
}

export interface SemanaEntrega {
  semana: number;
  /** null = ainda não exigível ou dados indisponíveis */
  status: StatusEntregaRss | null;
  exigivel: boolean;
  atrasada: boolean;
  dataEntrega?: string;
  registros: string[];
  observacoes: string[];
  origemSemana?: 'SEMANA_RSS' | 'DATA_ENTREGA' | 'AJUSTE';
}

export interface ResumoEntregasRss {
  disponibilidade: 'OK' | 'DADOS_INDISPONIVEIS';
  totalRealizado: number;
  totalPrevisto: number;
  esperadosAteHoje: number;
  semanasEntregues: number[];
  /** null = sem detalhe por semana (consolidado sem registros) ou dados indisponíveis */
  semanasPendentes: number[] | null;
  /** quantas entregas faltam até agora, por contagem (vale mesmo quando não se sabe QUAIS semanas) */
  pendentesEmNumero: number;
  semanasAtrasadas: number[];
  semSemanaIdentificada: string[];
  /** entregas contadas pela planilha consolidada sem registro detalhado correspondente */
  consolidadoSemDetalhe: number;
  semanas: SemanaEntrega[];
}

const txt = (v: unknown) => String(v ?? '').trim();
export const dataIso = (v: unknown): string | null => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(txt(v)); return m ? m[1] : null; };

/** RECEBIDO/ENTREGUE conta; FORA_ESCOPO e demais não. `status_revisao` é ignorado de propósito (sem etapa de validação). */
export function contaComoEntrega(r: RegistroRssBase): boolean {
  const s = txt(r.status).toUpperCase();
  return s === 'RECEBIDO' || s === 'ENTREGUE';
}

export function semanaExplicita(r: RegistroRssBase, totalPrevisto = 12): number | null {
  const n = Number(txt(r.semana_rss ?? r.semana).replace(',', '.'));
  return Number.isInteger(n) && n >= 1 && n <= Math.max(totalPrevisto, 1) ? n : null;
}

const seq = (c: SemanaCronograma) => { const n = Number(txt(c.sequencia ?? c.semana)); return Number.isInteger(n) && n > 0 ? n : null; };

/** Semana do cronograma que contém a data de entrega (só com data válida e semana com início e fim). */
export function semanaPorData(r: RegistroRssBase, cronograma: SemanaCronograma[]): number | null {
  const d = dataIso(r.data_entrega);
  if (!d) return null;
  for (const c of cronograma) {
    const n = seq(c), ini = dataIso(c.semana_inicio), fim = dataIso(c.semana_fim);
    if (n && ini && fim && d >= ini && d <= fim) return n;
  }
  return null;
}

/** Aplica ajustes ATIVOS de associação sobre cópias dos registros (a fonte não é alterada). */
export function aplicarAjustesRss<T extends RegistroRssBase>(registros: T[], ajustes: AjusteRss[]): T[] {
  const ativos = new Map<string, AjusteRss>();
  for (const a of ajustes) if (a.tipo === 'ASSOCIAR' && a.status === 'ATIVO' && a.registro_id) ativos.set(a.registro_id, a);
  if (!ativos.size) return registros;
  return registros.map(r => {
    const a = ativos.get(txt(r.registro_id));
    if (!a) return r;
    const novo: Record<string, unknown> = { ...r, __ajuste_id: a.ajuste_id };
    if (a.semana !== undefined && a.semana !== null) { novo.semana_rss = a.semana; novo.__semana_ajustada = true; }
    if (a.unidade_tipo === 'GRUPO' && a.unidade_id) { novo.grupo_id = a.unidade_id; }
    if (a.unidade_tipo === 'MATRICULA' && a.unidade_id) { novo.grupo_id = ''; novo.matricula_id = a.unidade_id; }
    return novo as T;
  });
}

export function observacoesPorSemana(ajustes: AjusteRss[], turmaId: string, unidadeTipo: 'MATRICULA' | 'GRUPO', unidadeId: string): Map<number, string[]> {
  const m = new Map<number, string[]>();
  for (const a of ajustes) {
    if (a.tipo !== 'OBSERVACAO' || a.status !== 'ATIVO' || a.turma_id !== turmaId || a.unidade_tipo !== unidadeTipo || a.unidade_id !== unidadeId) continue;
    if (!a.semana || !txt(a.observacao)) continue;
    m.set(a.semana, [...(m.get(a.semana) ?? []), txt(a.observacao)]);
  }
  return m;
}

export function semanasEncerradas(cronograma: SemanaCronograma[], hojeIso: string): number[] {
  return [...new Set(cronograma.filter(c => { const f = dataIso(c.semana_fim); return f && f < hojeIso; }).map(seq).filter((n): n is number => n !== null))].sort((a, b) => a - b);
}

export function resumirEntregasRss(p: {
  /** registros JÁ filtrados para a unidade (matrícula ou grupo) e a turma */
  registros: RegistroRssBase[];
  cronograma: SemanaCronograma[];
  totalPrevisto: number;
  esperadosAteHoje: number;
  /** entregas contadas pela planilha consolidada para a unidade (pode exceder o detalhe) */
  realizadosConsolidado?: number | null;
  hojeIso: string;
  /** false quando a leitura da fonte falhou/está incompleta */
  fonteDisponivel?: boolean;
  observacoes?: Map<number, string[]>;
}): ResumoEntregasRss {
  const total = Math.max(1, Math.floor(p.totalPrevisto) || 12);
  const porSemana = new Map<number, { regs: string[]; data?: string; origem: SemanaEntrega['origemSemana'] }>();
  const sem: string[] = [];
  const ordenados = p.registros.filter(contaComoEntrega).sort((a, b) => (dataIso(a.data_entrega) ?? '').localeCompare(dataIso(b.data_entrega) ?? ''));
  // 1ª passada: semana explícita (ou ajustada). 2ª: pela data, sem ocupar semana já entregue.
  const resto: RegistroRssBase[] = [];
  for (const r of ordenados) {
    const n = semanaExplicita(r, total);
    if (n === null) { resto.push(r); continue; }
    const cur = porSemana.get(n) ?? { regs: [], origem: (r as Record<string, unknown>).__semana_ajustada ? 'AJUSTE' as const : 'SEMANA_RSS' as const };
    cur.regs.push(txt(r.registro_id)); cur.data = cur.data ?? dataIso(r.data_entrega) ?? undefined; porSemana.set(n, cur);
  }
  for (const r of resto) {
    const n = semanaPorData(r, p.cronograma);
    if (n !== null && n <= total && !porSemana.has(n)) porSemana.set(n, { regs: [txt(r.registro_id)], data: dataIso(r.data_entrega) ?? undefined, origem: 'DATA_ENTREGA' });
    else sem.push(txt(r.registro_id));
  }
  const entreguesDetalhe = [...porSemana.keys()].sort((a, b) => a - b);
  const realizadosDetalhe = entreguesDetalhe.length + sem.length;
  const consolidado = Math.max(0, Math.floor(Number(p.realizadosConsolidado ?? 0)) || 0);
  const totalRealizado = Math.max(realizadosDetalhe, consolidado);
  const consolidadoSemDetalhe = Math.max(0, consolidado - realizadosDetalhe);
  // Entrega sem semana identificada pode cobrir qualquer semana aberta: sem certeza, nenhuma semana é acusada.
  const incerteza = sem.length + consolidadoSemDetalhe;

  const fonteOk = p.fonteDisponivel !== false;
  const encerradas = p.cronograma.length ? semanasEncerradas(p.cronograma, p.hojeIso) : [];
  const exigiveis = new Set<number>(encerradas.length || p.cronograma.length ? encerradas : Array.from({ length: Math.min(Math.max(p.esperadosAteHoje, 0), total) }, (_, i) => i + 1));
  const fimDe = (n: number) => { const c = p.cronograma.find(x => seq(x) === n); return c ? dataIso(c.semana_fim) : null; };

  const semanas: SemanaEntrega[] = Array.from({ length: total }, (_, i) => i + 1).map(n => {
    const e = porSemana.get(n);
    const fim = fimDe(n);
    const atrasada = !!(e && e.data && fim && e.data > fim);
    const exigivel = exigiveis.has(n);
    const status: StatusEntregaRss | null = e ? 'ENTREGUE' : (fonteOk && exigivel && incerteza === 0 ? 'NAO_ENTREGUE' : null);
    return { semana: n, status, exigivel, atrasada, dataEntrega: e?.data, registros: e?.regs ?? [], observacoes: p.observacoes?.get(n) ?? [], origemSemana: e?.origem };
  });
  const pendentes = semanas.filter(s => s.status === 'NAO_ENTREGUE').map(s => s.semana);
  return {
    disponibilidade: fonteOk ? 'OK' : 'DADOS_INDISPONIVEIS',
    totalRealizado, totalPrevisto: total, esperadosAteHoje: p.esperadosAteHoje,
    semanasEntregues: entreguesDetalhe,
    // sem semana identificada em alguma entrega não é possível dizer QUAL semana falta: não se acusa semana alguma
    semanasPendentes: fonteOk && incerteza === 0 ? pendentes : null,
    pendentesEmNumero: fonteOk ? Math.max(0, p.esperadosAteHoje - totalRealizado) : 0,
    semanasAtrasadas: semanas.filter(s => s.atrasada).map(s => s.semana),
    semSemanaIdentificada: sem, consolidadoSemDetalhe, semanas,
  };
}
