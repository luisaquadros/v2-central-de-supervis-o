import { matriculaParticipaDaChamada } from './aulaParticipants';
import { resumirEntregasRss, contaComoEntrega, semanaExplicita, semanasEncerradas } from './rssEntregas';
import {
  Turma,
  HorarioTurma,
  Frequencia,
  Matricula,
  Aluno,
  MarcoAcademico,
  Documento,
  RegistroSemanal,
  Orientacao,
  LeituraResponsavel,
  EncontroTurma,
  NotificacaoDerivada,
  ItemPendenciaOperacional,
  StatusEncontro,
  MotivoNaoRealizado,
  TurmaOrigem,
  CalendarioRss,
  SituacaoAtualTurma,
  StatusRssUnidade,
  RegraRss,
  SituacaoRssEstudante,
  GrupoPratica,
  GrupoIntegrante,
  Periodo,
} from '../types';

/** Uma frequência isolada não pode concluir a chamada de toda a turma. */
export function chamadaCompletaNaData(
  turmaId: string, data: string, matriculas: Matricula[], frequencias: Frequencia[],
): boolean {
  const elegiveis = matriculas
    .filter(m => m.turma_id === turmaId && matriculaParticipaDaChamada(m.status))
    .map(m => m.matricula_id);
  if (elegiveis.length === 0) return false;
  const presentes = new Set(frequencias.filter(f => f.data_aula === data).map(f => f.matricula_id));
  return elegiveis.every(id => presentes.has(id));
}

export const DIAS_SEMANA_NOMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/**
 * Retorna a data de hoje no formato YYYY-MM-DD com base no horário local
 */
export function getHojeDataIso(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Retorna a hora atual no formato HH:MM
 */
export function getHoraMinutoAtual(data: Date = new Date()): string {
  const h = String(data.getHours()).padStart(2, '0');
  const m = String(data.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export interface ResultadoSupervisaoAtual {
  emAndamento: boolean;
  turma?: Turma;
  horario?: HorarioTurma;
  horaInicio?: string;
  horaFim?: string;
  chamadaSalvaHoje?: boolean;
  naoRealizadaHoje?: boolean;
  motivoNaoRealizada?: string;
  observacaoNaoRealizada?: string;
  reagendadaHoje?: boolean;
  dataReagendada?: string;
  chamadaPendenteHoje?: boolean;
  dataHoje: string;
  encontroHoje?: EncontroTurma;
}

/**
 * Identifica contextualmente qual supervisão está acontecendo AGORA ou no dia de hoje
 */
export function identificarSupervisaoAtual(
  turmas: Turma[],
  horariosTurma: HorarioTurma[],
  frequencias: Frequencia[],
  encontrosTurma: EncontroTurma[],
  matriculas: Matricula[],
  dataReferencia: Date = new Date()
): ResultadoSupervisaoAtual {
  const dataHoje = getHojeDataIso(dataReferencia);
  const diaSemanaHoje = dataReferencia.getDay();
  const horaAtual = getHoraMinutoAtual(dataReferencia);

  const turmasAtivas = turmas.filter(t => t.status === 'ATIVO');

  // 1. Procura turmas que têm horário programado para o dia da semana de hoje
  for (const turma of turmasAtivas) {
    const horarioHoje = horariosTurma.find(
      h => h.turma_id === turma.turma_id && h.dia_semana === diaSemanaHoje && h.ativo
    );

    // Encontro específico registrado para hoje
    const encontroHoje = encontrosTurma.find(
      e => e.turma_id === turma.turma_id && e.data === dataHoje
    );

    // Se a aula foi explicitamente cancelada / não realizada hoje:
    if (horarioHoje && encontroHoje && encontroHoje.status === 'NAO_REALIZADO') {
      return {
        emAndamento: false,
        turma,
        horario: horarioHoje,
        horaInicio: horarioHoje?.hora_inicio,
        horaFim: horarioHoje?.hora_fim,
        naoRealizadaHoje: true,
        motivoNaoRealizada: encontroHoje.motivo_nao_realizado,
        observacaoNaoRealizada: encontroHoje.observacao,
        dataHoje,
        encontroHoje,
      };
    }

    // Se foi reagendada a partir de hoje:
    if (horarioHoje && encontroHoje && encontroHoje.status === 'REAGENDADO') {
      return {
        emAndamento: false,
        turma,
        horario: horarioHoje,
        horaInicio: horarioHoje?.hora_inicio,
        horaFim: horarioHoje?.hora_fim,
        reagendadaHoje: true,
        dataReagendada: encontroHoje.data_reagendada,
        dataHoje,
        encontroHoje,
      };
    }

    if (horarioHoje) {
      const horaInicio = horarioHoje.hora_inicio || '18:30';
      const horaFim = horarioHoje.hora_fim || '21:12';

      // Verifica se a chamada foi salva hoje para essa turma
      const chamadaSalva = chamadaCompletaNaData(turma.turma_id, dataHoje, matriculas, frequencias);

      // Está acontecendo agora no horário exato
      const emAndamento = horaAtual >= horaInicio && horaAtual <= horaFim;
      const jaPassouDoHorario = horaAtual > horaFim;
      const chamadaPendenteHoje = jaPassouDoHorario && !chamadaSalva;

      if (emAndamento) {
        return {
          emAndamento: true,
          turma,
          horario: horarioHoje,
          horaInicio,
          horaFim,
          chamadaSalvaHoje: chamadaSalva,
          dataHoje,
          encontroHoje,
        };
      }

      if (chamadaPendenteHoje) {
        return {
          emAndamento: false,
          turma,
          horario: horarioHoje,
          horaInicio,
          horaFim,
          chamadaSalvaHoje: false,
          chamadaPendenteHoje: true,
          dataHoje,
          encontroHoje,
        };
      }
    }
  }

  // Nenhuma supervisão em andamento neste instante
  return {
    emAndamento: false,
    dataHoje,
  };
}

export interface ResultadoProximaSupervisao {
  turma: Turma;
  horario: HorarioTurma;
  dataProxima: string;
  diaSemanaNome: string;
  horaInicio: string;
  horaFim: string;
  diasAte: number;
}

/**
 * Identifica a PRÓXIMA supervisão agendada que não esteja cancelada
 */
/** Aceita tanto datas ISO quanto datas brasileiras vindas da planilha de horários. */
function dataHorarioIso(valor: unknown): string | null {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? [match[3], match[2], match[1]].join('-') : null;
}

/** Agenda real, em ordem cronológica, sem depender da ordem das linhas de turmas. */
export function listarProximasSupervisoes(
  turmas: Turma[],
  horariosTurma: HorarioTurma[],
  encontrosTurma: EncontroTurma[],
  dataReferencia: Date = new Date(),
  horizonteDias = 14
): ResultadoProximaSupervisao[] {
  const ativas = turmas.filter(t => t.status === 'ATIVO');
  const agoraIso = getHojeDataIso(dataReferencia);
  const agoraHora = getHoraMinutoAtual(dataReferencia);
  const eventos: ResultadoProximaSupervisao[] = [];
  for (let offset = 0; offset <= horizonteDias; offset++) {
    const dia = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), dataReferencia.getDate() + offset);
    const dataProxima = getHojeDataIso(dia);
    const diaSemana = dia.getDay();
    for (const turma of ativas) {
      const cancelado = encontrosTurma.some(e =>
        e.turma_id === turma.turma_id &&
        e.data === dataProxima &&
        (e.status === 'NAO_REALIZADO' || e.status === 'REAGENDADO')
      );
      if (cancelado) continue;
      const regulares = horariosTurma.filter(h => {
        if (h.turma_id !== turma.turma_id || Number(h.dia_semana) !== diaSemana || !h.ativo) return false;
        const inicio = dataHorarioIso(h.data_inicio);
        const fim = dataHorarioIso(h.data_fim);
        return (!inicio || inicio <= dataProxima) && (!fim || fim >= dataProxima);
      });
      const excepcional = encontrosTurma.find(e =>
        e.turma_id === turma.turma_id && e.data === dataProxima &&
        e.status !== 'NAO_REALIZADO' && e.status !== 'REAGENDADO'
      );
      const transferido = encontrosTurma.find(e =>
        e.turma_id === turma.turma_id && e.data_reagendada === dataProxima && e.status === 'REAGENDADO'
      );
      const horariosDia = regulares.length ? regulares : (excepcional || transferido ? [{
        horario_id: 'extra-' + turma.turma_id + '-' + dataProxima,
        turma_id: turma.turma_id,
        dia_semana: diaSemana,
        hora_inicio: excepcional?.hora_inicio || transferido?.hora_inicio || '18:30',
        hora_fim: excepcional?.hora_fim || transferido?.hora_fim || '21:12',
        ativo: true,
      } as HorarioTurma] : []);
      for (const horario of horariosDia) {
        const horaInicio = excepcional?.hora_inicio || horario.hora_inicio || '18:30';
        const horaFim = excepcional?.hora_fim || horario.hora_fim || '21:12';
        if (dataProxima === agoraIso && horaFim < agoraHora) continue;
        eventos.push({
          turma, horario, dataProxima,
          diaSemanaNome: DIAS_SEMANA_NOMES[diaSemana],
          horaInicio, horaFim, diasAte: offset,
        });
      }
    }
  }
  return eventos.sort((a, b) =>
    a.dataProxima.localeCompare(b.dataProxima) ||
    a.horaInicio.localeCompare(b.horaInicio) ||
    a.turma.nome.localeCompare(b.turma.nome, 'pt-BR')
  );
}

/** Próxima supervisão, ignorando cancelamentos e horários já encerrados. */
export function identificarProximaSupervisao(
  turmas: Turma[],
  horariosTurma: HorarioTurma[],
  encontrosTurma: EncontroTurma[],
  dataReferencia: Date = new Date()
): ResultadoProximaSupervisao | null {
  return listarProximasSupervisoes(turmas, horariosTurma, encontrosTurma, dataReferencia)[0] ?? null;
}

export interface ItemChamadaPendente {
  turma: Turma;
  dataAula: string;
  diaSemanaNome: string;
  horario?: HorarioTurma;
}

/**
 * Identifica chamadas pendentes (aulas previstas que já ocorreram e não têm frequência salva,
 * respeitando cancelamentos e feriados)
 */
export function identificarChamadasPendentes(
  turmas: Turma[],
  horariosTurma: HorarioTurma[],
  frequencias: Frequencia[],
  encontrosTurma: EncontroTurma[],
  matriculas: Matricula[],
  dataReferencia: Date = new Date(),
  diasParaTras: number = 7
): ItemChamadaPendente[] {
  const pendencias: ItemChamadaPendente[] = [];
  const hojeIso = getHojeDataIso(dataReferencia);
  const horaAtual = getHoraMinutoAtual(dataReferencia);

  const turmasAtivas = turmas.filter(t => t.status === 'ATIVO');

  // Verifica últimos diasParaTras dias
  for (let offset = 0; offset <= diasParaTras; offset++) {
    const d = new Date(dataReferencia);
    d.setDate(dataReferencia.getDate() - offset);
    const dataIso = getHojeDataIso(d);
    const diaSemana = d.getDay();

    for (const turma of turmasAtivas) {
      const horario = horariosTurma.find(
        h => h.turma_id === turma.turma_id && h.dia_semana === diaSemana && h.ativo
      );
      if (!horario) continue;

      // Respeita intervalo de vigência do horário
      if (horario.data_inicio && dataIso < horario.data_inicio) continue;
      if (horario.data_fim && dataIso > horario.data_fim) continue;

      // Se for hoje, só conta como pendente se a aula já acabou
      if (offset === 0) {
        const horaFim = horario.hora_fim || '21:12';
        if (horaAtual <= horaFim) continue;
      }

      // Se foi marcada como NÃO REALIZADA ou REAGENDADA: NÃO GERA CHAMADA PENDENTE
      // A base pode conter encontros duplicados pela sincronização: qualquer
      // encerramento explícito da aula elimina sua pendência de chamada.
      const aulaEncerrada = encontrosTurma.some(e => e.turma_id === turma.turma_id &&
        e.data === dataIso && (e.status === 'NAO_REALIZADO' || e.status === 'REAGENDADO'));
      if (aulaEncerrada) continue;

      // Verifica se a chamada foi salva
      const chamadaSalva = chamadaCompletaNaData(turma.turma_id, dataIso, matriculas, frequencias);

      if (!chamadaSalva) {
        pendencias.push({
          turma,
          dataAula: dataIso,
          diaSemanaNome: DIAS_SEMANA_NOMES[diaSemana],
          horario,
        });
      }
    }
  }

  return pendencias;
}

export interface CalendarioAcademicoInfo {
  periodoId: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  estaNaSemanaFinal: boolean;
  encerrado: boolean;
  diasAteFim: number;
}

/**
 * Retorna as datas e o status do Calendário Acadêmico Oficial.
 * REGRA OFICIAL ESTRITA:
 * - O semestre 2026.2 iniciou em 10/08/2026 e encerra somente na semana de 01/12/2026 (2026-12-05).
 * - O calendário de prática/RSS (1..12 semanas) estrutura a operação clínica, mas NÃO define nem encerra o semestre letivo.
 * - NUNCA derivar fim do semestre de semanas de prática, última semana RSS ou semanaAtual/totalSemanas.
 */
export function obterDatasCalendarioAcademico(
  periodo?: Periodo | null,
  hojeIso: string = getHojeDataIso()
): CalendarioAcademicoInfo {
  const nome = periodo?.nome || '2026.2';
  let dataInicio = periodo?.data_inicio || (nome === '2026.2' ? '2026-08-10' : '2026-08-10');
  let dataFim = periodo?.data_fim || (nome === '2026.2' ? '2026-12-05' : '2026-12-05');

  // Proteção da autoridade acadêmica máxima:
  // Se para 2026.2 a base trouxer datas parciais da prática de outubro/novembro,
  // prevalece a regra acadêmica oficial: encerramento somente na semana de 01/12/2026
  if (nome === '2026.2' && (!dataFim || dataFim < '2026-12-01')) {
    dataFim = '2026-12-05';
  }
  if (nome === '2026.2' && (!dataInicio || dataInicio < '2026-08-01')) {
    dataInicio = '2026-08-10';
  }

  const estaNaSemanaFinal = Boolean(dataFim && hojeIso >= '2026-12-01' && hojeIso <= dataFim);
  const encerrado = Boolean(dataFim && hojeIso > dataFim);

  const msPorDia = 1000 * 60 * 60 * 24;
  const dFim = new Date(dataFim);
  const dHoje = new Date(hojeIso);
  const diasAteFim = Math.ceil((dFim.getTime() - dHoje.getTime()) / msPorDia);

  return {
    periodoId: periodo?.periodo_id || 'per_2026_2',
    nome,
    dataInicio,
    dataFim,
    estaNaSemanaFinal,
    encerrado,
    diasAteFim,
  };
}

export interface ProximoMarco { nome: string; data: string; diasRestantes: number; geral: boolean }

/**
 * Próximo marco acadêmico de UMA turma: o de data mais próxima a partir de hoje que ainda não foi concluído.
 * Marcos gerais do período (sem turma) também valem. Marcos passados ou concluídos nunca são "o próximo".
 */
export function proximoMarcoDaTurma(marcos: MarcoAcademico[], turmaId: string, hojeIso: string): ProximoMarco | null {
  const dia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const candidatos = marcos
    .filter(m => (!m.turma_id || m.turma_id === turmaId) && /^\d{4}-\d{2}-\d{2}/.test(String(m.data_prazo || '')))
    .filter(m => String(m.status || '').toUpperCase() !== 'CONCLUIDO' && String(m.data_prazo).slice(0, 10) >= hojeIso)
    .sort((a, b) => String(a.data_prazo).localeCompare(String(b.data_prazo)) || (a.turma_id ? 0 : 1) - (b.turma_id ? 0 : 1));
  const m = candidatos[0];
  if (!m) return null;
  const data = String(m.data_prazo).slice(0, 10);
  return { nome: m.nome, data, diasRestantes: Math.round((dia(data) - dia(hojeIso)) / 86400000), geral: !m.turma_id };
}

export type LeituraAgendada = LeituraResponsavel & { data_original: string; data_apresentacao: string; reprogramada: boolean };

/**
 * Transfere estudos dirigidos CANCELADOS para a aula imediatamente seguinte
 * DA MESMA TURMA, inclusive quando existe outra leitura no novo encontro.
 * O registro de origem não é alterado nem apagado da planilha.
 * Leituras de apoio à Clínica Ampliada não criam responsável fictício.
 */
export function obterLeiturasAgendadas(
  leituras: LeituraResponsavel[],
  encontros: EncontroTurma[]
): LeituraAgendada[] {
  return leituras.map(leitura => {
    const original = String(leitura.data || '');
    let novaData = original;
    if (leitura.tipo !== 'LEITURA_RECOMENDADA' && /^\d{4}-\d{2}-\d{2}$/.test(original)) {
      const visitadas = new Set<string>();
      for (let tentativas = 0; tentativas < 12; tentativas++) {
        const enc = encontros.find(e => e.turma_id === leitura.turma_id && e.data === novaData);
        if (!enc || (enc.status !== 'NAO_REALIZADO' && enc.status !== 'REAGENDADO')) break;
        if (visitadas.has(novaData)) break;
        visitadas.add(novaData);
        if (enc.status === 'REAGENDADO' && enc.data_reagendada &&
            /^\d{4}-\d{2}-\d{2}$/.test(enc.data_reagendada)) {
          novaData = enc.data_reagendada;
          continue;
        }
        const proxima = new Date(`${novaData}T12:00:00Z`);
        proxima.setUTCDate(proxima.getUTCDate() + 7);
        novaData = proxima.toISOString().slice(0, 10);
      }
    }
    return { ...leitura, data_original: original, data_apresentacao: novaData, reprogramada: novaData !== original };
  }).sort((a,b) => a.data_apresentacao.localeCompare(b.data_apresentacao) ||
    a.data_original.localeCompare(b.data_original));
}

/**
 * Deriva notificações internas automáticas sem duplicidade de cadastro
 */
export function derivarNotificacoesOperacionais(
  turmas: Turma[],
  matriculas: Matricula[],
  frequencias: Frequencia[],
  documentos: Documento[],
  registrosSemanais: RegistroSemanal[],
  marcosAcademicos: MarcoAcademico[],
  leiturasResponsaveis: LeituraResponsavel[],
  encontrosTurma: EncontroTurma[],
  horariosTurma: HorarioTurma[],
  dataReferencia: Date = new Date(),
  periodos?: Periodo[],
  selectedPeriodoId?: string
): NotificacaoDerivada[] {
  const notificacoes: NotificacaoDerivada[] = [];
  const hojeIso = getHojeDataIso(dataReferencia);

  // 1. Chamadas pendentes (REQUER AÇÃO)
  const chamadasPendentes = identificarChamadasPendentes(
    turmas,
    horariosTurma,
    frequencias,
    encontrosTurma,
    matriculas,
    dataReferencia
  );

  chamadasPendentes.forEach((item, idx) => {
    notificacoes.push({
      id: `notif-chamada-${item.turma.turma_id}-${item.dataAula}-${idx}`,
      titulo: 'Chamada Pendente',
      mensagem: `${item.turma.nome} em ${item.dataAula} (${item.diaSemanaNome})`,
      categoria: 'REQUER_ACAO',
      tipo: 'CHAMADA_PENDENTE',
      turma_id: item.turma.turma_id,
      turma_nome: item.turma.nome,
      targetTab: 'frequencia',
      targetParam: item.turma.turma_id,
    });
  });

  // 2. Justificativas pendentes de análise (REQUER AÇÃO)
  const justPendentes = frequencias.filter(f => f.status === 'JUSTIFICATIVA_PENDENTE');
  if (justPendentes.length > 0) {
    notificacoes.push({
      id: 'notif-justificativas-pendentes',
      titulo: 'Justificativas Pendentes',
      mensagem: `${justPendentes.length} justificativa(s) de falta aguardando análise`,
      categoria: 'REQUER_ACAO',
      tipo: 'JUSTIFICATIVA_PENDENTE',
      targetTab: 'frequencia',
      targetParam: 'pendencias',
    });
  }

  // 3. Prazos Finais Hoje ou Vencidos de Marcos Acadêmicos (REQUER AÇÃO)
  // Se o marco for marco operacional de prática/atendimentos, deixa explícito e nunca confunde com fim do semestre
  marcosAcademicos.forEach(m => {
    if (m.status !== 'CONCLUIDO' && m.data_prazo) {
      const nomeLower = m.nome.toLowerCase();
      const isAlertaFimPrecoce =
        (nomeLower.includes('fim') || nomeLower.includes('encerramento') || nomeLower.includes('termino')) &&
        m.data_prazo < '2026-12-01';

      const tituloBase = isAlertaFimPrecoce
        ? 'Encerramento de Atendimentos Práticos'
        : m.nome;

      if (m.data_prazo === hojeIso) {
        notificacoes.push({
          id: `notif-prazo-hoje-${m.marco_id}`,
          titulo: 'Prazo Final Hoje',
          mensagem: `${tituloBase} vence hoje! (Semestre acadêmico segue até dezembro)`,
          categoria: 'REQUER_ACAO',
          tipo: 'PRAZO_HOJE',
          targetTab: 'calendario',
        });
      } else if (m.data_prazo < hojeIso) {
        notificacoes.push({
          id: `notif-prazo-vencido-${m.marco_id}`,
          titulo: 'Prazo Vencido',
          mensagem: `${tituloBase} venceu em ${m.data_prazo}`,
          categoria: 'REQUER_ACAO',
          tipo: 'PRAZO_VENCIDO',
          targetTab: 'calendario',
        });
      }
    }
  });

  // 4. Estudo Dirigido ocorrido em aula realizada sem confirmação (REQUER AÇÃO)
  leiturasResponsaveis.forEach(l => {
    if (l.data && l.data < hojeIso && (!l.status_realizacao || l.status_realizacao === 'PLANEJADO')) {
      // Verifica se a aula não foi cancelada
      const cancelada = encontrosTurma.some(
        e => e.turma_id === l.turma_id && e.data === l.data && e.status === 'NAO_REALIZADO'
      );
      if (!cancelada) {
        notificacoes.push({
          id: `notif-estudo-dirigido-${l.leitura_id || l.data}`,
          titulo: 'Estudo Dirigido Pendente',
          mensagem: `Tema "${l.tema || l.artigo_leitura}" em ${l.data} aguarda registro de realização`,
          categoria: 'REQUER_ACAO',
          tipo: 'ESTUDO_DIRIGIDO_PENDENTE',
          turma_id: l.turma_id,
          targetTab: 'hoje',
        });
      }
    }
  });

  // 5. Informativos do dia: Supervisão hoje ou Feriado (INFORMATIVO)
  const diaSemanaHoje = dataReferencia.getDay();
  turmas.filter(t => t.status === 'ATIVO').forEach(turma => {
    const horario = horariosTurma.find(h => h.turma_id === turma.turma_id && h.dia_semana === diaSemanaHoje && h.ativo);
    if (horario) {
      const encontro = encontrosTurma.find(e => e.turma_id === turma.turma_id && e.data === hojeIso);
      if (encontro && encontro.status === 'NAO_REALIZADO') {
        notificacoes.push({
          id: `notif-feriado-${turma.turma_id}-${hojeIso}`,
          titulo: 'Supervisão Não Ocorrerá',
          mensagem: `${turma.nome}: ${encontro.motivo_nao_realizado || 'Feriado/Recesso'}`,
          categoria: 'INFORMATIVO',
          tipo: 'FERIADO',
          turma_id: turma.turma_id,
          turma_nome: turma.nome,
          targetTab: 'calendario',
        });
      } else {
        notificacoes.push({
          id: `notif-supervisao-hoje-${turma.turma_id}-${hojeIso}`,
          titulo: 'Supervisão Prevista Hoje',
          mensagem: `${turma.nome} às ${horario.hora_inicio}–${horario.hora_fim}`,
          categoria: 'INFORMATIVO',
          tipo: 'SUPERVISAO_HOJE',
          turma_id: turma.turma_id,
          turma_nome: turma.nome,
          targetTab: 'hoje',
        });
      }
    }
  });

  // 6. Calendário Acadêmico Oficial: Notificação de encerramento acadêmico
  // Regra Oficial Estrita: O semestre 2026.2 encerra na semana de 01/12/2026.
  // Notificação só é disparada quando de fato na semana de 01/12/2026!
  const periodoAtual = periodos?.find(p => p.periodo_id === selectedPeriodoId || p.status === 'ATIVO') || periodos?.[0];
  const infoAcademica = obterDatasCalendarioAcademico(periodoAtual, hojeIso);
  if (infoAcademica.estaNaSemanaFinal) {
    notificacoes.push({
      id: `notif-encerramento-academico-${infoAcademica.periodoId}`,
      titulo: 'Semana de Encerramento Acadêmico',
      mensagem: `Semestre ${infoAcademica.nome}: semana oficial de término letivo (encerramento em ${infoAcademica.dataFim}).`,
      categoria: 'INFORMATIVO',
      tipo: 'MARCO_PROXIMO',
      targetTab: 'calendario',
    });
  }

  return notificacoes;
}

/**
 * Deriva itens que precisam da atenção do professor (estritamente acionáveis)
 */
export function derivarPendenciasOperacionais(
  turmas: Turma[],
  matriculas: Matricula[],
  alunos: Aluno[],
  frequencias: Frequencia[],
  documentos: Documento[],
  registrosSemanais: RegistroSemanal[],
  orientacoes: Orientacao[],
  marcosAcademicos: MarcoAcademico[],
  leiturasResponsaveis: LeituraResponsavel[],
  encontrosTurma: EncontroTurma[],
  horariosTurma: HorarioTurma[],
  dataReferencia: Date = new Date()
): ItemPendenciaOperacional[] {
  const pendencias: ItemPendenciaOperacional[] = [];
  const hojeIso = getHojeDataIso(dataReferencia);

  // 1. Chamadas pendentes
  const chamadas = identificarChamadasPendentes(
    turmas,
    horariosTurma,
    frequencias,
    encontrosTurma,
    matriculas,
    dataReferencia
  );
  chamadas.forEach(c => {
    pendencias.push({
      id: `pend-chamada-${c.turma.turma_id}-${c.dataAula}`,
      tipo: 'CHAMADA',
      titulo: `Chamada pendente: ${c.turma.nome}`,
      descricao: `Encontro de ${c.diaSemanaNome}, ${c.dataAula} não teve presença salva.`,
      turma_id: c.turma.turma_id,
      turma_nome: c.turma.nome,
      prazo: c.dataAula,
      urgencia: 'CRITICA',
      targetTab: 'frequencia',
      targetParam: c.turma.turma_id,
    });
  });

  // 2. Justificativas pendentes de análise
  frequencias
    .filter(f => f.status === 'JUSTIFICATIVA_PENDENTE')
    .forEach(f => {
      const mat = matriculas.find(m => m.matricula_id === f.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      const t = mat ? turmas.find(tur => tur.turma_id === mat.turma_id) : null;
      pendencias.push({
        id: `pend-just-${f.frequencia_id}`,
        tipo: 'JUSTIFICATIVA',
        titulo: `Justificativa pendente: ${al?.nome || 'Estudante'}`,
        descricao: `Falta de ${f.data_aula}. Justificativa: "${f.justificativa || 'Aguardando comprovação'}"`,
        turma_id: mat?.turma_id,
        turma_nome: t?.nome,
        matricula_id: f.matricula_id,
        aluno_nome: al?.nome,
        prazo: f.data_aula,
        urgencia: 'ALTA',
        targetTab: 'frequencia',
        targetParam: 'pendencias',
      });
    });

  // 3. Marcos acadêmicos vencidos ou com prazo hoje
  marcosAcademicos
    .filter(m => m.status !== 'CONCLUIDO' && m.data_prazo && m.data_prazo <= hojeIso)
    .forEach(m => {
      pendencias.push({
        id: `pend-marco-${m.marco_id}`,
        tipo: 'PRAZO',
        titulo: `Prazo ${m.data_prazo === hojeIso ? 'hoje' : 'vencido'}: ${m.nome}`,
        descricao: `Data limite: ${m.data_prazo}. ${m.observacao || ''}`,
        prazo: m.data_prazo,
        urgencia: m.data_prazo === hojeIso ? 'CRITICA' : 'ALTA',
        targetTab: 'calendario',
      });
    });

  // 4. Orientações abertas
  orientacoes
    .filter(o => o.status === 'ABERTA')
    .slice(0, 10)
    .forEach(o => {
      const mat = matriculas.find(m => m.matricula_id === o.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      const t = mat ? turmas.find(tur => tur.turma_id === mat.turma_id) : null;
      pendencias.push({
        id: `pend-ori-${o.orientacao_id}`,
        tipo: 'ORIENTACAO',
        titulo: `Orientação em aberto: ${al?.nome || 'Estudante'}`,
        descricao: `[${o.categoria}] ${o.texto.slice(0, 80)}...`,
        turma_id: mat?.turma_id,
        turma_nome: t?.nome,
        matricula_id: o.matricula_id,
        aluno_nome: al?.nome,
        urgencia: 'MEDIA',
        targetTab: 'alunos',
      });
    });

  // 5. Documentos pendentes
  documentos
    .filter(d => d.status === 'PENDENTE')
    .slice(0, 8)
    .forEach(d => {
      const mat = matriculas.find(m => m.matricula_id === d.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      const t = mat ? turmas.find(tur => tur.turma_id === mat.turma_id) : null;
      pendencias.push({
        id: `pend-doc-${d.documento_id}`,
        tipo: 'DOCUMENTO',
        titulo: `Documento pendente: ${d.tipo} - ${al?.nome || 'Estudante'}`,
        descricao: d.observacao || 'Aguardando envio do termo assinado',
        turma_id: mat?.turma_id,
        turma_nome: t?.nome,
        matricula_id: d.matricula_id,
        aluno_nome: al?.nome,
        urgencia: 'MEDIA',
        targetTab: 'pendencias',
        targetParam: 'documentos',
      });
    });

  // RSS não integra a fila de notificações ou alertas gerais.
  // É exibido apenas no contexto da turma e do Modo Supervisão.

  return pendencias;
}

// -----------------------------------------------------------------------------
// CÁLCULO CANÔNICO E RESILIENTE DO CRONOGRAMA DE PRÁTICA E RSS (SEMANA ATUAL E ENCERRADAS)
// -----------------------------------------------------------------------------
export interface MetricasCronogramaRss {
  semanaAtual: number | null;
  totalSemanas: number | null;
  semanasEncerradas: number | null;
  semanaTexto: string; // Ex: "5 / 12" ou "—"
  semanasEncerradasTexto: string; // Ex: "4" ou "—"
  temDados: boolean;
  conflitoIdentificado: boolean;
  avisoInconsistencia?: string | null;
  fonte: 'calendario_rss' | 'situacao_atual_turmas' | 'sem_dados';
}

/**
 * Calcula metricas do cronograma semanal de prática e RSS de forma canônica:
 * - Aplica filtragem estrita por turma_id (NUNCA usa calendário de outra turma como fallback).
 * - Garante a invariante acadêmica: semanasEncerradas < semanaAtual (uma turma na semana 5/12
 *   nunca pode aparecer com 10 semanas de prática encerradas).
 * - Identifica e resolve divergências entre datas defasadas e marcadores manuais de status.
 */
export function calcularMetricasCronogramaRss(
  turmaId: string | undefined,
  calendarioRss: CalendarioRss[],
  situacaoAtualTurmas: SituacaoAtualTurma[],
  hojeIso: string = getHojeDataIso()
): MetricasCronogramaRss {
  if (!turmaId) {
    return {
      semanaAtual: null,
      totalSemanas: null,
      semanasEncerradas: null,
      semanaTexto: '—',
      semanasEncerradasTexto: '—',
      temDados: false,
      conflitoIdentificado: false,
      fonte: 'sem_dados',
    };
  }

  // 1. Filtragem ESTRITA por turma_id (REGRA: NUNCA herdar de outra turma se estiver vazio)
  const calendarioDaTurma = calendarioRss.filter(c => c.turma_id === turmaId);
  const situacaoTurma = situacaoAtualTurmas.find(s => s.turma_id === turmaId);

  // Cenário A: Não há registros em calendario_rss para esta turma específica
  if (calendarioDaTurma.length === 0) {
    // Se a tabela oficial materializada situacao_atual_turmas tiver dados para esta turma
    if (situacaoTurma && (situacaoTurma.rss_total_previsto || situacaoTurma.rss_esperados_ate_hoje || situacaoTurma.aula_cronograma_atual)) {
      const totalPrevisto = situacaoTurma.rss_total_previsto ? Number(situacaoTurma.rss_total_previsto) : 12;
      let esperadosAteHoje =
        situacaoTurma.rss_esperados_ate_hoje !== undefined && situacaoTurma.rss_esperados_ate_hoje !== ''
          ? Number(situacaoTurma.rss_esperados_ate_hoje)
          : null;
      let aulaAtual =
        situacaoTurma.aula_cronograma_atual !== undefined && situacaoTurma.aula_cronograma_atual !== ''
          ? Number(situacaoTurma.aula_cronograma_atual)
          : (esperadosAteHoje !== null ? Math.min(totalPrevisto, esperadosAteHoje + 1) : null);

      let conflito = false;
      let avisoInconsistencia: string | null = null;

      // Invariante acadêmica: semanas encerradas NUNCA pode ser >= semana atual
      if (aulaAtual !== null && esperadosAteHoje !== null && esperadosAteHoje >= aulaAtual) {
        conflito = true;
        avisoInconsistencia = `Inconsistência na tabela situacao_atual_turmas: RSS esperados (${esperadosAteHoje}) >= Semana atual (${aulaAtual}). Ajustado para ${Math.max(0, aulaAtual - 1)}.`;
        esperadosAteHoje = Math.max(0, aulaAtual - 1);
      }

      return {
        semanaAtual: aulaAtual,
        totalSemanas: totalPrevisto,
        semanasEncerradas: esperadosAteHoje,
        semanaTexto: aulaAtual !== null ? `${aulaAtual} / ${totalPrevisto}` : '—',
        semanasEncerradasTexto: esperadosAteHoje !== null ? `${esperadosAteHoje}` : '—',
        temDados: true,
        conflitoIdentificado: conflito,
        avisoInconsistencia,
        fonte: 'situacao_atual_turmas',
      };
    }

    // Sem dados: retorna estado neutro — NUNCA FALLBACK PARA OUTRA TURMA
    return {
      semanaAtual: null,
      totalSemanas: null,
      semanasEncerradas: null,
      semanaTexto: '—',
      semanasEncerradasTexto: '—',
      temDados: false,
      conflitoIdentificado: false,
      avisoInconsistencia: 'Sem cronograma cadastrado para esta turma.',
      fonte: 'sem_dados',
    };
  }

  // Cronograma de prática: deriva a semana das datas das 12 janelas oficiais.
  // "aula_cronograma_atual" pertence à supervisão presencial e NÃO
  // é uma semana de prática/RSS. Estados textuais da planilha podem estar
  // materializados em outro momento; datas sempre prevalecem.
  const semanas = calendarioDaTurma
    .map(c => ({
      seq: Number(c.sequencia || c.semana || 0),
      inicio: c.semana_inicio || '',
      fim: c.semana_fim || '',
    }))
    .filter(c => c.seq > 0 && /^\d{4}-\d{2}-\d{2}$/.test(c.inicio) && /^\d{4}-\d{2}-\d{2}$/.test(c.fim))
    .sort((a, b) => a.seq - b.seq);
  if (semanas.length === 0) {
    return {
      semanaAtual: null, totalSemanas: null, semanasEncerradas: null,
      semanaTexto: '—', semanasEncerradasTexto: '—',
      temDados: false, conflitoIdentificado: true,
      avisoInconsistencia: 'Datas de prática não disponíveis no calendário oficial.',
      fonte: 'sem_dados',
    };
  }
  const totalSemanas = Math.max(...semanas.map(s => s.seq));
  const encerradas = semanas.filter(s => s.fim < hojeIso);
  const atual = semanas.find(s => s.inicio <= hojeIso && s.fim >= hojeIso);
  const primeiraFutura = semanas.find(s => s.inicio > hojeIso);
  const semanaAtual = atual?.seq ?? primeiraFutura?.seq ?? totalSemanas;
  const semanasEncerradas = encerradas.length;
  const conflito = Boolean(situacaoTurma?.aula_cronograma_atual &&
    Number(situacaoTurma.aula_cronograma_atual) !== semanaAtual);
  return {
    semanaAtual,
    totalSemanas,
    semanasEncerradas,
    semanaTexto: `${semanaAtual} / ${totalSemanas}`,
    semanasEncerradasTexto: `${semanasEncerradas}`,
    temDados: true,
    conflitoIdentificado: conflito,
    avisoInconsistencia: conflito
      ? 'Número da aula de supervisão difere da semana de prática; prevalece o calendário de prática.'
      : null,
    fonte: 'calendario_rss',
  };
}

/**
 * Seletor Canônico de Situação RSS do Estudante
 * Unifica e sincroniza em todas as telas:
 * - Registros Realizados (tabela registros_semanais com fallback para status_rss_unidades)
 * - Registros Esperados Até Hoje (status_rss_unidades ou semanas encerradas da turma)
 * - Total Previsto no Período (regras_rss, situacao_atual_turmas ou padrão 12)
 * Garante distinção explícita entre esperado hoje e total previsto no período.
 */
/**
 * RSS importado: apenas respostas validadas e atribuídas a uma semana RSS
 * específica comprovam o cumprimento daquela semana. O número de sessão
 * clínica NÃO corresponde necessariamente ao número da semana do semestre.
 */
/**
 * Semana acadêmica de uma entrega de RSS. Não há etapa de validação: conta o registro RECEBIDO/ENTREGUE com semana
 * explícita (1 a 12). Semana vazia é resolvida pela data de entrega em `resumirEntregasRss`, nunca pelo número do encontro.
 */
export function obterSemanaRssValidada(reg: RegistroSemanal): number | null {
  return contaComoEntrega(reg as never) ? semanaExplicita(reg as never) : null;
}

export function obterSituacaoRssEstudante(
  matriculaId: string,
  turmaId: string,
  registrosSemanais: RegistroSemanal[],
  statusRssUnidade?: StatusRssUnidade,
  regraTurma?: RegraRss,
  situacaoTurma?: SituacaoAtualTurma,
  calendarioRssTurma?: CalendarioRss[],
  grupoId?: string,
  opcoes: { fonteDisponivel?: boolean; hojeIso?: string; observacoes?: Map<number, string[]> } = {}
): SituacaoRssEstudante {
  // Clínica Ampliada: a unidade de entrega é o grupo inteiro, não o autor
  // responsável pelo preenchimento. Nunca atribuir o RSS somente à matrícula.
  const regsEstudante = registrosSemanais.filter(r =>
    grupoId
      ? (r as any).grupo_id === grupoId && (!(r as any).turma_id || (r as any).turma_id === turmaId)
      : r.matricula_id === matriculaId && !(r as any).grupo_id
  );
  // (a contagem de entregas é feita adiante por resumirEntregasRss, com o total consolidado como piso)
  // 3. Registros esperados até hoje
  let esperadosHoje = 0;
  if (
    statusRssUnidade?.rss_esperados_ate_hoje !== undefined &&
    statusRssUnidade.rss_esperados_ate_hoje !== null
  ) {
    esperadosHoje = Number(statusRssUnidade.rss_esperados_ate_hoje);
  } else if (
    statusRssUnidade?.total_esperado_ate_hoje !== undefined &&
    statusRssUnidade.total_esperado_ate_hoje !== null
  ) {
    esperadosHoje = Number(statusRssUnidade.total_esperado_ate_hoje);
  } else if (
    situacaoTurma?.rss_esperados_ate_hoje !== undefined &&
    situacaoTurma.rss_esperados_ate_hoje !== null
  ) {
    esperadosHoje = Number(situacaoTurma.rss_esperados_ate_hoje);
  } else if (calendarioRssTurma && calendarioRssTurma.length > 0) {
    const metricas = calcularMetricasCronogramaRss(turmaId, calendarioRssTurma, situacaoTurma ? [situacaoTurma] : []);
    esperadosHoje = metricas.semanasEncerradas ?? 0;
  }

  // 4. Total previsto no período / semestre
  let totalPrevisto = 12;
  if (regraTurma?.total_esperado) {
    totalPrevisto = Number(regraTurma.total_esperado);
  } else if (situacaoTurma?.rss_total_previsto) {
    totalPrevisto = Number(situacaoTurma.rss_total_previsto);
  }

  // Entregas: dois status por semana, semana identificada automaticamente, sem etapa de validação
  const entregas = resumirEntregasRss({
    registros: regsEstudante as never[],
    cronograma: (calendarioRssTurma ?? []) as never[],
    totalPrevisto,
    esperadosAteHoje: esperadosHoje,
    realizadosConsolidado: statusRssUnidade?.rss_recebidos_validos !== undefined && statusRssUnidade.rss_recebidos_validos !== null
      ? Number(statusRssUnidade.rss_recebidos_validos) : null,
    hojeIso: opcoes.hojeIso ?? getHojeDataIso(),
    fonteDisponivel: opcoes.fonteDisponivel,
    observacoes: opcoes.observacoes,
  });
  const realizados = entregas.totalRealizado;

  // 5. Saldo e Status
  const saldo = realizados - esperadosHoje;
  const statusSemanal = saldo < 0 ? 'ATRASADO' : saldo === 0 ? 'EM_DIA' : 'ADIANTADO';
  const estaAtrasado = saldo < 0;

  const textoExibicao = `${realizados} de ${esperadosHoje} esperados até hoje (${totalPrevisto} previstos)`;

  return {
    matriculaId,
    turmaId,
    registrosRealizados: realizados,
    registrosEsperadosAteHoje: esperadosHoje,
    totalPrevistoNoPeriodo: totalPrevisto,
    saldoRss: saldo,
    statusSemanal,
    estaAtrasado,
    registrosEstudante: regsEstudante,
    textoExibicao,
    entregas,
  };
}

/**
 * Informações de RSS exibidas só na aula/turma; nunca criam notificações.
 * Cada semana encerrada é distinta do número de encontro clínico.
 */
export function obterLacunasRssDaAula(
  situacao: SituacaoRssEstudante | null,
  calendario: CalendarioRss[],
  hojeIso: string = getHojeDataIso()
): { faltantes: number[]; emRevisao: number[] } {
  // `emRevisao` permanece no formato por compatibilidade, mas não existe etapa de validação: é sempre vazio.
  if (!situacao) return { faltantes: [], emRevisao: [] };
  const encerradas = semanasEncerradas(calendario.filter(c => c.turma_id === situacao.turmaId) as never[], hojeIso);
  // Entrega sem semana identificada pode cobrir qualquer semana aberta: sem certeza, nenhuma semana é acusada.
  const e = situacao.entregas;
  if (e && (e.semSemanaIdentificada.length > 0 || e.consolidadoSemDetalhe > 0 || e.disponibilidade !== 'OK')) return { faltantes: [], emRevisao: [] };
  const entregues = new Set(e ? e.semanasEntregues : situacao.registrosEstudante.map(obterSemanaRssValidada).filter((n): n is number => n !== null));
  return { faltantes: encerradas.filter(n => !entregues.has(n)), emRevisao: [] };
}

export type SituacaoRssOperacional = 'EM_DIA' | 'RECENTE_PENDENTE' | 'HISTORICO_INCOMPLETO' | 'AGUARDANDO_CALENDARIO';
/**
 * Situação recente (para atenção) separada do histórico acumulado.
 * Nunca reabre notificação por um RSS antigo; mantém a lacuna visível
 * no histórico da turma. Apenas a semana encerrada mais recentemente
 * pode gerar uma pendência operacional, e somente enquanto ainda é
 * a última semana encerrada.
 */
export function classificarRssOperacional(
  situacao: SituacaoRssEstudante | null,
  calendario: CalendarioRss[],
  hojeIso: string = getHojeDataIso()
): { categoria: SituacaoRssOperacional; faltamHistoricas: number; ultimaSemanaFechada: number | null } {
  if (!situacao) return { categoria: 'AGUARDANDO_CALENDARIO', faltamHistoricas: 0, ultimaSemanaFechada: null };
  const encerradas = semanasEncerradas(calendario.filter(c => c.turma_id === situacao.turmaId) as never[], hojeIso);
  if (encerradas.length === 0) return { categoria: 'EM_DIA', faltamHistoricas: 0, ultimaSemanaFechada: null };
  const ultima = Math.max(...encerradas);
  const e = situacao.entregas;
  // Dados indisponíveis ou entrega sem semana identificada: não se acusa semana; só a contagem (sem alarme) é mostrada.
  if (e && (e.disponibilidade !== 'OK' || e.semSemanaIdentificada.length > 0 || e.consolidadoSemDetalhe > 0)) {
    const n = e.disponibilidade === 'OK' ? e.pendentesEmNumero : 0;
    return { categoria: n === 0 ? 'EM_DIA' : 'HISTORICO_INCOMPLETO', faltamHistoricas: n, ultimaSemanaFechada: ultima };
  }
  const recebidas = new Set(e ? e.semanasEntregues : situacao.registrosEstudante.map(obterSemanaRssValidada).filter((n): n is number => n !== null));
  const faltamHistoricas = encerradas.filter(n => !recebidas.has(n)).length;
  if (faltamHistoricas === 0) return { categoria: 'EM_DIA', faltamHistoricas: 0, ultimaSemanaFechada: ultima };
  if (recebidas.has(ultima)) return { categoria: 'HISTORICO_INCOMPLETO', faltamHistoricas, ultimaSemanaFechada: ultima };
  return { categoria: 'RECENTE_PENDENTE', faltamHistoricas, ultimaSemanaFechada: ultima };
}

/**
 * Coleção Canônica de Pendências Operacionais
 * Unifica todos os contadores e listas do app (Sidebar, Pendências, Dashboard, Aluno, Turma)
 * garantindo consistência matemática absoluta.
 */
export function gerarPendenciasCanonicas(
  periodoId: string,
  turmas: Turma[],
  matriculas: Matricula[],
  alunos: Aluno[],
  frequencias: Frequencia[],
  documentos: Documento[],
  registrosSemanais: RegistroSemanal[],
  orientacoes: Orientacao[],
  marcosAcademicos: MarcoAcademico[],
  leiturasResponsaveis: LeituraResponsavel[],
  encontrosTurma: EncontroTurma[],
  horariosTurma: HorarioTurma[],
  regrasRss: RegraRss[],
  situacaoAtualTurmas: SituacaoAtualTurma[],
  calendarioRss: CalendarioRss[],
  statusRssUnidades: StatusRssUnidade[],
  dataReferencia: Date = new Date(),
  gruposPratica: GrupoPratica[] = [],
  grupoIntegrantes: GrupoIntegrante[] = []
): ItemPendenciaOperacional[] {
  const pendencias: ItemPendenciaOperacional[] = [];
  const hojeIso = getHojeDataIso(dataReferencia);

  // Filtro de turmas e matrículas do período letivo selecionado
  const turmasDoPeriodo = turmas.filter(t => t.periodo_id === periodoId || !t.periodo_id);
  const turmasIds = turmasDoPeriodo.map(t => t.turma_id);
  const matriculasDoPeriodo = matriculas.filter(m => turmasIds.includes(m.turma_id));
  const matIds = matriculasDoPeriodo.map(m => m.matricula_id);

  // 1. Documentos pendentes
  documentos
    .filter(d => d.status === 'PENDENTE' && matIds.includes(d.matricula_id))
    .forEach(d => {
      const mat = matriculasDoPeriodo.find(m => m.matricula_id === d.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      const t = mat ? turmasDoPeriodo.find(tur => tur.turma_id === mat.turma_id) : null;
      pendencias.push({
        id: `pend-doc-${d.documento_id}`,
        tipo: 'DOCUMENTO',
        titulo: `Documento pendente: ${d.tipo} - ${al?.nome || 'Estudante'}`,
        descricao: d.observacao || 'Aguardando envio do termo assinado',
        turma_id: mat?.turma_id,
        turma_nome: t?.nome,
        matricula_id: d.matricula_id,
        aluno_nome: al?.nome,
        urgencia: 'MEDIA',
        targetTab: 'pendencias',
        targetParam: 'documentos',
      });
    });

  // 2. RSS em Atraso: cada grupo da Clínica Ampliada é UMA unidade.
  // Não gerar pendência individual se outra integrante enviou pelo grupo.
  const gruposJaAvaliados = new Set<string>();
  matriculasDoPeriodo.forEach(m => {
    const grupoIntegrante = grupoIntegrantes.find(gi => gi.matricula_id === m.matricula_id &&
      gruposPratica.some(g => g.grupo_id === gi.grupo_id && g.turma_id === m.turma_id)
    );
    const grupoId = grupoIntegrante?.grupo_id;
    if (grupoId) {
      if (gruposJaAvaliados.has(grupoId)) return;
      gruposJaAvaliados.add(grupoId);
    } else if (gruposPratica.some(g => g.turma_id === m.turma_id)) {
      // Vínculo de grupo ausente: não inventar ausência individual de RSS.
      return;
    }
    const statusRss = statusRssUnidades.find(st =>
      (st.turma_id === m.turma_id || !st.turma_id) &&
      (grupoId
        ? st.unidade_id === grupoId && st.unidade_tipo === 'GRUPO'
        : (st.unidade_id === m.matricula_id || st.unidade_id === m.aluno_id) &&
          (st.unidade_tipo === 'INDIVIDUAL' || !st.unidade_tipo))
    );
    const turma = turmasDoPeriodo.find(t => t.turma_id === m.turma_id);
    const regraTurma = regrasRss.find(r => r.turma_id === m.turma_id || r.disciplina_id === turma?.disciplina_id);
    const situacaoTurma = situacaoAtualTurmas.find(st => st.turma_id === m.turma_id);
    const calTurma = calendarioRss.filter(c => c.turma_id === m.turma_id);
    const sitRss = obterSituacaoRssEstudante(
      m.matricula_id, m.turma_id, registrosSemanais, statusRss,
      regraTurma, situacaoTurma, calTurma, grupoId
    );
    const situacaoOperacional = classificarRssOperacional(sitRss, calendarioRss, hojeIso);
    if (situacaoOperacional.categoria !== 'RECENTE_PENDENTE') return;
    const al = alunos.find(a => a.aluno_id === m.aluno_id);
    const grupo = grupoId ? gruposPratica.find(g => g.grupo_id === grupoId) : undefined;
    const nomeUnidade = grupo ? (grupo.nome_grupo || 'Grupo de prática') : (al?.nome || 'Estudante');
    pendencias.push({
      id: grupoId ? `pend-rss-grupo-${grupoId}` : `pend-rss-${m.matricula_id}`,
      tipo: 'RSS_ATRASADO',
      titulo: `RSS em Atraso: ${nomeUnidade}`,
      descricao: `${grupoId ? 'Pendência coletiva do grupo. ' : ''}Semana ${situacaoOperacional.ultimaSemanaFechada} não entregue. Entregas: ${sitRss.registrosRealizados} de ${sitRss.registrosEsperadosAteHoje} esperados até hoje (${sitRss.totalPrevistoNoPeriodo} previstos)`,
      turma_id: m.turma_id,
      turma_nome: turma?.nome,
      matricula_id: m.matricula_id,
      aluno_nome: nomeUnidade,
      urgencia: 'ALTA',
      targetTab: 'pendencias',
      targetParam: 'registros',
    });
  });

  // 3. Faltas Injustificadas
  frequencias
    .filter(f => f.status === 'FALTA_SEM_JUSTIFICATIVA' && matIds.includes(f.matricula_id))
    .forEach(f => {
      const mat = matriculasDoPeriodo.find(m => m.matricula_id === f.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      const t = mat ? turmasDoPeriodo.find(tur => tur.turma_id === mat.turma_id) : null;
      pendencias.push({
        id: `pend-falta-${f.frequencia_id}`,
        tipo: 'FALTA_INJUSTIFICADA',
        titulo: `Falta Injustificada: ${al?.nome || 'Estudante'}`,
        descricao: `Ausência não justificada em aula de ${f.data_aula}.`,
        turma_id: mat?.turma_id,
        turma_nome: t?.nome,
        matricula_id: f.matricula_id,
        aluno_nome: al?.nome,
        urgencia: 'ALTA',
        targetTab: 'frequencia',
      });
    });

  // 4. Orientações Abertas
  orientacoes
    .filter(o => o.status === 'ABERTA' && matIds.includes(o.matricula_id))
    .forEach(o => {
      const mat = matriculasDoPeriodo.find(m => m.matricula_id === o.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      const t = mat ? turmasDoPeriodo.find(tur => tur.turma_id === mat.turma_id) : null;
      pendencias.push({
        id: `pend-ori-${o.orientacao_id}`,
        tipo: 'ORIENTACAO',
        titulo: `Orientação em aberto: ${al?.nome || 'Estudante'}`,
        descricao: `[${o.categoria}] ${o.texto.slice(0, 80)}...`,
        turma_id: mat?.turma_id,
        turma_nome: t?.nome,
        matricula_id: o.matricula_id,
        aluno_nome: al?.nome,
        urgencia: 'MEDIA',
        targetTab: 'alunos',
      });
    });

  // 5. Chamadas Pendentes
  const chamadas = identificarChamadasPendentes(
    turmasDoPeriodo,
    horariosTurma,
    frequencias,
    encontrosTurma,
    matriculasDoPeriodo,
    dataReferencia
  );
  chamadas.forEach(c => {
    pendencias.push({
      id: `pend-chamada-${c.turma.turma_id}-${c.dataAula}`,
      tipo: 'CHAMADA',
      titulo: `Chamada pendente: ${c.turma.nome}`,
      descricao: `Encontro de ${c.diaSemanaNome}, ${c.dataAula} não teve presença salva.`,
      turma_id: c.turma.turma_id,
      turma_nome: c.turma.nome,
      prazo: c.dataAula,
      urgencia: 'CRITICA',
      targetTab: 'frequencia',
      targetParam: c.turma.turma_id,
    });
  });

  // 6. Justificativas Pendentes
  frequencias
    .filter(f => f.status === 'JUSTIFICATIVA_PENDENTE' && matIds.includes(f.matricula_id))
    .forEach(f => {
      const mat = matriculasDoPeriodo.find(m => m.matricula_id === f.matricula_id);
      const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
      const t = mat ? turmasDoPeriodo.find(tur => tur.turma_id === mat.turma_id) : null;
      pendencias.push({
        id: `pend-just-${f.frequencia_id}`,
        tipo: 'JUSTIFICATIVA',
        titulo: `Justificativa pendente: ${al?.nome || 'Estudante'}`,
        descricao: `Falta de ${f.data_aula}. Comprovação anexada: "${f.justificativa || 'Aguardando comprovação'}"`,
        turma_id: mat?.turma_id,
        turma_nome: t?.nome,
        matricula_id: f.matricula_id,
        aluno_nome: al?.nome,
        prazo: f.data_aula,
        urgencia: 'ALTA',
        targetTab: 'frequencia',
        targetParam: 'pendencias',
      });
    });

  // 7. Marcos Acadêmicos Vencidos/Prazo Hoje
  marcosAcademicos
    .filter(m => m.status !== 'CONCLUIDO' && m.data_prazo && m.data_prazo <= hojeIso)
    .forEach(m => {
      pendencias.push({
        id: `pend-marco-${m.marco_id}`,
        tipo: 'PRAZO',
        titulo: `Prazo ${m.data_prazo === hojeIso ? 'hoje' : 'vencido'}: ${m.nome}`,
        descricao: `Data limite: ${m.data_prazo}. ${m.observacao || ''}`,
        prazo: m.data_prazo,
        urgencia: m.data_prazo === hojeIso ? 'CRITICA' : 'ALTA',
        targetTab: 'calendario',
      });
    });

  return pendencias;
}

