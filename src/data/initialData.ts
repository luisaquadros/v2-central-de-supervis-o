import {
  Periodo,
  Disciplina,
  Turma,
  Aluno,
  Matricula,
  Orientacao,
  RegistroSemanal,
  Documento,
  Avaliacao,
  FeedbackAluno,
  CriterioAvaliacao,
  Ocorrencia,
  Configuracao,
  TurmaOrigem,
  Frequencia,
  HorarioTurma,
  PontoAcompanhamento,
  MarcoAcademico,
  RegraRss,
  CalendarioRss,
  StatusRssUnidade,
  SituacaoAtualTurma,
  LeituraResponsavel,
  RegraPrazo,
  GrupoPratica,
  GrupoIntegrante,
  Entrega,
  Feedback,
  RegistroSupervisao,
  Sincronizacao,
  DicionarioDado,
  ContratoApp,
  MapeamentoFonte,
  AuditoriaBase,
} from '../types';

/**
 * BASE DE DADOS OFICIAL: Central de Supervisão - DESENVOLVIMENTO
 * Spreadsheet ID: 1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4
 *
 * Mocks de alunos e critérios acadêmicos hardcoded foram removidos.
 * Todos os registros e critérios de avaliação efetivos DEVEM vir
 * exclusivamente da planilha oficial (criterios_avaliacao), variando
 * por turma, disciplina e instrumento de avaliação.
 */

// 18 Tabelas Originais Mapeadas
export const initialPeriodos: Periodo[] = [];
export const initialDisciplinas: Disciplina[] = [];
export const initialTurmas: Turma[] = [];
export const initialTurmasOrigem: TurmaOrigem[] = [];
export const initialHorariosTurma: HorarioTurma[] = [];
export const initialAlunos: Aluno[] = [];
export const initialMatriculas: Matricula[] = [];
export const initialOrientacoes: Orientacao[] = [];
export const initialRegistrosSemanais: RegistroSemanal[] = [];
export const initialDocumentos: Documento[] = [];
export const initialAvaliacoes: Avaliacao[] = [];
export const initialFeedbacks: FeedbackAluno[] = [];
export const initialOcorrencias: Ocorrencia[] = [];
export const initialPontosAcompanhamento: PontoAcompanhamento[] = [];
export const initialFrequencias: Frequencia[] = [];
export const initialMarcosAcademicos: MarcoAcademico[] = [];
export const initialConfiguracoes: Configuracao[] = [];

// Critérios de Avaliação (sem fallback com critérios hardcoded - vêm de criterios_avaliacao)
export const initialCriteriosAvaliacao: CriterioAvaliacao[] = [];

// 12 Tabelas Adicionais Normalizadas da Planilha Oficial
export const initialRegrasRss: RegraRss[] = [];
export const initialCalendarioRss: CalendarioRss[] = [];
export const initialStatusRssUnidades: StatusRssUnidade[] = [];
export const initialSituacaoAtualTurmas: SituacaoAtualTurma[] = [];
export const initialLeiturasResponsaveis: LeituraResponsavel[] = [];
export const initialRegrasPrazo: RegraPrazo[] = [];
export const initialGruposPratica: GrupoPratica[] = [];
export const initialGrupoIntegrantes: GrupoIntegrante[] = [];
export const initialEntregas: Entrega[] = [];
export const initialFeedbacksOficiais: Feedback[] = [];
export const initialRegistrosSupervisao: RegistroSupervisao[] = [];
export const initialSincronizacao: Sincronizacao[] = [];

// Tabelas de Documentação e Contrato da Base Oficial
export const initialDicionarioDados: DicionarioDado[] = [];
export const initialContratoApp: ContratoApp[] = [];
export const initialMapeamentoFontes: MapeamentoFonte[] = [];
export const initialAuditoriaBase: AuditoriaBase[] = [];
