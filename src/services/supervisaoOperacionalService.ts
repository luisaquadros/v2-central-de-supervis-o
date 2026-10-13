/**
 * Regras operacionais da supervisão (funções puras, sem estado e sem rede).
 *
 * - Agenda: aula agora, próxima aula, chamadas pendentes (respeita feriados,
 *   aulas não realizadas e reagendamentos).
 * - Pendências: SOMENTE o que exige uma ação da professora. RSS não entra aqui:
 *   aparece apenas dentro de cada turma (gerarRssDaTurma).
 */
import {
  Aluno,
  AvaliacaoCompleta,
  CalendarioRss,
  EncontroTurma,
  Entrega,
  Frequencia,
  GrupoIntegrante,
  GrupoPratica,
  HorarioTurma,
  ItemPendenciaOperacional,
  LeituraResponsavel,
  Matricula,
  Periodo,
  RegistroSemanal,
  RegraRss,
  SituacaoAtualTurma,
  SituacaoRssEstudante,
  StatusRssUnidade,
  Turma,
} from '../types';
import { textoComparavel } from './normalizacaoPlanilha';

export const DIAS_SEMANA_NOMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
];

/** Quantos dias para trás o app procura chamadas não feitas. */
export const DIAS_BUSCA_CHAMADA_PENDENTE = 14;
/** Faltas sem justificativa a partir das quais o estudante entra em "risco por faltas". */
export const LIMITE_FALTAS_RISCO = 3;

/** Data de hoje (fuso local) em AAAA-MM-DD. Nunca usar toISOString() para datas do dia. */
/**
 * Data e hora LOCAIS no formato AAAA-MM-DDTHH:MM:SS (sem "Z"), igual ao que a planilha mostra.
 * Em UTC, um registro feito às 22h de 13/10 viraria 14/10.
 */
export function agoraLocalIso(data: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${getHojeDataIso(data)}T${p(data.getHours())}:${p(data.getMinutes())}:${p(data.getSeconds())}`;
}

export function getHojeDataIso(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function getHoraMinutoAtual(data: Date = new Date()): string {
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

/** "2026-10-13" → Date ao meio-dia local (evita troca de dia por fuso). */
export function dataLocal(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1, 12);
}

export function somarDias(iso: string, dias: number): string {
  const d = dataLocal(iso);
  d.setDate(d.getDate() + dias);
  return getHojeDataIso(d);
}

/** "2026-10-13" → "13/10". Com ano: "13/10/2026". */
export function formatarDataBr(iso?: string, comAno = false): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  if (!a || !m || !d) return iso;
  return comAno ? `${d}/${m}/${a}` : `${d}/${m}`;
}

/** "terça, 13/10" */
export function formatarDiaCurto(iso: string): string {
  const nome = DIAS_SEMANA_NOMES[dataLocal(iso).getDay()].replace('-feira', '').toLowerCase();
  return `${nome}, ${formatarDataBr(iso)}`;
}

// ---------------------------------------------------------------------------
// FERIADOS NACIONAIS (evitam chamadas pendentes falsas)
// ---------------------------------------------------------------------------

function domingoDePascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia, 12);
}

const FERIADOS_FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho',
  '09-07': 'Independência', '10-12': 'Nossa Senhora Aparecida', '11-02': 'Finados',
  '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal',
};

/** Nome do feriado nacional (ou ponto facultativo de Carnaval/Corpus Christi) na data, se houver. */
export function feriadoNacional(iso: string): string | null {
  const fixo = FERIADOS_FIXOS[iso.slice(5, 10)];
  if (fixo) return fixo;
  const pascoa = domingoDePascoa(Number(iso.slice(0, 4)));
  const relativo = (dias: number) => {
    const d = new Date(pascoa);
    d.setDate(d.getDate() + dias);
    return getHojeDataIso(d);
  };
  const moveis: Record<string, string> = {
    [relativo(-48)]: 'Carnaval', [relativo(-47)]: 'Carnaval',
    [relativo(-2)]: 'Sexta-feira Santa', [relativo(60)]: 'Corpus Christi',
  };
  return moveis[iso] || null;
}

// ---------------------------------------------------------------------------
// AGENDA
// ---------------------------------------------------------------------------

function horarioVigente(h: HorarioTurma, iso: string): boolean {
  if (!h.ativo || h.dia_semana === null || h.dia_semana === undefined) return false;
  if (h.data_inicio && iso < h.data_inicio) return false;
  if (h.data_fim && iso > h.data_fim) return false;
  return Number(h.dia_semana) === dataLocal(iso).getDay();
}

export interface AulaDoDia {
  turma: Turma;
  data: string;
  horaInicio: string;
  horaFim: string;
  /** Aula prevista, realizada, não realizada (com motivo) ou movida para outra data. */
  situacao: 'PREVISTA' | 'NAO_REALIZADA' | 'REAGENDADA';
  motivo?: string;
  dataReagendada?: string;
  encontro?: EncontroTurma;
  chamadaSalva: boolean;
  /** Veio de um reagendamento para esta data. */
  extra?: boolean;
}

/** Todas as aulas de um dia, considerando horários, reagendamentos, cancelamentos e feriados. */
export function aulasDoDia(
  iso: string,
  turmas: Turma[],
  horarios: HorarioTurma[],
  encontros: EncontroTurma[],
  frequencias: Frequencia[],
  matriculas: Matricula[]
): AulaDoDia[] {
  const aulas: AulaDoDia[] = [];
  const feriado = feriadoNacional(iso);
  for (const turma of turmas.filter(t => t.status === 'ATIVO')) {
    const encontro = encontros.find(e => e.turma_id === turma.turma_id && e.data === iso);
    const horario = horarios.find(h => h.turma_id === turma.turma_id && horarioVigente(h, iso));
    const extra = !horario && encontro && (encontro.status === 'PREVISTO' || encontro.status === 'REALIZADO');
    if (!horario && !extra) continue;
    const matsTurma = new Set(matriculas.filter(m => m.turma_id === turma.turma_id).map(m => m.matricula_id));
    const chamadaSalva = encontro?.chamada_salva === true
      || frequencias.some(f => f.data_aula === iso && matsTurma.has(f.matricula_id));
    let situacao: AulaDoDia['situacao'] = 'PREVISTA';
    let motivo: string | undefined;
    if (encontro?.status === 'NAO_REALIZADO') {
      situacao = 'NAO_REALIZADA';
      motivo = encontro.motivo_nao_realizado || encontro.observacao || 'Aula não realizada';
    } else if (encontro?.status === 'REAGENDADO') {
      situacao = 'REAGENDADA';
      motivo = encontro.motivo_nao_realizado;
    } else if (feriado && encontro?.status !== 'REALIZADO' && !chamadaSalva) {
      situacao = 'NAO_REALIZADA';
      motivo = `Feriado: ${feriado}`;
    }
    aulas.push({
      turma,
      data: iso,
      horaInicio: encontro?.hora_inicio || encontro?.hora_reagendada || horario?.hora_inicio || '',
      horaFim: encontro?.hora_fim || horario?.hora_fim || '',
      situacao,
      motivo,
      dataReagendada: encontro?.data_reagendada,
      encontro,
      chamadaSalva,
      extra: Boolean(extra),
    });
  }
  return aulas.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

export interface ResultadoSupervisaoAtual {
  /** Aula acontecendo agora (de 15 min antes do início até o fim). */
  emAndamento?: AulaDoDia;
  /** Aula de hoje já encerrada e sem chamada salva. */
  chamadaPendenteHoje?: AulaDoDia;
  /** Aulas de hoje que não acontecem (feriado, cancelamento, reagendamento). */
  naoRealizadasHoje: AulaDoDia[];
  dataHoje: string;
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function identificarSupervisaoAtual(
  turmas: Turma[],
  horarios: HorarioTurma[],
  frequencias: Frequencia[],
  encontros: EncontroTurma[],
  matriculas: Matricula[],
  agora: Date = new Date()
): ResultadoSupervisaoAtual {
  const dataHoje = getHojeDataIso(agora);
  const agoraMin = minutos(getHoraMinutoAtual(agora));
  const aulas = aulasDoDia(dataHoje, turmas, horarios, encontros, frequencias, matriculas);
  const previstas = aulas.filter(a => a.situacao === 'PREVISTA' && a.horaInicio);
  return {
    dataHoje,
    emAndamento: previstas.find(a => agoraMin >= minutos(a.horaInicio) - 15 && agoraMin <= minutos(a.horaFim || a.horaInicio)),
    chamadaPendenteHoje: previstas.find(a => a.horaFim && agoraMin > minutos(a.horaFim) && !a.chamadaSalva),
    naoRealizadasHoje: aulas.filter(a => a.situacao !== 'PREVISTA'),
  };
}

export interface ResultadoProximaSupervisao {
  aula: AulaDoDia;
  turma: Turma;
  dataProxima: string;
  diaSemanaNome: string;
  horaInicio: string;
  horaFim: string;
  diasAte: number;
}

/** Próxima aula prevista (ignora as já encerradas hoje, as canceladas e feriados). */
export function identificarProximaSupervisao(
  turmas: Turma[],
  horarios: HorarioTurma[],
  encontros: EncontroTurma[],
  agora: Date = new Date(),
  frequencias: Frequencia[] = [],
  matriculas: Matricula[] = []
): ResultadoProximaSupervisao | null {
  const hoje = getHojeDataIso(agora);
  const agoraMin = minutos(getHoraMinutoAtual(agora));
  for (let offset = 0; offset <= 21; offset++) {
    const iso = somarDias(hoje, offset);
    const aula = aulasDoDia(iso, turmas, horarios, encontros, frequencias, matriculas)
      .find(a => a.situacao === 'PREVISTA' && (offset > 0 || !a.horaFim || agoraMin <= minutos(a.horaFim)));
    if (aula) {
      return {
        aula,
        turma: aula.turma,
        dataProxima: iso,
        diaSemanaNome: DIAS_SEMANA_NOMES[dataLocal(iso).getDay()],
        horaInicio: aula.horaInicio,
        horaFim: aula.horaFim,
        diasAte: offset,
      };
    }
  }
  return null;
}

export interface ItemChamadaPendente {
  turma: Turma;
  dataAula: string;
  diaSemanaNome: string;
  horaInicio: string;
  horaFim: string;
}

/** Aulas que já aconteceram e não têm chamada salva (últimos 14 dias, dentro do período). */
export function identificarChamadasPendentes(
  turmas: Turma[],
  horarios: HorarioTurma[],
  frequencias: Frequencia[],
  encontros: EncontroTurma[],
  matriculas: Matricula[],
  agora: Date = new Date(),
  diasParaTras: number = DIAS_BUSCA_CHAMADA_PENDENTE,
  inicioPeriodo?: string
): ItemChamadaPendente[] {
  const hoje = getHojeDataIso(agora);
  const agoraMin = minutos(getHoraMinutoAtual(agora));
  const pendentes: ItemChamadaPendente[] = [];
  for (let offset = 0; offset <= diasParaTras; offset++) {
    const iso = somarDias(hoje, -offset);
    if (inicioPeriodo && iso < inicioPeriodo) break;
    for (const aula of aulasDoDia(iso, turmas, horarios, encontros, frequencias, matriculas)) {
      if (aula.situacao !== 'PREVISTA' || aula.chamadaSalva) continue;
      if (offset === 0 && (!aula.horaFim || agoraMin <= minutos(aula.horaFim))) continue;
      pendentes.push({
        turma: aula.turma,
        dataAula: iso,
        diaSemanaNome: DIAS_SEMANA_NOMES[dataLocal(iso).getDay()],
        horaInicio: aula.horaInicio,
        horaFim: aula.horaFim,
      });
    }
  }
  return pendentes;
}

// ---------------------------------------------------------------------------
// LEITURAS / ESTUDO DIRIGIDO
// ---------------------------------------------------------------------------

/** Leituras da aula de uma turma numa data (inclui as trazidas de uma aula reagendada). */
export function leiturasDoEncontro(
  turmaId: string,
  data: string,
  leituras: LeituraResponsavel[],
  encontros: EncontroTurma[]
): LeituraResponsavel[] {
  const movidaDaqui = encontros.some(e => e.turma_id === turmaId && e.data === data && e.status === 'REAGENDADO');
  const origens = encontros
    .filter(e => e.turma_id === turmaId && e.status === 'REAGENDADO' && e.data_reagendada === data)
    .map(e => e.data);
  return leituras.filter(l => l.turma_id === turmaId && (
    (l.data === data && !movidaDaqui) || origens.includes(l.data || '')
  ));
}

export interface ResponsavelLeitura { nome: string; matriculaId?: string }

/**
 * Resolve os nomes de "responsaveis_texto" (separados por ";") para estudantes da turma.
 * Nomes não encontrados continuam aparecendo (sem vínculo), nunca são descartados.
 */
export function resolverResponsaveisLeitura(
  leitura: LeituraResponsavel,
  alunosDaTurma: { matricula: Matricula; aluno: Aluno }[]
): ResponsavelLeitura[] {
  const texto = String(leitura.responsaveis_texto || leitura.responsavel_nome || '');
  const nomes = texto.split(/;|\n/).map(n => n.trim()).filter(Boolean);
  return nomes.map(nome => {
    const alvo = textoComparavel(nome);
    const palavras = alvo.split(' ').filter(p => p.length > 2);
    const candidato = alunosDaTurma.find(a => textoComparavel(a.aluno.nome) === alvo)
      || alunosDaTurma.find(a => textoComparavel(a.aluno.nome).startsWith(alvo) || alvo.startsWith(textoComparavel(a.aluno.nome)))
      || (palavras.length >= 2
        ? alunosDaTurma.find(a => palavras.every(p => textoComparavel(a.aluno.nome).split(' ').includes(p)))
        : undefined);
    return { nome: candidato?.aluno.nome || nome, matriculaId: candidato?.matricula.matricula_id };
  });
}

export function leituraPrecisaConfirmacao(l: LeituraResponsavel): boolean {
  const tipo = String(l.tipo || 'ESTUDO_DIRIGIDO').toUpperCase();
  const tipoResp = String(l.responsavel_tipo || '').toUpperCase();
  return tipo === 'ESTUDO_DIRIGIDO' && tipoResp !== 'SEM_RESPONSAVEL' && !l.status_realizacao;
}

// ---------------------------------------------------------------------------
// RSS (somente dentro da turma e da ficha do estudante)
// ---------------------------------------------------------------------------

export interface MetricasCronogramaRss {
  semanaAtual: number | null;
  totalSemanas: number | null;
  semanasEncerradas: number | null;
  semanaTexto: string;
  temDados: boolean;
}

/** Semana de prática atual e semanas encerradas, sempre filtradas pela própria turma. */
export function calcularMetricasCronogramaRss(
  turmaId: string | undefined,
  calendarioRss: CalendarioRss[],
  situacaoAtualTurmas: SituacaoAtualTurma[],
  hojeIso: string = getHojeDataIso()
): MetricasCronogramaRss {
  const vazio: MetricasCronogramaRss = { semanaAtual: null, totalSemanas: null, semanasEncerradas: null, semanaTexto: '—', temDados: false };
  if (!turmaId) return vazio;
  const calendario = calendarioRss.filter(c => c.turma_id === turmaId);
  const situacao = situacaoAtualTurmas.find(s => s.turma_id === turmaId);
  const sequencias = calendario.map(c => Number(c.sequencia || c.semana || 0)).filter(n => n > 0);
  const total = Number(situacao?.rss_total_previsto) || (sequencias.length ? Math.max(...sequencias) : 0);
  if (!total && !calendario.length) return vazio;

  const porData = calendario.find(c => c.semana_inicio && c.semana_fim && hojeIso >= c.semana_inicio && hojeIso <= c.semana_fim);
  const marcada = calendario.find(c => String(c.status_calendario).toUpperCase() === 'ATUAL');
  const encerradas = calendario.filter(c => c.semana_fim && c.semana_fim < hojeIso).length;
  let atual = Number(porData?.sequencia || marcada?.sequencia || 0) || null;
  if (!atual && calendario.length) atual = encerradas >= total ? null : encerradas + 1;
  const encerradasFinal = situacao?.rss_esperados_ate_hoje !== undefined && situacao.rss_esperados_ate_hoje !== ''
    ? Number(situacao.rss_esperados_ate_hoje)
    : encerradas;
  return {
    semanaAtual: atual,
    totalSemanas: total || null,
    semanasEncerradas: atual ? Math.min(encerradasFinal, atual - 1) : encerradasFinal,
    semanaTexto: atual && total ? `${atual} de ${total}` : total && encerradas >= total ? 'Prática encerrada' : '—',
    temDados: true,
  };
}

/**
 * Somente respostas validadas e atribuídas a uma semana RSS comprovam aquela semana.
 * O número da sessão clínica (encontro_numero) NÃO é a semana do semestre.
 */
export function obterSemanaRssValidada(reg: RegistroSemanal): number | null {
  const semana = Number((reg as any).semana_rss ?? reg.semana);
  if (!Number.isInteger(semana) || semana < 1 || semana > 20) return null;
  const status = String(reg.status || '').trim().toUpperCase();
  const revisao = String((reg as any).status_revisao || '').trim().toUpperCase();
  if (status !== 'ENTREGUE' && status !== 'RECEBIDO') return null;
  if (revisao && revisao !== 'VALIDADO' && revisao !== 'VALIDADO_ALIAS') return null;
  return semana;
}

export function obterSituacaoRssEstudante(
  matriculaId: string,
  turmaId: string,
  registrosSemanais: RegistroSemanal[],
  statusRssUnidade?: StatusRssUnidade,
  regraTurma?: RegraRss,
  situacaoTurma?: SituacaoAtualTurma,
  calendarioRssTurma?: CalendarioRss[],
  grupoId?: string
): SituacaoRssEstudante {
  // Clínica Ampliada: a unidade de entrega é o grupo inteiro, não o autor da resposta.
  const regs = registrosSemanais.filter(r => grupoId
    ? (r as any).grupo_id === grupoId && (!(r as any).turma_id || (r as any).turma_id === turmaId)
    : r.matricula_id === matriculaId && !(r as any).grupo_id);
  const semanas = new Set(regs.map(obterSemanaRssValidada).filter((n): n is number => n !== null));
  const daPlanilha = Number(statusRssUnidade?.rss_recebidos_validos) || 0;
  const realizados = Math.max(semanas.size, daPlanilha);

  let esperados = 0;
  if (statusRssUnidade?.rss_esperados_ate_hoje !== undefined && statusRssUnidade.rss_esperados_ate_hoje !== '') {
    esperados = Number(statusRssUnidade.rss_esperados_ate_hoje);
  } else if (situacaoTurma?.rss_esperados_ate_hoje !== undefined && situacaoTurma.rss_esperados_ate_hoje !== '') {
    esperados = Number(situacaoTurma.rss_esperados_ate_hoje);
  } else if (calendarioRssTurma?.length) {
    esperados = calcularMetricasCronogramaRss(turmaId, calendarioRssTurma, situacaoTurma ? [situacaoTurma] : []).semanasEncerradas ?? 0;
  }
  const total = Number(regraTurma?.total_esperado) || Number(situacaoTurma?.rss_total_previsto) || 12;
  const saldo = realizados - esperados;
  return {
    matriculaId,
    turmaId,
    registrosRealizados: realizados,
    registrosEsperadosAteHoje: esperados,
    totalPrevistoNoPeriodo: total,
    saldoRss: saldo,
    statusSemanal: saldo < 0 ? 'ATRASADO' : saldo === 0 ? 'EM_DIA' : 'ADIANTADO',
    estaAtrasado: saldo < 0,
    registrosEstudante: regs,
    textoExibicao: `${realizados} de ${esperados} esperados até hoje (${total} no semestre)`,
  };
}

export interface UnidadeRss {
  /** matrícula (individual) ou grupo (Clínica Ampliada) */
  unidadeId: string;
  tipo: 'INDIVIDUAL' | 'GRUPO';
  nome: string;
  integrantes: { matriculaId: string; nome: string }[];
  realizados: number;
  esperados: number;
  faltando: number;
  /** Ainda não enviou o RSS da semana em curso (nem pendente de revisão). */
  semEnvioNaSemana: boolean;
  aguardandoRevisao: number;
  situacao: SituacaoRssEstudante;
}

export interface RssDaTurma {
  metricas: MetricasCronogramaRss;
  unidades: UnidadeRss[];
  atrasadas: UnidadeRss[];
  semEnvioNaSemana: UnidadeRss[];
  emDia: number;
}

/** Visão de RSS de UMA turma: quem está atrasado e quem ainda não enviou nesta semana. */
export function gerarRssDaTurma(
  turmaId: string,
  dados: {
    matriculas: Matricula[];
    alunos: Aluno[];
    registrosSemanais: RegistroSemanal[];
    statusRssUnidades: StatusRssUnidade[];
    regrasRss: RegraRss[];
    situacaoAtualTurmas: SituacaoAtualTurma[];
    calendarioRss: CalendarioRss[];
    gruposPratica: GrupoPratica[];
    grupoIntegrantes: GrupoIntegrante[];
  },
  hojeIso: string = getHojeDataIso()
): RssDaTurma {
  const metricas = calcularMetricasCronogramaRss(turmaId, dados.calendarioRss, dados.situacaoAtualTurmas, hojeIso);
  const regra = dados.regrasRss.find(r => r.turma_id === turmaId);
  const situacao = dados.situacaoAtualTurmas.find(s => s.turma_id === turmaId);
  const calendario = dados.calendarioRss.filter(c => c.turma_id === turmaId);
  const mats = dados.matriculas.filter(m => m.turma_id === turmaId && m.status === 'MATRICULADO');
  const nomeDe = (m: Matricula) => dados.alunos.find(a => a.aluno_id === m.aluno_id)?.nome || 'Estudante';
  const grupos = dados.gruposPratica.filter(g => g.turma_id === turmaId);
  const unidades: UnidadeRss[] = [];

  const montar = (unidadeId: string, tipo: 'INDIVIDUAL' | 'GRUPO', nome: string, integrantes: Matricula[]) => {
    const status = dados.statusRssUnidades.find(s => s.unidade_id === unidadeId && (!s.turma_id || s.turma_id === turmaId));
    const sit = obterSituacaoRssEstudante(
      integrantes[0]?.matricula_id || unidadeId, turmaId, dados.registrosSemanais, status, regra, situacao, calendario,
      tipo === 'GRUPO' ? unidadeId : undefined
    );
    const semana = metricas.semanaAtual;
    const daSemana = semana ? sit.registrosEstudante.filter(r => Number((r as any).semana_rss ?? r.semana) === semana) : [];
    unidades.push({
      unidadeId, tipo, nome,
      integrantes: integrantes.map(m => ({ matriculaId: m.matricula_id, nome: nomeDe(m) })),
      realizados: sit.registrosRealizados,
      esperados: sit.registrosEsperadosAteHoje,
      faltando: Math.max(0, -sit.saldoRss),
      semEnvioNaSemana: Boolean(semana) && daSemana.length === 0,
      aguardandoRevisao: sit.registrosEstudante.filter(r => String((r as any).status_revisao).toUpperCase() === 'PENDENTE_REVISAO').length,
      situacao: sit,
    });
  };

  if (grupos.length > 0) {
    for (const g of grupos) {
      const ids = new Set(dados.grupoIntegrantes.filter(gi => gi.grupo_id === g.grupo_id).map(gi => gi.matricula_id));
      montar(g.grupo_id, 'GRUPO', g.nome_grupo || 'Grupo', mats.filter(m => ids.has(m.matricula_id)));
    }
  } else {
    for (const m of mats) montar(m.matricula_id, 'INDIVIDUAL', nomeDe(m), [m]);
  }
  unidades.sort((a, b) => b.faltando - a.faltando || a.nome.localeCompare(b.nome));
  return {
    metricas,
    unidades,
    atrasadas: unidades.filter(u => u.faltando > 0),
    semEnvioNaSemana: unidades.filter(u => u.semEnvioNaSemana),
    emDia: unidades.filter(u => u.faltando === 0).length,
  };
}

// ---------------------------------------------------------------------------
// PENDÊNCIAS (somente itens acionáveis, sem RSS)
// ---------------------------------------------------------------------------

export const NOMES_TIPO_ENTREGA: Record<string, string> = {
  TERMO_COMPROMISSO: 'Termo de Compromisso',
  MANUAL_ESTAGIO: 'Manual do Estágio',
  DOCUMENTACAO_EXTERNA: 'Documentação externa',
  TCLE: 'TCLE',
};

export function nomeTipoEntrega(tipo?: string): string {
  if (!tipo) return 'Documento';
  return NOMES_TIPO_ENTREGA[tipo] || tipo.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

export interface DadosPendencias {
  periodo?: Periodo;
  turmas: Turma[];
  matriculas: Matricula[];
  alunos: Aluno[];
  frequencias: Frequencia[];
  entregas: Entrega[];
  leituras: LeituraResponsavel[];
  encontros: EncontroTurma[];
  horarios: HorarioTurma[];
  avaliacoesCompletas: AvaliacaoCompleta[];
}

/**
 * Lista única de pendências usada no menu, na tela Hoje e na tela Pendências.
 * Cada item tem uma ação direta. RSS, orientações abertas e prazos informativos ficam fora.
 */
export function gerarPendencias(d: DadosPendencias, agora: Date = new Date()): ItemPendenciaOperacional[] {
  const hoje = getHojeDataIso(agora);
  const turmas = d.turmas.filter(t => t.status === 'ATIVO' && (!d.periodo || t.periodo_id === d.periodo.periodo_id));
  const turmaPorId = new Map(turmas.map(t => [t.turma_id, t]));
  const mats = d.matriculas.filter(m => turmaPorId.has(m.turma_id) && m.status === 'MATRICULADO');
  const matPorId = new Map(mats.map(m => [m.matricula_id, m]));
  const alunoPorId = new Map(d.alunos.map(a => [a.aluno_id, a]));
  const nomeAluno = (matriculaId: string) => alunoPorId.get(matPorId.get(matriculaId)?.aluno_id || '')?.nome || 'Estudante';
  const itens: ItemPendenciaOperacional[] = [];

  // 1. Chamadas não feitas
  for (const c of identificarChamadasPendentes(turmas, d.horarios, d.frequencias, d.encontros, mats, agora, DIAS_BUSCA_CHAMADA_PENDENTE, d.periodo?.data_inicio)) {
    itens.push({
      id: `chamada-${c.turma.turma_id}-${c.dataAula}`,
      tipo: 'CHAMADA',
      titulo: `Fazer chamada · ${c.turma.nome}`,
      descricao: `Aula de ${formatarDiaCurto(c.dataAula)} sem chamada salva.`,
      turma_id: c.turma.turma_id,
      turma_nome: c.turma.nome,
      prazo: c.dataAula,
      dataAula: c.dataAula,
      urgencia: 'CRITICA',
      targetTab: 'turmas',
    });
  }

  // 2. Justificativas de falta aguardando decisão
  for (const f of d.frequencias) {
    if (f.status !== 'JUSTIFICATIVA_PENDENTE' || !matPorId.has(f.matricula_id)) continue;
    const m = matPorId.get(f.matricula_id)!;
    itens.push({
      id: `just-${f.frequencia_id}`,
      tipo: 'JUSTIFICATIVA',
      titulo: `Avaliar justificativa · ${nomeAluno(f.matricula_id)}`,
      descricao: `Falta em ${formatarDiaCurto(f.data_aula)}${f.justificativa ? `: "${f.justificativa}"` : ''}`,
      turma_id: m.turma_id,
      turma_nome: turmaPorId.get(m.turma_id)?.nome,
      matricula_id: f.matricula_id,
      aluno_nome: nomeAluno(f.matricula_id),
      frequencia_id: f.frequencia_id,
      prazo: f.data_aula,
      urgencia: 'ALTA',
      targetTab: 'pendencias',
    });
  }

  // 3. Estudantes com muitas faltas sem justificativa (conversar)
  const faltasPorMatricula = new Map<string, number>();
  for (const f of d.frequencias) {
    if (f.status === 'FALTA_SEM_JUSTIFICATIVA' && matPorId.has(f.matricula_id)) {
      faltasPorMatricula.set(f.matricula_id, (faltasPorMatricula.get(f.matricula_id) || 0) + 1);
    }
  }
  for (const [matriculaId, total] of faltasPorMatricula) {
    if (total < LIMITE_FALTAS_RISCO) continue;
    const m = matPorId.get(matriculaId)!;
    itens.push({
      id: `risco-faltas-${matriculaId}`,
      tipo: 'RISCO_FALTAS',
      titulo: `Conversar sobre faltas · ${nomeAluno(matriculaId)}`,
      descricao: `${total} faltas sem justificativa no semestre.`,
      turma_id: m.turma_id,
      turma_nome: turmaPorId.get(m.turma_id)?.nome,
      matricula_id: matriculaId,
      aluno_nome: nomeAluno(matriculaId),
      quantidade: total,
      urgencia: 'ALTA',
      targetTab: 'alunos',
    });
  }

  // 4. Documentos: agrupados por turma e tipo (para conferir / não entregues)
  const grupos = new Map<string, { turmaId: string; tipo: string; situacao: 'A_CONFERIR' | 'PENDENTE'; ids: string[] }>();
  for (const e of d.entregas) {
    if (!e.matricula_id || !matPorId.has(e.matricula_id)) continue;
    if (e.situacao !== 'A_CONFERIR' && e.situacao !== 'PENDENTE') continue;
    const turmaId = matPorId.get(e.matricula_id)!.turma_id;
    const tipo = e.tipo_documento || e.tipo_entrega || 'DOCUMENTO';
    const chave = `${turmaId}|${tipo}|${e.situacao}`;
    if (!grupos.has(chave)) grupos.set(chave, { turmaId, tipo, situacao: e.situacao, ids: [] });
    grupos.get(chave)!.ids.push(String(e.entrega_id));
  }
  for (const g of grupos.values()) {
    const n = g.ids.length;
    const conferir = g.situacao === 'A_CONFERIR';
    itens.push({
      id: `doc-${g.situacao}-${g.turmaId}-${g.tipo}`,
      tipo: conferir ? 'DOCUMENTO_CONFERIR' : 'DOCUMENTO',
      titulo: conferir
        ? `Conferir ${nomeTipoEntrega(g.tipo)} · ${n} ${n === 1 ? 'estudante' : 'estudantes'}`
        : `${nomeTipoEntrega(g.tipo)} não entregue · ${n} ${n === 1 ? 'estudante' : 'estudantes'}`,
      descricao: turmaPorId.get(g.turmaId)?.nome || '',
      turma_id: g.turmaId,
      turma_nome: turmaPorId.get(g.turmaId)?.nome,
      entrega_ids: g.ids,
      quantidade: n,
      urgencia: conferir ? 'MEDIA' : 'ALTA',
      targetTab: 'pendencias',
    });
  }

  // 5. Estudo dirigido que já aconteceu e ainda não foi confirmado
  const inicioJanela = somarDias(hoje, -DIAS_BUSCA_CHAMADA_PENDENTE);
  for (const l of d.leituras) {
    if (!l.turma_id || !turmaPorId.has(l.turma_id) || !l.data || l.data >= hoje || l.data < inicioJanela) continue;
    if (!leituraPrecisaConfirmacao(l)) continue;
    const aula = aulasDoDia(l.data, [turmaPorId.get(l.turma_id)!], d.horarios, d.encontros, d.frequencias, mats)[0];
    if (aula && aula.situacao !== 'PREVISTA') continue;
    itens.push({
      id: `estudo-${l.leitura_id}`,
      tipo: 'ESTUDO_DIRIGIDO',
      titulo: `Confirmar estudo dirigido · ${turmaPorId.get(l.turma_id)?.nome}`,
      descricao: `"${l.tema || l.titulo}" (${formatarDataBr(l.data)})${l.responsavel_nome ? ` — ${l.responsavel_nome}` : ''}`,
      turma_id: l.turma_id,
      turma_nome: turmaPorId.get(l.turma_id)?.nome,
      leitura_id: l.leitura_id,
      prazo: l.data,
      urgencia: 'MEDIA',
      targetTab: 'pendencias',
    });
  }

  // 6. Devolutivas prontas aguardando envio
  for (const a of d.avaliacoesCompletas) {
    if (!matPorId.has(a.matricula_id)) continue;
    if (a.status !== 'APROVADO_ENVIO' && a.status !== 'FEEDBACK_PREPARADO') continue;
    itens.push({
      id: `devolutiva-${a.avaliacao_id}`,
      tipo: 'DEVOLUTIVA',
      titulo: `Enviar devolutiva · ${nomeAluno(a.matricula_id)}`,
      descricao: a.status === 'APROVADO_ENVIO' ? 'Aprovada, falta enviar ao estudante.' : 'Texto preparado, falta revisar e enviar.',
      turma_id: a.turma_id,
      turma_nome: turmaPorId.get(a.turma_id)?.nome,
      matricula_id: a.matricula_id,
      aluno_nome: nomeAluno(a.matricula_id),
      avaliacao_id: a.avaliacao_id,
      urgencia: 'MEDIA',
      targetTab: 'avaliacao',
    });
  }

  const ordem = { CRITICA: 0, ALTA: 1, MEDIA: 2 } as const;
  return itens.sort((a, b) => ordem[a.urgencia] - ordem[b.urgencia] || String(b.prazo || '').localeCompare(String(a.prazo || '')));
}
