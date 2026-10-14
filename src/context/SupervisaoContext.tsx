import { aplicarAjustesRss, observacoesPorSemana } from '../services/rssEntregas';
import { ABAS_AVALIACAO, linhaParaAjuste, type NomeAbaAvaliacao } from '../services/estruturaAvaliacao';
import { chaveItemOperacional, prepararRegistroOperacional, combinarOperacionais, contarLegadosLocais, type TipoOperacional } from '../services/operacionaisSheetsService';
import { resumirDocumentacaoOficial, documentosPendentesOficiais } from '../services/documentacaoAcademicaService';
import { interpretarStatusEntrega } from '../services/normalizacaoAcademica';
import { filtrarPendenciasResolvidas } from '../services/pendenciaResolutionService';
import { selecionarRssDoEstudante } from '../services/rssVinculos';
import { listarAlunosChamada } from '../services/aulaParticipants';
import { useDurableLocalState } from '../hooks/useDurableLocalState';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  AlunoResumoSupervisao,
  SituacaoRssEstudante,
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
  CaixaEntradaItem,
  ItemFilaProfessora,
  ItemFilaSupervisao,
  AvaliacaoCompleta,
  HistoricoAuditoria,
  EncontroTurma,
  PreparacaoAula,
  StatusEncontro,
  MotivoNaoRealizado,
  NotificacaoDerivada,
  ItemPendenciaOperacional,
} from '../types';
import {
  identificarSupervisaoAtual,
  identificarProximaSupervisao,
  identificarChamadasPendentes,
  derivarNotificacoesOperacionais,
  obterSituacaoRssEstudante,
  classificarRssOperacional,
  gerarPendenciasCanonicas,
  ResultadoSupervisaoAtual,
  ResultadoProximaSupervisao,
  ItemChamadaPendente,
} from '../services/supervisaoOperacionalService';
import { getHojeDataIso } from '../services/supervisaoOperacionalService';
import { lerSessaoAutorizada, registrarSessaoAutorizada, encerrarSessaoAutorizada } from '../services/sessionPolicy';
import { validarEscritaTabela, gerarIdEstavel } from '../services/safeWriteService';
import {
  inicializarCacheLocal,
  sincronizarDaBaseOficial,
  salvarRegistroResiliente,
  processarFilaSincronizacao,
  subscribeSyncStatus,
  SyncStatusState,
} from '../services/syncService';
import { salvarTabelaUnicaNoIndexedDb, carregarFilaSincronizacao, garantirCacheDoUsuario } from '../services/indexedDbService';
import {
  initialPeriodos,
  initialDisciplinas,
  initialTurmas,
  initialAlunos,
  initialMatriculas,
  initialOrientacoes,
  initialRegistrosSemanais,
  initialDocumentos,
  initialAvaliacoes,
  initialFeedbacks,
  initialCriteriosAvaliacao,
  initialOcorrencias,
  initialConfiguracoes,
  initialTurmasOrigem,
  initialFrequencias,
  initialHorariosTurma,
  initialPontosAcompanhamento,
  initialMarcosAcademicos,
  initialRegrasRss,
  initialCalendarioRss,
  initialStatusRssUnidades,
  initialSituacaoAtualTurmas,
  initialLeiturasResponsaveis,
  initialRegrasPrazo,
  initialGruposPratica,
  initialGrupoIntegrantes,
  initialEntregas,
  initialFeedbacksOficiais,
  initialRegistrosSupervisao,
  initialSincronizacao,
  initialDicionarioDados,
  initialContratoApp,
  initialMapeamentoFontes,
  initialAuditoriaBase,
} from '../data/initialData';
import { geraRegistroAutomatico } from '../services/condicoesMatricula';
import { verificarAcessoEscrita, limparCachePerfil, type PerfilServidor } from '../services/escritaCoordenadaService';
import { gerarBackup, validarBackup, compararComBackup, operacaoDeRestauracao, type TabelasBackup, type ArquivoBackup, type RelatorioBackup, type DiferencaRegistro } from '../services/backupService';
import { OFFICIAL_SPREADSHEET_ID, OFFICIAL_SPREADSHEET_NAME, OFFICIAL_SPREADSHEET_URL } from '../services/googleSheetsService';
import type { DadosIniciais } from '../services/dadosIniciais';
import type { User } from 'firebase/auth';
import type { MonitoramentoDocumento } from '../types';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  carregarDadosDaPlanilhaOficial,
  getAccessToken,
} from '../services/googleSheetsService';

export type ConnectionStatus = 'CARREGANDO' | 'CONECTADO' | 'ERRO_CONEXAO' | 'LOCAL_DEV';
export type SaveStatus =
  | 'IDLE'
  | 'SALVANDO'
  | 'SINCRONIZADO_SHEETS'
  | 'SALVO_LOCAL_AGUARDANDO_SYNC'
  | 'ERRO_SINCRONIZACAO'
  | 'SALVO'
  | 'ERRO_SALVAR';

export interface NovoHorarioInput {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

export interface NovaOrigemInput {
  sistema: string;
  codigo_externo: string;
  nome_externo: string;
}

interface SupervisaoContextType {
  periodos: Periodo[];
  disciplinas: Disciplina[];
  turmas: Turma[];
  alunos: Aluno[];
  matriculas: Matricula[];
  orientacoes: Orientacao[];
  registrosSemanais: RegistroSemanal[];
  documentos: Documento[];
  avaliacoes: Avaliacao[];
  feedbacks: FeedbackAluno[];
  criterios: CriterioAvaliacao[];
  ocorrencias: Ocorrencia[];
  configuracoes: Configuracao[];
  turmasOrigem: TurmaOrigem[];
  frequencias: Frequencia[];
  horariosTurma: HorarioTurma[];
  pontosAcompanhamento: PontoAcompanhamento[];
  marcosAcademicos: MarcoAcademico[];
  // 12 Tabelas Adicionais da Planilha Oficial
  regrasRss: RegraRss[];
  calendarioRss: CalendarioRss[];
  statusRssUnidades: StatusRssUnidade[];
  situacaoAtualTurmas: SituacaoAtualTurma[];
  leiturasResponsaveis: LeituraResponsavel[];
  regrasPrazo: RegraPrazo[];
  gruposPratica: GrupoPratica[];
  grupoIntegrantes: GrupoIntegrante[];
  entregas: Entrega[];
  feedbacksOficiais: Feedback[];
  registrosSupervisao: RegistroSupervisao[];
  sincronizacao: Sincronizacao[];
  // Documentação e Contrato da Base Oficial
  dicionarioDados: DicionarioDado[];
  contratoApp: ContratoApp[];
  mapeamentoFontes: MapeamentoFonte[];
  auditoriaBase: AuditoriaBase[];

  selectedPeriodoId: string;
  setSelectedPeriodoId: (id: string) => void;

  // Informações da Planilha Oficial
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;

  // Autenticação Google Workspace (para acesso à planilha privada)
  currentUser: User | null;
  /** Perfil verificado no servidor (PROFESSORA_ADMIN ou MONITORA); null enquanto indisponível. */
  perfilServidor: PerfilServidor | null;
  monitoramentoDocumentos: MonitoramentoDocumento[];
  acessoGoogleValidado: boolean;
  isLoggingIn: boolean;
  loginGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;

  // Status de conexão, sincronização e persistência
  hasLocalCache: boolean;
  connectionStatus: ConnectionStatus;
  connectionErrorMessage: string | null;
  saveStatus: SaveStatus;
  saveErrorMessage: string | null;
  saveStatusMessage: string | null;
  isTokenExpired: boolean;
  tokenExpiredAviso: string | null;
  syncStatusState: SyncStatusState;
  sincronizarAgora: () => Promise<void>;
  reconectarESincronizar: () => Promise<void>;
  recarregarDados: () => Promise<void>;

  // Ações de Turmas (Dinâmicas)
  addTurma: (dados: {
    disciplina_id: string;
    nome: string;
    turno: 'MATUTINO' | 'NOTURNO' | 'VESPERTINO' | 'INTEGRAL';
    periodo_id?: string;
    horarios?: NovoHorarioInput[];
    origens?: NovaOrigemInput[];
  }) => Promise<Turma>;
  updateTurma: (
    turmaId: string,
    dados: {
      disciplina_id: string;
      nome: string;
      turno: 'MATUTINO' | 'NOTURNO' | 'VESPERTINO' | 'INTEGRAL';
      status?: 'ATIVO' | 'ENCERRADO' | 'ARQUIVADO';
      horarios?: NovoHorarioInput[];
      origens?: NovaOrigemInput[];
    }
  ) => Promise<void>;
  toggleArchiveTurma: (turmaId: string) => Promise<void>;

  // Ações de Alunos e Orientações
  addOrientacao: (matriculaId: string, categoria: string, texto: string, status?: 'ABERTA' | 'CONCLUÍDA') => Promise<Orientacao>;
  toggleOrientacaoStatus: (orientacaoId: string) => Promise<void>;
  deleteOrientacao: (orientacaoId: string) => Promise<void>;
  
  addFeedback: (matriculaId: string, texto: string) => Promise<void>;
  deleteFeedback: (feedbackId: string) => Promise<void>;
  
  addOcorrencia: (matriculaId: string, tipo: 'ATRASO' | 'USO_INADEQUADO_DISPOSITIVO' | 'OUTRO', observacao: string) => Promise<void>;
  deleteOcorrencia: (ocorrenciaId: string) => Promise<void>;
  
  addPontoAcompanhamento: (matriculaId: string, texto: string, prioridade?: 'ALTA' | 'MEDIA' | 'BAIXA' | '') => Promise<void>;
  togglePontoStatus: (pontoId: string) => Promise<void>;
  deletePontoAcompanhamento: (pontoId: string) => Promise<void>;

  updateRegistroSemanal: (matriculaId: string, semana: number, status: 'ENTREGUE' | 'FALTANTE' | 'PENDENTE_REVISAO', obs?: string) => Promise<void>;
  updateDocumento: (documentoId: string, status: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE', obs?: string) => Promise<void>;
  addDocumento: (matriculaId: string, tipo: string, status?: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE', obs?: string) => Promise<void>;

  addFrequencia: (matriculaId: string, dataAula: string, status: Frequencia['status'], justificativa: string, origemId?: string) => Promise<void>;
  updateFrequenciaStatus: (frequenciaId: string, status: Frequencia['status'], justificativa?: string) => Promise<void>;

  saveAvaliacao: (matriculaId: string, criterioId: string, nota: number, observacao?: string) => Promise<void>;
  
  // Gestão de períodos e turmas
  createNovoPeriodo: (nome: string, dataInicio: string, dataFim: string, copiarTurmasDePeriodoId?: string) => Promise<string>;
  importarAlunosLote: (turmaId: string, novosAlunos: { nome: string; identificador_academico: string }[]) => Promise<{ adicionados: number; duplicados: number }>;

  // Consultas e Regras de Negócio da Base
  isTurmaClinicaAmpliada: (turmaId: string) => boolean;
  getStatusRssUnidade: (turmaId: string, matriculaId?: string, grupoId?: string) => StatusRssUnidade | undefined;
  getSituacaoTurma: (turmaId: string) => {
    situacao: string;
    totalAlunos: number;
    totalPendencias: number;
    materializado?: SituacaoAtualTurma;
  };
  getCriteriosDaTurma: (turmaId: string, instrumento?: string) => CriterioAvaliacao[];
  addRegistroSupervisao: (matriculaId: string, dataHora: string, categoria: string, texto: string, status?: string) => Promise<RegistroSupervisao>;
  addEntrega: (matriculaId: string, tipoDocumento: string, statusEntrega?: string, obs?: string) => Promise<Entrega>;
  /** Marca/desmarca o check de um documento (entregue / não entregue). Cria a linha em `entregas` se não existir. */
  marcarEntrega: (matriculaId: string, tipoDocumento: string, entregue: boolean) => Promise<void>;

  // Consultas
  getResumoAlunoSupervisao: (matriculaId: string) => AlunoResumoSupervisao | null;
  getSituacaoRssEstudante: (matriculaId: string) => SituacaoRssEstudante | null;
  getPendenciasCanonicas: (periodoId?: string) => ItemPendenciaOperacional[];
  marcarPendenciaResolvida: (item: ItemPendenciaOperacional) => Promise<void>;
  getTurmasDoPeriodo: (periodoId?: string, incluirArquivadas?: boolean) => Turma[];
  getAlunosDaTurma: (turmaId: string) => { matricula: Matricula; aluno: Aluno }[];

  // Componentes de Apoio / Fila / Avaliação
  caixaEntrada: CaixaEntradaItem[];
  itensOperacionaisLocaisPendentes: number;
  importarItensOperacionaisLocais: () => Promise<number>;
  addCaixaEntradaItem: (item: any) => Promise<void>;
  confirmarCaixaEntradaItem: (id: string, updates?: any) => Promise<void>;
  descartarCaixaEntradaItem: (id: string) => Promise<void>;

  filaProfessora: ItemFilaProfessora[];
  addItemFilaProfessora: (item: any) => Promise<void>;
  toggleStatusFilaProfessora: (id: string) => Promise<void>;
  deleteItemFilaProfessora: (id: string) => Promise<void>;

  filaSupervisao: ItemFilaSupervisao[];
  addItemFilaSupervisao: (item: any) => Promise<void>;
  updateStatusFilaSupervisao: (id: string, status: any) => Promise<void>;
  removerItemFilaSupervisao: (id: string) => Promise<void>;

  avaliacoesCompletas: AvaliacaoCompleta[];
  salvarAvaliacaoCompleta: (avaliacao: any) => Promise<void>;
  aprovarDevolutiva: (id: string) => Promise<void>;
  registrarEnvioDevolutiva: (id: string, emailDestino?: string) => Promise<void>;
  registrarAuditoria: (acaoOrObj: any, entidade?: string, entidadeId?: string, valorAnterior?: any, valorNovo?: any, motivo?: string) => Promise<void>;
  
  // Gestão de Encontros, Aulas Não Realizadas e Reagendamentos
  encontrosTurma: EncontroTurma[];
  preparacoesAula: PreparacaoAula[];
  /** Linhas brutas das abas aditivas da avaliação; converta com services/estruturaAvaliacao.ts */
  configAvaliacao: Record<string, unknown>[];
  rubricasAvaliacao: Record<string, unknown>[];
  rascunhosAvaliacao: Record<string, unknown>[];
  evidenciasAvaliacao: Record<string, unknown>[];
  /** Correções de associação de RSS e observações pontuais (rss_ajustes) */
  rssAjustes: Record<string, unknown>[];
  /** Insere ou atualiza (por chave) uma linha das abas aditivas da avaliação, com versão, fila e log. */
  salvarLinhaAvaliacao: (tabela: NomeAbaAvaliacao, linha: Record<string, unknown>) => Promise<void>;
  adicionarPreparacaoAula: (dados: Pick<PreparacaoAula, 'turma_id' | 'data_aula' | 'tipo' | 'texto'>) => Promise<void>;
  alterarPreparacaoAula: (id: string, mudancas: Partial<Pick<PreparacaoAula, 'status' | 'data_aula' | 'texto' | 'tipo'>>) => Promise<void>;
  excluirPreparacaoAula: (id: string) => Promise<void>;
  marcarEncontroNaoRealizado: (
    turmaId: string,
    data: string,
    motivo: MotivoNaoRealizado | string,
    observacao?: string
  ) => Promise<void>;
  reagendarEncontro: (
    turmaId: string,
    dataOriginal: string,
    novaData: string,
    novoHorario?: string,
    motivo?: string,
    transferirEstudoDirigido?: boolean
  ) => Promise<void>;
  reverterNaoRealizadoOuReagendado: (turmaId: string, data: string) => Promise<void>;

  // Estudo Dirigido / Leitura (Planejado vs Realizado / Substituição)
  atualizarStatusEstudoDirigido: (
    leituraId: string,
    status: 'PLANEJADO' | 'REALIZADO' | 'PARCIAL' | 'NAO_REALIZADO' | 'SUBSTITUICAO',
    responsaveisEfetivosIds?: string[],
    motivoSubstituicao?: string
  ) => Promise<void>;

  // Chamada por Exceção
  salvarChamadaPorExcecao: (
    turmaId: string,
    dataAula: string,
    excecoes: {
      matriculaId: string;
      status: Frequencia['status'];
      justificativa?: string;
      atraso?: boolean;
      celular?: boolean;
      observacao?: string;
    }[],
    origemIdPadrao?: string
  ) => Promise<{
    salvos: number;
    atualizados: number;
    sincronizadoRemoto: boolean;
    salvoLocal: boolean;
    tokenExpirado: boolean;
    statusTexto: string;
  }>;

  // Docente Online
  getOrigemDoAluno: (matriculaId: string) => TurmaOrigem | undefined;
  setOrigemDoAluno: (matriculaId: string, origemId: string) => Promise<void>;

  // Consultas contextuais do Dashboard / Modo Supervisão / Notificações
  getSupervisaoAtual: () => ResultadoSupervisaoAtual;
  getProximaSupervisao: () => ResultadoProximaSupervisao | null;
  getChamadasPendentes: () => ItemChamadaPendente[];
  getNotificacoesDerivadas: () => NotificacaoDerivada[];
  getPendenciasOperacionais: () => ItemPendenciaOperacional[];

  // Política Global de Exclusão & Desfazer
  confirmacaoExclusaoModal: {
    isOpen: boolean;
    itemNome: string;
    descricaoAfetada?: string;
    onConfirmar: () => void;
  } | null;
  solicitarConfirmacaoExclusao: (config: {
    itemNome: string;
    descricaoAfetada?: string;
    onConfirmar: () => void | Promise<void>;
  }) => void;
  fecharConfirmacaoExclusao: () => void;
  itemExcluidoRecente: {
    id: string;
    tabela: string;
    itemNome: string;
    dado: any;
    timestamp: string;
  } | null;
  desfazerUltimaExclusao: () => Promise<boolean>;
  limparItemDesfazer: () => void;

  // Backup / Export
  exportDatabaseAsJson: () => Promise<string>;
  conferirBackup: (bruto: unknown) => Promise<{ relatorio: RelatorioBackup; diferencas: DiferencaRegistro[] }>;
  restaurarRegistroDoBackup: (d: DiferencaRegistro) => Promise<void>;
}

const SupervisaoContext = createContext<SupervisaoContextType | undefined>(undefined);

function generateUuid(): string {
  return 'id-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

export const SupervisaoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estados das tabelas
  const [periodos, setPeriodos] = useState<Periodo[]>(initialPeriodos);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>(initialDisciplinas);
  const [turmas, setTurmas] = useState<Turma[]>(initialTurmas);
  const [alunos, setAlunos] = useState<Aluno[]>(initialAlunos);
  const [matriculas, setMatriculas] = useState<Matricula[]>(initialMatriculas);
  const [orientacoes, setOrientacoes] = useState<Orientacao[]>(initialOrientacoes);
  const [registrosSemanais, setRegistrosSemanais] = useState<RegistroSemanal[]>(initialRegistrosSemanais);
  const [documentos, setDocumentos] = useState<Documento[]>(initialDocumentos);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>(initialAvaliacoes);
  const [feedbacks, setFeedbacks] = useState<FeedbackAluno[]>(initialFeedbacks);
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>(initialCriteriosAvaliacao);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(initialOcorrencias);
  const [configuracoes, setConfiguracoes] = useState<Configuracao[]>(initialConfiguracoes);
  const [turmasOrigem, setTurmasOrigem] = useState<TurmaOrigem[]>(initialTurmasOrigem);
  const [frequencias, setFrequencias] = useState<Frequencia[]>(initialFrequencias);
  const [horariosTurma, setHorariosTurma] = useState<HorarioTurma[]>(initialHorariosTurma);
  const [pontosAcompanhamento, setPontosAcompanhamento] = useState<PontoAcompanhamento[]>(initialPontosAcompanhamento);
  const [marcosAcademicos, setMarcosAcademicos] = useState<MarcoAcademico[]>(initialMarcosAcademicos);

  // 12 Tabelas Adicionais Normalizadas
  const [regrasRss, setRegrasRss] = useState<RegraRss[]>(initialRegrasRss);
  const [calendarioRss, setCalendarioRss] = useState<CalendarioRss[]>(initialCalendarioRss);
  const [statusRssUnidades, setStatusRssUnidades] = useState<StatusRssUnidade[]>(initialStatusRssUnidades);
  const [situacaoAtualTurmas, setSituacaoAtualTurmas] = useState<SituacaoAtualTurma[]>(initialSituacaoAtualTurmas);
  const [leiturasResponsaveis, setLeiturasResponsaveis] = useState<LeituraResponsavel[]>(initialLeiturasResponsaveis);
  const [regrasPrazo, setRegrasPrazo] = useState<RegraPrazo[]>(initialRegrasPrazo);
  const [gruposPratica, setGruposPratica] = useState<GrupoPratica[]>(initialGruposPratica);
  const [grupoIntegrantes, setGrupoIntegrantes] = useState<GrupoIntegrante[]>(initialGrupoIntegrantes);
  const [entregas, setEntregas] = useState<Entrega[]>(initialEntregas);
  const [feedbacksOficiais, setFeedbacksOficiais] = useState<Feedback[]>(initialFeedbacksOficiais);
  const [registrosSupervisao, setRegistrosSupervisao] = useState<RegistroSupervisao[]>(initialRegistrosSupervisao);
  const [sincronizacao, setSincronizacao] = useState<Sincronizacao[]>(initialSincronizacao);

  // Documentação e Contrato da Base Oficial
  const [dicionarioDados, setDicionarioDados] = useState<DicionarioDado[]>(initialDicionarioDados);
  const [contratoApp, setContratoApp] = useState<ContratoApp[]>(initialContratoApp);
  const [mapeamentoFontes, setMapeamentoFontes] = useState<MapeamentoFonte[]>(initialMapeamentoFontes);
  const [auditoriaBase, setAuditoriaBase] = useState<AuditoriaBase[]>(initialAuditoriaBase);

  // Período selecionado
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>('');

  // Autenticação Google
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [perfilServidor, setPerfilServidor] = useState<PerfilServidor | null>(null);
  const [monitoramentoDocumentos, setMonitoramentoDocumentos] = useState<MonitoramentoDocumento[]>([]);
  useEffect(() => {
    if (!currentUser) { limparCachePerfil(); setPerfilServidor(null); return; }
    let ativo = true;
    void verificarAcessoEscrita(true).then(e => { if (ativo) setPerfilServidor(e.estado === 'AUTORIZADO' ? e.perfil : null); });
    return () => { ativo = false; };
  }, [currentUser?.uid]);
  const [acessoGoogleValidado, setAcessoGoogleValidado] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Status de conexão e gravação
  const [hasLocalCache, setHasLocalCache] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CARREGANDO');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('IDLE');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [isTokenExpired, setIsTokenExpired] = useState<boolean>(false);
  const [tokenExpiredAviso, setTokenExpiredAviso] = useState<string | null>(null);

  // Status global de sincronização e persistência
  const [syncStatusState, setSyncStatusState] = useState<SyncStatusState>({
    status: 'LOCAL',
    ultimaSincronizacao: null,
    ultimaLeituraSucesso: null,
    ultimaEscritaSucesso: null,
    pendentesCount: 0,
    conflitosCount: 0,
    erros: [],
    tabelasStatus: {},
  });

  // Estados de apoio, filas e avaliações completas
  const [caixaEntrada, setCaixaEntrada] = useDurableLocalState<CaixaEntradaItem[]>('cs_caixa_entrada_v1', []);
  const [filaProfessora, setFilaProfessora] = useDurableLocalState<ItemFilaProfessora[]>('cs_fila_professora_v1', []);
  const [filaSupervisao, setFilaSupervisao] = useDurableLocalState<ItemFilaSupervisao[]>('cs_fila_supervisao_v1', []);
  const [avaliacoesCompletas, setAvaliacoesCompletas] = useDurableLocalState<AvaliacaoCompleta[]>('cs_avaliacoes_completas_v1', []);

  // Política Global de Exclusão & Desfazer
  const [confirmacaoExclusaoModal, setConfirmacaoExclusaoModal] = useState<{
    isOpen: boolean;
    itemNome: string;
    descricaoAfetada?: string;
    onConfirmar: () => void;
  } | null>(null);

  const [itemExcluidoRecente, setItemExcluidoRecente] = useState<{
    id: string;
    tabela: string;
    itemNome: string;
    dado: any;
    timestamp: string;
  } | null>(null);

  const solicitarConfirmacaoExclusao = useCallback((config: {
    itemNome: string;
    descricaoAfetada?: string;
    onConfirmar: () => void | Promise<void>;
  }) => {
    setConfirmacaoExclusaoModal({
      isOpen: true,
      itemNome: config.itemNome,
      descricaoAfetada: config.descricaoAfetada,
      onConfirmar: async () => {
        setConfirmacaoExclusaoModal(null);
        await config.onConfirmar();
      },
    });
  }, []);

  const fecharConfirmacaoExclusao = useCallback(() => {
    setConfirmacaoExclusaoModal(null);
  }, []);

  const limparItemDesfazer = useCallback(() => {
    setItemExcluidoRecente(null);
  }, []);

  const desfazerUltimaExclusao = useCallback(async (): Promise<boolean> => {
    if (!itemExcluidoRecente) return false;
    const { tabela, dado } = itemExcluidoRecente;
    setSaveStatus('SALVANDO');

    try {
      if (tabela === 'orientacoes') {
        setOrientacoes(prev => [dado, ...prev]);
        
      } else if (tabela === 'ocorrencias') {
        setOcorrencias(prev => [dado, ...prev]);
        
      } else if (tabela === 'feedbacks') {
        setFeedbacks(prev => [dado, ...prev]);
        
      } else if (tabela === 'pontos_acompanhamento') {
        setPontosAcompanhamento(prev => [dado, ...prev]);
        
      } else if (tabela === 'documentos') {
        setDocumentos(prev => [dado, ...prev]);
      } else if (tabela === 'registros_semanais') {
        setRegistrosSemanais(prev => [dado, ...prev]);
      }
      setItemExcluidoRecente(null);
      notifySaveSuccess();
      return true;
    } catch (err) {
      handleSaveError(err);
      return false;
    }
  }, [itemExcluidoRecente]);

  // Gestão Operacional de Encontros (Feriados, Cancelamentos e Reagendamentos)
  const [preparacoesAula, setPreparacoesAula] = useState<PreparacaoAula[]>([]);
  const [configAvaliacao, setConfigAvaliacao] = useState<Record<string, unknown>[]>([]);
  const [rubricasAvaliacao, setRubricasAvaliacao] = useState<Record<string, unknown>[]>([]);
  const [rascunhosAvaliacao, setRascunhosAvaliacao] = useState<Record<string, unknown>[]>([]);
  const [evidenciasAvaliacao, setEvidenciasAvaliacao] = useState<Record<string, unknown>[]>([]);
  const [rssAjustes, setRssAjustes] = useState<Record<string, unknown>[]>([]);
  const [encontrosTurma, setEncontrosTurma] = useState<EncontroTurma[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('cs_encontros_turma_v2');
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cs_encontros_turma_v2', JSON.stringify(encontrosTurma));
      }
    } catch (e) {
      // ignore
    }
  }, [encontrosTurma]);
  const [auditoriaApp, setAuditoriaApp] = useState<HistoricoAuditoria[]>([]);

  // Helper para aplicar dados recebidos das 30 tabelas normalizadas
  // NUNCA substitui dados válidos por arrays vazios caso uma tabela falhe ou venha incompleta
  const aplicarDados = useCallback((data: DadosIniciais) => {
    if (data.periodos && data.periodos.length > 0) {
      setPeriodos(data.periodos);
      setSelectedPeriodoId(prev => {
        if (prev && data.periodos.some((p: Periodo) => p.periodo_id === prev)) return prev;
        const periodoAtivo = data.periodos.find((p: Periodo) => p.status === 'ATIVO') || data.periodos[0];
        return periodoAtivo ? periodoAtivo.periodo_id : '';
      });
    }
    if (Array.isArray(data.disciplinas)) setDisciplinas(data.disciplinas);
    if (Array.isArray(data.turmas)) setTurmas(data.turmas);
    if (Array.isArray(data.horarios)) setHorariosTurma(data.horarios);
    if (Array.isArray(data.turmasOrigem)) setTurmasOrigem(data.turmasOrigem);
    if (Array.isArray(data.alunos)) setAlunos(data.alunos);
    if (Array.isArray(data.matriculas)) setMatriculas(data.matriculas);
    if (Array.isArray(data.orientacoes)) setOrientacoes(data.orientacoes);
    if (Array.isArray(data.criterios)) setCriterios(data.criterios);
    if (Array.isArray(data.configuracoes)) {
      setConfiguracoes(data.configuracoes);
      setCaixaEntrada(prev => combinarOperacionais(prev, data.configuracoes, 'CAIXA_ENTRADA'));
      setFilaProfessora(prev => combinarOperacionais(prev, data.configuracoes, 'FILA_PROFESSORA'));
      setFilaSupervisao(prev => combinarOperacionais(prev, data.configuracoes, 'FILA_SUPERVISAO'));
    }
    if (Array.isArray(data.marcos)) setMarcosAcademicos(data.marcos);
    if (Array.isArray(data.pontosAcompanhamento)) setPontosAcompanhamento(data.pontosAcompanhamento);
    if (Array.isArray(data.frequencias)) setFrequencias(data.frequencias);
    if (Array.isArray(data.documentos)) setDocumentos(data.documentos);
    if (Array.isArray(data.registrosSemanais)) setRegistrosSemanais(data.registrosSemanais);
    if (Array.isArray(data.avaliacoes)) setAvaliacoes(data.avaliacoes);
    if (Array.isArray(data.feedbacks)) setFeedbacks(data.feedbacks);
    if (Array.isArray(data.ocorrencias)) setOcorrencias(data.ocorrencias);
    // 12 Tabelas Adicionais
    if (Array.isArray(data.regrasRss)) setRegrasRss(data.regrasRss);
    if (Array.isArray(data.calendarioRss)) setCalendarioRss(data.calendarioRss);
    if (Array.isArray(data.statusRssUnidades)) setStatusRssUnidades(data.statusRssUnidades);
    if (Array.isArray(data.situacaoAtualTurmas)) setSituacaoAtualTurmas(data.situacaoAtualTurmas);
    if (Array.isArray(data.leiturasResponsaveis)) setLeiturasResponsaveis(data.leiturasResponsaveis);
    if (Array.isArray(data.regrasPrazo)) setRegrasPrazo(data.regrasPrazo);
    if (Array.isArray(data.gruposPratica)) setGruposPratica(data.gruposPratica);
    if (Array.isArray(data.grupoIntegrantes)) setGrupoIntegrantes(data.grupoIntegrantes);
    if (Array.isArray(data.entregas)) setEntregas(data.entregas);
    if (Array.isArray(data.feedbacksOficiais)) setFeedbacksOficiais(data.feedbacksOficiais);
    if (Array.isArray(data.registrosSupervisao)) setRegistrosSupervisao(data.registrosSupervisao);
    if (Array.isArray(data.encontrosTurma)) setEncontrosTurma(data.encontrosTurma);
    if (Array.isArray(data.preparacoesAula)) setPreparacoesAula(data.preparacoesAula);
    if (Array.isArray(data.configAvaliacao)) setConfigAvaliacao(data.configAvaliacao);
    if (Array.isArray(data.rubricasAvaliacao)) setRubricasAvaliacao(data.rubricasAvaliacao);
    if (Array.isArray(data.rascunhosAvaliacao)) setRascunhosAvaliacao(data.rascunhosAvaliacao);
    if (Array.isArray(data.evidenciasAvaliacao)) setEvidenciasAvaliacao(data.evidenciasAvaliacao);
    if (Array.isArray(data.rssAjustes)) setRssAjustes(data.rssAjustes);
    if (Array.isArray(data.monitoramentoDocumentos)) setMonitoramentoDocumentos(data.monitoramentoDocumentos);
    if (Array.isArray(data.avaliacoesCompletas)) setAvaliacoesCompletas(data.avaliacoesCompletas);
    if (Array.isArray(data.sincronizacao)) setSincronizacao(data.sincronizacao);
    if (Array.isArray(data.dicionarioDados)) setDicionarioDados(data.dicionarioDados);
    if (Array.isArray(data.contratoApp)) setContratoApp(data.contratoApp);
    if (Array.isArray(data.mapeamentoFontes)) setMapeamentoFontes(data.mapeamentoFontes);
    if (Array.isArray(data.auditoriaBase)) setAuditoriaBase(data.auditoriaBase);
  }, []);

  // 1. ABERTURA DO APP: Carrega imediatamente o cache do IndexedDB
  useEffect(() => {
    let isMounted = true;
    inicializarCacheLocal().then(({ dados }) => {
      if (!isMounted) return;
      if (dados && dados.periodos && dados.periodos.length > 0) {
        aplicarDados(dados);
        setHasLocalCache(true);
        setConnectionStatus('CONECTADO');
      } else {
        setHasLocalCache(false);
        setConnectionStatus('LOCAL_DEV');
      }
    });

    const unsubSync = subscribeSyncStatus(state => {
      if (isMounted) setSyncStatusState(state);
    });

    return () => {
      isMounted = false;
      unsubSync();
    };
  }, [aplicarDados]);

  // 2. OBSERVADOR DE AUTENTICAÇÃO GOOGLE: Sincroniza silenciosamente se o token estiver válido
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = initAuth(
      (user, _token) => {
        if (!isMounted) return;
        setCurrentUser(user);
        // Sessão do app é independente do token OAuth do Sheets (que expira antes).
        // Só exibe cache em até 6h se esta conta já foi validada neste dispositivo.
        if (lerSessaoAutorizada(user.uid)) {
          setAcessoGoogleValidado(true);
        }
        // Cache local é do navegador: na troca de conta, apaga a cópia das tabelas (se não houver pendências de outra conta).
        garantirCacheDoUsuario(user.uid)
          .then(estado => {
            if (estado === 'PENDENTES_DE_OUTRA_CONTA') {
              setConnectionErrorMessage('Há alterações pendentes de outra conta neste aparelho. Entre com a conta original para enviá-las antes de trocar de usuária.');
              return Promise.reject(new Error('PENDENTES_DE_OUTRA_CONTA'));
            }
            if (estado === 'LIMPO') { setHasLocalCache(false); }
          })
          .then(() => processarFilaSincronizacao())
          .catch(e => { if (e instanceof Error && e.message === 'PENDENTES_DE_OUTRA_CONTA') throw e; })
          .then(() => sincronizarDaBaseOficial())
          .then(res => {
            if (!isMounted) return;
            if (res.sucesso && res.dados) {
              registrarSessaoAutorizada(user.uid);
              setAcessoGoogleValidado(true);
              aplicarDados(res.dados);
              setHasLocalCache(true);
              setConnectionStatus('CONECTADO');
            }
          })
          .catch(() => { /* pendências de outra conta já sinalizadas; falhas de rede seguem o fluxo de reconexão */ });
      },
      () => {
        if (!isMounted) return;
        setAcessoGoogleValidado(false);
        setCurrentUser(null);
      }
    );
    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [aplicarDados]);

  // 3. SINCRONIZAÇÃO AUTOMÁTICA EM SEGUNDO PLANO (FOCO, REDE ONLINE E INTERVALO)
  useEffect(() => {
    let isMounted = true;

    const autoSyncSePossivel = async () => {
      if (!isMounted) return;
      const token = await getAccessToken();
      if (token && document.visibilityState === 'visible') {
        try {
          await processarFilaSincronizacao();
          const res = await sincronizarDaBaseOficial();
          if (!isMounted) return;
          if (res.sucesso && res.dados) {
            if (currentUser) registrarSessaoAutorizada(currentUser.uid);
            setAcessoGoogleValidado(true);
            aplicarDados(res.dados);
            setHasLocalCache(true);
            setConnectionStatus('CONECTADO');
          }
        } catch (e) {
          console.warn('Auto-sync em segundo plano:', e);
        }
      }
    };

    window.addEventListener('focus', autoSyncSePossivel);
    window.addEventListener('online', autoSyncSePossivel);

    const intervalId = setInterval(autoSyncSePossivel, 5 * 60 * 1000); // 5 min; evita excesso de consultas

    return () => {
      isMounted = false;
      window.removeEventListener('focus', autoSyncSePossivel);
      window.removeEventListener('online', autoSyncSePossivel);
      clearInterval(intervalId);
    };
  }, [aplicarDados]);

  // 4. SINCRONIZAÇÃO DA BASE OFICIAL COM RENOVAÇÃO INTERATIVA SE NECESSÁRIO
  const sincronizarAgora = useCallback(async () => {
    setConnectionStatus('CARREGANDO');
    setConnectionErrorMessage(null);

    // Ambiente web: acesso Google com renovação interativa quando o token expira.
    let token = await getAccessToken();
    if (!token) {
      // Se não há token ativo (expirou ou sessão nova), abre o popup de login do Google!
      setIsLoggingIn(true);
      try {
        const resLogin = await googleSignIn();
        if (resLogin) {
          setCurrentUser(resLogin.user);
          setIsTokenExpired(false);
          setTokenExpiredAviso(null);
          token = resLogin.accessToken;
        }
      } catch (e: any) {
        console.error('Falha ao autenticar:', e);
        setConnectionErrorMessage('Autenticação necessária para sincronizar com Google Sheets.');
        setConnectionStatus('ERRO_CONEXAO'); // cache disponível não equivale a conexão
        return;
      } finally {
        setIsLoggingIn(false);
      }
    }

    // 1. PRIMEIRO: Processa e envia alterações pendentes na fila local (syncQueue) para o Google Sheets!
    try {
      await processarFilaSincronizacao();
    } catch (e) {
      console.warn('Erro ao processar fila antes de ler:', e);
    }

    // 2. SEGUNDO: Lê a base oficial atualizada com as novas alterações gravadas!
    const res = await sincronizarDaBaseOficial();
    if (res.sucesso && res.dados) {
      if (currentUser) registrarSessaoAutorizada(currentUser.uid);
      setAcessoGoogleValidado(true);
      aplicarDados(res.dados);
      setHasLocalCache(true);
      setConnectionStatus('CONECTADO');
      setIsTokenExpired(false);
      setTokenExpiredAviso(null);
    } else {
      setConnectionErrorMessage(res.erro || 'Falha ao sincronizar com Google Sheets');
      setConnectionStatus('ERRO_CONEXAO'); // mantém cache, mas informa falha real
    }
  }, [aplicarDados, hasLocalCache]);

  const carregarDadosReais = sincronizarAgora;

  const loginGoogle = async () => {
    setIsLoggingIn(true);
    setConnectionErrorMessage(null);
    try {
      // Uma única janela de autenticação. Nunca chamar sincronizarAgora aqui:
      // ela poderia abrir outro popup e iniciar uma segunda tentativa concorrente.
      const res = await googleSignIn();
      if (!res) throw new Error('A autenticação não foi concluída.');
      setCurrentUser(res.user);
      setConnectionStatus('CARREGANDO');
      const resultado = await Promise.race([
        sincronizarDaBaseOficial(),
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error('A conexão com a planilha excedeu 30 segundos. Verifique a conexão e tente novamente.')),
          30000
        )),
      ]);
      if (!resultado.sucesso || !resultado.dados) {
        throw new Error(resultado.erro || 'Não foi possível validar o acesso à planilha oficial.');
      }
      registrarSessaoAutorizada(res.user.uid);
      setAcessoGoogleValidado(true);
      aplicarDados(resultado.dados);
      setHasLocalCache(true);
      setConnectionStatus('CONECTADO');
      // Alterações locais pendentes são mantidas; sincronização independente
      // evita bloquear o acesso e nunca é tratada como sucesso implícito.
      void processarFilaSincronizacao().catch(error => {
        console.warn('Fila local pendente após autenticação:', error);
      });
    } catch (err: any) {
      console.error('Erro de login Google:', err);
      setConnectionErrorMessage(err?.message || 'Falha ao autenticar com Google.');
      setConnectionStatus('ERRO_CONEXAO');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logoutGoogle = async () => {
    await googleLogout();
    encerrarSessaoAutorizada();
    setAcessoGoogleValidado(false);
    setCurrentUser(null);
    setConnectionStatus('LOCAL_DEV');
  };

  const notifySaveSuccess = (remoto: boolean = false) => {
    if (remoto) {
      setSaveStatus('SINCRONIZADO_SHEETS');
      setSaveStatusMessage('✓ Sincronizado no Google Sheets');
    } else {
      setSaveStatus('SALVO_LOCAL_AGUARDANDO_SYNC');
      setSaveStatusMessage('● Salvo neste dispositivo — aguardando sincronização');
    }
    setTimeout(() => {
      setSaveStatus('IDLE');
      setSaveStatusMessage(null);
    }, 3500);
  };

  const handleSaveError = (err: any) => {
    console.error('Erro de persistência:', err);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cs:save-error'));
    setSaveStatus('ERRO_SINCRONIZACAO');
    setSaveErrorMessage(err?.message || 'Erro ao sincronizar com Google Sheets');
    setSaveStatusMessage('⚠ Erro de sincronização');
  };

  // Persistência: só confirma sincronização remota após resposta do Google Sheets.
  // Mantém o estado local atualizado no IndexedDB para uso offline.
  const persistirMudancaWeb = async (
    tabela: string,
    tipo: 'INSERT' | 'UPDATE' | 'DELETE',
    registro: Record<string, any>,
    listaAtualizada: any[]
  ): Promise<void> => {
    
    try {
      const resultado = await salvarRegistroResiliente(tabela, tipo, registro, listaAtualizada);
      notifySaveSuccess(resultado.gravadoOnline);
    } catch (erro) {
      handleSaveError(erro);
      throw erro;
    }
  };

  // Preparação de aula é registrada uma única vez na planilha oficial, por turma.
  // A interface mostra itens pendentes nas próximas aulas sem duplicar linhas.
  const adicionarPreparacaoAula = async (
    dados: Pick<PreparacaoAula, 'turma_id' | 'data_aula' | 'tipo' | 'texto'>
  ): Promise<void> => {
    const texto = dados.texto.trim();
    if (!texto || texto.length > 4000 || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data_aula) ||
        !turmas.some(t => t.turma_id === dados.turma_id)) {
      throw new Error('Confira turma, data e observação (até 4.000 caracteres).');
    }
    const agora = new Date().toISOString();
    const registro: PreparacaoAula = {
      preparacao_id: gerarIdEstavel('prep'),
      turma_id: dados.turma_id,
      periodo_id: selectedPeriodoId,
      data_aula: dados.data_aula,
      tipo: dados.tipo,
      texto,
      status: 'PENDENTE',
      criado_em: agora,
      atualizado_em: agora,
    };
    const lista = [...preparacoesAula, registro];
    await persistirMudancaWeb('preparacoes_aula', 'INSERT', registro, lista);
    setPreparacoesAula(lista);
  };

  const alterarPreparacaoAula = async (
    id: string,
    mudancas: Partial<Pick<PreparacaoAula, 'status' | 'data_aula' | 'texto' | 'tipo'>>
  ): Promise<void> => {
    const anterior = preparacoesAula.find(p => p.preparacao_id === id);
    if (!anterior) throw new Error('Preparação de aula não encontrada.');
    if (mudancas.texto !== undefined && (!mudancas.texto.trim() || mudancas.texto.length > 4000)) {
      throw new Error('A observação deve ter entre 1 e 4.000 caracteres.');
    }
    const registro = { ...anterior, ...mudancas, atualizado_em: new Date().toISOString() };
    const lista = preparacoesAula.map(p => p.preparacao_id === id ? registro : p);
    await persistirMudancaWeb('preparacoes_aula', 'UPDATE', registro, lista);
    setPreparacoesAula(lista);
  };

  const excluirPreparacaoAula = async (id: string): Promise<void> => {
    const registro = preparacoesAula.find(p => p.preparacao_id === id);
    if (!registro) return;
    const lista = preparacoesAula.filter(p => p.preparacao_id !== id);
    await persistirMudancaWeb('preparacoes_aula', 'DELETE', registro, lista);
    setPreparacoesAula(lista);
  };

  const salvarLinhaAvaliacao = async (tabela: NomeAbaAvaliacao, linha: Record<string, unknown>): Promise<void> => {
    const chave = ABAS_AVALIACAO[tabela].pk;
    const id = String(linha[chave] ?? '').trim();
    if (!id) throw new Error('Registro sem identificador.');
    const atuais: Record<string, unknown>[] = tabela === 'config_avaliacao' ? configAvaliacao
      : tabela === 'rubricas_avaliacao' ? rubricasAvaliacao
      : tabela === 'avaliacao_rascunhos' ? rascunhosAvaliacao : tabela === 'rss_ajustes' ? rssAjustes : evidenciasAvaliacao;
    const existe = atuais.some(r => String(r[chave] ?? '').trim() === id);
    const lista = existe ? atuais.map(r => String(r[chave] ?? '').trim() === id ? linha : r) : [...atuais, linha];
    await persistirMudancaWeb(tabela, existe ? 'UPDATE' : 'INSERT', linha, lista);
    if (tabela === 'config_avaliacao') setConfigAvaliacao(lista);
    else if (tabela === 'rubricas_avaliacao') setRubricasAvaliacao(lista);
    else if (tabela === 'avaliacao_rascunhos') setRascunhosAvaliacao(lista);
    else if (tabela === 'rss_ajustes') setRssAjustes(lista);
    else setEvidenciasAvaliacao(lista);
  };

  const reconectarESincronizar = async (): Promise<void> => {
    try {
      setSaveStatus('SALVANDO');
      setSaveStatusMessage('Reconectando ao Google Workspace...');
      await loginGoogle();
      if (!await getAccessToken()) throw new Error('Autenticação do Google Sheets não confirmada.');
      setIsTokenExpired(false);
      setTokenExpiredAviso(null);
      setSaveStatusMessage('Reenviando alterações da fila segura...');
      const resFila = await processarFilaSincronizacao();
      const filaRestante = await carregarFilaSincronizacao();
      const pendentes = filaRestante; // fila contém apenas alterações ainda não confirmadas
      if (resFila.erros === 0 && pendentes.length === 0) {
        setSaveStatus('SINCRONIZADO_SHEETS');
        setSaveStatusMessage('✓ Sincronizado no Google Sheets');
        setTimeout(() => {
          setSaveStatus('IDLE');
          setSaveStatusMessage(null);
        }, 3500);
      } else {
        setSaveStatus('SALVO_LOCAL_AGUARDANDO_SYNC');
        setSaveStatusMessage('● Salvo neste dispositivo — aguardando sincronização');
      }
    } catch (err: any) {
      console.error('Erro ao reconectar e sincronizar:', err);
      setSaveStatus('ERRO_SINCRONIZACAO');
      setSaveStatusMessage('⚠ Erro de sincronização');
    }
  };

  // ==========================================
  // GESTÃO DINÂMICA DE TURMAS
  // ==========================================

  const addTurma = async (dados: {
    disciplina_id: string;
    nome: string;
    turno: 'MATUTINO' | 'NOTURNO' | 'VESPERTINO' | 'INTEGRAL';
    periodo_id?: string;
    horarios?: NovoHorarioInput[];
    origens?: NovaOrigemInput[];
  }): Promise<Turma> => {
    setSaveStatus('SALVANDO');
    const pId = dados.periodo_id || selectedPeriodoId;
    const turmaId = generateUuid();
    const novaTurma: Turma = {
      turma_id: turmaId,
      periodo_id: pId,
      disciplina_id: dados.disciplina_id,
      nome: dados.nome,
      turno: dados.turno,
      status: 'ATIVO',
    };

    const novosHorarios: HorarioTurma[] = (dados.horarios || []).map(h => ({
      horario_id: generateUuid(),
      turma_id: turmaId,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      data_inicio: '2026-08-01',
      data_fim: '2026-12-20',
      ativo: true,
    }));

    const novasOrigens: TurmaOrigem[] = (dados.origens || []).map(o => ({
      origem_id: generateUuid(),
      turma_id: turmaId,
      sistema: o.sistema || 'Docente Online',
      codigo_externo: o.codigo_externo,
      nome_externo: o.nome_externo || dados.nome,
      ativo: true,
    }));

    {
      // Não anunciar sucesso antes de a escrita ser entregue ao Sheets ou à fila segura.
      // Sub-registros possuem chaves próprias e precisam ser gravados separadamente.
      await persistirMudancaWeb('turmas', 'INSERT', novaTurma, [...turmas, novaTurma]);
      let horariosSnapshot = [...horariosTurma];
      for (const horario of novosHorarios) {
        horariosSnapshot = [...horariosSnapshot, horario];
        await persistirMudancaWeb('horarios_turma', 'INSERT', horario, horariosSnapshot);
      }
      let origensSnapshot = [...turmasOrigem];
      for (const origem of novasOrigens) {
        origensSnapshot = [...origensSnapshot, origem];
        await persistirMudancaWeb('turmas_origem', 'INSERT', origem, origensSnapshot);
      }
      setTurmas(prev => [...prev, novaTurma]);
      if (novosHorarios.length > 0) setHorariosTurma(prev => [...prev, ...novosHorarios]);
      if (novasOrigens.length > 0) setTurmasOrigem(prev => [...prev, ...novasOrigens]);
      return novaTurma;
    }
  };

  const updateTurma = async (
    turmaId: string,
    dados: {
      disciplina_id: string;
      nome: string;
      turno: 'MATUTINO' | 'NOTURNO' | 'VESPERTINO' | 'INTEGRAL';
      status?: 'ATIVO' | 'ENCERRADO' | 'ARQUIVADO';
      horarios?: NovoHorarioInput[];
      origens?: NovaOrigemInput[];
    }
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const anterior = turmas.find(t => t.turma_id === turmaId);
    if (!anterior) throw new Error('Turma não encontrada.');
    const statusTurma = dados.status || anterior.status || 'ATIVO';
    const turmaAtualizada = {
      ...anterior, disciplina_id: dados.disciplina_id,
      nome: dados.nome, turno: dados.turno, status: statusTurma,
    };

    

    await persistirMudancaWeb('turmas', 'UPDATE', turmaAtualizada,
      turmas.map(t => t.turma_id === turmaId ? turmaAtualizada : t));
    setTurmas(prev =>
      prev.map(t =>
        t.turma_id === turmaId
          ? {
              ...t,
              disciplina_id: dados.disciplina_id,
              nome: dados.nome,
              turno: dados.turno,
              status: statusTurma,
            }
          : t
      )
    );

    if (dados.horarios) {
      const novosHorarios: HorarioTurma[] = dados.horarios.map(h => ({
        horario_id: generateUuid(),
        turma_id: turmaId,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
        data_inicio: '2026-08-01',
        data_fim: '2026-12-20',
        ativo: true,
      }));
      const anteriores = horariosTurma.filter(h => h.turma_id === turmaId);
      const proximaLista = [...horariosTurma.filter(h => h.turma_id !== turmaId), ...novosHorarios];
      // Gravar primeiro os substitutos: se a conexão falhar, os horários antigos
      // continuam disponíveis na planilha oficial.
      for (const h of novosHorarios) await persistirMudancaWeb('horarios_turma', 'INSERT', h, [...horariosTurma, ...novosHorarios]);
      for (const h of anteriores) await persistirMudancaWeb('horarios_turma', 'DELETE', h, proximaLista);
      setHorariosTurma(prev => [...prev.filter(h => h.turma_id !== turmaId), ...novosHorarios]);
    }

    if (dados.origens) {
      const novasOrigens: TurmaOrigem[] = dados.origens.map(o => ({
        origem_id: generateUuid(),
        turma_id: turmaId,
        sistema: o.sistema || 'Docente Online',
        codigo_externo: o.codigo_externo,
        nome_externo: o.nome_externo || dados.nome,
        ativo: true,
      }));
      const anteriores = turmasOrigem.filter(o => o.turma_id === turmaId);
      const proximaLista = [...turmasOrigem.filter(o => o.turma_id !== turmaId), ...novasOrigens];
      // Preservar origens existentes até confirmar as novas.
      for (const o of novasOrigens) await persistirMudancaWeb('turmas_origem', 'INSERT', o, [...turmasOrigem, ...novasOrigens]);
      for (const o of anteriores) await persistirMudancaWeb('turmas_origem', 'DELETE', o, proximaLista);
      setTurmasOrigem(prev => [...prev.filter(o => o.turma_id !== turmaId), ...novasOrigens]);
    }

    
  };

  const toggleArchiveTurma = async (turmaId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const turma = turmas.find(t => t.turma_id === turmaId);
    if (!turma) return;
    const novoStatus = turma.status === 'ARQUIVADO' ? 'ATIVO' : 'ARQUIVADO';

    

    const atualizado = { ...turma, status: novoStatus };
    await persistirMudancaWeb('turmas', 'UPDATE', atualizado,
      turmas.map(t => t.turma_id === turmaId ? atualizado : t));
    setTurmas(prev =>
      prev.map(t => (t.turma_id === turmaId ? { ...t, status: novoStatus } : t))
    );
    
  };

  // ==========================================
  // ORIENTAÇÕES
  // ==========================================

  const addOrientacao = async (
    matriculaId: string,
    categoria: string,
    texto: string,
    status: 'ABERTA' | 'CONCLUÍDA' = 'ABERTA'
  ): Promise<Orientacao> => {
    setSaveStatus('SALVANDO');
    setSaveErrorMessage(null);
    const now = new Date().toISOString();

    {
      const newOri: Orientacao = {
        orientacao_id: generateUuid(),
        matricula_id: matriculaId,
        data_hora: now,
        categoria,
        texto,
        status,
        criado_em: now,
        atualizado_em: now,
      };
      setOrientacoes(prev => [newOri, ...prev]);

      try {
        const res = await salvarRegistroResiliente('orientacoes', 'INSERT', newOri);
        if (res.gravadoOnline) {
          notifySaveSuccess(true);
        } else {
          notifySaveSuccess(false);
        }
      } catch (err: any) {
        console.warn('Erro ao persistir orientação de forma resiliente:', err);
        notifySaveSuccess(false);
      }
      return newOri;
    }
  };

  const toggleOrientacaoStatus = async (orientacaoId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();
    const ori = orientacoes.find(o => o.orientacao_id === orientacaoId);
    if (!ori) return;
    const novoStatus: 'ABERTA' | 'CONCLUÍDA' = ori.status === 'ABERTA' ? 'CONCLUÍDA' : 'ABERTA';

    

    const oriAtualizada = { ...ori, status: novoStatus, atualizado_em: now };
    setOrientacoes(prev =>
      prev.map(o =>
        o.orientacao_id === orientacaoId ? oriAtualizada : o
      )
    );

    try {
      const res = await salvarRegistroResiliente('orientacoes', 'INSERT', oriAtualizada);
      if (res.gravadoOnline) {
        notifySaveSuccess(true);
      } else {
        notifySaveSuccess(false);
      }
    } catch (err: any) {
      console.warn('Erro ao persistir atualização de orientação:', err);
      notifySaveSuccess(false);
    }
  };

  const deleteOrientacao = async (orientacaoId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const anterior = orientacoes.find(o => o.orientacao_id === orientacaoId);
    
    setOrientacoes(prev => prev.filter(ori => ori.orientacao_id !== orientacaoId));
    if (anterior) await persistirMudancaWeb('orientacoes', 'DELETE', anterior, orientacoes.filter(o => o.orientacao_id !== orientacaoId));
  };

  // ==========================================
  // FEEDBACKS
  // ==========================================

  const addFeedback = async (matriculaId: string, texto: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();

    

    const newFeedback: FeedbackAluno = {
      feedback_id: generateUuid(),
      matricula_id: matriculaId,
      data_hora: now,
      texto,
    };
    setFeedbacks(prev => [newFeedback, ...prev]);
    await persistirMudancaWeb('feedback_alunos', 'INSERT', newFeedback, [newFeedback, ...feedbacks]);
  };

  const deleteFeedback = async (feedbackId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const anterior = feedbacks.find(f => f.feedback_id === feedbackId);
    
    setFeedbacks(prev => prev.filter(fb => fb.feedback_id !== feedbackId));
    if (anterior) await persistirMudancaWeb('feedback_alunos', 'DELETE', anterior, feedbacks.filter(f => f.feedback_id !== feedbackId));
  };

  // ==========================================
  // OCORRÊNCIAS
  // ==========================================

  const addOcorrencia = async (
    matriculaId: string,
    tipo: 'ATRASO' | 'USO_INADEQUADO_DISPOSITIVO' | 'OUTRO',
    observacao: string
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();

    

    const newOcorrencia: Ocorrencia = {
      ocorrencia_id: generateUuid(),
      matricula_id: matriculaId,
      data_hora: now,
      tipo,
      observacao,
    };
    setOcorrencias(prev => [newOcorrencia, ...prev]);
    await persistirMudancaWeb('ocorrencias', 'INSERT', newOcorrencia, [newOcorrencia, ...ocorrencias]);
  };

  const deleteOcorrencia = async (ocorrenciaId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const anterior = ocorrencias.find(o => o.ocorrencia_id === ocorrenciaId);
    
    setOcorrencias(prev => prev.filter(oc => oc.ocorrencia_id !== ocorrenciaId));
    if (anterior) await persistirMudancaWeb('ocorrencias', 'DELETE', anterior, ocorrencias.filter(o => o.ocorrencia_id !== ocorrenciaId));
  };

  // ==========================================
  // PONTOS DE ACOMPANHAMENTO
  // ==========================================

  const addPontoAcompanhamento = async (
    matriculaId: string,
    texto: string,
    prioridade: 'ALTA' | 'MEDIA' | 'BAIXA' | '' = 'ALTA'
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const today = getHojeDataIso();

    

    const newPonto: PontoAcompanhamento = {
      ponto_id: generateUuid(),
      matricula_id: matriculaId,
      texto,
      status: 'ATIVO',
      prioridade,
      data_criacao: today,
      atualizado_em: today,
    };
    setPontosAcompanhamento(prev => [newPonto, ...prev]);
    await persistirMudancaWeb('pontos_acompanhamento', 'INSERT', newPonto, [newPonto, ...pontosAcompanhamento]);
  };

  const togglePontoStatus = async (pontoId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const today = getHojeDataIso();
    const ponto = pontosAcompanhamento.find(p => p.ponto_id === pontoId);
    const novoStatus = ponto?.status === 'ATIVO' ? 'CONCLUIDO' : 'ATIVO';
    const dataConclusao = novoStatus === 'CONCLUIDO' ? today : undefined;
    if (!ponto) return;

    

    setPontosAcompanhamento(prev =>
      prev.map(p =>
        p.ponto_id === pontoId
          ? {
              ...p,
              status: novoStatus,
              atualizado_em: today,
              data_conclusao: dataConclusao,
            }
          : p
      )
    );
    const atualizado = { ...ponto, status: novoStatus, atualizado_em: today, data_conclusao: dataConclusao };
    await persistirMudancaWeb('pontos_acompanhamento', 'UPDATE', atualizado, pontosAcompanhamento.map(p => p.ponto_id === pontoId ? atualizado : p));
  };

  const deletePontoAcompanhamento = async (pontoId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const anterior = pontosAcompanhamento.find(p => p.ponto_id === pontoId);
    
    setPontosAcompanhamento(prev => prev.filter(p => p.ponto_id !== pontoId));
    if (anterior) await persistirMudancaWeb('pontos_acompanhamento', 'DELETE', anterior, pontosAcompanhamento.filter(p => p.ponto_id !== pontoId));
  };

  // ==========================================
  // REGISTROS SEMANAIS & DOCUMENTOS
  // ==========================================

  // RSS originais são respostas importadas: não permitir alterar o histórico
  // por uma ação que modificava apenas o React, sem gravar no Sheets.
  const updateRegistroSemanal = async (
    _matriculaId: string,
    _semana: number,
    _status: 'ENTREGUE' | 'FALTANTE' | 'PENDENTE_REVISAO',
    _obs: string = ''
  ): Promise<void> => {
    throw new Error('RSS da planilha oficial são somente leitura. Registre sua orientação na ficha; não é possível alterar uma entrega sem trilha de auditoria.');
  };

  const updateDocumento = async (
    documentoId: string,
    status: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE',
    obs?: string
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const anterior = documentos.find(d => d.documento_id === documentoId);
    const today = getHojeDataIso();

    

    setDocumentos(prev =>
      prev.map(d =>
        d.documento_id === documentoId
          ? {
              ...d,
              status,
              data_entrega: status === 'ENTREGUE' ? today : d.data_entrega,
              observacao: obs !== undefined ? obs : d.observacao,
            }
          : d
      )
    );
    if (anterior) {
      const atualizado = { ...anterior, status, data_entrega: status === 'ENTREGUE' ? today : anterior.data_entrega, observacao: obs !== undefined ? obs : anterior.observacao };
      await persistirMudancaWeb('documentos', 'UPDATE', atualizado, documentos.map(d => d.documento_id === documentoId ? atualizado : d));
    }
  };

  const addDocumento = async (
    matriculaId: string,
    tipo: string,
    status: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE' = 'PENDENTE',
    obs: string = ''
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const today = getHojeDataIso();

    

    const newDoc: Documento = {
      documento_id: generateUuid(),
      matricula_id: matriculaId,
      tipo,
      status,
      data_entrega: status === 'ENTREGUE' ? today : '',
      observacao: obs,
    };
    setDocumentos(prev => [...prev, newDoc]);
    await persistirMudancaWeb('documentos', 'INSERT', newDoc, [...documentos, newDoc]);
  };

  // ==========================================
  // FREQUÊNCIA
  // ==========================================

  const addFrequencia = async (
    matriculaId: string,
    dataAula: string,
    status: Frequencia['status'],
    justificativa: string,
    origemId?: string
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();

    

    const newFreq: Frequencia = {
      frequencia_id: generateUuid(),
      matricula_id: matriculaId,
      data_aula: dataAula,
      status,
      justificativa,
      origem_id: origemId || '',
      criado_em: now,
      atualizado_em: now,
    };
    setFrequencias(prev => [newFreq, ...prev]);
    await persistirMudancaWeb('frequencias', 'INSERT', newFreq, [newFreq, ...frequencias]);
  };

  const updateFrequenciaStatus = async (
    frequenciaId: string,
    status: Frequencia['status'],
    justificativa?: string
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const anterior = frequencias.find(f => f.frequencia_id === frequenciaId);
    const now = new Date().toISOString();

    

    setFrequencias(prev =>
      prev.map(f =>
        f.frequencia_id === frequenciaId
          ? {
              ...f,
              status,
              justificativa: justificativa !== undefined ? justificativa : f.justificativa,
              atualizado_em: now,
            }
          : f
      )
    );
    if (anterior) {
      const atualizado = { ...anterior, status, justificativa: justificativa !== undefined ? justificativa : anterior.justificativa, atualizado_em: now };
      await persistirMudancaWeb('frequencias', 'UPDATE', atualizado, frequencias.map(f => f.frequencia_id === frequenciaId ? atualizado : f));
    }
  };

  // ==========================================
  // AVALIAÇÕES
  // ==========================================

  const saveAvaliacao = async (
    matriculaId: string,
    criterioId: string,
    nota: number,
    observacao: string = ''
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const anterior = avaliacoes.find(a => a.matricula_id === matriculaId && a.criterio_id === criterioId);
    const registro = anterior ? { ...anterior, nota, observacao } : { avaliacao_id: generateUuid(), matricula_id: matriculaId, criterio_id: criterioId, nota, observacao };

    

    setAvaliacoes(prev => {
      const idx = prev.findIndex(a => a.matricula_id === matriculaId && a.criterio_id === criterioId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], nota, observacao };
        return updated;
      } else {
        return [
          ...prev,
          {
            avaliacao_id: registro.avaliacao_id,
            matricula_id: matriculaId,
            criterio_id: criterioId,
            nota,
            observacao,
          },
        ];
      }
    });
    await persistirMudancaWeb('avaliacoes', anterior ? 'UPDATE' : 'INSERT', registro, anterior ? avaliacoes.map(a => a.avaliacao_id === anterior.avaliacao_id ? registro : a) : [...avaliacoes, registro]);
  };

  // ==========================================
  // PERÍODOS & IMPORTAÇÃO
  // ==========================================

  const createNovoPeriodo = async (
    nome: string,
    dataInicio: string,
    dataFim: string,
    copiarTurmasDePeriodoId?: string
  ): Promise<string> => {
    setSaveStatus('SALVANDO');
    const newPeriodoId = `p-${nome.replace('.', '-')}-${Date.now().toString(36)}`;
    const newPeriodo: Periodo = {
      periodo_id: newPeriodoId, nome,
      data_inicio: dataInicio, data_fim: dataFim, status: 'PLANEJADO',
    };
    const turmasAntigas = copiarTurmasDePeriodoId
      ? turmas.filter(t => t.periodo_id === copiarTurmasDePeriodoId) : [];
    const idsNovos = new Map<string, string>();
    const novasTurmas = turmasAntigas.map(t => {
      const id = generateUuid();
      idsNovos.set(t.turma_id, id);
      return { ...t, turma_id: id, periodo_id: newPeriodoId, status: 'ATIVO' as const };
    });
    // Preserva vínculo de cada critério à turma correspondente no novo período.
    const novosCriterios = criterios
      .filter(c => c.periodo_id === copiarTurmasDePeriodoId)
      .map(c => ({
        ...c, criterio_id: generateUuid(), periodo_id: newPeriodoId,
        turma_id: c.turma_id ? (idsNovos.get(c.turma_id) || c.turma_id) : c.turma_id,
      }));
    
    // Não apenas alterar React e indicar sucesso: registrar cada nova entidade
    // no Sheets ou na fila offline antes de expor o novo período na interface.
    await persistirMudancaWeb('periodos', 'INSERT', newPeriodo, [...periodos, newPeriodo]);
    let turmasSnapshot = [...turmas];
    for (const turma of novasTurmas) {
      turmasSnapshot = [...turmasSnapshot, turma];
      await persistirMudancaWeb('turmas', 'INSERT', turma, turmasSnapshot);
    }
    let criteriosSnapshot = [...criterios];
    for (const criterio of novosCriterios) {
      criteriosSnapshot = [...criteriosSnapshot, criterio];
      await persistirMudancaWeb('criterios_avaliacao', 'INSERT', criterio, criteriosSnapshot);
    }
    setPeriodos(prev => [...prev, newPeriodo]);
    if (novasTurmas.length) setTurmas(prev => [...prev, ...novasTurmas]);
    if (novosCriterios.length) setCriterios(prev => [...prev, ...novosCriterios]);
    return newPeriodoId;
  };

  const importarAlunosLote = async (
    turmaId: string,
    novosAlunos: { nome: string; identificador_academico: string }[]
  ): Promise<{ adicionados: number; duplicados: number }> => {
    let adicionados = 0;
    let duplicados = 0;

    const turmaAlvo = turmas.find(t => t.turma_id === turmaId);
    if (!turmaAlvo) return { adicionados: 0, duplicados: 0 };

    

    const alunosCriados: Aluno[] = [];
    const matriculasCriadas: Matricula[] = [];

    novosAlunos.forEach(item => {
      const cleanNome = item.nome.trim();
      const cleanRa = item.identificador_academico.trim();
      if (!cleanNome) return;

      // Conferir também o próprio lote: duas linhas com o mesmo RA
      // não podem criar duas fichas independentes.
      const existingAluno = [...alunos, ...alunosCriados].find(
        a => cleanRa.length > 0 &&
          a.identificador_academico.toLowerCase() === cleanRa.toLowerCase()
      );

      let targetAlunoId: string;

      if (existingAluno) {
        targetAlunoId = existingAluno.aluno_id;
        const jaMatriculado = [...matriculas, ...matriculasCriadas].some(
          m => m.aluno_id === targetAlunoId && m.turma_id === turmaId
        );
        if (jaMatriculado) {
          duplicados++;
          return;
        }
      } else {
        targetAlunoId = generateUuid();
        alunosCriados.push({
          aluno_id: targetAlunoId,
          nome: cleanNome,
          identificador_academico: cleanRa || `RA-PENDENTE-${targetAlunoId}`,
          status: 'ATIVO',
        });
      }

      matriculasCriadas.push({
        matricula_id: generateUuid(),
        aluno_id: targetAlunoId,
        turma_id: turmaId,
        periodo_id: turmaAlvo.periodo_id,
        status: 'MATRICULADO',
      });
      adicionados++;
    });

    // Importação controlada: grava alunos antes de vincular matrículas;
    // não confirma lote apenas em memória nem duplica registros já existentes.
    let alunosSnapshot = [...alunos];
    for (const aluno of alunosCriados) {
      alunosSnapshot = [...alunosSnapshot, aluno];
      await persistirMudancaWeb('alunos', 'INSERT', aluno, alunosSnapshot);
    }
    let matriculasSnapshot = [...matriculas];
    for (const matricula of matriculasCriadas) {
      matriculasSnapshot = [...matriculasSnapshot, matricula];
      await persistirMudancaWeb('matriculas', 'INSERT', matricula, matriculasSnapshot);
    }
    if (alunosCriados.length) setAlunos(prev => [...prev, ...alunosCriados]);
    if (matriculasCriadas.length) setMatriculas(prev => [...prev, ...matriculasCriadas]);
    return { adicionados, duplicados };
  };

  // ==========================================
  // CONSULTAS E REGRAS DE NEGÓCIO DA BASE
  // ==========================================

  const isTurmaClinicaAmpliada = useCallback((turmaId: string): boolean => {
    // 1. Verifica se existem grupos cadastrados para a turma em grupos_pratica
    if (gruposPratica.some(g => g.turma_id === turmaId)) return true;
    // 2. Verifica se a disciplina correspondente está tipada como grupo / clinica ampliada
    const turma = turmas.find(t => t.turma_id === turmaId);
    if (turma) {
      const disc = disciplinas.find(d => d.disciplina_id === turma.disciplina_id);
      if (disc?.tipo === 'CLINICA_AMPLIADA' || disc?.tipo === 'GRUPO') return true;
    }
    // 3. Verifica configurações do contrato da turma
    const cfg = configuracoes.find(c => c.turma_id === turmaId && (c.chave === 'MODALIDADE_SUPERVISAO' || c.chave === 'TIPO_SUPERVISAO'));
    if (cfg?.valor === 'GRUPO' || cfg?.valor === 'CLINICA_AMPLIADA') return true;
    return false;
  }, [gruposPratica, turmas, disciplinas, configuracoes]);

  const getStatusRssUnidade = useCallback((turmaId: string, matriculaId?: string, grupoId?: string): StatusRssUnidade | undefined => {
    const isGrupo = isTurmaClinicaAmpliada(turmaId);
    if (isGrupo) {
      let targetGrupoId = grupoId;
      if (!targetGrupoId && matriculaId) {
        const mat = matriculas.find(m => m.matricula_id === matriculaId);
        const candidatos = grupoIntegrantes.filter(gi =>
          (gi.matricula_id === matriculaId || (mat && gi.aluno_id === mat.aluno_id)) &&
          gruposPratica.some(g => g.grupo_id === gi.grupo_id && g.turma_id === turmaId) &&
          !['INATIVO', 'REMOVIDO', 'ENCERRADO'].includes(String(gi.status ?? '').toUpperCase())
        );
        const ids = [...new Set(candidatos.map(gi => gi.grupo_id))];
        targetGrupoId = ids.length === 1 ? ids[0] : undefined;
      }
      if (targetGrupoId) {
        return statusRssUnidades.find(s =>
          (s.turma_id === turmaId || !s.turma_id) &&
          s.unidade_id === targetGrupoId &&
          (s.unidade_tipo === 'GRUPO' || !s.unidade_tipo)
        );
      }
      // Clínica Ampliada: sem vínculo de grupo inequívoco, não retornar
      // saldo da modalidade individual ou de outra turma.
      return undefined;
    }
    if (matriculaId) {
      const mat = matriculas.find(m => m.matricula_id === matriculaId);
      return statusRssUnidades.find(s =>
        (s.turma_id === turmaId || !s.turma_id) &&
        (s.unidade_id === matriculaId || (mat && s.unidade_id === mat.aluno_id)) &&
        (s.unidade_tipo === 'INDIVIDUAL' || !s.unidade_tipo)
      );
    }
    return undefined;
  }, [isTurmaClinicaAmpliada, matriculas, grupoIntegrantes, gruposPratica, statusRssUnidades]);

  const getSituacaoTurma = useCallback((turmaId: string) => {
    const materializado = situacaoAtualTurmas.find(s => s.turma_id === turmaId);
    const totalAlunos = materializado?.total_alunos !== undefined && materializado?.total_alunos !== null
      ? Number(materializado.total_alunos)
      : matriculas.filter(m => m.turma_id === turmaId && m.status === 'MATRICULADO').length;

    const situacao = materializado?.situacao || 'EM_ANDAMENTO';

    let totalPendencias = materializado?.total_pendencias !== undefined && materializado?.total_pendencias !== null
      ? Number(materializado.total_pendencias)
      : 0;

    if (materializado?.total_pendencias === undefined || materializado?.total_pendencias === null) {
      const mats = matriculas.filter(m => m.turma_id === turmaId).map(m => m.matricula_id);
      const resumoDocs = resumirDocumentacaoOficial(entregas, documentos, new Set(mats));
      const docs = resumoDocs.pendentes + resumoDocs.conferir;
      const freqs = frequencias.filter(f => mats.includes(f.matricula_id) && f.status === 'FALTA_SEM_JUSTIFICATIVA').length;
      totalPendencias = docs + freqs;
    }

    return {
      situacao,
      totalAlunos,
      totalPendencias,
      materializado,
    };
  }, [situacaoAtualTurmas, matriculas, entregas, documentos, frequencias]);

  const getCriteriosDaTurma = useCallback((turmaId: string, instrumento?: string): CriterioAvaliacao[] => {
    const turma = turmas.find(t => t.turma_id === turmaId);
    return criterios.filter(c => {
      if (c.ativo === false) return false;
      if (c.turma_id && c.turma_id !== turmaId) return false;
      if (c.disciplina_id && turma && c.disciplina_id !== turma.disciplina_id) return false;
      if (instrumento && c.instrumento_avaliacao && c.instrumento_avaliacao !== instrumento) return false;
      return true;
    });
  }, [turmas, criterios]);

  const addRegistroSupervisao = async (
    matriculaId: string,
    dataHora: string,
    categoria: string,
    texto: string,
    status: string = 'REGISTRADO'
  ): Promise<RegistroSupervisao> => {
    const validation = validarEscritaTabela('registros_supervisao', { matricula_id: matriculaId, texto });
    if (!validation.valido) throw new Error(validation.motivo);
    const novoRegistro: RegistroSupervisao = {
      registro_id: gerarIdEstavel('reg_sup'),
      matricula_id: matriculaId,
      data_hora: dataHora || new Date().toISOString(),
      categoria,
      texto,
      status,
      data: dataHora || new Date().toISOString(),
      descricao: texto,
      periodo_id: selectedPeriodoId,
      turma_id: matriculas.find(m => m.matricula_id === matriculaId)?.turma_id || '',
      escopo: 'INDIVIDUAL',
    };
    await persistirMudancaWeb('registros_supervisao', 'INSERT', novoRegistro, [novoRegistro, ...registrosSupervisao]);
    setRegistrosSupervisao(prev => [novoRegistro, ...prev]);
    return novoRegistro;
  };

  const addEntrega = async (
    matriculaId: string,
    tipoDocumento: string,
    statusEntrega: string = 'PENDENTE',
    obs: string = ''
  ): Promise<Entrega> => {
    const validation = validarEscritaTabela('entregas', { matricula_id: matriculaId, tipo_documento: tipoDocumento });
    if (!validation.valido) throw new Error(validation.motivo);
    const novaEntrega: Entrega = {
      entrega_id: gerarIdEstavel('ent'),
      matricula_id: matriculaId,
      tipo_documento: tipoDocumento,
      status_entrega: statusEntrega,
      data_entrega: statusEntrega === 'ENTREGUE' ? getHojeDataIso() : '',
      observacao: obs,
      periodo_id: selectedPeriodoId,
      turma_id: matriculas.find(m => m.matricula_id === matriculaId)?.turma_id || '',
      tipo_entrega: tipoDocumento,
      status: statusEntrega,
      data_envio: statusEntrega === 'ENTREGUE' ? getHojeDataIso() : '',
      escopo: 'INDIVIDUAL',
    };
    await persistirMudancaWeb('entregas', 'INSERT', novaEntrega, [novaEntrega, ...entregas]);
    setEntregas(prev => [novaEntrega, ...prev]);
    return novaEntrega;
  };

  const marcarEntrega = async (matriculaId: string, tipoDocumento: string, entregue: boolean): Promise<void> => {
    const tipo = tipoDocumento.toUpperCase();
    const atual = entregas.find(e =>
      String(e.matricula_id ?? '').trim() === matriculaId &&
      String(e.tipo_documento ?? e.tipo_entrega ?? '').trim().toUpperCase() === tipo);
    if (!atual) { await addEntrega(matriculaId, tipoDocumento, entregue ? 'ENTREGUE' : 'PENDENTE'); return; }
    const hoje = getHojeDataIso();
    const status = entregue ? 'ENTREGUE' : 'PENDENTE';
    const data = entregue ? (String(atual.data_entrega ?? atual.data_envio ?? '').trim() || hoje) : '';
    const atualizado: Entrega = { ...atual, status_entrega: status, status, data_entrega: data, data_envio: data };
    const lista = entregas.map(e => e.entrega_id === atual.entrega_id ? atualizado : e);
    await persistirMudancaWeb('entregas', 'UPDATE', atualizado, lista);
    setEntregas(prev => prev.map(e => e.entrega_id === atual.entrega_id ? atualizado : e));
  };

  const gravarItemOperacional = async <T extends {id: string}>(
    tipo: TipoOperacional, item: T, excluido = false,
  ): Promise<void> => {
    const chave = chaveItemOperacional(tipo, item.id);
    const existente = configuracoes.find(c => c.chave === chave);
    const registro = prepararRegistroOperacional(tipo, item, selectedPeriodoId, existente, excluido);
    await persistirMudancaWeb('configuracoes', existente ? 'UPDATE' : 'INSERT',
      registro, [...configuracoes.filter(c => c.chave !== chave), registro]);
    setConfiguracoes(prev => [...prev.filter(c => c.chave !== chave), registro]);
  };

  const itensOperacionaisLocaisPendentes =
    contarLegadosLocais(caixaEntrada, configuracoes, 'CAIXA_ENTRADA') +
    contarLegadosLocais(filaProfessora, configuracoes, 'FILA_PROFESSORA') +
    contarLegadosLocais(filaSupervisao, configuracoes, 'FILA_SUPERVISAO');

  const importarItensOperacionaisLocais = async (): Promise<number> => {
    if (!await getAccessToken()) throw new Error('Conecte ao Google Sheets antes da importação.');
    const grupos = [
      ['CAIXA_ENTRADA', caixaEntrada],
      ['FILA_PROFESSORA', filaProfessora],
      ['FILA_SUPERVISAO', filaSupervisao],
    ] as const;
    const conhecidos = new Set(configuracoes.map(c => c.chave));
    let count = 0;
    for (const [tipo, items] of grupos) {
      for (const item of items) {
        const chave = chaveItemOperacional(tipo, item.id);
        if (conhecidos.has(chave)) continue;
        const registro = prepararRegistroOperacional(tipo, item, selectedPeriodoId);
        const res = await salvarRegistroResiliente('configuracoes', 'INSERT', registro);
        if (!res.gravadoOnline) throw new Error('Importação parcial: itens mantidos no dispositivo. Reconecte antes de continuar.');
        setConfiguracoes(prev => [...prev.filter(c => c.chave !== chave), registro]);
        conhecidos.add(chave);
        count++;
      }
    }
    return count;
  };

  // Métodos de apoio / transição
  const addCaixaEntradaItem = async (item: any) => {
    const novo: CaixaEntradaItem = { ...item, id: gerarIdEstavel('cx'), criado_em: new Date().toISOString(), status: item.status || 'PENDENTE' };
    await gravarItemOperacional('CAIXA_ENTRADA', novo);
    setCaixaEntrada(prev => [novo, ...prev]);
  };
  const confirmarCaixaEntradaItem = async (id: string, updates?: any) => {
    const anterior = caixaEntrada.find(i => i.id === id);
    if (!anterior) throw new Error('Item da caixa não encontrado.');
    const atualizado: CaixaEntradaItem = { ...anterior, ...(updates || {}), status: 'CONFIRMADO', resolvido_em: new Date().toISOString() };
    await gravarItemOperacional('CAIXA_ENTRADA', atualizado);
    setCaixaEntrada(prev => prev.map(i => i.id === id ? atualizado : i));
  };
  const descartarCaixaEntradaItem = async (id: string) => {
    const anterior = caixaEntrada.find(i => i.id === id);
    if (!anterior) throw new Error('Item da caixa não encontrado.');
    const atualizado: CaixaEntradaItem = { ...anterior, status: 'DESCARTADO', resolvido_em: new Date().toISOString() };
    await gravarItemOperacional('CAIXA_ENTRADA', atualizado);
    setCaixaEntrada(prev => prev.map(i => i.id === id ? atualizado : i));
  };
  const addItemFilaProfessora = async (item: any) => {
    const novo: ItemFilaProfessora = { ...item, id: gerarIdEstavel('fp'), criado_em: new Date().toISOString(), status: item.status || 'PENDENTE' };
    await gravarItemOperacional('FILA_PROFESSORA', novo);
    setFilaProfessora(prev => [novo, ...prev]);
  };
  const toggleStatusFilaProfessora = async (id: string) => {
    const anterior = filaProfessora.find(i => i.id === id);
    if (!anterior) throw new Error('Tarefa não encontrada.');
    const atualizado: ItemFilaProfessora = { ...anterior, status: anterior.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO' };
    await gravarItemOperacional('FILA_PROFESSORA', atualizado);
    setFilaProfessora(prev => prev.map(i => i.id === id ? atualizado : i));
  };
  const deleteItemFilaProfessora = async (id: string) => {
    const anterior = filaProfessora.find(i => i.id === id);
    if (!anterior) throw new Error('Tarefa não encontrada.');
    await gravarItemOperacional('FILA_PROFESSORA', anterior, true);
    setFilaProfessora(prev => prev.filter(i => i.id !== id));
  };

  const addItemFilaSupervisao = async (item: any) => {
    const novo: ItemFilaSupervisao = { ...item, id: gerarIdEstavel('fs'),
      criado_em: new Date().toISOString(), status: item.status || 'AGUARDANDO',
      ordem: filaSupervisao.length + 1 };
    await gravarItemOperacional('FILA_SUPERVISAO', novo);
    setFilaSupervisao(prev => [...prev, novo]);
  };
  const updateStatusFilaSupervisao = async (id: string, status: ItemFilaSupervisao['status']) => {
    const anterior = filaSupervisao.find(i => i.id === id);
    if (!anterior) throw new Error('Item da supervisão não encontrado.');
    const atualizado: ItemFilaSupervisao = { ...anterior, status };
    await gravarItemOperacional('FILA_SUPERVISAO', atualizado);
    setFilaSupervisao(prev => prev.map(i => i.id === id ? atualizado : i));
  };
  const removerItemFilaSupervisao = async (id: string) => {
    const anterior = filaSupervisao.find(i => i.id === id);
    if (!anterior) throw new Error('Item da supervisão não encontrado.');
    await gravarItemOperacional('FILA_SUPERVISAO', anterior, true);
    setFilaSupervisao(prev => prev.filter(i => i.id !== id));
  };

  const salvarAvaliacaoCompleta = async (avaliacao: AvaliacaoCompleta) => {
    const anterior = avaliacoesCompletas.find(a => a.matricula_id === avaliacao.matricula_id &&
      a.instrumento_id === avaliacao.instrumento_id);
    const id = anterior?.avaliacao_id || avaliacao.avaliacao_id || gerarIdEstavel('av_c');
    const item: AvaliacaoCompleta = { ...anterior, ...avaliacao, avaliacao_id: id, atualizado_em: new Date().toISOString() };
    const lista = [...avaliacoesCompletas.filter(a => a.avaliacao_id !== id), item];
    await persistirMudancaWeb('avaliacoes_completas', anterior ? 'UPDATE' : 'INSERT', item, lista);
    setAvaliacoesCompletas(lista);
    // NOTA: notas por critério são persistidas na tabela oficial 'avaliacoes'
    // pelo fluxo de correção. Este registro guarda o parecer e a devolutiva.
  };
  /** Aprovação registrada na planilha antes de atualizar o estado da UI. */
  const aprovarDevolutiva = async (id: string) => {
    const anterior = avaliacoesCompletas.find(a => a.avaliacao_id === id);
    if (!anterior) throw new Error('Avaliação não encontrada. Sincronize e tente novamente.');
    if (anterior.status === 'ENVIADO') throw new Error('A devolutiva já consta como enviada; não é possível voltar à aprovação.');
    const atualizado: AvaliacaoCompleta = {
      ...anterior, status: 'APROVADO_ENVIO',
      data_aprovacao: new Date().toISOString(), atualizado_em: new Date().toISOString(),
    };
    const lista = avaliacoesCompletas.map(a => a.avaliacao_id === id ? atualizado : a);
    await persistirMudancaWeb('avaliacoes_completas', 'UPDATE', atualizado, lista);
    setAvaliacoesCompletas(lista);
  };
  /** Confirmação manual de envio: não envia e-mail e não pode inventar uma confirmação. */
  const registrarEnvioDevolutiva = async (id: string, _emailDestino?: string) => {
    const anterior = avaliacoesCompletas.find(a => a.avaliacao_id === id);
    if (!anterior) throw new Error('Avaliação não encontrada. Sincronize e tente novamente.');
    if (anterior.status !== 'APROVADO_ENVIO' && anterior.status !== 'ENVIADO') {
      throw new Error('A devolutiva precisa ser aprovada antes de registrar o envio.');
    }
    const atualizado: AvaliacaoCompleta = {
      ...anterior, status: 'ENVIADO',
      data_envio: anterior.data_envio || new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    const lista = avaliacoesCompletas.map(a => a.avaliacao_id === id ? atualizado : a);
    await persistirMudancaWeb('avaliacoes_completas', 'UPDATE', atualizado, lista);
    setAvaliacoesCompletas(lista);
  };

  const registrarAuditoria = async (
    acaoOrObj: any,
    entidade?: string,
    entidadeId?: string,
    valorAnterior?: any,
    valorNovo?: any,
    motivo?: string
  ) => {
    let log: HistoricoAuditoria;
    if (typeof acaoOrObj === 'object' && acaoOrObj !== null) {
      log = {
        id: gerarIdEstavel('aud'),
        timestamp: new Date().toISOString(),
        usuario: currentUser?.email || 'professora',
        ...acaoOrObj,
      };
    } else {
      log = {
        id: gerarIdEstavel('aud'),
        timestamp: new Date().toISOString(),
        usuario: currentUser?.email || 'professora',
        acao: String(acaoOrObj || ''),
        entidade: entidade || '',
        entidade_id: entidadeId || '',
        valor_anterior: valorAnterior !== undefined ? String(valorAnterior) : undefined,
        valor_novo: valorNovo !== undefined ? String(valorNovo) : undefined,
        motivo,
      };
    }
    setAuditoriaApp(prev => [log, ...prev]);
  };

  const getTurmasDoPeriodo = (periodoId?: string, incluirArquivadas: boolean = false): Turma[] => {
    const pId = periodoId || selectedPeriodoId;
    return turmas.filter(t => {
      if (t.periodo_id !== pId) return false;
      if (!incluirArquivadas && t.status === 'ARQUIVADO') return false;
      return true;
    });
  };

  const getAlunosDaTurma = (turmaId: string): { matricula: Matricula; aluno: Aluno }[] => {
    return listarAlunosChamada(turmaId, matriculas, alunos);
  };


  // RSS: correções auditáveis de associação são aplicadas sobre cópias; `registros_semanais` (fonte) nunca é alterada.
  const ajustesRss = useMemo(() => rssAjustes.map(linhaParaAjuste), [rssAjustes]);
  const registrosCorrigidos = useMemo(() => aplicarAjustesRss(registrosSemanais as never[], ajustesRss) as unknown as RegistroSemanal[], [registrosSemanais, ajustesRss]);
  // Falha de leitura/sincronização da fonte de RSS nunca vira "NÃO ENTREGUE".
  const fonteRssDisponivel = !(syncStatusState.status === 'ERRO' ||
    syncStatusState.erros.some(e => /registros_semanais|calendario_rss|status_rss_unidades/.test(e)));

  const getSituacaoRssEstudante = useCallback((matriculaId: string): SituacaoRssEstudante | null => {
    const matricula = matriculas.find(m => m.matricula_id === matriculaId);
    if (!matricula) return null;
    const turma = turmas.find(t => t.turma_id === matricula.turma_id);
    if (!turma) return null;

    const vinculo = selecionarRssDoEstudante({
      matriculaId, turmaId: turma.turma_id, registros: registrosCorrigidos,
      matriculas, alunos, grupos: gruposPratica, integrantes: grupoIntegrantes,
    });
    const grupoId = vinculo.grupoId;
    // Não usar status agregado da turma para estudante sem grupo inequívoco.
    const statusRss = vinculo.modo === 'GRUPO_AMBIGUO' ? undefined
      : getStatusRssUnidade(turma.turma_id, matriculaId, grupoId);
    const regraTurma = regrasRss.find(
      r => r.turma_id === turma.turma_id || r.disciplina_id === turma.disciplina_id
    );
    const situacaoTurma = situacaoAtualTurmas.find(s => s.turma_id === turma.turma_id);
    const calTurma = calendarioRss.filter(c => c.turma_id === turma.turma_id);

    return obterSituacaoRssEstudante(
      matriculaId,
      turma.turma_id,
      vinculo.registros,
      statusRss,
      regraTurma,
      situacaoTurma,
      calTurma,
      grupoId,
      {
        fonteDisponivel: fonteRssDisponivel,
        observacoes: observacoesPorSemana(ajustesRss, turma.turma_id, grupoId ? 'GRUPO' : 'MATRICULA', grupoId ?? matriculaId),
      }
    );
  }, [matriculas, alunos, turmas, getStatusRssUnidade, regrasRss, situacaoAtualTurmas, calendarioRss, registrosCorrigidos, grupoIntegrantes, gruposPratica, fonteRssDisponivel, ajustesRss]);

  const getResumoAlunoSupervisao = (matriculaId: string): AlunoResumoSupervisao | null => {
    const matricula = matriculas.find(m => m.matricula_id === matriculaId);
    if (!matricula) return null;
    const aluno = alunos.find(a => a.aluno_id === matricula.aluno_id);
    const turma = turmas.find(t => t.turma_id === matricula.turma_id);
    if (!aluno || !turma) return null;
    const disciplina = disciplinas.find(d => d.disciplina_id === turma.disciplina_id) || {
      disciplina_id: '',
      codigo: '',
      nome: 'Estágio',
      tipo: 'ESTÁGIO',
    };

    // Situação canônica RSS unificada
    const situacaoRss = getSituacaoRssEstudante(matriculaId);
    const totalRegistrosEntregues = situacaoRss?.registrosRealizados ?? 0;
    const totalRegistrosEsperados = situacaoRss?.registrosEsperadosAteHoje ?? 0;
    const totalPrevistoNoPeriodo = situacaoRss?.totalPrevistoNoPeriodo ?? 12;
    const saldoRss = situacaoRss?.saldoRss ?? (totalRegistrosEntregues - totalRegistrosEsperados);

    const docsResumo = resumirDocumentacaoOficial(entregas, documentos, new Set([matriculaId]));
    const docsPendentesCount = docsResumo.pendentes + docsResumo.conferir;

    const freqs = frequencias.filter(f => f.matricula_id === matriculaId);
    const faltasInjustificadasCount = freqs.filter(
      f => f.status === 'FALTA_SEM_JUSTIFICATIVA'
    ).length;
    const justificativasPendentesCount = freqs.filter(
      f => f.status === 'JUSTIFICATIVA_PENDENTE'
    ).length;

    const orientacoesDoAluno = orientacoes.filter(o => o.matricula_id === matriculaId);
    const orientacoesAbertasCount = orientacoesDoAluno.filter(o => o.status === 'ABERTA').length;

    const pontosAtivos = pontosAcompanhamento.filter(
      p => p.matricula_id === matriculaId && p.status === 'ATIVO'
    );

    const ultimasOrientacoes = orientacoesDoAluno
      .slice()
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
      .slice(0, 3);

    const ultimasOcorrencias = ocorrencias
      .filter(o => o.matricula_id === matriculaId)
      .slice()
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
      .slice(0, 3);

    const motivosAtencao: string[] = [];
    const rssOperacional = classificarRssOperacional(situacaoRss, calendarioRss, getHojeDataIso());
    // RSS é informação contextual da aula; não ativa alerta geral de estudante.
    if (docsPendentesCount > 0) {
      motivosAtencao.push(`${docsPendentesCount} documento(s) pendente(s) ou a conferir`);
    }
    if (faltasInjustificadasCount > 0) {
      motivosAtencao.push(`${faltasInjustificadasCount} falta(s) sem justificativa`);
    }
    if (justificativasPendentesCount > 0) {
      motivosAtencao.push(`${justificativasPendentesCount} justificativa(s) pendente(s)`);
    }
    if (orientacoesAbertasCount > 0) {
      motivosAtencao.push(`${orientacoesAbertasCount} orientação(ões) aberta(s)`);
    }

    let statusAtencao: 'NORMAL' | 'ATENCAO' | 'PRIORIDADE' = 'NORMAL';
    if (motivosAtencao.length >= 2 || faltasInjustificadasCount >= 2) {
      statusAtencao = 'PRIORIDADE';
    } else if (motivosAtencao.length === 1) {
      statusAtencao = 'ATENCAO';
    }

    const temAtencao = statusAtencao !== 'NORMAL';

    return {
      matricula,
      aluno,
      turma,
      disciplina,
      totalRegistrosEntregues,
      totalRegistrosEsperados,
      totalPrevistoNoPeriodo,
      situacaoRss: situacaoRss || undefined,
      docsPendentesCount,
      faltasInjustificadasCount,
      orientacoesAbertasCount,
      justificativasPendentesCount,
      temAtencao,
      statusAtencao,
      motivosAtencao,
      pontosAtivos,
      ultimasOrientacoes,
      ultimasOcorrencias,
    };
  };

  // ==========================================
  // OPERAÇÃO: ENCONTROS, AULAS NÃO REALIZADAS E REAGENDAMENTOS
  // ==========================================

  const marcarEncontroNaoRealizado = async (
    turmaId: string,
    data: string,
    motivo: MotivoNaoRealizado | string,
    observacao?: string
  ) => {
    setSaveStatus('SALVANDO');
    const anterior = encontrosTurma.find(e => e.turma_id === turmaId && e.data === data);
    const atualizado: EncontroTurma = {
      ...anterior,
      encontro_id: anterior?.encontro_id || generateUuid(),
      turma_id: turmaId,
      periodo_id: selectedPeriodoId,
      data,
      status: 'NAO_REALIZADO',
      motivo_nao_realizado: motivo,
      observacao: observacao || '',
      atualizado_em: new Date().toISOString(),
    };
    const listaAtualizada = [...encontrosTurma.filter(e => !(e.turma_id === turmaId && e.data === data)), atualizado];
    setEncontrosTurma(listaAtualizada);
    // Não alterar realização do estudo dirigido sem confirmação da docente.
    // As aulas canceladas não justificam automaticamente ausência de RSS/prática.
    await persistirMudancaWeb('encontros_turma', anterior ? 'UPDATE' : 'INSERT', atualizado, listaAtualizada);
    await registrarAuditoria({
      acao: 'MARCAR_AULA_NAO_REALIZADA',
      entidade: 'encontros_turma',
      entidade_id: `${turmaId}_${data}`,
      valor_novo: JSON.stringify({ motivo, observacao }),
      motivo: String(motivo),
    });
  };

  const reagendarEncontro = async (
    turmaId: string,
    dataOriginal: string,
    novaData: string,
    novoHorario?: string,
    motivo?: string,
    transferirEstudoDirigido: boolean = true
  ) => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();
    const horarioOriginal = horariosTurma.find(h => h.turma_id === turmaId);

    setEncontrosTurma(prev => {
      // 1. Marca encontro original como REAGENDADO
      const idxOrig = prev.findIndex(e => e.turma_id === turmaId && e.data === dataOriginal);
      const origAtualizado: EncontroTurma = {
        encontro_id: idxOrig >= 0 ? prev[idxOrig].encontro_id : generateUuid(),
        turma_id: turmaId,
        periodo_id: selectedPeriodoId,
        data: dataOriginal,
        status: 'REAGENDADO',
        motivo_nao_realizado: motivo || 'Reagendamento',
        data_reagendada: novaData,
        hora_reagendada: novoHorario,
        atualizado_em: now,
      };

      // 2. Cria novo encontro para a novaData
      const idxNovo = prev.findIndex(e => e.turma_id === turmaId && e.data === novaData);
      const novoEncontro: EncontroTurma = {
        encontro_id: idxNovo >= 0 ? prev[idxNovo].encontro_id : generateUuid(),
        turma_id: turmaId,
        periodo_id: selectedPeriodoId,
        data: novaData,
        status: 'PREVISTO',
        data_original: dataOriginal,
        hora_inicio: novoHorario || horarioOriginal?.hora_inicio || '18:30',
        hora_fim: horarioOriginal?.hora_fim || '21:12',
        observacao: `Reagendado de ${dataOriginal}. Motivo: ${motivo || 'Reorganização acadêmica'}`,
        atualizado_em: now,
      };

      const copy = [...prev];
      if (idxOrig >= 0) copy[idxOrig] = origAtualizado;
      else copy.push(origAtualizado);

      if (idxNovo >= 0) copy[idxNovo] = novoEncontro;
      else copy.push(novoEncontro);

      return copy;
    });

    // A transferência do estudo dirigido NÃO altera `leituras_responsaveis`: ela é derivada dos encontros
    // cancelados/reagendados (gravados abaixo) em `leiturasDoEncontro`. Mudar a data só na memória faria
    // as telas divergirem até recarregar e outros dispositivos nunca veriam a mudança.
    void transferirEstudoDirigido;

    // Compartilha o cancelamento e o reagendamento com outros dispositivos.
    const itemOriginal = encontrosTurma.find(e => e.turma_id === turmaId && e.data === dataOriginal);
    const itemNovo = encontrosTurma.find(e => e.turma_id === turmaId && e.data === novaData);
    const registroOriginal: EncontroTurma = {
      ...itemOriginal, encontro_id: itemOriginal?.encontro_id || generateUuid(),
      turma_id: turmaId, periodo_id: selectedPeriodoId, data: dataOriginal,
      status: 'REAGENDADO', motivo_nao_realizado: motivo || 'Reagendamento',
      data_reagendada: novaData, hora_reagendada: novoHorario, atualizado_em: now,
    };
    const registroNovo: EncontroTurma = {
      ...itemNovo, encontro_id: itemNovo?.encontro_id || generateUuid(),
      turma_id: turmaId, periodo_id: selectedPeriodoId, data: novaData,
      status: 'PREVISTO', data_original: dataOriginal,
      hora_inicio: novoHorario || horarioOriginal?.hora_inicio || '18:30',
      hora_fim: horarioOriginal?.hora_fim || '21:12',
      observacao: `Reagendado de ${dataOriginal}. Motivo: ${motivo || 'Reorganização acadêmica'}`,
      atualizado_em: now,
    };
    const listaReagendada = [
      ...encontrosTurma.filter(e => e.turma_id !== turmaId || (e.data !== dataOriginal && e.data !== novaData)),
      registroOriginal, registroNovo
    ];
    await persistirMudancaWeb('encontros_turma', itemOriginal ? 'UPDATE' : 'INSERT', registroOriginal, listaReagendada);
    await persistirMudancaWeb('encontros_turma', itemNovo ? 'UPDATE' : 'INSERT', registroNovo, listaReagendada);

    await registrarAuditoria({
      acao: 'REAGENDAR_SUPERVISAO',
      entidade: 'encontros_turma',
      entidade_id: `${turmaId}_${dataOriginal}_to_${novaData}`,
      valor_anterior: dataOriginal,
      valor_novo: novaData,
      motivo: motivo || 'Reagendamento de aula',
    });

  };

  const reverterNaoRealizadoOuReagendado = async (turmaId: string, data: string) => {
    const anterior = encontrosTurma.find(e => e.turma_id === turmaId && e.data === data);
    if (!anterior) return;
    const atualizados = encontrosTurma.filter(e => !(e.turma_id === turmaId && e.data === data));
    setEncontrosTurma(atualizados);
    await persistirMudancaWeb('encontros_turma', 'DELETE', anterior, atualizados);
  };

  // ==========================================
  // OPERAÇÃO: ESTUDO DIRIGIDO / LEITURAS
  // ==========================================

  const atualizarStatusEstudoDirigido = async (
    leituraId: string,
    status: 'PLANEJADO' | 'REALIZADO' | 'PARCIAL' | 'NAO_REALIZADO' | 'SUBSTITUICAO',
    responsaveisEfetivosIds?: string[],
    motivoSubstituicao?: string
  ) => {
    setSaveStatus('SALVANDO');
    const original = leiturasResponsaveis.find(l => l.leitura_id === leituraId);
    if (!original || !original.leitura_id) {
      const erro = new Error('Leitura não encontrada na base oficial.');
      handleSaveError(erro);
      throw erro;
    }
    const atualizado: LeituraResponsavel = {
      ...original, status_realizacao: status,
      responsaveis_efetivos: responsaveisEfetivosIds !== undefined
        ? responsaveisEfetivosIds
        : (original.responsaveis_efetivos || original.responsaveis_previstos || []),
      motivo_substituicao: motivoSubstituicao !== undefined ? motivoSubstituicao : original.motivo_substituicao,
    };
    const lista = leiturasResponsaveis.map(l => l.leitura_id === leituraId ? atualizado : l);
    await persistirMudancaWeb('leituras_responsaveis', 'UPDATE', {
      ...atualizado,
      leitura_agenda_id: (atualizado as any).leitura_agenda_id || atualizado.leitura_id,
    }, lista);
    setLeiturasResponsaveis(lista);
  };

  // ==========================================
  // OPERAÇÃO: CHAMADA POR EXCEÇÃO
  // ==========================================

  const salvarChamadaPorExcecao = async (
    turmaId: string,
    dataAula: string,
    excecoes: {
      matriculaId: string;
      status: Frequencia['status'];
      justificativa?: string;
      atraso?: boolean;
      celular?: boolean;
      observacao?: string;
    }[],
    origemIdPadrao?: string
  ): Promise<{
    salvos: number;
    atualizados: number;
    sincronizadoRemoto: boolean;
    salvoLocal: boolean;
    tokenExpirado: boolean;
    statusTexto: string;
  }> => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();
    const matriculasDaTurma = listarAlunosChamada(turmaId, matriculas, alunos).map(item => item.matricula);
    const origensDaTurma = turmasOrigem.filter(o => o.turma_id === turmaId && o.ativo);
    const fallbackOrigem =
      origemIdPadrao || (origensDaTurma.length === 1 ? origensDaTurma[0].origem_id : '');

    let novosCount = 0;
    let atualizadosCount = 0;

    const mapNovasFreqs: Record<string, Frequencia> = {};
    const novasOcorrencias: Ocorrencia[] = [];

    matriculasDaTurma.forEach(mat => {
      const exc = excecoes.find(e => e.matriculaId === mat.matricula_id);
      // Supervisão em horário alternativo: o encontro coletivo não gera presença nem falta automática.
      // Só há registro se a professora marcar explicitamente.
      if (!geraRegistroAutomatico(mat, !!exc)) return;
      const statusFinal: Frequencia['status'] = exc ? exc.status : 'PRESENTE';
      const justFinal = exc?.justificativa || '';
      const origemFinal = mat.origem_id || turmasOrigem.find(o => o.turma_id === turmaId && o.codigo_externo === mat.codigo_origem)?.origem_id || fallbackOrigem;

      const existente = frequencias.find(
        f => f.matricula_id === mat.matricula_id && f.data_aula === dataAula
      );

      if (existente) {
        atualizadosCount++;
        mapNovasFreqs[mat.matricula_id] = {
          ...existente,
          status: statusFinal,
          justificativa: justFinal,
          origem_id: origemFinal,
          atraso: exc?.atraso,
          celular: exc?.celular,
          observacao: exc?.observacao,
          atualizado_em: now,
        };
      } else {
        novosCount++;
        mapNovasFreqs[mat.matricula_id] = {
          frequencia_id: generateUuid(),
          matricula_id: mat.matricula_id,
          data_aula: dataAula,
          status: statusFinal,
          justificativa: justFinal,
          origem_id: origemFinal,
          atraso: exc?.atraso,
          celular: exc?.celular,
          observacao: exc?.observacao,
          criado_em: now,
          atualizado_em: now,
        };
      }

      if (exc?.atraso) {
        novasOcorrencias.push({
          ocorrencia_id: generateUuid(),
          matricula_id: mat.matricula_id,
          data_hora: `${dataAula}T19:00:00`,
          tipo: 'ATRASO',
          observacao: exc.observacao || 'Chegada após o início da supervisão',
        });
      }

      if (exc?.celular) {
        novasOcorrencias.push({
          ocorrencia_id: generateUuid(),
          matricula_id: mat.matricula_id,
          data_hora: `${dataAula}T19:30:00`,
          tipo: 'USO_INADEQUADO_DISPOSITIVO',
          observacao: exc.observacao || 'Uso indevido de smartphone durante discussão de caso clínico',
        });
      }
    });

    setFrequencias(prev => {
      const filtradas = prev.filter(
        f =>
          !(
            matriculasDaTurma.some(m => m.matricula_id === f.matricula_id) &&
            f.data_aula === dataAula
          )
      );
      return [...Object.values(mapNovasFreqs), ...filtradas];
    });

    if (novasOcorrencias.length > 0) {
      setOcorrencias(prev => [...novasOcorrencias, ...prev]);
    }

    const encontroAnterior = encontrosTurma.find(e => e.turma_id === turmaId && e.data === dataAula);
    const encontroAtualizado: EncontroTurma = {
      ...encontroAnterior,
      encontro_id: encontroAnterior?.encontro_id || generateUuid(),
      turma_id: turmaId,
      periodo_id: selectedPeriodoId,
      data: dataAula,
      status: 'REALIZADO',
      chamada_salva: true,
      total_presentes: Object.values(mapNovasFreqs).filter(f => f.status === 'PRESENTE').length,
      total_faltas: Object.values(mapNovasFreqs).filter(f => f.status !== 'PRESENTE').length,
      atualizado_em: now,
    };
    setEncontrosTurma(prev => {
      const idx = prev.findIndex(e => e.turma_id === turmaId && e.data === dataAula);
      if (idx < 0) return [...prev, encontroAtualizado];
      const copy = [...prev];
      copy[idx] = encontroAtualizado;
      return copy;
    });

    // 1. Persistência local imediata e segura em cache persistente (IndexedDB)
    const novasFreqsArray = Object.values(mapNovasFreqs);
    const todasFreqsAtualizadas = [
      ...novasFreqsArray,
      ...frequencias.filter(
        f => !(matriculasDaTurma.some(m => m.matricula_id === f.matricula_id) && f.data_aula === dataAula)
      ),
    ];
    await salvarTabelaUnicaNoIndexedDb('frequencias', todasFreqsAtualizadas).catch(err =>
      console.warn('Erro ao salvar frequências no IndexedDB:', err)
    );

    if (novasOcorrencias.length > 0) {
      await salvarTabelaUnicaNoIndexedDb('ocorrencias', [...novasOcorrencias, ...ocorrencias]).catch(err =>
        console.warn('Erro ao salvar ocorrencias no IndexedDB:', err)
      );
    }

    // 2. Persistência remota com tratamento rigoroso para token expirado / offline
    const token = await getAccessToken();
    let todasGravadasRemotamente = true;
    let houveTokenExpirado = false;

    if (!token) {
      todasGravadasRemotamente = false;
      // Enfileira na fila segura syncQueue com chave determinística (evita duplicidade)
      for (const freq of novasFreqsArray) {
        await salvarRegistroResiliente('frequencias', 'INSERT', freq);
      }
      for (const oc of novasOcorrencias) {
        await salvarRegistroResiliente('ocorrencias', 'INSERT', oc);
      }
    } else {
      // Tenta persistir diretamente no Google Sheets com confirmação remota
      for (const freq of novasFreqsArray) {
        try {
          const res = await salvarRegistroResiliente('frequencias', 'INSERT', freq);
          if (!res.gravadoOnline) {
            todasGravadasRemotamente = false;
          }
        } catch (err: any) {
          todasGravadasRemotamente = false;
          if (err?.message?.includes('Sessão expirada') || err?.message?.includes('401')) {
            houveTokenExpirado = true;
          }
        }
      }

      for (const oc of novasOcorrencias) {
        try {
          const res = await salvarRegistroResiliente('ocorrencias', 'INSERT', oc);
          if (!res.gravadoOnline) {
            todasGravadasRemotamente = false;
          }
        } catch (err: any) {
          todasGravadasRemotamente = false;
          if (err?.message?.includes('Sessão expirada') || err?.message?.includes('401')) {
            houveTokenExpirado = true;
          }
        }
      }
    }

    // Encerramento do encontro é uma escrita real e independente.
    // Se a rede não estiver disponível, fica na fila após as frequências;
    // não anunciar chamada sincronizada enquanto este marcador estiver pendente.
    try {
      const resEncontro = await salvarRegistroResiliente(
        'encontros_turma', encontroAnterior ? 'UPDATE' : 'INSERT', encontroAtualizado
      );
      if (!resEncontro.gravadoOnline) todasGravadasRemotamente = false;
    } catch (erro) {
      handleSaveError(erro);
      throw new Error('Frequências processadas, mas não foi possível garantir o fechamento do encontro. Verifique a fila de sincronização antes de tentar novamente.');
    }

    if (houveTokenExpirado) {
      setIsTokenExpired(true);
      setTokenExpiredAviso(
        'Sessão expirada do Google Workspace. Os dados da chamada foram preservados com segurança neste dispositivo. Reconecte para sincronizar com o Google Sheets.'
      );
      setSaveStatus('SALVO_LOCAL_AGUARDANDO_SYNC');
      setSaveStatusMessage('● Salvo neste dispositivo — aguardando sincronização');
      return {
        salvos: novosCount,
        atualizados: atualizadosCount,
        sincronizadoRemoto: false,
        salvoLocal: true,
        tokenExpirado: true,
        statusTexto: '● Salvo neste dispositivo — aguardando sincronização',
      };
    }

    if (todasGravadasRemotamente) {
      setIsTokenExpired(false);
      setTokenExpiredAviso(null);
      setSaveStatus('SINCRONIZADO_SHEETS');
      setSaveStatusMessage('✓ Sincronizado no Google Sheets');
      setTimeout(() => {
        setSaveStatus('IDLE');
        setSaveStatusMessage(null);
      }, 4000);
      return {
        salvos: novosCount,
        atualizados: atualizadosCount,
        sincronizadoRemoto: true,
        salvoLocal: true,
        tokenExpirado: false,
        statusTexto: '✓ Sincronizado no Google Sheets',
      };
    }

    // Salvo localmente na fila segura, aguardando sincronização
    setSaveStatus('SALVO_LOCAL_AGUARDANDO_SYNC');
    setSaveStatusMessage('● Salvo neste dispositivo — aguardando sincronização');
    return {
      salvos: novosCount,
      atualizados: atualizadosCount,
      sincronizadoRemoto: false,
      salvoLocal: true,
      tokenExpirado: false,
      statusTexto: '● Salvo neste dispositivo — aguardando sincronização',
    };
  };

  // ==========================================
  // OPERAÇÃO: DOCENTE ONLINE
  // ==========================================

  const getOrigemDoAluno = (matriculaId: string): TurmaOrigem | undefined => {
    const mat = matriculas.find(m => m.matricula_id === matriculaId);
    if (!mat) return undefined;
    if (mat.origem_id) {
      return turmasOrigem.find(o => o.origem_id === mat.origem_id);
    }
    if (mat.codigo_origem) {
      return turmasOrigem.find(o => o.turma_id === mat.turma_id && o.codigo_externo === mat.codigo_origem);
    }
    // Nunca atribuir silenciosamente um código de Docente Online arbitrário.
    const origens = turmasOrigem.filter(o => o.turma_id === mat.turma_id && o.ativo);
    return origens.length === 1 ? origens[0] : undefined;
  };

  const setOrigemDoAluno = async (matriculaId: string, origemId: string): Promise<void> => {
    const mat = matriculas.find(m => m.matricula_id === matriculaId);
    const origem = turmasOrigem.find(o => o.origem_id === origemId && o.turma_id === mat?.turma_id && o.ativo);
    if (!mat || !origem) throw new Error('Origem do Docente Online inválida para esta matrícula.');
    // A planilha matriculas atualmente não dispõe de origem_id/codigo_origem.
    // Não anunciar persistência de uma alteração que a fonte oficial não armazena.
    throw new Error('O vínculo individual do Docente Online requer coluna de origem na planilha matriculas. Nenhuma alteração foi salva.');
  };

  // ==========================================
  // OPERAÇÃO: CONSULTAS CONTEXTUAIS E NOTIFICAÇÕES
  // ==========================================

  const getSupervisaoAtual = useCallback((): ResultadoSupervisaoAtual => {
    const turmasDoPeriodo = getTurmasDoPeriodo(selectedPeriodoId);
    return identificarSupervisaoAtual(
      turmasDoPeriodo,
      horariosTurma,
      frequencias,
      encontrosTurma,
      matriculas
    );
  }, [getTurmasDoPeriodo, selectedPeriodoId, horariosTurma, frequencias, encontrosTurma, matriculas]);

  const getProximaSupervisao = useCallback((): ResultadoProximaSupervisao | null => {
    const turmasDoPeriodo = getTurmasDoPeriodo(selectedPeriodoId);
    return identificarProximaSupervisao(turmasDoPeriodo, horariosTurma, encontrosTurma);
  }, [getTurmasDoPeriodo, selectedPeriodoId, horariosTurma, encontrosTurma]);

  const getChamadasPendentes = useCallback((): ItemChamadaPendente[] => {
    const turmasDoPeriodo = getTurmasDoPeriodo(selectedPeriodoId);
    return identificarChamadasPendentes(
      turmasDoPeriodo,
      horariosTurma,
      frequencias,
      encontrosTurma,
      matriculas
    );
  }, [getTurmasDoPeriodo, selectedPeriodoId, horariosTurma, frequencias, encontrosTurma, matriculas]);

  const getNotificacoesDerivadas = useCallback((): NotificacaoDerivada[] => {
    const turmasDoPeriodo = getTurmasDoPeriodo(selectedPeriodoId);
    return derivarNotificacoesOperacionais(
      turmasDoPeriodo,
      matriculas,
      frequencias,
      documentos,
      registrosSemanais,
      marcosAcademicos,
      leiturasResponsaveis,
      encontrosTurma,
      horariosTurma,
      new Date(),
      periodos,
      selectedPeriodoId
    );
  }, [
    getTurmasDoPeriodo,
    selectedPeriodoId,
    matriculas,
    frequencias,
    documentos,
    registrosSemanais,
    marcosAcademicos,
    leiturasResponsaveis,
    encontrosTurma,
    horariosTurma,
    periodos,
  ]);

  // Resoluções manuais auditáveis e compartilhadas na tabela configuracoes.
  // A marcação é uma confirmação explícita da docente, não uma alteração da presença/RSS.
  const marcarPendenciaResolvida = async (item: ItemPendenciaOperacional): Promise<void> => {
    const chave = 'PENDENCIA_RESOLVIDA:' + item.id;
    if (configuracoes.some(c => c.chave === chave && c.periodo_id === selectedPeriodoId)) return;
    const novo: Configuracao = {
      configuracao_id: generateUuid(),
      chave,
      valor: JSON.stringify({ resolvido_em: new Date().toISOString(), titulo: item.titulo, tipo: item.tipo }),
      periodo_id: selectedPeriodoId,
      turma_id: item.turma_id,
    };
    const lista = [...configuracoes, novo];
    await persistirMudancaWeb('configuracoes', 'INSERT', novo, lista);
    setConfiguracoes(lista);
  };

  const getPendenciasCanonicas = useCallback((periodoId?: string): ItemPendenciaOperacional[] => {
    const pId = periodoId || selectedPeriodoId;
    const pendencias = gerarPendenciasCanonicas(
      pId,
      turmas,
      matriculas,
      alunos,
      frequencias,
      documentosPendentesOficiais(entregas, documentos),
      registrosSemanais,
      orientacoes,
      marcosAcademicos,
      leiturasResponsaveis,
      encontrosTurma,
      horariosTurma,
      regrasRss,
      situacaoAtualTurmas,
      calendarioRss,
      statusRssUnidades,
      new Date(),
      gruposPratica,
      grupoIntegrantes
    );
    // RSS atrasado/não enviado NÃO é pendência nem notificação: aparece só na turma e na ficha.
    // (A regra de cálculo permanece em gerarPendenciasCanonicas, coberta por testes, para uso nessas telas.)
    const semRss = pendencias.filter(p => p.tipo !== 'RSS_ATRASADO');
    return filtrarPendenciasResolvidas(semRss, configuracoes, pId);
  }, [
    selectedPeriodoId,
    turmas,
    matriculas,
    alunos,
    frequencias,
    documentos,
    entregas,
    registrosSemanais,
    orientacoes,
    marcosAcademicos,
    leiturasResponsaveis,
    encontrosTurma,
    horariosTurma,
    regrasRss,
    situacaoAtualTurmas,
    calendarioRss,
    statusRssUnidades,
    gruposPratica,
    grupoIntegrantes,
    configuracoes
  ]);

  // A visão diária e a área de pendências usam UM ÚNICO cálculo de RSS.
  // Lacunas antigas ficam nas fichas, sem se tornarem novas urgências.
  const getPendenciasOperacionais = useCallback(
    (): ItemPendenciaOperacional[] => getPendenciasCanonicas(),
    [getPendenciasCanonicas]
  );


  const tabelasParaBackup = (): TabelasBackup => ({
        periodos,
        disciplinas,
        turmas,
        alunos,
        matriculas,
        orientacoes,
        registros_semanais: registrosSemanais,
        documentos,
        avaliacoes,
        feedback_alunos: feedbacks,
        criterios_avaliacao: criterios,
        ocorrencias,
        configuracoes,
        turmas_origem: turmasOrigem,
        frequencias,
        horarios_turma: horariosTurma,
        pontos_acompanhamento: pontosAcompanhamento,
        marcos_academicos: marcosAcademicos,
        regras_rss: regrasRss,
        calendario_rss: calendarioRss,
        status_rss_unidades: statusRssUnidades,
        situacao_atual_turmas: situacaoAtualTurmas,
        leituras_responsaveis: leiturasResponsaveis,
        regras_prazo: regrasPrazo,
        grupos_pratica: gruposPratica,
        grupo_integrantes: grupoIntegrantes,
        entregas,
        feedbacks: feedbacksOficiais,
        registros_supervisao: registrosSupervisao,
        config_avaliacao: configAvaliacao,
        rubricas_avaliacao: rubricasAvaliacao,
        avaliacao_rascunhos: rascunhosAvaliacao,
        evidencias_avaliacao: evidenciasAvaliacao,
        rss_ajustes: rssAjustes,
        sincronizacao,
        dicionario_dados: dicionarioDados,
        contrato_app: contratoApp,
        mapeamento_fontes: mapeamentoFontes,
        auditoria_base: auditoriaBase,
  }) as unknown as TabelasBackup;

  const exportDatabaseAsJson = async (): Promise<string> =>
    JSON.stringify(await gerarBackup(tabelasParaBackup()), null, 2);

  /** Confere o arquivo (somente leitura) e lista o que difere dos dados atuais. */
  const conferirBackup = async (bruto: unknown): Promise<{ relatorio: RelatorioBackup; diferencas: DiferencaRegistro[] }> => {
    const relatorio = await validarBackup(bruto);
    const diferencas = relatorio.ok ? compararComBackup((bruto as ArquivoBackup).tables, tabelasParaBackup()) : [];
    return { relatorio, diferencas };
  };

  /** Restaura UM registro pelo mesmo caminho das demais gravações (fila, coordenador, log). */
  const restaurarRegistroDoBackup = async (d: DiferencaRegistro): Promise<void> => {
    const op = operacaoDeRestauracao(d);
    await persistirMudancaWeb(d.tabela, op.tipo, op.registro, []);
  };

  return (
    <SupervisaoContext.Provider
      value={{
        confirmacaoExclusaoModal,
        solicitarConfirmacaoExclusao,
        fecharConfirmacaoExclusao,
        itemExcluidoRecente,
        desfazerUltimaExclusao,
        limparItemDesfazer,
        periodos,
        disciplinas,
        turmas,
        alunos,
        matriculas,
        orientacoes,
        registrosSemanais,
        documentos,
        avaliacoes,
        feedbacks,
        criterios,
        ocorrencias,
        configuracoes,
        turmasOrigem,
        frequencias,
        horariosTurma,
        pontosAcompanhamento,
        marcosAcademicos,
        // 12 Tabelas Adicionais Normalizadas
        regrasRss,
        calendarioRss,
        statusRssUnidades,
        situacaoAtualTurmas,
        leiturasResponsaveis,
        regrasPrazo,
        gruposPratica,
        grupoIntegrantes,
        entregas,
        feedbacksOficiais,
        registrosSupervisao,
        sincronizacao,
        // Documentação e Contrato da Base Oficial
        dicionarioDados,
        contratoApp,
        mapeamentoFontes,
        auditoriaBase,
        selectedPeriodoId,
        setSelectedPeriodoId,
        spreadsheetId: OFFICIAL_SPREADSHEET_ID,
        spreadsheetName: OFFICIAL_SPREADSHEET_NAME,
        spreadsheetUrl: OFFICIAL_SPREADSHEET_URL,
        currentUser,
        perfilServidor,
        monitoramentoDocumentos,
        acessoGoogleValidado,
        isLoggingIn,
        loginGoogle,
        logoutGoogle,
        hasLocalCache,
        syncStatusState,
        sincronizarAgora,
        connectionStatus,
        connectionErrorMessage,
        saveStatus,
        saveErrorMessage,
        saveStatusMessage,
        isTokenExpired,
        tokenExpiredAviso,
        reconectarESincronizar,
        recarregarDados: carregarDadosReais,
        addTurma,
        updateTurma,
        toggleArchiveTurma,
        addOrientacao,
        toggleOrientacaoStatus,
        deleteOrientacao,
        addFeedback,
        deleteFeedback,
        addOcorrencia,
        deleteOcorrencia,
        addPontoAcompanhamento,
        togglePontoStatus,
        deletePontoAcompanhamento,
        updateRegistroSemanal,
        updateDocumento,
        addDocumento,
        addFrequencia,
        updateFrequenciaStatus,
        saveAvaliacao,
        createNovoPeriodo,
        importarAlunosLote,
        // Suporte estrutural e regras canônicas da base
        isTurmaClinicaAmpliada,
        getStatusRssUnidade,
        getSituacaoTurma,
        getCriteriosDaTurma,
        addRegistroSupervisao,
        addEntrega,
        marcarEntrega,
        getResumoAlunoSupervisao,
        getSituacaoRssEstudante,
        getTurmasDoPeriodo,
        getAlunosDaTurma,
        // Componentes de apoio / filas / avaliação
        caixaEntrada,
        itensOperacionaisLocaisPendentes,
        importarItensOperacionaisLocais,
        addCaixaEntradaItem,
        confirmarCaixaEntradaItem,
        descartarCaixaEntradaItem,
        filaProfessora,
        addItemFilaProfessora,
        toggleStatusFilaProfessora,
        deleteItemFilaProfessora,
        filaSupervisao,
        addItemFilaSupervisao,
        updateStatusFilaSupervisao,
        removerItemFilaSupervisao,
        avaliacoesCompletas,
        salvarAvaliacaoCompleta,
        aprovarDevolutiva,
        registrarEnvioDevolutiva,
        registrarAuditoria,
        // Operação: Encontros, Aulas Não Realizadas e Reagendamentos
        encontrosTurma,
        preparacoesAula,
        configAvaliacao,
        rubricasAvaliacao,
        rascunhosAvaliacao,
        evidenciasAvaliacao,
        rssAjustes,
        salvarLinhaAvaliacao,
        adicionarPreparacaoAula,
        alterarPreparacaoAula,
        excluirPreparacaoAula,
        marcarEncontroNaoRealizado,
        reagendarEncontro,
        reverterNaoRealizadoOuReagendado,
        atualizarStatusEstudoDirigido,
        salvarChamadaPorExcecao,
        getOrigemDoAluno,
        setOrigemDoAluno,
        getSupervisaoAtual,
        getProximaSupervisao,
        getChamadasPendentes,
        getNotificacoesDerivadas,
        getPendenciasOperacionais,
        getPendenciasCanonicas,
    marcarPendenciaResolvida,
        exportDatabaseAsJson,
        conferirBackup,
        restaurarRegistroDoBackup,
      }}
    >
      {children}
    </SupervisaoContext.Provider>
  );
};

export const useSupervisao = () => {
  const context = useContext(SupervisaoContext);
  if (!context) {
    throw new Error('useSupervisao deve ser usado dentro de um SupervisaoProvider');
  }
  return context;
};
