/** Formato dos dados carregados da planilha oficial (todas as abas normalizadas). */

import {
  Periodo,
  Disciplina,
  Turma,
  Aluno,
  Matricula,
  HorarioTurma,
  TurmaOrigem,
  Orientacao,
  CriterioAvaliacao,
  Configuracao,
  MarcoAcademico,
  PontoAcompanhamento,
  Frequencia,
  Documento,
  RegistroSemanal,
  Avaliacao,
  FeedbackAluno,
  Ocorrencia,
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
  EncontroTurma,
  PreparacaoAula,
  AvaliacaoCompleta,
  MonitoramentoDocumento,
} from '../types';

export interface DadosIniciais {
  periodos: Periodo[];
  disciplinas: Disciplina[];
  turmas: Turma[];
  horarios: HorarioTurma[];
  turmasOrigem: TurmaOrigem[];
  alunos: Aluno[];
  matriculas: Matricula[];
  criterios: CriterioAvaliacao[];
  orientacoes: Orientacao[];
  configuracoes: Configuracao[];
  marcos: MarcoAcademico[];
  pontosAcompanhamento: PontoAcompanhamento[];
  frequencias: Frequencia[];
  documentos: Documento[];
  registrosSemanais: RegistroSemanal[];
  avaliacoes: Avaliacao[];
  feedbacks: FeedbackAluno[];
  ocorrencias: Ocorrencia[];
  // 12 Tabelas Adicionais Normalizadas
  regrasRss?: RegraRss[];
  calendarioRss?: CalendarioRss[];
  statusRssUnidades?: StatusRssUnidade[];
  situacaoAtualTurmas?: SituacaoAtualTurma[];
  leiturasResponsaveis?: LeituraResponsavel[];
  regrasPrazo?: RegraPrazo[];
  gruposPratica?: GrupoPratica[];
  grupoIntegrantes?: GrupoIntegrante[];
  entregas?: Entrega[];
  feedbacksOficiais?: Feedback[];
  registrosSupervisao?: RegistroSupervisao[];
  encontrosTurma?: EncontroTurma[];
  preparacoesAula?: PreparacaoAula[];
  monitoramentoDocumentos?: MonitoramentoDocumento[];
  /** Linhas brutas das abas aditivas da avaliação (convertidas por estruturaAvaliacao.ts) */
  configAvaliacao?: Record<string, unknown>[];
  rubricasAvaliacao?: Record<string, unknown>[];
  rascunhosAvaliacao?: Record<string, unknown>[];
  evidenciasAvaliacao?: Record<string, unknown>[];
  avaliacoesCompletas?: AvaliacaoCompleta[];
  sincronizacao?: Sincronizacao[];
  // Documentação e Contrato da Base Oficial
  dicionarioDados?: DicionarioDado[];
  contratoApp?: ContratoApp[];
  mapeamentoFontes?: MapeamentoFonte[];
  auditoriaBase?: AuditoriaBase[];
}
