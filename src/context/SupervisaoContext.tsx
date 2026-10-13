/**
 * Estado central da Central de Supervisão.
 *
 * Fluxo de toda alteração: atualiza a tela → salva no aparelho (garantido) → envia à planilha
 * em segundo plano. Nada fica só na memória: o que aparece salvo sobrevive a recarregar a página
 * e chega à planilha quando houver conexão com o Google.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Aluno,
  AlunoResumoSupervisao,
  Avaliacao,
  AvaliacaoCompleta,
  CriterioAvaliacao,
  DadosBase,
  EncontroTurma,
  Entrega,
  FeedbackAluno,
  Frequencia,
  HorarioTurma,
  ItemPendenciaOperacional,
  LeituraResponsavel,
  Matricula,
  Ocorrencia,
  Orientacao,
  Periodo,
  PontoAcompanhamento,
  PreparacaoAula,
  SituacaoEntrega,
  SituacaoRssEstudante,
  StatusRssUnidade,
  Tarefa,
  Turma,
  TurmaOrigem,
} from '../types';
import {
  agoraLocalIso,
  aulasDoDia,
  AulaDoDia,
  gerarPendencias,
  gerarRssDaTurma,
  getHojeDataIso,
  identificarProximaSupervisao,
  identificarSupervisaoAtual,
  leiturasDoEncontro,
  obterSituacaoRssEstudante,
  resolverResponsaveisLeitura,
  ResponsavelLeitura,
  ResultadoProximaSupervisao,
  ResultadoSupervisaoAtual,
  RssDaTurma,
  LIMITE_FALTAS_RISCO,
} from '../services/supervisaoOperacionalService';
import { gerarIdEstavel } from '../services/safeWriteService';
import {
  AlteracaoResiliente,
  inicializarCacheLocal,
  processarFilaSincronizacao,
  salvarEEnviarEmSegundoPlano,
  sincronizarDaBaseOficial,
  subscribeSyncStatus,
  SyncStatusState,
} from '../services/syncService';
import {
  getAccessToken,
  googleLogout,
  googleSignIn,
  initAuth,
  OFFICIAL_SPREADSHEET_ID,
  OFFICIAL_SPREADSHEET_NAME,
  OFFICIAL_SPREADSHEET_URL,
} from '../services/googleSheetsService';
import { dadosVazios } from '../services/tabelas';
import { textoComparavel } from '../services/normalizacaoPlanilha';

export type ConnectionStatus = 'CARREGANDO' | 'PRONTO' | 'SEM_DADOS';

export interface NovoHorarioInput { dia_semana: number; hora_inicio: string; hora_fim: string }
export interface NovaOrigemInput { sistema: string; codigo_externo: string; nome_externo: string }
export interface DadosTurmaInput {
  disciplina_id: string;
  nome: string;
  turno: Turma['turno'];
  status?: Turma['status'];
  horarios?: NovoHorarioInput[];
  origens?: NovaOrigemInput[];
}

/** Marcação de um estudante na chamada (todos começam presentes). */
export interface MarcacaoChamada {
  faltou: boolean;
  atraso: boolean;
  celular: boolean;
  justificativa?: string;
  observacao?: string;
}

export type TabelaExcluivel =
  | 'orientacoes' | 'ocorrencias' | 'feedbacks' | 'pontos_acompanhamento' | 'tarefas_professora' | 'preparacoes_aula';

export interface Aviso { tipo: 'sucesso' | 'erro'; texto: string }

interface PedidoExclusao { nome: string; descricao?: string; tabela: TabelaExcluivel; registro: Record<string, any> }

const CAMPO_DA_TABELA: Record<TabelaExcluivel, keyof DadosBase> = {
  orientacoes: 'orientacoes',
  ocorrencias: 'ocorrencias',
  feedbacks: 'feedbacks',
  pontos_acompanhamento: 'pontosAcompanhamento',
  tarefas_professora: 'tarefas',
  preparacoes_aula: 'preparacoesAula',
};
const CHAVE_DA_TABELA: Record<TabelaExcluivel, string> = {
  orientacoes: 'orientacao_id',
  ocorrencias: 'ocorrencia_id',
  feedbacks: 'feedback_id',
  pontos_acompanhamento: 'ponto_id',
  tarefas_professora: 'id',
  preparacoes_aula: 'preparacao_id',
};

const TEXTO_STATUS_ENTREGA: Record<SituacaoEntrega, string> = {
  ENTREGUE: 'Entregue',
  PENDENTE: 'Pendente',
  A_CONFERIR: 'A conferir',
  NAO_SE_APLICA: 'Não se aplica',
};

interface SupervisaoContextType {
  // Dados da planilha
  periodos: Periodo[];
  disciplinas: DadosBase['disciplinas'];
  turmas: Turma[];
  horariosTurma: HorarioTurma[];
  turmasOrigem: TurmaOrigem[];
  alunos: Aluno[];
  matriculas: Matricula[];
  criterios: CriterioAvaliacao[];
  orientacoes: Orientacao[];
  configuracoes: DadosBase['configuracoes'];
  marcosAcademicos: DadosBase['marcos'];
  pontosAcompanhamento: PontoAcompanhamento[];
  frequencias: Frequencia[];
  registrosSemanais: DadosBase['registrosSemanais'];
  avaliacoes: Avaliacao[];
  feedbacks: FeedbackAluno[];
  ocorrencias: Ocorrencia[];
  regrasRss: DadosBase['regrasRss'];
  calendarioRss: DadosBase['calendarioRss'];
  statusRssUnidades: StatusRssUnidade[];
  situacaoAtualTurmas: DadosBase['situacaoAtualTurmas'];
  leiturasResponsaveis: LeituraResponsavel[];
  gruposPratica: DadosBase['gruposPratica'];
  grupoIntegrantes: DadosBase['grupoIntegrantes'];
  entregas: Entrega[];
  encontrosTurma: EncontroTurma[];
  avaliacoesCompletas: AvaliacaoCompleta[];
  casosDiscussao: PreparacaoAula[];
  tarefas: Tarefa[];

  // Período
  selectedPeriodoId: string;
  setSelectedPeriodoId: (id: string) => void;
  periodoAtual?: Periodo;

  // Planilha, login e sincronização
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  currentUser: User | null;
  authVerificado: boolean;
  isLoggingIn: boolean;
  loginGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  hasLocalCache: boolean;
  connectionStatus: ConnectionStatus;
  connectionErrorMessage: string | null;
  syncStatusState: SyncStatusState;
  /** Há conta conectada mas o acesso do Google expirou (1 toque para renovar). */
  precisaReconectar: boolean;
  sincronizarAgora: () => Promise<void>;

  // Aviso curto de salvamento
  aviso: Aviso | null;
  limparAviso: () => void;

  // Relógio (atualiza a cada minuto)
  agora: Date;
  hojeIso: string;

  // Turmas e semestre
  addTurma: (dados: DadosTurmaInput) => Promise<Turma>;
  updateTurma: (turmaId: string, dados: DadosTurmaInput) => Promise<void>;
  toggleArchiveTurma: (turmaId: string) => Promise<void>;
  createNovoPeriodo: (nome: string, dataInicio: string, dataFim: string, copiarTurmasDePeriodoId?: string) => Promise<string>;
  importarAlunosLote: (turmaId: string, lista: { nome: string; email?: string; identificador_academico?: string }[]) => Promise<{ adicionados: number; duplicados: number }>;
  setOrigemDoAluno: (matriculaId: string, origemId: string) => Promise<void>;

  // Registros de supervisão
  addOrientacao: (matriculaId: string, categoria: string, texto: string, status?: Orientacao['status']) => Promise<void>;
  addOrientacaoGrupo: (grupoId: string, categoria: string, texto: string) => Promise<void>;
  toggleOrientacaoStatus: (orientacaoId: string) => Promise<void>;
  addFeedback: (matriculaId: string, texto: string) => Promise<void>;
  addOcorrencia: (matriculaId: string, tipo: Ocorrencia['tipo'], observacao: string) => Promise<void>;
  addPontoAcompanhamento: (matriculaId: string, texto: string, prioridade?: PontoAcompanhamento['prioridade']) => Promise<void>;
  togglePontoStatus: (pontoId: string) => Promise<void>;

  // Frequência
  salvarChamada: (turmaId: string, dataAula: string, marcacoes: Record<string, MarcacaoChamada>) => Promise<{ presentes: number; faltas: number }>;
  atualizarFrequencia: (matriculaId: string, dataAula: string, status: Frequencia['status'], justificativa?: string) => Promise<void>;
  decidirJustificativa: (frequenciaId: string, aceita: boolean) => Promise<void>;

  // Documentos (aba entregas)
  atualizarEntregas: (entregaIds: string[], situacao: SituacaoEntrega) => Promise<void>;
  addEntrega: (matriculaId: string, tipo: string, situacao?: SituacaoEntrega) => Promise<void>;

  // Notas e devolutivas
  saveAvaliacao: (matriculaId: string, criterioId: string, nota: number, observacao?: string) => Promise<void>;
  salvarAvaliacaoCompleta: (avaliacao: Partial<AvaliacaoCompleta> & Pick<AvaliacaoCompleta, 'matricula_id' | 'turma_id' | 'instrumento_id'>) => Promise<AvaliacaoCompleta>;
  aprovarDevolutiva: (avaliacaoId: string) => Promise<void>;
  registrarEnvioDevolutiva: (avaliacaoId: string) => Promise<void>;

  // Aulas
  marcarEncontroNaoRealizado: (turmaId: string, data: string, motivo: string, observacao?: string) => Promise<void>;
  reagendarEncontro: (turmaId: string, dataOriginal: string, novaData: string, novoHorario?: string, motivo?: string) => Promise<void>;
  reverterEncontro: (turmaId: string, data: string) => Promise<void>;
  /** A aula aconteceu e a chamada foi feita em outro sistema (ex.: Docente Online). */
  dispensarChamada: (turmaId: string, data: string) => Promise<void>;
  atualizarStatusEstudoDirigido: (
    leituraId: string,
    status: NonNullable<LeituraResponsavel['status_realizacao']>,
    responsaveisEfetivos?: string[],
    motivoSubstituicao?: string
  ) => Promise<void>;

  // Casos para discutir e tarefas
  addCaso: (turmaId: string, dados: { alvo_tipo: 'ALUNO' | 'GRUPO' | 'TURMA'; alvo_id?: string; alvo_nome: string; texto: string }) => Promise<void>;
  marcarCasoDiscutido: (preparacaoId: string, discutido: boolean) => Promise<void>;
  addTarefa: (dados: Partial<Tarefa> & { titulo: string }) => Promise<void>;
  toggleTarefa: (id: string) => Promise<void>;

  // Exclusão com confirmação e desfazer
  solicitarExclusao: (pedido: PedidoExclusao) => void;
  pedidoExclusao: PedidoExclusao | null;
  confirmarExclusao: () => Promise<void>;
  cancelarExclusao: () => void;
  ultimaExclusao: PedidoExclusao | null;
  desfazerExclusao: () => Promise<void>;
  dispensarDesfazer: () => void;

  // Consultas
  getTurmasDoPeriodo: (periodoId?: string, incluirArquivadas?: boolean) => Turma[];
  getAlunosDaTurma: (turmaId: string) => { matricula: Matricula; aluno: Aluno }[];
  getResumoAlunoSupervisao: (matriculaId: string) => AlunoResumoSupervisao | null;
  getSituacaoRssEstudante: (matriculaId: string) => SituacaoRssEstudante | null;
  getRssDaTurma: (turmaId: string) => RssDaTurma;
  getGrupoDoAluno: (matriculaId: string) => DadosBase['gruposPratica'][number] | undefined;
  isTurmaClinicaAmpliada: (turmaId: string) => boolean;
  getCriteriosDaTurma: (turmaId: string) => CriterioAvaliacao[];
  getOrigemDoAluno: (matriculaId: string) => TurmaOrigem | undefined;
  getAulasDoDia: (data: string) => AulaDoDia[];
  getLeiturasDoEncontro: (turmaId: string, data: string) => LeituraResponsavel[];
  getResponsaveisLeitura: (leitura: LeituraResponsavel) => ResponsavelLeitura[];
  supervisaoAtual: ResultadoSupervisaoAtual;
  proximaSupervisao: ResultadoProximaSupervisao | null;
  pendencias: ItemPendenciaOperacional[];

  exportDatabaseAsJson: () => string;
}

const SupervisaoContext = createContext<SupervisaoContextType | undefined>(undefined);

const novoId = (prefixo: string) => gerarIdEstavel(prefixo);
const agoraIso = () => agoraLocalIso();

/** Lê uma lista antiga do localStorage (versões anteriores guardavam dados só no navegador). */
function lerLocalAntigo<T>(chave: string): T[] {
  try {
    const bruto = localStorage.getItem(chave);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export const SupervisaoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dados, setDados] = useState<DadosBase>(dadosVazios);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  const [selectedPeriodoId, setSelectedPeriodoIdState] = useState<string>(() => {
    try { return localStorage.getItem('cs_periodo_selecionado') || ''; } catch { return ''; }
  });
  const setSelectedPeriodoId = useCallback((id: string) => {
    setSelectedPeriodoIdState(id);
    try { localStorage.setItem('cs_periodo_selecionado', id); } catch { /* opcional */ }
  }, []);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authVerificado, setAuthVerificado] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [hasLocalCache, setHasLocalCache] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CARREGANDO');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);
  const [temToken, setTemToken] = useState(false);
  const [syncStatusState, setSyncStatusState] = useState<SyncStatusState>({
    status: 'LOCAL', ultimaSincronizacao: null, ultimaLeituraSucesso: null, ultimaEscritaSucesso: null,
    pendentesCount: 0, conflitosCount: 0, erros: [], tabelasStatus: {},
  });
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [pedidoExclusao, setPedidoExclusao] = useState<PedidoExclusao | null>(null);
  const [ultimaExclusao, setUltimaExclusao] = useState<PedidoExclusao | null>(null);

  const hojeIso = getHojeDataIso(agora);

  // ------------------------------------------------------------------
  // Aplicação dos dados e avisos
  // ------------------------------------------------------------------

  const aplicarDados = useCallback((novos: DadosBase) => {
    setDados(novos);
    if (novos.periodos.length > 0 && novos.turmas.length > 0) setHasLocalCache(true);
    setSelectedPeriodoIdState(atual => {
      if (atual && novos.periodos.some(p => p.periodo_id === atual)) return atual;
      return (novos.periodos.find(p => p.status === 'ATIVO') || novos.periodos[0])?.periodo_id || '';
    });
  }, []);

  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = useCallback((novo: Aviso) => {
    setAviso(novo);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(null), novo.tipo === 'erro' ? 8000 : 2500);
  }, []);

  /**
   * Atualiza a tela e salva. Se o aparelho não conseguir guardar, desfaz a mudança na tela
   * e avisa: nunca mostramos como salvo algo que não foi salvo.
   */
  const mutar = useCallback(async (
    alterarTela: (d: DadosBase) => DadosBase,
    alteracoes: AlteracaoResiliente[],
    mensagem = 'Salvo'
  ) => {
    const anterior = dadosRef.current;
    const proximo = alterarTela(anterior);
    dadosRef.current = proximo;
    setDados(proximo);
    try {
      await salvarEEnviarEmSegundoPlano(alteracoes);
      avisar({ tipo: 'sucesso', texto: mensagem });
    } catch (erro: any) {
      dadosRef.current = anterior;
      setDados(anterior);
      avisar({ tipo: 'erro', texto: `Não foi possível salvar: ${erro?.message || 'erro desconhecido'}` });
      throw erro;
    }
  }, [avisar]);

  // ------------------------------------------------------------------
  // Abertura, login e sincronização
  // ------------------------------------------------------------------

  const migrarDadosAntigosDoNavegador = useCallback(async () => {
    try {
      if (localStorage.getItem('cs_migracao_planilha_v3') === 'ok') return;
    } catch { return; }
    const alteracoes: AlteracaoResiliente[] = [];
    for (const e of lerLocalAntigo<EncontroTurma>('cs_encontros_turma_v2')) {
      if (e?.turma_id && e?.data) alteracoes.push({ tabela: 'encontros_turma', tipo: 'INSERT', registro: { ...e, fonte: 'APP' } });
    }
    for (const a of lerLocalAntigo<AvaliacaoCompleta>('cs_avaliacoes_completas_v1')) {
      if (a?.avaliacao_id) alteracoes.push({ tabela: 'avaliacoes_completas', tipo: 'INSERT', registro: a as any });
    }
    for (const t of lerLocalAntigo<any>('cs_fila_professora_v1')) {
      if (t?.titulo) {
        const id = t.id || novoId('tf');
        alteracoes.push({ tabela: 'tarefas_professora', tipo: 'INSERT', registro: { ...t, id, tarefa_id: id, status: t.status === 'CONCLUIDO' ? 'CONCLUIDO' : 'PENDENTE' } });
      }
    }
    for (const c of lerLocalAntigo<any>('cs_caixa_entrada_v1')) {
      if (c?.texto_original && c.status === 'PENDENTE') {
        const id = novoId('tf');
        alteracoes.push({ tabela: 'tarefas_professora', tipo: 'INSERT', registro: {
          id, tarefa_id: id, titulo: c.texto_original.slice(0, 120), detalhe: c.texto_original, prioridade: 'MEDIA',
          duracao_minutos: 5, status: 'PENDENTE', origem: 'ANOTACAO', criado_em: c.criado_em || agoraIso(),
        } });
      }
    }
    for (const f of lerLocalAntigo<any>('cs_fila_supervisao_v1')) {
      if (f?.turma_id && f?.assunto) {
        alteracoes.push({ tabela: 'preparacoes_aula', tipo: 'INSERT', registro: {
          preparacao_id: novoId('caso'), turma_id: f.turma_id, tipo: 'CASO', texto: f.assunto,
          status: f.status === 'CONCLUIDO' ? 'DISCUTIDO' : 'AGUARDANDO', alvo_tipo: f.alvo_tipo, alvo_id: f.alvo_id,
          alvo_nome: f.nome_alvo, criado_em: f.criado_em || agoraIso(),
        } });
      }
    }
    try {
      if (alteracoes.length > 0) await salvarEEnviarEmSegundoPlano(alteracoes);
      localStorage.setItem('cs_migracao_planilha_v3', 'ok');
      ['cs_encontros_turma_v2', 'cs_avaliacoes_completas_v1', 'cs_fila_professora_v1', 'cs_caixa_entrada_v1', 'cs_fila_supervisao_v1']
        .forEach(k => localStorage.removeItem(k));
    } catch (erro) {
      console.warn('Migração dos dados antigos do navegador será tentada novamente:', erro);
    }
  }, []);

  const sincronizandoRef = useRef(false);
  const ultimaSyncRef = useRef(0);

  /** Lê a planilha (enviando antes o que estiver na fila). Silenciosa: não abre login. */
  const sincronizarSilenciosamente = useCallback(async () => {
    if (sincronizandoRef.current) return;
    const token = await getAccessToken();
    setTemToken(Boolean(token));
    if (!token) return;
    sincronizandoRef.current = true;
    try {
      const res = await sincronizarDaBaseOficial();
      ultimaSyncRef.current = Date.now();
      if (res.sucesso && res.dados) {
        aplicarDados(res.dados);
        setConnectionStatus('PRONTO');
        setConnectionErrorMessage(null);
      } else {
        setConnectionErrorMessage(res.erro || 'Falha ao sincronizar com a planilha.');
        setTemToken(Boolean(await getAccessToken()));
      }
    } finally {
      sincronizandoRef.current = false;
    }
  }, [aplicarDados]);

  // 1. Abre imediatamente com a cópia do aparelho.
  useEffect(() => {
    let ativo = true;
    const unsub = subscribeSyncStatus(s => ativo && setSyncStatusState(s));
    inicializarCacheLocal().then(({ dados: cache }) => {
      if (!ativo) return;
      if (cache && cache.periodos.length > 0 && cache.turmas.length > 0) {
        aplicarDados(cache);
        setConnectionStatus('PRONTO');
      } else {
        setConnectionStatus('SEM_DADOS');
      }
      void migrarDadosAntigosDoNavegador();
    });
    return () => { ativo = false; unsub(); };
  }, [aplicarDados, migrarDadosAntigosDoNavegador]);

  // 2. Login persistente do Firebase: sincroniza se o acesso do Google ainda for válido.
  useEffect(() => {
    const unsub = initAuth(
      user => {
        setCurrentUser(user);
        setAuthVerificado(true);
        void sincronizarSilenciosamente();
      },
      () => {
        setCurrentUser(null);
        setAuthVerificado(true);
      }
    );
    return () => unsub();
  }, [sincronizarSilenciosamente]);

  // 3. Relógio e sincronização automática (a cada 5 min, ao voltar para a aba e ao reconectar a rede).
  useEffect(() => {
    const tick = setInterval(() => {
      setAgora(new Date());
      void getAccessToken().then(t => setTemToken(Boolean(t)));
    }, 60000);
    // A cada 5 min (a planilha inteira é lida; intervalos menores gastariam dados móveis à toa).
    const auto = setInterval(() => {
      if (document.visibilityState === 'visible') void sincronizarSilenciosamente();
    }, 300000);
    const aoVoltar = () => {
      setAgora(new Date());
      if (Date.now() - ultimaSyncRef.current > 60000) void sincronizarSilenciosamente();
    };
    window.addEventListener('focus', aoVoltar);
    window.addEventListener('online', aoVoltar);
    return () => {
      clearInterval(tick);
      clearInterval(auto);
      window.removeEventListener('focus', aoVoltar);
      window.removeEventListener('online', aoVoltar);
    };
  }, [sincronizarSilenciosamente]);

  const loginGoogle = useCallback(async () => {
    setIsLoggingIn(true);
    setConnectionErrorMessage(null);
    try {
      const res = await googleSignIn();
      setCurrentUser(res.user);
      setTemToken(true);
      await processarFilaSincronizacao().catch(() => undefined);
      await sincronizarSilenciosamente();
    } catch (erro: any) {
      if (erro?.code !== 'auth/popup-closed-by-user' && erro?.code !== 'auth/cancelled-popup-request') {
        setConnectionErrorMessage(erro?.message || 'Não foi possível entrar com a conta Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  }, [sincronizarSilenciosamente]);

  const sincronizarAgora = useCallback(async () => {
    if (!(await getAccessToken())) {
      await loginGoogle();
      return;
    }
    await sincronizarSilenciosamente();
  }, [loginGoogle, sincronizarSilenciosamente]);

  const logoutGoogle = useCallback(async () => {
    await googleLogout();
    setCurrentUser(null);
    setTemToken(false);
  }, []);

  // ------------------------------------------------------------------
  // Consultas
  // ------------------------------------------------------------------

  const periodoAtual = dados.periodos.find(p => p.periodo_id === selectedPeriodoId);

  const getTurmasDoPeriodo = useCallback((periodoId?: string, incluirArquivadas = false) => {
    const pId = periodoId || selectedPeriodoId;
    return dados.turmas
      .filter(t => t.periodo_id === pId && (incluirArquivadas || t.status !== 'ARQUIVADO'))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [dados.turmas, selectedPeriodoId]);

  const alunosPorTurma = useMemo(() => {
    const alunoPorId = new Map(dados.alunos.map(a => [a.aluno_id, a]));
    const mapa = new Map<string, { matricula: Matricula; aluno: Aluno }[]>();
    for (const m of dados.matriculas) {
      if (m.status !== 'MATRICULADO') continue;
      const aluno = alunoPorId.get(m.aluno_id);
      if (!aluno) continue;
      if (!mapa.has(m.turma_id)) mapa.set(m.turma_id, []);
      mapa.get(m.turma_id)!.push({ matricula: m, aluno });
    }
    mapa.forEach(lista => lista.sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome)));
    return mapa;
  }, [dados.alunos, dados.matriculas]);

  const getAlunosDaTurma = useCallback((turmaId: string) => alunosPorTurma.get(turmaId) || [], [alunosPorTurma]);

  const getGrupoDoAluno = useCallback((matriculaId: string) => {
    const mat = dados.matriculas.find(m => m.matricula_id === matriculaId);
    const vinculo = dados.grupoIntegrantes.find(gi => gi.matricula_id === matriculaId
      && dados.gruposPratica.some(g => g.grupo_id === gi.grupo_id && g.turma_id === mat?.turma_id));
    return vinculo ? dados.gruposPratica.find(g => g.grupo_id === vinculo.grupo_id) : undefined;
  }, [dados.matriculas, dados.grupoIntegrantes, dados.gruposPratica]);

  const isTurmaClinicaAmpliada = useCallback((turmaId: string) =>
    dados.gruposPratica.some(g => g.turma_id === turmaId), [dados.gruposPratica]);

  const getSituacaoRssEstudante = useCallback((matriculaId: string): SituacaoRssEstudante | null => {
    const mat = dados.matriculas.find(m => m.matricula_id === matriculaId);
    if (!mat) return null;
    const grupo = getGrupoDoAluno(matriculaId);
    const unidadeId = grupo?.grupo_id || matriculaId;
    const status = dados.statusRssUnidades.find(s => s.unidade_id === unidadeId && (!s.turma_id || s.turma_id === mat.turma_id));
    return obterSituacaoRssEstudante(
      matriculaId, mat.turma_id, dados.registrosSemanais, status,
      dados.regrasRss.find(r => r.turma_id === mat.turma_id),
      dados.situacaoAtualTurmas.find(s => s.turma_id === mat.turma_id),
      dados.calendarioRss.filter(c => c.turma_id === mat.turma_id),
      grupo?.grupo_id
    );
  }, [dados, getGrupoDoAluno]);

  const getRssDaTurma = useCallback((turmaId: string) => gerarRssDaTurma(turmaId, dados, hojeIso), [dados, hojeIso]);

  const getResumoAlunoSupervisao = useCallback((matriculaId: string): AlunoResumoSupervisao | null => {
    const matricula = dados.matriculas.find(m => m.matricula_id === matriculaId);
    if (!matricula) return null;
    const aluno = dados.alunos.find(a => a.aluno_id === matricula.aluno_id);
    const turma = dados.turmas.find(t => t.turma_id === matricula.turma_id);
    if (!aluno || !turma) return null;
    const disciplina = dados.disciplinas.find(d => d.disciplina_id === turma.disciplina_id)
      || { disciplina_id: '', codigo: '', nome: 'Estágio', tipo: 'ESTÁGIO' };
    const situacaoRss = getSituacaoRssEstudante(matriculaId) || undefined;
    const freqs = dados.frequencias.filter(f => f.matricula_id === matriculaId);
    const faltasInjustificadasCount = freqs.filter(f => f.status === 'FALTA_SEM_JUSTIFICATIVA').length;
    const justificativasPendentesCount = freqs.filter(f => f.status === 'JUSTIFICATIVA_PENDENTE').length;
    const docsPendentesCount = dados.entregas.filter(e => e.matricula_id === matriculaId && e.situacao === 'PENDENTE').length;
    const orientacoesDoAluno = dados.orientacoes.filter(o => o.matricula_id === matriculaId);
    const orientacoesAbertasCount = orientacoesDoAluno.filter(o => o.status === 'ABERTA').length;
    const pontosAtivos = dados.pontosAcompanhamento.filter(p => p.matricula_id === matriculaId && p.status === 'ATIVO');
    const porData = <T extends { data_hora: string }>(a: T, b: T) => String(b.data_hora).localeCompare(String(a.data_hora));

    const motivosAtencao: string[] = [];
    if (faltasInjustificadasCount > 0) motivosAtencao.push(`${faltasInjustificadasCount} falta(s) sem justificativa`);
    if (justificativasPendentesCount > 0) motivosAtencao.push(`${justificativasPendentesCount} justificativa(s) para avaliar`);
    if (situacaoRss?.estaAtrasado) motivosAtencao.push(`RSS: faltam ${Math.abs(situacaoRss.saldoRss)}`);
    if (docsPendentesCount > 0) motivosAtencao.push(`${docsPendentesCount} documento(s) não entregue(s)`);
    if (pontosAtivos.length > 0) motivosAtencao.push(`${pontosAtivos.length} ponto(s) a acompanhar`);

    // O RSS aparece como informação, mas não acende alerta: costuma atrasar para a turma toda.
    const prioridade = faltasInjustificadasCount >= LIMITE_FALTAS_RISCO || pontosAtivos.some(p => p.prioridade === 'ALTA');
    const alertas = motivosAtencao.filter(m => !m.startsWith('RSS'));
    const statusAtencao: AlunoResumoSupervisao['statusAtencao'] = prioridade ? 'PRIORIDADE' : alertas.length > 0 ? 'ATENCAO' : 'NORMAL';

    return {
      matricula, aluno, turma, disciplina,
      totalRegistrosEntregues: situacaoRss?.registrosRealizados ?? 0,
      totalRegistrosEsperados: situacaoRss?.registrosEsperadosAteHoje ?? 0,
      totalPrevistoNoPeriodo: situacaoRss?.totalPrevistoNoPeriodo,
      situacaoRss,
      docsPendentesCount,
      faltasInjustificadasCount,
      orientacoesAbertasCount,
      justificativasPendentesCount,
      temAtencao: statusAtencao !== 'NORMAL',
      statusAtencao,
      motivosAtencao,
      pontosAtivos,
      ultimasOrientacoes: orientacoesDoAluno.slice().sort(porData).slice(0, 3),
      ultimasOcorrencias: dados.ocorrencias.filter(o => o.matricula_id === matriculaId).slice().sort(porData).slice(0, 3),
    };
  }, [dados, getSituacaoRssEstudante]);

  const getCriteriosDaTurma = useCallback((turmaId: string) => {
    const turma = dados.turmas.find(t => t.turma_id === turmaId);
    return dados.criterios
      .filter(c => c.ativo !== false
        && (!c.turma_id || c.turma_id === turmaId)
        && (!c.disciplina_id || c.disciplina_id === turma?.disciplina_id))
      .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
  }, [dados.turmas, dados.criterios]);

  const getOrigemDoAluno = useCallback((matriculaId: string) => {
    const mat = dados.matriculas.find(m => m.matricula_id === matriculaId);
    if (!mat) return undefined;
    if (mat.origem_id) return dados.turmasOrigem.find(o => o.origem_id === mat.origem_id);
    return dados.turmasOrigem.find(o => o.turma_id === mat.turma_id && o.ativo);
  }, [dados.matriculas, dados.turmasOrigem]);

  const turmasDoPeriodo = useMemo(() => getTurmasDoPeriodo(), [getTurmasDoPeriodo]);

  const getAulasDoDia = useCallback((data: string) =>
    aulasDoDia(data, turmasDoPeriodo, dados.horarios, dados.encontros, dados.frequencias, dados.matriculas),
  [turmasDoPeriodo, dados.horarios, dados.encontros, dados.frequencias, dados.matriculas]);

  const getLeiturasDoEncontro = useCallback((turmaId: string, data: string) =>
    leiturasDoEncontro(turmaId, data, dados.leiturasResponsaveis, dados.encontros),
  [dados.leiturasResponsaveis, dados.encontros]);

  const getResponsaveisLeitura = useCallback((leitura: LeituraResponsavel) =>
    resolverResponsaveisLeitura(leitura, getAlunosDaTurma(leitura.turma_id || '')),
  [getAlunosDaTurma]);

  const supervisaoAtual = useMemo(() => identificarSupervisaoAtual(
    turmasDoPeriodo, dados.horarios, dados.frequencias, dados.encontros, dados.matriculas, agora
  ), [turmasDoPeriodo, dados.horarios, dados.frequencias, dados.encontros, dados.matriculas, agora]);

  const proximaSupervisao = useMemo(() => identificarProximaSupervisao(
    turmasDoPeriodo, dados.horarios, dados.encontros, agora, dados.frequencias, dados.matriculas
  ), [turmasDoPeriodo, dados.horarios, dados.encontros, agora, dados.frequencias, dados.matriculas]);

  const pendencias = useMemo(() => gerarPendencias({
    periodo: periodoAtual,
    turmas: dados.turmas,
    matriculas: dados.matriculas,
    alunos: dados.alunos,
    frequencias: dados.frequencias,
    entregas: dados.entregas,
    leituras: dados.leiturasResponsaveis,
    encontros: dados.encontros,
    horarios: dados.horarios,
    avaliacoesCompletas: dados.avaliacoesCompletas,
  }, agora), [periodoAtual, dados, agora]);

  const feedbacks = useMemo<FeedbackAluno[]>(() => [
    ...dados.feedbacks.filter(f => f.matricula_id || f.turma_id).map(f => ({
      feedback_id: f.feedback_id, matricula_id: f.matricula_id || '', data_hora: f.data_hora || f.data || '', texto: f.texto || '',
      turma_id: f.turma_id, categoria: f.categoria, incluir_na_devolutiva: f.incluir_na_devolutiva, data_texto: f.data_texto,
    })),
    ...dados.feedbacksLegados,
  ], [dados.feedbacks, dados.feedbacksLegados]);

  const casosDiscussao = useMemo(
    () => dados.preparacoesAula.filter(p => String(p.tipo).toUpperCase() === 'CASO'),
    [dados.preparacoesAula]
  );

  // ------------------------------------------------------------------
  // Ações: turmas, semestre e alunos
  // ------------------------------------------------------------------

  const turmaDe = (matriculaId: string) => dadosRef.current.matriculas.find(m => m.matricula_id === matriculaId)?.turma_id || '';

  const montarHorarios = (turmaId: string, lista: NovoHorarioInput[], existentes: HorarioTurma[]): HorarioTurma[] => {
    const periodo = dadosRef.current.periodos.find(p => p.periodo_id === dadosRef.current.turmas.find(t => t.turma_id === turmaId)?.periodo_id)
      || periodoAtual;
    return lista.map((h, i) => ({
      horario_id: existentes[i]?.horario_id || novoId('hor'),
      turma_id: turmaId,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      data_inicio: existentes[i]?.data_inicio || periodo?.data_inicio || '',
      data_fim: existentes[i]?.data_fim || periodo?.data_fim || '',
      ativo: true,
    }));
  };

  const addTurma = useCallback(async (entrada: DadosTurmaInput): Promise<Turma> => {
    const turma: Turma = {
      turma_id: novoId('turma'), periodo_id: selectedPeriodoId, disciplina_id: entrada.disciplina_id,
      nome: entrada.nome, turno: entrada.turno, status: 'ATIVO',
    };
    const horarios = montarHorarios(turma.turma_id, entrada.horarios || [], []);
    const origens: TurmaOrigem[] = (entrada.origens || []).filter(o => o.codigo_externo).map(o => ({
      origem_id: novoId('orig'), turma_id: turma.turma_id, sistema: o.sistema || 'Docente Online',
      codigo_externo: o.codigo_externo, nome_externo: o.nome_externo || entrada.nome, ativo: true,
    }));
    await mutar(
      d => ({ ...d, turmas: [...d.turmas, turma], horarios: [...d.horarios, ...horarios], turmasOrigem: [...d.turmasOrigem, ...origens] }),
      [
        { tabela: 'turmas', tipo: 'INSERT', registro: turma },
        ...horarios.map(h => ({ tabela: 'horarios_turma', tipo: 'INSERT' as const, registro: h })),
        ...origens.map(o => ({ tabela: 'turmas_origem', tipo: 'INSERT' as const, registro: o })),
      ],
      'Turma criada'
    );
    return turma;
  }, [mutar, selectedPeriodoId, periodoAtual]);

  const updateTurma = useCallback(async (turmaId: string, entrada: DadosTurmaInput) => {
    const d0 = dadosRef.current;
    const atual = d0.turmas.find(t => t.turma_id === turmaId);
    if (!atual) return;
    const turma: Turma = { ...atual, disciplina_id: entrada.disciplina_id, nome: entrada.nome, turno: entrada.turno, status: entrada.status || atual.status };
    const alteracoes: AlteracaoResiliente[] = [
      { tabela: 'turmas', tipo: 'UPDATE', registro: turma, campos: ['disciplina_id', 'nome', 'turno', 'status'] },
    ];
    let horarios = d0.horarios;
    if (entrada.horarios) {
      const existentes = d0.horarios.filter(h => h.turma_id === turmaId);
      const novos = montarHorarios(turmaId, entrada.horarios, existentes);
      existentes.slice(novos.length).forEach(h => alteracoes.push({ tabela: 'horarios_turma', tipo: 'DELETE', registro: h }));
      novos.forEach((h, i) => alteracoes.push({
        tabela: 'horarios_turma', tipo: existentes[i] ? 'UPDATE' : 'INSERT', registro: h,
        campos: existentes[i] ? ['dia_semana', 'hora_inicio', 'hora_fim', 'ativo'] : undefined,
      }));
      horarios = [...d0.horarios.filter(h => h.turma_id !== turmaId), ...novos];
    }
    let origens = d0.turmasOrigem;
    if (entrada.origens) {
      const existentes = d0.turmasOrigem.filter(o => o.turma_id === turmaId);
      const novas: TurmaOrigem[] = entrada.origens.filter(o => o.codigo_externo).map((o, i) => ({
        origem_id: existentes[i]?.origem_id || novoId('orig'), turma_id: turmaId, sistema: o.sistema || 'Docente Online',
        codigo_externo: o.codigo_externo, nome_externo: o.nome_externo || entrada.nome, ativo: true,
      }));
      existentes.slice(novas.length).forEach(o => alteracoes.push({ tabela: 'turmas_origem', tipo: 'UPDATE', registro: { ...o, ativo: false }, campos: ['ativo'] }));
      novas.forEach((o, i) => alteracoes.push({ tabela: 'turmas_origem', tipo: existentes[i] ? 'UPDATE' : 'INSERT', registro: o }));
      origens = [...d0.turmasOrigem.filter(o => o.turma_id !== turmaId), ...novas];
    }
    await mutar(
      d => ({ ...d, turmas: d.turmas.map(t => (t.turma_id === turmaId ? turma : t)), horarios, turmasOrigem: origens }),
      alteracoes,
      'Turma atualizada'
    );
  }, [mutar, periodoAtual]);

  const toggleArchiveTurma = useCallback(async (turmaId: string) => {
    const turma = dadosRef.current.turmas.find(t => t.turma_id === turmaId);
    if (!turma) return;
    const atualizada: Turma = { ...turma, status: turma.status === 'ARQUIVADO' ? 'ATIVO' : 'ARQUIVADO' };
    await mutar(
      d => ({ ...d, turmas: d.turmas.map(t => (t.turma_id === turmaId ? atualizada : t)) }),
      [{ tabela: 'turmas', tipo: 'UPDATE', registro: atualizada, campos: ['status'] }],
      atualizada.status === 'ARQUIVADO' ? 'Turma arquivada' : 'Turma reativada'
    );
  }, [mutar]);

  const createNovoPeriodo = useCallback(async (nome: string, dataInicio: string, dataFim: string, copiarDe?: string) => {
    const d0 = dadosRef.current;
    const periodo: Periodo = { periodo_id: novoId('per'), nome, data_inicio: dataInicio, data_fim: dataFim, status: 'PLANEJADO' };
    const turmas: Turma[] = [];
    const horarios: HorarioTurma[] = [];
    const criterios: CriterioAvaliacao[] = [];
    if (copiarDe) {
      for (const t of d0.turmas.filter(x => x.periodo_id === copiarDe && x.status !== 'ARQUIVADO')) {
        const nova: Turma = { ...t, turma_id: novoId('turma'), periodo_id: periodo.periodo_id, status: 'ATIVO' };
        turmas.push(nova);
        d0.horarios.filter(h => h.turma_id === t.turma_id).forEach(h => horarios.push({
          ...h, horario_id: novoId('hor'), turma_id: nova.turma_id, data_inicio: dataInicio, data_fim: dataFim,
        }));
        d0.criterios.filter(c => c.turma_id === t.turma_id).forEach(c => criterios.push({
          ...c, criterio_id: novoId('crit'), turma_id: nova.turma_id, periodo_id: periodo.periodo_id,
        }));
      }
    }
    await mutar(
      d => ({ ...d, periodos: [...d.periodos, periodo], turmas: [...d.turmas, ...turmas], horarios: [...d.horarios, ...horarios], criterios: [...d.criterios, ...criterios] }),
      [
        { tabela: 'periodos', tipo: 'INSERT', registro: periodo },
        ...turmas.map(t => ({ tabela: 'turmas', tipo: 'INSERT' as const, registro: t })),
        ...horarios.map(h => ({ tabela: 'horarios_turma', tipo: 'INSERT' as const, registro: h })),
        ...criterios.map(c => ({ tabela: 'criterios_avaliacao', tipo: 'INSERT' as const, registro: c })),
      ],
      `Semestre ${nome} criado`
    );
    return periodo.periodo_id;
  }, [mutar]);

  const importarAlunosLote = useCallback(async (turmaId: string, lista: { nome: string; email?: string; identificador_academico?: string }[]) => {
    const d0 = dadosRef.current;
    const turma = d0.turmas.find(t => t.turma_id === turmaId);
    if (!turma) return { adicionados: 0, duplicados: 0 };
    const alunosNovos: Aluno[] = [];
    const matriculasNovas: Matricula[] = [];
    let duplicados = 0;
    const todos = () => [...d0.alunos, ...alunosNovos];
    for (const item of lista) {
      const nome = item.nome.trim();
      if (!nome) continue;
      const email = (item.email || '').trim().toLowerCase();
      const ra = (item.identificador_academico || '').trim();
      // Identifica a mesma pessoa por e-mail, RA ou nome completo (nunca por campo vazio).
      const existente = todos().find(a =>
        (email && String((a as any).email || '').toLowerCase() === email)
        || (ra && String(a.identificador_academico || '').toLowerCase() === ra.toLowerCase())
        || textoComparavel(a.nome) === textoComparavel(nome));
      const alunoId = existente?.aluno_id || novoId('aluno');
      if (existente && [...d0.matriculas, ...matriculasNovas].some(m => m.aluno_id === alunoId && m.turma_id === turmaId)) {
        duplicados++;
        continue;
      }
      if (!existente) alunosNovos.push({ aluno_id: alunoId, nome, identificador_academico: ra, status: 'ATIVO', ...(email ? { email } : {}) } as Aluno);
      matriculasNovas.push({ matricula_id: novoId('mat'), aluno_id: alunoId, turma_id: turmaId, periodo_id: turma.periodo_id, status: 'MATRICULADO' });
    }
    if (matriculasNovas.length > 0) {
      await mutar(
        d => ({ ...d, alunos: [...d.alunos, ...alunosNovos], matriculas: [...d.matriculas, ...matriculasNovas] }),
        [
          ...alunosNovos.map(a => ({ tabela: 'alunos', tipo: 'INSERT' as const, registro: a })),
          ...matriculasNovas.map(m => ({ tabela: 'matriculas', tipo: 'INSERT' as const, registro: m })),
        ],
        `${matriculasNovas.length} estudante(s) adicionado(s)`
      );
    }
    return { adicionados: matriculasNovas.length, duplicados };
  }, [mutar]);

  const setOrigemDoAluno = useCallback(async (matriculaId: string, origemId: string) => {
    const mat = dadosRef.current.matriculas.find(m => m.matricula_id === matriculaId);
    if (!mat) return;
    const atualizada = { ...mat, origem_id: origemId };
    await mutar(
      d => ({ ...d, matriculas: d.matriculas.map(m => (m.matricula_id === matriculaId ? atualizada : m)) }),
      [{ tabela: 'matriculas', tipo: 'UPDATE', registro: atualizada, campos: ['origem_id'] }]
    );
  }, [mutar]);

  // ------------------------------------------------------------------
  // Ações: registros de supervisão
  // ------------------------------------------------------------------

  const addOrientacao = useCallback(async (matriculaId: string, categoria: string, texto: string, status: Orientacao['status'] = 'ABERTA') => {
    const agora = agoraIso();
    const nova: Orientacao = { orientacao_id: novoId('ori'), matricula_id: matriculaId, data_hora: agora, categoria, texto, status, criado_em: agora, atualizado_em: agora };
    await mutar(d => ({ ...d, orientacoes: [nova, ...d.orientacoes] }), [{ tabela: 'orientacoes', tipo: 'INSERT', registro: nova }], 'Orientação registrada');
  }, [mutar]);

  const addOrientacaoGrupo = useCallback(async (grupoId: string, categoria: string, texto: string) => {
    const ids = dadosRef.current.grupoIntegrantes.filter(gi => gi.grupo_id === grupoId).map(gi => gi.matricula_id!).filter(Boolean);
    const agora = agoraIso();
    const novas: Orientacao[] = ids.map(matricula_id => ({
      orientacao_id: novoId('ori'), matricula_id, data_hora: agora, categoria, texto: `[Grupo] ${texto}`,
      status: 'ABERTA', criado_em: agora, atualizado_em: agora,
    }));
    await mutar(d => ({ ...d, orientacoes: [...novas, ...d.orientacoes] }),
      novas.map(n => ({ tabela: 'orientacoes', tipo: 'INSERT' as const, registro: n })),
      `Orientação registrada para ${novas.length} integrante(s)`);
  }, [mutar]);

  const toggleOrientacaoStatus = useCallback(async (orientacaoId: string) => {
    const ori = dadosRef.current.orientacoes.find(o => o.orientacao_id === orientacaoId);
    if (!ori) return;
    const atualizada: Orientacao = { ...ori, status: ori.status === 'ABERTA' ? 'CONCLUÍDA' : 'ABERTA', atualizado_em: agoraIso() };
    await mutar(d => ({ ...d, orientacoes: d.orientacoes.map(o => (o.orientacao_id === orientacaoId ? atualizada : o)) }),
      [{ tabela: 'orientacoes', tipo: 'UPDATE', registro: atualizada, campos: ['status', 'atualizado_em'] }],
      atualizada.status === 'ABERTA' ? 'Orientação reaberta' : 'Orientação concluída');
  }, [mutar]);

  const addFeedback = useCallback(async (matriculaId: string, texto: string) => {
    const agora = agoraIso();
    const novo = {
      feedback_id: novoId('fb'), periodo_id: selectedPeriodoId, turma_id: turmaDe(matriculaId), escopo: 'INDIVIDUAL',
      matricula_id: matriculaId, data: hojeIso, data_hora: agora, categoria: 'Supervisão', texto,
      incluir_na_devolutiva: true, criado_em: agora, atualizado_em: agora,
    };
    await mutar(d => ({ ...d, feedbacks: [novo, ...d.feedbacks] }), [{ tabela: 'feedbacks', tipo: 'INSERT', registro: novo }], 'Feedback registrado');
  }, [mutar, selectedPeriodoId, hojeIso]);

  const addOcorrencia = useCallback(async (matriculaId: string, tipo: Ocorrencia['tipo'], observacao: string) => {
    const nova: Ocorrencia = { ocorrencia_id: novoId('oc'), matricula_id: matriculaId, data_hora: agoraIso(), tipo, observacao };
    await mutar(d => ({ ...d, ocorrencias: [nova, ...d.ocorrencias] }), [{ tabela: 'ocorrencias', tipo: 'INSERT', registro: nova }], 'Ocorrência registrada');
  }, [mutar]);

  const addPontoAcompanhamento = useCallback(async (matriculaId: string, texto: string, prioridade: PontoAcompanhamento['prioridade'] = 'MEDIA') => {
    const novo: PontoAcompanhamento = {
      ponto_id: novoId('pt'), matricula_id: matriculaId, texto, status: 'ATIVO', prioridade, data_criacao: hojeIso, atualizado_em: hojeIso,
    };
    await mutar(d => ({ ...d, pontosAcompanhamento: [novo, ...d.pontosAcompanhamento] }),
      [{ tabela: 'pontos_acompanhamento', tipo: 'INSERT', registro: novo }], 'Ponto de acompanhamento criado');
  }, [mutar, hojeIso]);

  const togglePontoStatus = useCallback(async (pontoId: string) => {
    const ponto = dadosRef.current.pontosAcompanhamento.find(p => p.ponto_id === pontoId);
    if (!ponto) return;
    const concluir = ponto.status === 'ATIVO';
    const atualizado: PontoAcompanhamento = { ...ponto, status: concluir ? 'CONCLUIDO' : 'ATIVO', atualizado_em: hojeIso, data_conclusao: concluir ? hojeIso : '' };
    await mutar(d => ({ ...d, pontosAcompanhamento: d.pontosAcompanhamento.map(p => (p.ponto_id === pontoId ? atualizado : p)) }),
      [{ tabela: 'pontos_acompanhamento', tipo: 'UPDATE', registro: atualizado, campos: ['status', 'atualizado_em', 'data_conclusao'] }],
      concluir ? 'Ponto concluído' : 'Ponto reaberto');
  }, [mutar, hojeIso]);

  // ------------------------------------------------------------------
  // Ações: frequência
  // ------------------------------------------------------------------

  const salvarChamada = useCallback(async (turmaId: string, dataAula: string, marcacoes: Record<string, MarcacaoChamada>) => {
    const d0 = dadosRef.current;
    const agora = agoraIso();
    const alunosTurma = alunosPorTurma.get(turmaId) || [];
    const horario = d0.horarios.find(h => h.turma_id === turmaId && h.ativo);
    const horaAula = horario?.hora_inicio || '08:00';
    const origemPadrao = d0.turmasOrigem.find(o => o.turma_id === turmaId && o.ativo)?.origem_id || '';
    const freqs: Frequencia[] = [];
    const ocorrenciasNovas: Ocorrencia[] = [];
    const ocorrenciasRemover: Ocorrencia[] = [];
    let faltas = 0;

    for (const { matricula } of alunosTurma) {
      const id = matricula.matricula_id;
      const m = marcacoes[id] || { faltou: false, atraso: false, celular: false };
      const existente = d0.frequencias.find(f => f.matricula_id === id && f.data_aula === dataAula);
      let status: Frequencia['status'] = 'PRESENTE';
      if (m.faltou) {
        faltas++;
        status = existente?.status === 'FALTA_JUSTIFICADA' ? 'FALTA_JUSTIFICADA'
          : m.justificativa ? 'JUSTIFICATIVA_PENDENTE' : 'FALTA_SEM_JUSTIFICATIVA';
      }
      freqs.push({
        frequencia_id: existente?.frequencia_id || novoId('freq'),
        matricula_id: id,
        data_aula: dataAula,
        status,
        justificativa: m.faltou ? (m.justificativa || existente?.justificativa || '') : '',
        origem_id: existente?.origem_id || matricula.origem_id || origemPadrao,
        atraso: !m.faltou && m.atraso,
        celular: !m.faltou && m.celular,
        observacao: m.observacao || '',
        criado_em: existente?.criado_em || agora,
        atualizado_em: agora,
      });
      // Ocorrências da chamada têm id fixo por aluno/data: salvar de novo não duplica.
      for (const [marcado, tipo, sufixo] of [[m.atraso, 'ATRASO', 'atraso'], [m.celular, 'USO_INADEQUADO_DISPOSITIVO', 'celular']] as const) {
        const ocorrenciaId = `oc-${id}-${dataAula}-${sufixo}`;
        const anterior = d0.ocorrencias.find(o => o.ocorrencia_id === ocorrenciaId);
        if (marcado && !m.faltou) {
          ocorrenciasNovas.push({
            ocorrencia_id: ocorrenciaId, matricula_id: id, data_hora: `${dataAula}T${horaAula}:00`, tipo,
            observacao: m.observacao || (tipo === 'ATRASO' ? 'Chegou após o início da supervisão' : 'Uso de celular durante a supervisão'),
          });
        } else if (anterior) {
          ocorrenciasRemover.push(anterior);
        }
      }
    }

    const encontroExistente = d0.encontros.find(e => e.turma_id === turmaId && e.data === dataAula);
    const encontro: EncontroTurma = {
      ...encontroExistente,
      encontro_id: encontroExistente?.encontro_id || `aula-${dataAula}-${turmaId}`,
      turma_id: turmaId,
      periodo_id: d0.turmas.find(t => t.turma_id === turmaId)?.periodo_id || selectedPeriodoId,
      data: dataAula,
      status: 'REALIZADO',
      chamada_salva: true,
      total_presentes: alunosTurma.length - faltas,
      total_faltas: faltas,
      atualizado_em: agora,
      fonte: encontroExistente?.fonte || 'APP',
    };
    const idsNovas = new Set(ocorrenciasNovas.map(o => o.ocorrencia_id));
    const idsRemover = new Set(ocorrenciasRemover.map(o => o.ocorrencia_id));

    await mutar(
      d => ({
        ...d,
        frequencias: [...d.frequencias.filter(f => !(f.data_aula === dataAula && freqs.some(n => n.matricula_id === f.matricula_id))), ...freqs],
        ocorrencias: [...ocorrenciasNovas, ...d.ocorrencias.filter(o => !idsNovas.has(o.ocorrencia_id) && !idsRemover.has(o.ocorrencia_id))],
        encontros: [...d.encontros.filter(e => !(e.turma_id === turmaId && e.data === dataAula)), encontro],
      }),
      [
        ...freqs.map(f => ({ tabela: 'frequencias', tipo: 'INSERT' as const, registro: f })),
        ...ocorrenciasNovas.map(o => ({ tabela: 'ocorrencias', tipo: 'INSERT' as const, registro: o })),
        ...ocorrenciasRemover.map(o => ({ tabela: 'ocorrencias', tipo: 'DELETE' as const, registro: o })),
        { tabela: 'encontros_turma', tipo: encontroExistente ? 'UPDATE' : 'INSERT', registro: encontro,
          campos: encontroExistente ? ['status', 'chamada_salva', 'total_presentes', 'total_faltas', 'atualizado_em'] : undefined },
      ],
      `Chamada salva: ${alunosTurma.length - faltas} presentes, ${faltas} falta(s)`
    );
    return { presentes: alunosTurma.length - faltas, faltas };
  }, [alunosPorTurma, mutar, selectedPeriodoId]);

  const atualizarFrequencia = useCallback(async (matriculaId: string, dataAula: string, status: Frequencia['status'], justificativa?: string) => {
    const d0 = dadosRef.current;
    const existente = d0.frequencias.find(f => f.matricula_id === matriculaId && f.data_aula === dataAula);
    const mat = d0.matriculas.find(m => m.matricula_id === matriculaId);
    const agora = agoraIso();
    const registro: Frequencia = {
      ...(existente || {}),
      frequencia_id: existente?.frequencia_id || novoId('freq'),
      matricula_id: matriculaId,
      data_aula: dataAula,
      status,
      justificativa: justificativa ?? existente?.justificativa ?? '',
      origem_id: existente?.origem_id || mat?.origem_id || '',
      criado_em: existente?.criado_em || agora,
      atualizado_em: agora,
    };
    await mutar(
      d => ({ ...d, frequencias: [...d.frequencias.filter(f => !(f.matricula_id === matriculaId && f.data_aula === dataAula)), registro] }),
      [{ tabela: 'frequencias', tipo: existente ? 'UPDATE' : 'INSERT', registro, campos: existente ? ['status', 'justificativa', 'atualizado_em'] : undefined }],
      'Frequência atualizada'
    );
  }, [mutar]);

  const decidirJustificativa = useCallback(async (frequenciaId: string, aceita: boolean) => {
    const f = dadosRef.current.frequencias.find(x => x.frequencia_id === frequenciaId);
    if (!f) return;
    await atualizarFrequencia(f.matricula_id, f.data_aula, aceita ? 'FALTA_JUSTIFICADA' : 'FALTA_SEM_JUSTIFICATIVA', f.justificativa);
  }, [atualizarFrequencia]);

  // ------------------------------------------------------------------
  // Ações: documentos (aba entregas)
  // ------------------------------------------------------------------

  const atualizarEntregas = useCallback(async (entregaIds: string[], situacao: SituacaoEntrega) => {
    const ids = new Set(entregaIds);
    const status = TEXTO_STATUS_ENTREGA[situacao];
    const alvo = dadosRef.current.entregas.filter(e => ids.has(String(e.entrega_id)));
    if (alvo.length === 0) return;
    const atualizadas = alvo.map(e => ({ ...e, status, status_entrega: status, situacao }));
    await mutar(
      d => ({ ...d, entregas: d.entregas.map(e => atualizadas.find(a => a.entrega_id === e.entrega_id) || e) }),
      atualizadas.map(e => ({ tabela: 'entregas', tipo: 'UPDATE' as const, registro: e, campos: ['status'] })),
      alvo.length === 1 ? `Documento marcado como "${status}"` : `${alvo.length} documentos marcados como "${status}"`
    );
  }, [mutar]);

  const addEntrega = useCallback(async (matriculaId: string, tipo: string, situacao: SituacaoEntrega = 'PENDENTE') => {
    const status = TEXTO_STATUS_ENTREGA[situacao];
    const nova: Entrega = {
      entrega_id: novoId('ent'), periodo_id: selectedPeriodoId, turma_id: turmaDe(matriculaId), matricula_id: matriculaId,
      codigo_entrega: tipo, tipo_entrega: tipo, tipo_documento: tipo, escopo: 'INDIVIDUAL', status, status_entrega: status,
      situacao, data_envio: situacao === 'ENTREGUE' ? hojeIso : '', origem: 'APP',
    };
    await mutar(d => ({ ...d, entregas: [...d.entregas, nova] }), [{ tabela: 'entregas', tipo: 'INSERT', registro: nova }], 'Documento adicionado');
  }, [mutar, selectedPeriodoId, hojeIso]);

  // ------------------------------------------------------------------
  // Ações: notas e devolutivas
  // ------------------------------------------------------------------

  const saveAvaliacao = useCallback(async (matriculaId: string, criterioId: string, nota: number, observacao = '') => {
    const existente = dadosRef.current.avaliacoes.find(a => a.matricula_id === matriculaId && a.criterio_id === criterioId);
    const registro: Avaliacao = { ...(existente || {}), avaliacao_id: existente?.avaliacao_id || novoId('av'), matricula_id: matriculaId, criterio_id: criterioId, nota, observacao };
    await mutar(
      d => ({ ...d, avaliacoes: [...d.avaliacoes.filter(a => a.avaliacao_id !== registro.avaliacao_id), registro] }),
      [{ tabela: 'avaliacoes', tipo: existente ? 'UPDATE' : 'INSERT', registro, campos: existente ? ['nota', 'observacao'] : undefined }],
      'Nota salva'
    );
  }, [mutar]);

  const salvarAvaliacaoCompleta = useCallback(async (entrada: Partial<AvaliacaoCompleta> & Pick<AvaliacaoCompleta, 'matricula_id' | 'turma_id' | 'instrumento_id'>) => {
    const existente = entrada.avaliacao_id ? dadosRef.current.avaliacoesCompletas.find(a => a.avaliacao_id === entrada.avaliacao_id) : undefined;
    const registro: AvaliacaoCompleta = {
      tipo_instrumento: 'RUBRICA', nota_final: 0, nota_maxima: 10, status: 'RASCUNHO',
      ...existente, ...entrada,
      avaliacao_id: entrada.avaliacao_id || novoId('avc'),
      aluno_id: entrada.aluno_id || dadosRef.current.matriculas.find(m => m.matricula_id === entrada.matricula_id)?.aluno_id,
      atualizado_em: agoraIso(),
    } as AvaliacaoCompleta;
    await mutar(
      d => ({ ...d, avaliacoesCompletas: [...d.avaliacoesCompletas.filter(a => a.avaliacao_id !== registro.avaliacao_id), registro] }),
      [{ tabela: 'avaliacoes_completas', tipo: existente ? 'UPDATE' : 'INSERT', registro }],
      'Avaliação salva'
    );
    return registro;
  }, [mutar]);

  const mudarStatusDevolutiva = useCallback(async (avaliacaoId: string, mudancas: Partial<AvaliacaoCompleta>, mensagem: string) => {
    const a = dadosRef.current.avaliacoesCompletas.find(x => x.avaliacao_id === avaliacaoId);
    if (!a) return;
    const registro = { ...a, ...mudancas, atualizado_em: agoraIso() };
    await mutar(
      d => ({ ...d, avaliacoesCompletas: d.avaliacoesCompletas.map(x => (x.avaliacao_id === avaliacaoId ? registro : x)) }),
      [{ tabela: 'avaliacoes_completas', tipo: 'UPDATE', registro, campos: [...Object.keys(mudancas), 'atualizado_em'] }],
      mensagem
    );
  }, [mutar]);

  const aprovarDevolutiva = useCallback((id: string) =>
    mudarStatusDevolutiva(id, { status: 'APROVADO_ENVIO', data_aprovacao: hojeIso }, 'Devolutiva aprovada'), [mudarStatusDevolutiva, hojeIso]);
  const registrarEnvioDevolutiva = useCallback((id: string) =>
    mudarStatusDevolutiva(id, { status: 'ENVIADO', data_envio: hojeIso }, 'Envio registrado'), [mudarStatusDevolutiva, hojeIso]);

  // ------------------------------------------------------------------
  // Ações: aulas, reagendamentos e estudo dirigido
  // ------------------------------------------------------------------

  const encontroBase = (turmaId: string, data: string): EncontroTurma => {
    const existente = dadosRef.current.encontros.find(e => e.turma_id === turmaId && e.data === data);
    return {
      ...existente,
      encontro_id: existente?.encontro_id || `aula-${data}-${turmaId}`,
      turma_id: turmaId,
      periodo_id: dadosRef.current.turmas.find(t => t.turma_id === turmaId)?.periodo_id || selectedPeriodoId,
      data,
      status: existente?.status || 'PREVISTO',
      fonte: existente?.fonte || 'APP',
      atualizado_em: agoraIso(),
    };
  };

  const marcarEncontroNaoRealizado = useCallback(async (turmaId: string, data: string, motivo: string, observacao = '') => {
    const encontro: EncontroTurma = { ...encontroBase(turmaId, data), status: 'NAO_REALIZADO', motivo_nao_realizado: motivo, observacao };
    await mutar(d => ({ ...d, encontros: [...d.encontros.filter(e => !(e.turma_id === turmaId && e.data === data)), encontro] }),
      [{ tabela: 'encontros_turma', tipo: 'INSERT', registro: encontro }], 'Aula marcada como não realizada');
  }, [mutar, selectedPeriodoId]);

  const reagendarEncontro = useCallback(async (turmaId: string, dataOriginal: string, novaData: string, novoHorario?: string, motivo = 'Reagendamento') => {
    const horario = dadosRef.current.horarios.find(h => h.turma_id === turmaId && h.ativo);
    const original: EncontroTurma = {
      ...encontroBase(turmaId, dataOriginal), status: 'REAGENDADO', motivo_nao_realizado: motivo,
      data_reagendada: novaData, hora_reagendada: novoHorario || horario?.hora_inicio || '',
    };
    const nova: EncontroTurma = {
      ...encontroBase(turmaId, novaData), status: 'PREVISTO', data_original: dataOriginal,
      hora_inicio: novoHorario || horario?.hora_inicio || '', hora_fim: horario?.hora_fim || '',
      observacao: `Reposição da aula de ${dataOriginal.split('-').reverse().join('/')}`,
    };
    await mutar(
      d => ({ ...d, encontros: [...d.encontros.filter(e => !(e.turma_id === turmaId && (e.data === dataOriginal || e.data === novaData))), original, nova] }),
      [{ tabela: 'encontros_turma', tipo: 'INSERT', registro: original }, { tabela: 'encontros_turma', tipo: 'INSERT', registro: nova }],
      'Aula reagendada'
    );
  }, [mutar, selectedPeriodoId]);

  const dispensarChamada = useCallback(async (turmaId: string, data: string) => {
    const encontro: EncontroTurma = {
      ...encontroBase(turmaId, data), status: 'REALIZADO', chamada_salva: true,
      observacao: 'Chamada registrada fora do app (Docente Online).',
    };
    await mutar(d => ({ ...d, encontros: [...d.encontros.filter(e => !(e.turma_id === turmaId && e.data === data)), encontro] }),
      [{ tabela: 'encontros_turma', tipo: 'INSERT', registro: encontro }], 'Chamada marcada como feita no Docente Online');
  }, [mutar, selectedPeriodoId]);

  const reverterEncontro = useCallback(async (turmaId: string, data: string) => {
    const d0 = dadosRef.current;
    const encontro = d0.encontros.find(e => e.turma_id === turmaId && e.data === data);
    if (!encontro) return;
    const remover = [encontro];
    if (encontro.status === 'REAGENDADO' && encontro.data_reagendada) {
      const reposicao = d0.encontros.find(e => e.turma_id === turmaId && e.data === encontro.data_reagendada && !e.chamada_salva);
      if (reposicao) remover.push(reposicao);
    }
    await mutar(
      d => ({ ...d, encontros: d.encontros.filter(e => !remover.includes(e)) }),
      remover.map(e => ({ tabela: 'encontros_turma', tipo: 'DELETE' as const, registro: e })),
      'Aula voltou a ficar prevista'
    );
  }, [mutar]);

  const atualizarStatusEstudoDirigido = useCallback(async (
    leituraId: string, status: NonNullable<LeituraResponsavel['status_realizacao']>, efetivos?: string[], motivo?: string
  ) => {
    const leitura = dadosRef.current.leiturasResponsaveis.find(l => l.leitura_id === leituraId);
    if (!leitura) return;
    const atualizada: LeituraResponsavel = {
      ...leitura,
      status_realizacao: status,
      responsaveis_efetivos: efetivos ?? leitura.responsaveis_efetivos ?? [],
      motivo_substituicao: motivo ?? leitura.motivo_substituicao ?? '',
    };
    await mutar(
      d => ({ ...d, leiturasResponsaveis: d.leiturasResponsaveis.map(l => (l.leitura_id === leituraId ? atualizada : l)) }),
      [{ tabela: 'leituras_responsaveis', tipo: 'UPDATE', registro: atualizada, campos: ['status_realizacao', 'responsaveis_efetivos', 'motivo_substituicao'] }],
      'Estudo dirigido registrado'
    );
  }, [mutar]);

  // ------------------------------------------------------------------
  // Ações: casos para discutir e tarefas
  // ------------------------------------------------------------------

  const addCaso = useCallback(async (turmaId: string, dados_: { alvo_tipo: 'ALUNO' | 'GRUPO' | 'TURMA'; alvo_id?: string; alvo_nome: string; texto: string }) => {
    const agora = agoraIso();
    const caso: PreparacaoAula = {
      preparacao_id: novoId('caso'), turma_id: turmaId, periodo_id: selectedPeriodoId, data_aula: hojeIso, tipo: 'CASO',
      texto: dados_.texto, status: 'AGUARDANDO', alvo_tipo: dados_.alvo_tipo, alvo_id: dados_.alvo_id || '', alvo_nome: dados_.alvo_nome,
      ordem: dadosRef.current.preparacoesAula.filter(p => p.turma_id === turmaId).length + 1, criado_em: agora, atualizado_em: agora,
    };
    await mutar(d => ({ ...d, preparacoesAula: [...d.preparacoesAula, caso] }), [{ tabela: 'preparacoes_aula', tipo: 'INSERT', registro: caso }], 'Caso adicionado à fila');
  }, [mutar, selectedPeriodoId, hojeIso]);

  const marcarCasoDiscutido = useCallback(async (preparacaoId: string, discutido: boolean) => {
    const caso = dadosRef.current.preparacoesAula.find(p => p.preparacao_id === preparacaoId);
    if (!caso) return;
    const atualizado = { ...caso, status: discutido ? 'DISCUTIDO' : 'AGUARDANDO', atualizado_em: agoraIso() };
    await mutar(d => ({ ...d, preparacoesAula: d.preparacoesAula.map(p => (p.preparacao_id === preparacaoId ? atualizado : p)) }),
      [{ tabela: 'preparacoes_aula', tipo: 'UPDATE', registro: atualizado, campos: ['status', 'atualizado_em'] }],
      discutido ? 'Caso discutido' : 'Caso voltou para a fila');
  }, [mutar]);

  const addTarefa = useCallback(async (entrada: Partial<Tarefa> & { titulo: string }) => {
    const agora = agoraIso();
    const tarefa: Tarefa = {
      prioridade: 'MEDIA', duracao_minutos: 5, status: 'PENDENTE', origem: 'MANUAL', ...entrada,
      id: '', titulo: entrada.titulo.trim(), criado_em: agora, atualizado_em: agora,
    };
    tarefa.id = tarefa.tarefa_id = novoId('tf');
    await mutar(d => ({ ...d, tarefas: [tarefa, ...d.tarefas] }), [{ tabela: 'tarefas_professora', tipo: 'INSERT', registro: tarefa }], 'Lembrete guardado');
  }, [mutar]);

  const toggleTarefa = useCallback(async (id: string) => {
    const t = dadosRef.current.tarefas.find(x => x.id === id);
    if (!t) return;
    const atualizada: Tarefa = { ...t, status: t.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO', atualizado_em: agoraIso() };
    await mutar(d => ({ ...d, tarefas: d.tarefas.map(x => (x.id === id ? atualizada : x)) }),
      [{ tabela: 'tarefas_professora', tipo: 'UPDATE', registro: atualizada, campos: ['status', 'atualizado_em'] }],
      atualizada.status === 'CONCLUIDO' ? 'Feito ✓' : 'Lembrete reaberto');
  }, [mutar]);

  // ------------------------------------------------------------------
  // Exclusão com confirmação e desfazer
  // ------------------------------------------------------------------

  const solicitarExclusao = useCallback((pedido: PedidoExclusao) => setPedidoExclusao(pedido), []);
  const cancelarExclusao = useCallback(() => setPedidoExclusao(null), []);

  const confirmarExclusao = useCallback(async () => {
    const pedido = pedidoExclusao;
    if (!pedido) return;
    setPedidoExclusao(null);
    const campo = CAMPO_DA_TABELA[pedido.tabela];
    const chave = CHAVE_DA_TABELA[pedido.tabela];
    const id = pedido.registro[chave];
    await mutar(
      d => ({ ...d, [campo]: (d[campo] as any[]).filter(r => r[chave] !== id) }),
      [{ tabela: pedido.tabela, tipo: 'DELETE', registro: pedido.registro }],
      `${pedido.nome} excluído(a)`
    );
    setUltimaExclusao(pedido);
  }, [pedidoExclusao, mutar]);

  const desfazerExclusao = useCallback(async () => {
    const pedido = ultimaExclusao;
    if (!pedido) return;
    setUltimaExclusao(null);
    const campo = CAMPO_DA_TABELA[pedido.tabela];
    await mutar(
      d => ({ ...d, [campo]: [pedido.registro, ...(d[campo] as any[])] }),
      [{ tabela: pedido.tabela, tipo: 'INSERT', registro: pedido.registro }],
      'Exclusão desfeita'
    );
  }, [ultimaExclusao, mutar]);

  const dispensarDesfazer = useCallback(() => setUltimaExclusao(null), []);

  const exportDatabaseAsJson = useCallback(() => JSON.stringify({
    exportado_em: agoraIso(), planilha: OFFICIAL_SPREADSHEET_ID, dados: dadosRef.current,
  }, null, 2), []);

  const precisaReconectar = Boolean(currentUser) && !temToken;

  const value: SupervisaoContextType = {
    periodos: dados.periodos,
    disciplinas: dados.disciplinas,
    turmas: dados.turmas,
    horariosTurma: dados.horarios,
    turmasOrigem: dados.turmasOrigem,
    alunos: dados.alunos,
    matriculas: dados.matriculas,
    criterios: dados.criterios,
    orientacoes: dados.orientacoes,
    configuracoes: dados.configuracoes,
    marcosAcademicos: dados.marcos,
    pontosAcompanhamento: dados.pontosAcompanhamento,
    frequencias: dados.frequencias,
    registrosSemanais: dados.registrosSemanais,
    avaliacoes: dados.avaliacoes,
    feedbacks,
    ocorrencias: dados.ocorrencias,
    regrasRss: dados.regrasRss,
    calendarioRss: dados.calendarioRss,
    statusRssUnidades: dados.statusRssUnidades,
    situacaoAtualTurmas: dados.situacaoAtualTurmas,
    leiturasResponsaveis: dados.leiturasResponsaveis,
    gruposPratica: dados.gruposPratica,
    grupoIntegrantes: dados.grupoIntegrantes,
    entregas: dados.entregas,
    encontrosTurma: dados.encontros,
    avaliacoesCompletas: dados.avaliacoesCompletas,
    casosDiscussao,
    tarefas: dados.tarefas,
    selectedPeriodoId,
    setSelectedPeriodoId,
    periodoAtual,
    spreadsheetId: OFFICIAL_SPREADSHEET_ID,
    spreadsheetName: OFFICIAL_SPREADSHEET_NAME,
    spreadsheetUrl: OFFICIAL_SPREADSHEET_URL,
    currentUser,
    authVerificado,
    isLoggingIn,
    loginGoogle,
    logoutGoogle,
    hasLocalCache,
    connectionStatus,
    connectionErrorMessage,
    syncStatusState,
    precisaReconectar,
    sincronizarAgora,
    aviso,
    limparAviso: () => setAviso(null),
    agora,
    hojeIso,
    addTurma,
    updateTurma,
    toggleArchiveTurma,
    createNovoPeriodo,
    importarAlunosLote,
    setOrigemDoAluno,
    addOrientacao,
    addOrientacaoGrupo,
    toggleOrientacaoStatus,
    addFeedback,
    addOcorrencia,
    addPontoAcompanhamento,
    togglePontoStatus,
    salvarChamada,
    atualizarFrequencia,
    decidirJustificativa,
    atualizarEntregas,
    addEntrega,
    saveAvaliacao,
    salvarAvaliacaoCompleta,
    aprovarDevolutiva,
    registrarEnvioDevolutiva,
    marcarEncontroNaoRealizado,
    reagendarEncontro,
    reverterEncontro,
    dispensarChamada,
    atualizarStatusEstudoDirigido,
    addCaso,
    marcarCasoDiscutido,
    addTarefa,
    toggleTarefa,
    solicitarExclusao,
    pedidoExclusao,
    confirmarExclusao,
    cancelarExclusao,
    ultimaExclusao,
    desfazerExclusao,
    dispensarDesfazer,
    getTurmasDoPeriodo,
    getAlunosDaTurma,
    getResumoAlunoSupervisao,
    getSituacaoRssEstudante,
    getRssDaTurma,
    getGrupoDoAluno,
    isTurmaClinicaAmpliada,
    getCriteriosDaTurma,
    getOrigemDoAluno,
    getAulasDoDia,
    getLeiturasDoEncontro,
    getResponsaveisLeitura,
    supervisaoAtual,
    proximaSupervisao,
    pendencias,
    exportDatabaseAsJson,
  };

  return <SupervisaoContext.Provider value={value}>{children}</SupervisaoContext.Provider>;
};

export const useSupervisao = () => {
  const context = useContext(SupervisaoContext);
  if (!context) throw new Error('useSupervisao deve ser usado dentro de um SupervisaoProvider');
  return context;
};
