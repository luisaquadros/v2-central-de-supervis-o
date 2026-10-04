import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
} from '../types';
import { validarEscritaTabela, gerarIdEstavel } from '../services/safeWriteService';
import {
  inicializarCacheLocal,
  sincronizarDaBaseOficial,
  salvarRegistroResiliente,
  subscribeSyncStatus,
  SyncStatusState,
} from '../services/syncService';
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
import {
  isRunningInAppsScript,
  carregarDadosDoSheets,
  salvarOrientacaoNoSheets,
  toggleOrientacaoStatusNoSheets,
  deleteOrientacaoNoSheets,
  salvarFeedbackNoSheets,
  deleteFeedbackNoSheets,
  salvarOcorrenciaNoSheets,
  deleteOcorrenciaNoSheets,
  salvarPontoAcompanhamentoNoSheets,
  togglePontoStatusNoSheets,
  deletePontoAcompanhamentoNoSheets,
  salvarRegistroSemanalNoSheets,
  salvarDocumentoNoSheets,
  updateDocumentoNoSheets,
  salvarFrequenciaNoSheets,
  updateFrequenciaStatusNoSheets,
  salvarAvaliacaoNoSheets,
  salvarTurmaNoSheets,
  arquivarTurmaNoSheets,
  salvarNovoPeriodoNoSheets,
  importarAlunosLoteNoSheets,
  OFFICIAL_SPREADSHEET_ID,
  OFFICIAL_SPREADSHEET_NAME,
  OFFICIAL_SPREADSHEET_URL,
  DadosIniciaisGas,
} from '../services/gasService';
import type { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  carregarDadosDaPlanilhaOficial,
} from '../services/googleSheetsService';

export type ConnectionStatus = 'CARREGANDO' | 'CONECTADO' | 'ERRO_CONEXAO' | 'LOCAL_DEV';
export type SaveStatus = 'IDLE' | 'SALVANDO' | 'SALVO' | 'ERRO_SALVAR';

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
  isLoggingIn: boolean;
  loginGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;

  // Status de conexão, sincronização e persistência
  hasLocalCache: boolean;
  connectionStatus: ConnectionStatus;
  connectionErrorMessage: string | null;
  saveStatus: SaveStatus;
  saveErrorMessage: string | null;
  syncStatusState: SyncStatusState;
  sincronizarAgora: () => Promise<void>;
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

  // Consultas
  getResumoAlunoSupervisao: (matriculaId: string) => AlunoResumoSupervisao | null;
  getTurmasDoPeriodo: (periodoId?: string, incluirArquivadas?: boolean) => Turma[];
  getAlunosDaTurma: (turmaId: string) => { matricula: Matricula; aluno: Aluno }[];

  // Componentes de Apoio / Fila / Avaliação
  caixaEntrada: CaixaEntradaItem[];
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
  
  // Backup / Export
  resetDatabaseToSeed: () => void;
  exportDatabaseAsJson: () => string;
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Status de conexão e gravação
  const [hasLocalCache, setHasLocalCache] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CARREGANDO');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('IDLE');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

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
  const [caixaEntrada, setCaixaEntrada] = useState<CaixaEntradaItem[]>([]);
  const [filaProfessora, setFilaProfessora] = useState<ItemFilaProfessora[]>([]);
  const [filaSupervisao, setFilaSupervisao] = useState<ItemFilaSupervisao[]>([]);
  const [avaliacoesCompletas, setAvaliacoesCompletas] = useState<AvaliacaoCompleta[]>([]);
  const [auditoriaApp, setAuditoriaApp] = useState<HistoricoAuditoria[]>([]);

  // Helper para aplicar dados recebidos das 30 tabelas normalizadas
  // NUNCA substitui dados válidos por arrays vazios caso uma tabela falhe ou venha incompleta
  const aplicarDados = useCallback((data: DadosIniciaisGas) => {
    if (data.periodos && data.periodos.length > 0) {
      setPeriodos(data.periodos);
      setSelectedPeriodoId(prev => {
        if (prev && data.periodos.some((p: Periodo) => p.periodo_id === prev)) return prev;
        const periodoAtivo = data.periodos.find((p: Periodo) => p.status === 'ATIVO') || data.periodos[0];
        return periodoAtivo ? periodoAtivo.periodo_id : '';
      });
    }
    if (data.disciplinas && data.disciplinas.length > 0) setDisciplinas(data.disciplinas);
    if (data.turmas && data.turmas.length > 0) setTurmas(data.turmas);
    if (data.horarios && data.horarios.length > 0) setHorariosTurma(data.horarios);
    if (data.turmasOrigem && data.turmasOrigem.length > 0) setTurmasOrigem(data.turmasOrigem);
    if (data.alunos && data.alunos.length > 0) setAlunos(data.alunos);
    if (data.matriculas && data.matriculas.length > 0) setMatriculas(data.matriculas);
    if (data.orientacoes && data.orientacoes.length > 0) setOrientacoes(data.orientacoes);
    if (data.criterios && data.criterios.length > 0) setCriterios(data.criterios);
    if (data.configuracoes && data.configuracoes.length > 0) setConfiguracoes(data.configuracoes);
    if (data.marcos && data.marcos.length > 0) setMarcosAcademicos(data.marcos);
    if (data.pontosAcompanhamento && data.pontosAcompanhamento.length > 0) setPontosAcompanhamento(data.pontosAcompanhamento);
    if (data.frequencias && data.frequencias.length > 0) setFrequencias(data.frequencias);
    if (data.documentos && data.documentos.length > 0) setDocumentos(data.documentos);
    if (data.registrosSemanais && data.registrosSemanais.length > 0) setRegistrosSemanais(data.registrosSemanais);
    if (data.avaliacoes && data.avaliacoes.length > 0) setAvaliacoes(data.avaliacoes);
    if (data.feedbacks && data.feedbacks.length > 0) setFeedbacks(data.feedbacks);
    if (data.ocorrencias && data.ocorrencias.length > 0) setOcorrencias(data.ocorrencias);
    // 12 Tabelas Adicionais
    if (data.regrasRss && data.regrasRss.length > 0) setRegrasRss(data.regrasRss);
    if (data.calendarioRss && data.calendarioRss.length > 0) setCalendarioRss(data.calendarioRss);
    if (data.statusRssUnidades && data.statusRssUnidades.length > 0) setStatusRssUnidades(data.statusRssUnidades);
    if (data.situacaoAtualTurmas && data.situacaoAtualTurmas.length > 0) setSituacaoAtualTurmas(data.situacaoAtualTurmas);
    if (data.leiturasResponsaveis && data.leiturasResponsaveis.length > 0) setLeiturasResponsaveis(data.leiturasResponsaveis);
    if (data.regrasPrazo && data.regrasPrazo.length > 0) setRegrasPrazo(data.regrasPrazo);
    if (data.gruposPratica && data.gruposPratica.length > 0) setGruposPratica(data.gruposPratica);
    if (data.grupoIntegrantes && data.grupoIntegrantes.length > 0) setGrupoIntegrantes(data.grupoIntegrantes);
    if (data.entregas && data.entregas.length > 0) setEntregas(data.entregas);
    if (data.feedbacksOficiais && data.feedbacksOficiais.length > 0) setFeedbacksOficiais(data.feedbacksOficiais);
    if (data.registrosSupervisao && data.registrosSupervisao.length > 0) setRegistrosSupervisao(data.registrosSupervisao);
    if (data.sincronizacao && data.sincronizacao.length > 0) setSincronizacao(data.sincronizacao);
    if (data.dicionarioDados && data.dicionarioDados.length > 0) setDicionarioDados(data.dicionarioDados);
    if (data.contratoApp && data.contratoApp.length > 0) setContratoApp(data.contratoApp);
    if (data.mapeamentoFontes && data.mapeamentoFontes.length > 0) setMapeamentoFontes(data.mapeamentoFontes);
    if (data.auditoriaBase && data.auditoriaBase.length > 0) setAuditoriaBase(data.auditoriaBase);
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
        sincronizarDaBaseOficial().then(res => {
          if (!isMounted) return;
          if (res.sucesso && res.dados) {
            aplicarDados(res.dados);
            setHasLocalCache(true);
            setConnectionStatus('CONECTADO');
          }
        });
      },
      () => {
        if (!isMounted) return;
        setCurrentUser(null);
      }
    );
    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [aplicarDados]);

  // 3. SINCRONIZAÇÃO DA BASE OFICIAL
  const sincronizarAgora = useCallback(async () => {
    setConnectionStatus('CARREGANDO');
    setConnectionErrorMessage(null);

    // Se estiver rodando dentro do Apps Script
    if (isRunningInAppsScript()) {
      try {
        const data = await carregarDadosDoSheets();
        aplicarDados(data);
        setHasLocalCache(true);
        setConnectionStatus('CONECTADO');
      } catch (err: any) {
        setConnectionStatus('ERRO_CONEXAO');
        setConnectionErrorMessage(err?.message || 'Falha na leitura da Planilha Google.');
      }
      return;
    }

    // Ambiente Web / AI Studio
    const res = await sincronizarDaBaseOficial();
    if (res.sucesso && res.dados) {
      aplicarDados(res.dados);
      setHasLocalCache(true);
      setConnectionStatus('CONECTADO');
    } else {
      setConnectionErrorMessage(res.erro || 'Falha ao sincronizar com Google Sheets');
      if (hasLocalCache) {
        setConnectionStatus('CONECTADO');
      } else {
        setConnectionStatus('ERRO_CONEXAO');
      }
    }
  }, [aplicarDados, hasLocalCache]);

  const carregarDadosReais = sincronizarAgora;

  const loginGoogle = async () => {
    setIsLoggingIn(true);
    setConnectionErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        await sincronizarAgora();
      }
    } catch (err: any) {
      console.error('Erro de login Google:', err);
      setConnectionErrorMessage(err?.message || 'Falha ao autenticar com Google');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logoutGoogle = async () => {
    await googleLogout();
    setCurrentUser(null);
    setConnectionStatus('LOCAL_DEV');
  };

  const notifySaveSuccess = () => {
    setSaveStatus('SALVO');
    setTimeout(() => setSaveStatus('IDLE'), 2500);
  };

  const handleSaveError = (err: any) => {
    console.error('Erro de persistência:', err);
    setSaveStatus('ERRO_SALVAR');
    setSaveErrorMessage(err?.message || 'Erro ao sincronizar com Google Sheets');
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

    if (isRunningInAppsScript()) {
      try {
        const turmaSalva = await salvarTurmaNoSheets({
          ...novaTurma,
          horarios: dados.horarios?.map(h => ({
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio,
            hora_fim: h.hora_fim,
            data_inicio: '2026-08-01',
            data_fim: '2026-12-20',
            ativo: true,
          })),
          origens: dados.origens?.map(o => ({
            sistema: o.sistema || 'Docente Online',
            codigo_externo: o.codigo_externo,
            nome_externo: o.nome_externo || dados.nome,
            ativo: true,
          })),
        });
        setTurmas(prev => [...prev, turmaSalva]);
        if (novosHorarios.length > 0) setHorariosTurma(prev => [...prev, ...novosHorarios]);
        if (novasOrigens.length > 0) setTurmasOrigem(prev => [...prev, ...novasOrigens]);
        notifySaveSuccess();
        return turmaSalva;
      } catch (err) {
        handleSaveError(err);
        throw err;
      }
    } else {
      setTurmas(prev => [...prev, novaTurma]);
      if (novosHorarios.length > 0) setHorariosTurma(prev => [...prev, ...novosHorarios]);
      if (novasOrigens.length > 0) setTurmasOrigem(prev => [...prev, ...novasOrigens]);
      notifySaveSuccess();
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
    const statusTurma = dados.status || 'ATIVO';

    if (isRunningInAppsScript()) {
      try {
        await salvarTurmaNoSheets({
          turma_id: turmaId,
          periodo_id: selectedPeriodoId,
          disciplina_id: dados.disciplina_id,
          nome: dados.nome,
          turno: dados.turno,
          status: statusTurma,
        });
      } catch (err) {
        handleSaveError(err);
        throw err;
      }
    }

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
      setTurmasOrigem(prev => [...prev.filter(o => o.turma_id !== turmaId), ...novasOrigens]);
    }

    notifySaveSuccess();
  };

  const toggleArchiveTurma = async (turmaId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const turma = turmas.find(t => t.turma_id === turmaId);
    if (!turma) return;
    const novoStatus = turma.status === 'ARQUIVADO' ? 'ATIVO' : 'ARQUIVADO';

    if (isRunningInAppsScript()) {
      try {
        await arquivarTurmaNoSheets(turmaId, novoStatus);
      } catch (err) {
        handleSaveError(err);
        throw err;
      }
    }

    setTurmas(prev =>
      prev.map(t => (t.turma_id === turmaId ? { ...t, status: novoStatus } : t))
    );
    notifySaveSuccess();
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

    if (isRunningInAppsScript()) {
      try {
        const salvaNoSheets = await salvarOrientacaoNoSheets({
          matricula_id: matriculaId,
          categoria,
          texto,
          status,
        });
        setOrientacoes(prev => [salvaNoSheets, ...prev]);
        notifySaveSuccess();
        return salvaNoSheets;
      } catch (err: any) {
        handleSaveError(err);
        throw err;
      }
    } else {
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
      notifySaveSuccess();
      return newOri;
    }
  };

  const toggleOrientacaoStatus = async (orientacaoId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();
    const ori = orientacoes.find(o => o.orientacao_id === orientacaoId);
    const novoStatus = ori?.status === 'ABERTA' ? 'CONCLUÍDA' : 'ABERTA';

    if (isRunningInAppsScript()) {
      try {
        await toggleOrientacaoStatusNoSheets(orientacaoId, novoStatus);
      } catch (err) {
        handleSaveError(err);
      }
    }

    setOrientacoes(prev =>
      prev.map(o =>
        o.orientacao_id === orientacaoId
          ? { ...o, status: novoStatus, atualizado_em: now }
          : o
      )
    );
    notifySaveSuccess();
  };

  const deleteOrientacao = async (orientacaoId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    if (isRunningInAppsScript()) {
      try {
        await deleteOrientacaoNoSheets(orientacaoId);
      } catch (err) {
        handleSaveError(err);
      }
    }
    setOrientacoes(prev => prev.filter(ori => ori.orientacao_id !== orientacaoId));
    notifySaveSuccess();
  };

  // ==========================================
  // FEEDBACKS
  // ==========================================

  const addFeedback = async (matriculaId: string, texto: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();

    if (isRunningInAppsScript()) {
      try {
        const salvo = await salvarFeedbackNoSheets({ matricula_id: matriculaId, texto });
        setFeedbacks(prev => [salvo, ...prev]);
        notifySaveSuccess();
        return;
      } catch (err) {
        handleSaveError(err);
      }
    }

    const newFeedback: FeedbackAluno = {
      feedback_id: generateUuid(),
      matricula_id: matriculaId,
      data_hora: now,
      texto,
    };
    setFeedbacks(prev => [newFeedback, ...prev]);
    notifySaveSuccess();
  };

  const deleteFeedback = async (feedbackId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    if (isRunningInAppsScript()) {
      try {
        await deleteFeedbackNoSheets(feedbackId);
      } catch (err) {
        handleSaveError(err);
      }
    }
    setFeedbacks(prev => prev.filter(fb => fb.feedback_id !== feedbackId));
    notifySaveSuccess();
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

    if (isRunningInAppsScript()) {
      try {
        const salvo = await salvarOcorrenciaNoSheets({ matricula_id: matriculaId, tipo, observacao });
        setOcorrencias(prev => [salvo, ...prev]);
        notifySaveSuccess();
        return;
      } catch (err) {
        handleSaveError(err);
      }
    }

    const newOcorrencia: Ocorrencia = {
      ocorrencia_id: generateUuid(),
      matricula_id: matriculaId,
      data_hora: now,
      tipo,
      observacao,
    };
    setOcorrencias(prev => [newOcorrencia, ...prev]);
    notifySaveSuccess();
  };

  const deleteOcorrencia = async (ocorrenciaId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    if (isRunningInAppsScript()) {
      try {
        await deleteOcorrenciaNoSheets(ocorrenciaId);
      } catch (err) {
        handleSaveError(err);
      }
    }
    setOcorrencias(prev => prev.filter(oc => oc.ocorrencia_id !== ocorrenciaId));
    notifySaveSuccess();
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
    const today = new Date().toISOString().split('T')[0];

    if (isRunningInAppsScript()) {
      try {
        const salvo = await salvarPontoAcompanhamentoNoSheets({ matricula_id: matriculaId, texto, prioridade });
        setPontosAcompanhamento(prev => [salvo, ...prev]);
        notifySaveSuccess();
        return;
      } catch (err) {
        handleSaveError(err);
      }
    }

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
    notifySaveSuccess();
  };

  const togglePontoStatus = async (pontoId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    const today = new Date().toISOString().split('T')[0];
    const ponto = pontosAcompanhamento.find(p => p.ponto_id === pontoId);
    const novoStatus = ponto?.status === 'ATIVO' ? 'CONCLUIDO' : 'ATIVO';
    const dataConclusao = novoStatus === 'CONCLUIDO' ? today : undefined;

    if (isRunningInAppsScript()) {
      try {
        await togglePontoStatusNoSheets(pontoId, novoStatus, dataConclusao);
      } catch (err) {
        handleSaveError(err);
      }
    }

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
    notifySaveSuccess();
  };

  const deletePontoAcompanhamento = async (pontoId: string): Promise<void> => {
    setSaveStatus('SALVANDO');
    if (isRunningInAppsScript()) {
      try {
        await deletePontoAcompanhamentoNoSheets(pontoId);
      } catch (err) {
        handleSaveError(err);
      }
    }
    setPontosAcompanhamento(prev => prev.filter(p => p.ponto_id !== pontoId));
    notifySaveSuccess();
  };

  // ==========================================
  // REGISTROS SEMANAIS & DOCUMENTOS
  // ==========================================

  const updateRegistroSemanal = async (
    matriculaId: string,
    semana: number,
    status: 'ENTREGUE' | 'FALTANTE' | 'PENDENTE_REVISAO',
    obs: string = ''
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const today = new Date().toISOString().split('T')[0];

    if (isRunningInAppsScript()) {
      try {
        await salvarRegistroSemanalNoSheets({ matricula_id: matriculaId, semana, status, observacao: obs });
      } catch (err) {
        handleSaveError(err);
      }
    }

    setRegistrosSemanais(prev => {
      const existingIdx = prev.findIndex(r => r.matricula_id === matriculaId && r.semana === semana);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          status,
          data_entrega: status === 'ENTREGUE' ? today : '',
          observacao: obs,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            registro_id: generateUuid(),
            matricula_id: matriculaId,
            semana,
            status,
            data_entrega: status === 'ENTREGUE' ? today : '',
            observacao: obs,
          },
        ];
      }
    });
    notifySaveSuccess();
  };

  const updateDocumento = async (
    documentoId: string,
    status: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE',
    obs?: string
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const today = new Date().toISOString().split('T')[0];

    if (isRunningInAppsScript()) {
      try {
        await updateDocumentoNoSheets(documentoId, status, obs);
      } catch (err) {
        handleSaveError(err);
      }
    }

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
    notifySaveSuccess();
  };

  const addDocumento = async (
    matriculaId: string,
    tipo: string,
    status: 'ENTREGUE' | 'PENDENTE' | 'EM_ANALISE' = 'PENDENTE',
    obs: string = ''
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const today = new Date().toISOString().split('T')[0];

    if (isRunningInAppsScript()) {
      try {
        const salvo = await salvarDocumentoNoSheets({ matricula_id: matriculaId, tipo, status, observacao: obs });
        setDocumentos(prev => [...prev, salvo]);
        notifySaveSuccess();
        return;
      } catch (err) {
        handleSaveError(err);
      }
    }

    const newDoc: Documento = {
      documento_id: generateUuid(),
      matricula_id: matriculaId,
      tipo,
      status,
      data_entrega: status === 'ENTREGUE' ? today : '',
      observacao: obs,
    };
    setDocumentos(prev => [...prev, newDoc]);
    notifySaveSuccess();
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

    if (isRunningInAppsScript()) {
      try {
        const salvo = await salvarFrequenciaNoSheets({
          matricula_id: matriculaId,
          data_aula: dataAula,
          status,
          justificativa,
          origem_id: origemId,
        });
        setFrequencias(prev => [salvo, ...prev]);
        notifySaveSuccess();
        return;
      } catch (err) {
        handleSaveError(err);
      }
    }

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
    notifySaveSuccess();
  };

  const updateFrequenciaStatus = async (
    frequenciaId: string,
    status: Frequencia['status'],
    justificativa?: string
  ): Promise<void> => {
    setSaveStatus('SALVANDO');
    const now = new Date().toISOString();

    if (isRunningInAppsScript()) {
      try {
        await updateFrequenciaStatusNoSheets(frequenciaId, status, justificativa);
      } catch (err) {
        handleSaveError(err);
      }
    }

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
    notifySaveSuccess();
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

    if (isRunningInAppsScript()) {
      try {
        await salvarAvaliacaoNoSheets({ matricula_id: matriculaId, criterio_id: criterioId, nota, observacao });
      } catch (err) {
        handleSaveError(err);
      }
    }

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
            avaliacao_id: generateUuid(),
            matricula_id: matriculaId,
            criterio_id: criterioId,
            nota,
            observacao,
          },
        ];
      }
    });
    notifySaveSuccess();
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
      periodo_id: newPeriodoId,
      nome,
      data_inicio: dataInicio,
      data_fim: dataFim,
      status: 'PLANEJADO',
    };

    if (isRunningInAppsScript()) {
      try {
        await salvarNovoPeriodoNoSheets({
          nome,
          data_inicio: dataInicio,
          data_fim: dataFim,
          copiarTurmasDePeriodoId,
        });
      } catch (err) {
        handleSaveError(err);
      }
    }

    setPeriodos(prev => [...prev, newPeriodo]);

    if (copiarTurmasDePeriodoId) {
      const turmasAntigas = turmas.filter(t => t.periodo_id === copiarTurmasDePeriodoId);
      const novasTurmas: Turma[] = turmasAntigas.map(t => ({
        ...t,
        turma_id: generateUuid(),
        periodo_id: newPeriodoId,
        status: 'ATIVO',
      }));
      setTurmas(prev => [...prev, ...novasTurmas]);

      const criteriosAntigos = criterios.filter(c => c.periodo_id === copiarTurmasDePeriodoId);
      const novosCriterios: CriterioAvaliacao[] = criteriosAntigos.map(c => ({
        ...c,
        criterio_id: generateUuid(),
        periodo_id: newPeriodoId,
      }));
      setCriterios(prev => [...prev, ...novosCriterios]);
    }

    notifySaveSuccess();
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

    if (isRunningInAppsScript()) {
      try {
        const res = await importarAlunosLoteNoSheets({
          turma_id: turmaId,
          periodo_id: turmaAlvo.periodo_id,
          alunos: novosAlunos,
        });
        await carregarDadosReais();
        return res;
      } catch (err) {
        handleSaveError(err);
      }
    }

    const alunosCriados: Aluno[] = [];
    const matriculasCriadas: Matricula[] = [];

    novosAlunos.forEach(item => {
      const cleanNome = item.nome.trim();
      const cleanRa = item.identificador_academico.trim();
      if (!cleanNome) return;

      const existingAluno = alunos.find(
        a => a.identificador_academico.toLowerCase() === cleanRa.toLowerCase()
      );

      let targetAlunoId: string;

      if (existingAluno) {
        targetAlunoId = existingAluno.aluno_id;
        const jaMatriculado = matriculas.some(
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
          identificador_academico: cleanRa || `RA${Date.now()}`,
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

    if (alunosCriados.length > 0) setAlunos(prev => [...prev, ...alunosCriados]);
    if (matriculasCriadas.length > 0) setMatriculas(prev => [...prev, ...matriculasCriadas]);

    notifySaveSuccess();
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
        const integrante = grupoIntegrantes.find(gi => gi.matricula_id === matriculaId || (mat && gi.aluno_id === mat.aluno_id));
        targetGrupoId = integrante?.grupo_id;
      }
      if (targetGrupoId) {
        return statusRssUnidades.find(s =>
          (s.turma_id === turmaId || !s.turma_id) &&
          s.unidade_id === targetGrupoId &&
          (s.unidade_tipo === 'GRUPO' || !s.unidade_tipo)
        );
      }
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
  }, [isTurmaClinicaAmpliada, matriculas, grupoIntegrantes, statusRssUnidades]);

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
      const docs = entregas.length > 0
        ? entregas.filter(e => mats.includes(e.matricula_id || '') && e.status_entrega !== 'ENTREGUE').length
        : documentos.filter(d => mats.includes(d.matricula_id) && d.status === 'PENDENTE').length;
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
    };
    await salvarRegistroResiliente('registros_supervisao', 'INSERT', novoRegistro, [novoRegistro, ...registrosSupervisao]);
    setRegistrosSupervisao(prev => [novoRegistro, ...prev]);
    notifySaveSuccess();
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
      data_entrega: statusEntrega === 'ENTREGUE' ? new Date().toISOString().split('T')[0] : '',
      observacao: obs,
    };
    await salvarRegistroResiliente('entregas', 'INSERT', novaEntrega, [novaEntrega, ...entregas]);
    setEntregas(prev => [novaEntrega, ...prev]);
    notifySaveSuccess();
    return novaEntrega;
  };

  // Métodos de apoio / transição
  const addCaixaEntradaItem = async (item: any) => {
    const novo = { id: gerarIdEstavel('cx'), criado_em: new Date().toISOString(), status: 'PENDENTE' as const, ...item };
    setCaixaEntrada(prev => [novo, ...prev]);
  };
  const confirmarCaixaEntradaItem = async (id: string, updates?: any) => {
    setCaixaEntrada(prev => prev.map(i => i.id === id ? { ...i, status: 'CONFIRMADO' as const, ...(updates || {}) } : i));
  };
  const descartarCaixaEntradaItem = async (id: string) => {
    setCaixaEntrada(prev => prev.map(i => i.id === id ? { ...i, status: 'DESCARTADO' as const } : i));
  };

  const addItemFilaProfessora = async (item: any) => {
    const novo = { id: gerarIdEstavel('fp'), criado_em: new Date().toISOString(), status: 'PENDENTE' as const, ...item };
    setFilaProfessora(prev => [novo, ...prev]);
  };
  const toggleStatusFilaProfessora = async (id: string) => {
    setFilaProfessora(prev => prev.map(i => i.id === id ? { ...i, status: i.status === 'CONCLUIDO' ? 'PENDENTE' as const : 'CONCLUIDO' as const } : i));
  };
  const deleteItemFilaProfessora = async (id: string) => {
    setFilaProfessora(prev => prev.filter(i => i.id !== id));
  };

  const addItemFilaSupervisao = async (item: any) => {
    const novo = { id: gerarIdEstavel('fs'), criado_em: new Date().toISOString(), status: 'AGUARDANDO' as const, ordem: filaSupervisao.length + 1, ...item };
    setFilaSupervisao(prev => [...prev, novo]);
  };
  const updateStatusFilaSupervisao = async (id: string, status: any) => {
    setFilaSupervisao(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };
  const removerItemFilaSupervisao = async (id: string) => {
    setFilaSupervisao(prev => prev.filter(i => i.id !== id));
  };

  const salvarAvaliacaoCompleta = async (avaliacao: any) => {
    const id = avaliacao.avaliacao_id || gerarIdEstavel('av_c');
    const item: AvaliacaoCompleta = { ...avaliacao, avaliacao_id: id, atualizado_em: new Date().toISOString() };
    setAvaliacoesCompletas(prev => {
      const idx = prev.findIndex(a => a.avaliacao_id === id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [item, ...prev];
    });
    notifySaveSuccess();
  };
  const aprovarDevolutiva = async (id: string) => {
    setAvaliacoesCompletas(prev => prev.map(a => a.avaliacao_id === id ? { ...a, status: 'APROVADO_ENVIO', data_aprovacao: new Date().toISOString() } : a));
  };
  const registrarEnvioDevolutiva = async (id: string, emailDestino?: string) => {
    setAvaliacoesCompletas(prev => prev.map(a => a.avaliacao_id === id ? { ...a, status: 'ENVIADO', data_envio: new Date().toISOString(), ...(emailDestino ? { email_destino: emailDestino } : {}) } : a));
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
    const mats = matriculas.filter(m => m.turma_id === turmaId && m.status === 'MATRICULADO');
    return mats
      .map(m => {
        const al = alunos.find(a => a.aluno_id === m.aluno_id);
        return al ? { matricula: m, aluno: al } : null;
      })
      .filter((item): item is { matricula: Matricula; aluno: Aluno } => item !== null)
      .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));
  };

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

    const regs = registrosSemanais.filter(r => r.matricula_id === matriculaId);
    
    // Obtém status da unidade de RSS (individual ou grupo em Clínica Ampliada)
    const statusRss = getStatusRssUnidade(turma.turma_id, matriculaId);
    const regraTurma = regrasRss.find(
      r => r.turma_id === turma.turma_id || r.disciplina_id === turma.disciplina_id
    );
    const totalRegistrosEsperados = statusRss?.rss_esperados_ate_hoje !== undefined && statusRss?.rss_esperados_ate_hoje !== null
      ? Number(statusRss.rss_esperados_ate_hoje)
      : (regraTurma?.total_esperado ? Number(regraTurma.total_esperado) : 0);

    const totalRegistrosEntregues = statusRss?.rss_recebidos_validos !== undefined && statusRss?.rss_recebidos_validos !== null
      ? Number(statusRss.rss_recebidos_validos)
      : regs.filter(r => r.status === 'ENTREGUE').length;

    const saldoRss = statusRss?.saldo_rss !== undefined && statusRss?.saldo_rss !== null
      ? Number(statusRss.saldo_rss)
      : (totalRegistrosEntregues - totalRegistrosEsperados);

    const docsPendentesCount = documentos.filter(
      d => d.matricula_id === matriculaId && d.status === 'PENDENTE'
    ).length;

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
    if (statusRss?.status_rss === 'ATRASADO' || statusRss?.status_rss === 'PENDENTE' || saldoRss < 0) {
      motivosAtencao.push(`RSS: ${statusRss?.status_rss || 'Pendente'} (${totalRegistrosEntregues}/${totalRegistrosEsperados})`);
    }
    if (faltasInjustificadasCount > 0) {
      motivosAtencao.push(`${faltasInjustificadasCount} falta(s) sem justificativa`);
    }
    if (docsPendentesCount > 0) {
      motivosAtencao.push(`${docsPendentesCount} documento(s) pendente(s)`);
    }
    if (justificativasPendentesCount > 0) {
      motivosAtencao.push(`${justificativasPendentesCount} justificativa(s) pendente(s)`);
    }
    if (orientacoesAbertasCount > 0) {
      motivosAtencao.push(`${orientacoesAbertasCount} orientação(ões) aberta(s)`);
    }
    if (ultimasOcorrencias.length > 1) {
      motivosAtencao.push(`${ultimasOcorrencias.length} ocorrências registradas`);
    }

    let statusAtencao: 'NORMAL' | 'ATENCAO' | 'PRIORIDADE' = 'NORMAL';
    if (statusRss?.status_rss === 'ATRASADO' || motivosAtencao.length >= 2 || faltasInjustificadasCount >= 2 || saldoRss < -1) {
      statusAtencao = 'PRIORIDADE';
    } else if (motivosAtencao.length === 1 || statusRss?.status_rss === 'PENDENTE' || saldoRss < 0) {
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

  const resetDatabaseToSeed = () => {
    setPeriodos(initialPeriodos);
    setDisciplinas(initialDisciplinas);
    setTurmas(initialTurmas);
    setAlunos(initialAlunos);
    setMatriculas(initialMatriculas);
    setOrientacoes(initialOrientacoes);
    setRegistrosSemanais(initialRegistrosSemanais);
    setDocumentos(initialDocumentos);
    setAvaliacoes(initialAvaliacoes);
    setFeedbacks(initialFeedbacks);
    setCriterios(initialCriteriosAvaliacao);
    setOcorrencias(initialOcorrencias);
    setConfiguracoes(initialConfiguracoes);
    setTurmasOrigem(initialTurmasOrigem);
    setFrequencias(initialFrequencias);
    setHorariosTurma(initialHorariosTurma);
    setPontosAcompanhamento(initialPontosAcompanhamento);
    setMarcosAcademicos(initialMarcosAcademicos);
    setRegrasRss(initialRegrasRss);
    setCalendarioRss(initialCalendarioRss);
    setStatusRssUnidades(initialStatusRssUnidades);
    setSituacaoAtualTurmas(initialSituacaoAtualTurmas);
    setLeiturasResponsaveis(initialLeiturasResponsaveis);
    setRegrasPrazo(initialRegrasPrazo);
    setGruposPratica(initialGruposPratica);
    setGrupoIntegrantes(initialGrupoIntegrantes);
    setEntregas(initialEntregas);
    setFeedbacksOficiais(initialFeedbacksOficiais);
    setRegistrosSupervisao(initialRegistrosSupervisao);
    setSincronizacao(initialSincronizacao);
    setDicionarioDados(initialDicionarioDados);
    setContratoApp(initialContratoApp);
    setMapeamentoFontes(initialMapeamentoFontes);
    setAuditoriaBase(initialAuditoriaBase);
    const ativo = initialPeriodos.find(p => p.status === 'ATIVO') || initialPeriodos[0];
    if (ativo) setSelectedPeriodoId(ativo.periodo_id);
  };

  const exportDatabaseAsJson = (): string => {
    const backup = {
      exportDate: new Date().toISOString(),
      version: '1.2.1',
      tables: {
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
        sincronizacao,
        dicionario_dados: dicionarioDados,
        contrato_app: contratoApp,
        mapeamento_fontes: mapeamentoFontes,
        auditoria_base: auditoriaBase,
      },
    };
    return JSON.stringify(backup, null, 2);
  };

  return (
    <SupervisaoContext.Provider
      value={{
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
        getResumoAlunoSupervisao,
        getTurmasDoPeriodo,
        getAlunosDaTurma,
        // Componentes de apoio / filas / avaliação
        caixaEntrada,
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
        resetDatabaseToSeed,
        exportDatabaseAsJson,
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
